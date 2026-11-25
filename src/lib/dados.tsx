import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useApi, useAuth } from './auth';
import { ErroApi } from './api';
import { gravar, ler as lerLocal, limparRascunhosAntigos } from './local';
import type { Integrante, Usuario } from './tipos';

export type Config = { justificativaAtiva: boolean; rankingDe: string; rankingAte: string };

const CACHE_INTEGRANTES = 'sge:integrantes';
const CACHE_CONFIG = 'sge:config';

type Contexto = {
  integrantes: Integrante[];
  config: Config;
  salvarConfig: (c: Partial<Config>) => Promise<void>;
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
  aplicar: (i: Integrante) => void;
  semRede: boolean;
};

const Dados = createContext<Contexto | null>(null);

/** Os integrantes são lidos uma vez e reaproveitados pelas telas. */
export function ProvedorDados({ children }: { children: ReactNode }) {
  const api = useApi();
  const { atualizarUsuario, sair } = useAuth();
  const [integrantes, setIntegrantes] = useState<Integrante[]>(() => lerLocal<Integrante[]>(CACHE_INTEGRANTES) ?? []);
  const [config, setConfig] = useState<Config>(() => lerLocal<Config>(CACHE_CONFIG) ?? { justificativaAtiva: false, rankingDe: '', rankingAte: '' });
  const [semRede, setSemRede] = useState(false);
  const [carregando, setCarregando] = useState(() => !lerLocal<Integrante[]>(CACHE_INTEGRANTES)?.length);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setErro(null);
    try {
      // Uma chamada só: quem é o chefe, os integrantes e a configuração.
      // Em um Apps Script ainda não atualizado, cai para as chamadas antigas.
      let r: { usuario?: Usuario; integrantes: Integrante[]; config: Config };
      try {
        r = await api<{ usuario: Usuario; integrantes: Integrante[]; config: Config }>('inicio');
      } catch (e) {
        if (!(e instanceof ErroApi) || !/Ação desconhecida/i.test(e.message)) throw e;
        const [integrantesAntigo, configAntiga] = await Promise.all([
          api<Integrante[]>('integrantes.listar'),
          api<Config>('config.ler').catch(() => ({ justificativaAtiva: false, rankingDe: '', rankingAte: '' })),
        ]);
        r = { integrantes: integrantesAntigo, config: configAntiga };
      }

      const lista = [...r.integrantes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      setIntegrantes(lista);
      setConfig(r.config);
      if (r.usuario) atualizarUsuario(r.usuario);
      gravar(CACHE_INTEGRANTES, lista);
      gravar(CACHE_CONFIG, r.config);
      setSemRede(false);
    } catch (e) {
      // Sem internet, o app segue com a última cópia baixada.
      const guardados = lerLocal<Integrante[]>(CACHE_INTEGRANTES);
      if (e instanceof ErroApi && e.codigo === 'SEM_REDE' && guardados?.length) {
        setIntegrantes(guardados);
        setSemRede(true);
      } else if (e instanceof ErroApi && (e.codigo === 'NAO_AUTORIZADO' || e.codigo === 'LOGIN_EXPIRADO' || e.codigo === 'LOGIN_INVALIDO')) {
        sair();
      } else {
        setErro(e instanceof ErroApi ? e.message : 'Não foi possível carregar os integrantes.');
      }
    } finally {
      setCarregando(false);
    }
  }, [api, atualizarUsuario, sair]);

  useEffect(() => {
    limparRascunhosAntigos();
    void recarregar();
  }, [recarregar]);

  const aplicar = useCallback((salvo: Integrante) => {
    setIntegrantes((atual) => {
      const i = atual.findIndex((x) => x.id === salvo.id);
      const novo = i === -1 ? [...atual, salvo] : atual.map((x) => (x.id === salvo.id ? salvo : x));
      return novo.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    });
  }, []);

  const salvarConfig = useCallback(
    async (mudanca: Partial<Config>) => {
      setConfig(await api<Config>('config.salvar', mudanca));
    },
    [api],
  );

  return (
    <Dados.Provider value={{ integrantes, config, salvarConfig, carregando, erro, recarregar, aplicar, semRede }}>
      {children}
    </Dados.Provider>
  );
}

export function useDados(): Contexto {
  const ctx = useContext(Dados);
  if (!ctx) throw new Error('useDados precisa estar dentro de ProvedorDados.');
  return ctx;
}

export function hojeISO(): string {
  const agora = new Date();
  const fuso = new Date(agora.getTime() - agora.getTimezoneOffset() * 60_000);
  return fuso.toISOString().slice(0, 10);
}

export function porExtenso(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  if (!a || !m || !d) return iso;
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
