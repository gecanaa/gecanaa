import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { chamar, ErroApi } from './api';
import { gravar, ler as lerLocal } from './local';
import type { Usuario } from './tipos';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const CHAVE_TOKEN = 'sge:sessao';
const CHAVE_USUARIO = 'sge:usuario';

type Contexto = {
  usuario: Usuario | null;
  token: string | null;
  carregando: boolean;
  erro: string | null;
  sair: () => void;
  montarBotao: (no: HTMLElement) => void;
  atualizarUsuario: (u: Usuario) => void;
};

const Auth = createContext<Contexto | null>(null);

type Credencial = { credential: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

/** Vale tanto para o token do Google (exp em segundos) quanto para a sessão deste sistema (exp em milissegundos). */
function expirado(token: string): boolean {
  try {
    const corpo = token.split('.')[1];
    const { exp } = JSON.parse(atob(corpo.replace(/-/g, '+').replace(/_/g, '/')));
    const quando = token.startsWith('s1.') ? Number(exp) : Number(exp) * 1000;
    return quando - 30_000 < Date.now();
  } catch {
    return true;
  }
}

export function ProvedorAuth({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const iniciado = useRef(false);

  const aceitar = useCallback(async (credencial: string) => {
    setErro(null);
    setCarregando(true);
    try {
      const u = await chamar<Usuario>('me', {}, credencial);
      let guardar = credencial;
      if (!credencial.startsWith('s1.')) {
        // Troca o login do Google por uma sessão longa, para não pedir acesso toda vez.
        try {
          const s = await chamar<{ token: string }>('sessao.criar', {}, credencial);
          guardar = s.token;
        } catch {
          guardar = credencial;
        }
      }
      localStorage.setItem(CHAVE_TOKEN, guardar);
      gravar(CHAVE_USUARIO, u);
      setToken(guardar);
      setUsuario(u);
    } catch (e) {
      // Sem rede, com sessão válida no aparelho, o app abre com o último acesso conhecido.
      const guardadoUsuario = lerLocal<Usuario>(CHAVE_USUARIO);
      if (e instanceof ErroApi && e.codigo === 'SEM_REDE' && guardadoUsuario && credencial.startsWith('s1.')) {
        setToken(credencial);
        setUsuario(guardadoUsuario);
        setErro(null);
        setCarregando(false);
        return;
      }
      localStorage.removeItem(CHAVE_TOKEN);
      setToken(null);
      setUsuario(null);
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível entrar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  // Carrega a biblioteca de login do Google e reaproveita a sessão da aba.
  useEffect(() => {
    let cancelado = false;

    const guardado = localStorage.getItem(CHAVE_TOKEN);
    const conhecido = lerLocal<Usuario>(CHAVE_USUARIO);
    if (guardado && !expirado(guardado) && conhecido) {
      // Sessão válida no aparelho: entra direto. Quem confere com o servidor
      // é a primeira leitura de dados, logo em seguida.
      setToken(guardado);
      setUsuario(conhecido);
      setCarregando(false);
    } else if (guardado && !expirado(guardado)) {
      void aceitar(guardado);
    } else {
      localStorage.removeItem(CHAVE_TOKEN);
      sessionStorage.removeItem('sge:token');
      setCarregando(false);
    }

    const tentarIniciar = () => {
      if (cancelado || iniciado.current) return;
      if (!window.google || !CLIENT_ID) {
        window.setTimeout(tentarIniciar, 150);
        return;
      }
      iniciado.current = true;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (r: Credencial) => void aceitar(r.credential),
        auto_select: true,
        use_fedcm_for_prompt: true,
      });
    };
    tentarIniciar();

    return () => {
      cancelado = true;
    };
  }, [aceitar]);

  const montarBotao = useCallback((no: HTMLElement) => {
    const tentar = () => {
      if (!window.google || !iniciado.current) {
        window.setTimeout(tentar, 150);
        return;
      }
      no.replaceChildren();
      window.google.accounts.id.renderButton(no, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        locale: 'pt-BR',
      });
    };
    tentar();
  }, []);

  const sair = useCallback(() => {
    window.google?.accounts.id.disableAutoSelect();
    localStorage.removeItem(CHAVE_TOKEN);
    localStorage.removeItem(CHAVE_USUARIO);
    setToken(null);
    setUsuario(null);
    setErro(null);
  }, []);

  const atualizarUsuario = useCallback((u: Usuario) => {
    gravar(CHAVE_USUARIO, u);
    setUsuario(u);
  }, []);

  return (
    <Auth.Provider value={{ usuario, token, carregando, erro, sair, montarBotao, atualizarUsuario }}>
      {children}
    </Auth.Provider>
  );
}

export function useAuth(): Contexto {
  const ctx = useContext(Auth);
  if (!ctx) throw new Error('useAuth precisa estar dentro de ProvedorAuth.');
  return ctx;
}

/** Chama a API já com o token do chefe logado. */
export function useApi() {
  const { token, sair } = useAuth();
  return useCallback(
    async <T,>(action: string, payload: unknown = {}): Promise<T> => {
      try {
        return await chamar<T>(action, payload, token);
      } catch (e) {
        if (e instanceof ErroApi && (e.codigo === 'LOGIN_EXPIRADO' || e.codigo === 'SEM_LOGIN')) sair();
        throw e;
      }
    },
    [token, sair],
  );
}
