import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useApi, useAuth } from './auth';
import { ErroApi } from './api';
import {
  enfileirarGravacao,
  enviarGravacoes,
  gravacoesPendentes,
  gravar,
  ler as lerLocal,
  limparRascunhosAntigos,
} from './local';
import type { Integrante, Usuario } from './tipos';

export type Config = {
  justificativaAtiva: boolean;
  rankingDe: string;
  rankingAte: string;
  mensalidadeValor: number;
  /** Chave PIX do grupo, usada nas mensagens de cobrança. */
  chavePix: string;
};

const CACHE_INTEGRANTES = 'sge:integrantes';
const CACHE_CONFIG = 'sge:config';

type Contexto = {
  integrantes: Integrante[];
  config: Config;
  salvarConfig: (c: Partial<Config>) => Promise<Config>;
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
  aplicar: (i: Integrante) => void;
  semRede: boolean;
  /** Confirma na tela e manda para a planilha depois. */
  gravarDepois: (action: string, id: string, payload: Record<string, unknown>, descricao: string) => void;
  sincronizar: () => Promise<void>;
  gravacoesNaFila: number;
  erroDeEnvio: string | null;
};

const Dados = createContext<Contexto | null>(null);

/** Os integrantes são lidos uma vez e reaproveitados pelas telas. */
export function ProvedorDados({ children }: { children: ReactNode }) {
  const api = useApi();
  const { atualizarUsuario, sair } = useAuth();
  const [integrantes, setIntegrantes] = useState<Integrante[]>(() => lerLocal<Integrante[]>(CACHE_INTEGRANTES) ?? []);
  const [config, setConfig] = useState<Config>(() => lerLocal<Config>(CACHE_CONFIG) ?? { justificativaAtiva: false, rankingDe: '', rankingAte: '', mensalidadeValor: 0, chavePix: '' });
  const [semRede, setSemRede] = useState(false);
  const [gravacoesNaFila, setGravacoesNaFila] = useState(() => gravacoesPendentes().length);
  const [erroDeEnvio, setErroDeEnvio] = useState<string | null>(null);
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
          api<Config>('config.ler').catch(() => ({ justificativaAtiva: false, rankingDe: '', rankingAte: '', mensalidadeValor: 0, chavePix: '' })),
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

  const sincronizar = useCallback(async () => {
    if (!gravacoesPendentes().length) return;
    const r = await enviarGravacoes((g) => api(g.action, g.payload));
    setGravacoesNaFila(r.restantes);
    if (r.erro instanceof ErroApi && r.erro.codigo === 'SEM_REDE') {
      setErroDeEnvio(null);
    } else if (r.erro) {
      setErroDeEnvio(
        `${r.descricao ?? 'Uma gravação'} não foi aceita pela planilha: ${
          r.erro instanceof ErroApi ? r.erro.message : 'erro desconhecido'
        }`,
      );
    } else {
      setErroDeEnvio(null);
    }
  }, [api]);

  const gravarDepois = useCallback(
    (action: string, id: string, payload: Record<string, unknown>, descricao: string) => {
      enfileirarGravacao({ action, id, payload, descricao });
      setGravacoesNaFila(gravacoesPendentes().length);
      void sincronizar();
    },
    [sincronizar],
  );

  useEffect(() => {
    const aoVoltar = () => void sincronizar();
    window.addEventListener('online', aoVoltar);
    // Rede instável no acampamento: tenta de novo sozinho enquanto sobrar fila.
    const relogio = window.setInterval(() => {
      if (gravacoesPendentes().length) void sincronizar();
    }, 60_000);
    return () => {
      window.removeEventListener('online', aoVoltar);
      window.clearInterval(relogio);
    };
  }, [sincronizar]);

  useEffect(() => {
    limparRascunhosAntigos();
    void sincronizar();
    void recarregar();
  }, [recarregar, sincronizar]);

  const aplicar = useCallback((salvo: Integrante) => {
    setIntegrantes((atual) => {
      const i = atual.findIndex((x) => x.id === salvo.id);
      const novo = i === -1 ? [...atual, salvo] : atual.map((x) => (x.id === salvo.id ? salvo : x));
      return novo.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    });
  }, []);

  const salvarConfig = useCallback(
    async (mudanca: Partial<Config>) => {
      const salva = await api<Config>('config.salvar', mudanca);
      setConfig(salva);
      gravar(CACHE_CONFIG, salva);
      return salva;
    },
    [api],
  );

  return (
    <Dados.Provider
      value={{
        integrantes, config, salvarConfig, carregando, erro, recarregar, aplicar, semRede,
        gravarDepois, sincronizar, gravacoesNaFila, erroDeEnvio,
      }}
    >
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
