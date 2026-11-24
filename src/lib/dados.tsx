import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useApi } from './auth';
import { ErroApi } from './api';
import type { Integrante } from './tipos';

type Contexto = {
  integrantes: Integrante[];
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
  aplicar: (i: Integrante) => void;
};

const Dados = createContext<Contexto | null>(null);

/** Os integrantes são lidos uma vez e reaproveitados pelas telas. */
export function ProvedorDados({ children }: { children: ReactNode }) {
  const api = useApi();
  const [integrantes, setIntegrantes] = useState<Integrante[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await api<Integrante[]>('integrantes.listar');
      lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      setIntegrantes(lista);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível carregar os integrantes.');
    } finally {
      setCarregando(false);
    }
  }, [api]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const aplicar = useCallback((salvo: Integrante) => {
    setIntegrantes((atual) => {
      const i = atual.findIndex((x) => x.id === salvo.id);
      const novo = i === -1 ? [...atual, salvo] : atual.map((x) => (x.id === salvo.id ? salvo : x));
      return novo.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    });
  }, []);

  return (
    <Dados.Provider value={{ integrantes, carregando, erro, recarregar, aplicar }}>{children}</Dados.Provider>
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
