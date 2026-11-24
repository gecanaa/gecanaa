import { useState } from 'react';
import { useApi, useAuth } from '../lib/auth';
import { ErroApi } from '../lib/api';
import { useDados } from '../lib/dados';
import { Erro } from '../components/Estados';

type Diagnostico = {
  integrantes: number;
  linhasPresenca: number;
  nomesDuplicados: string[][];
  presencasSemIntegrante: Record<string, number>;
  presencasRepetidas: string[];
  uebVencida: string[];
  semRamo: string[];
};

export function Conta() {
  const { usuario, sair } = useAuth();
  const { integrantes, recarregar } = useDados();
  const api = useApi();
  const [diag, setDiag] = useState<Diagnostico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rodando, setRodando] = useState(false);

  const rodar = async () => {
    setRodando(true);
    setErro(null);
    try {
      setDiag(await api<Diagnostico>('diagnostico'));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível rodar o diagnóstico.');
    } finally {
      setRodando(false);
    }
  };

  const ativos = integrantes.filter((i) => i.status === 'Ativo').length;

  return (
    <main className="px-4 pb-10 pt-5">
      <h1 className="font-display text-xl font-[600] tracking-tight">Conta</h1>

      <section className="mt-4 rounded-xl bg-card px-4 py-4">
        <p className="text-[15px] font-medium">{usuario?.nome}</p>
        <p className="text-[13px] text-muted">{usuario?.email}</p>
        <p className="mt-1 text-[13px] text-muted">
          Acesso: {usuario?.nivel === 'admin' ? 'administrador' : 'geral'}
        </p>
      </section>

      <section className="mt-4 rounded-xl bg-card px-4 py-4">
        <p className="font-display text-[15px] font-[700]">Quadro do grupo</p>
        <p className="mt-1.5 text-[14px] text-muted">
          {ativos} integrantes ativos de {integrantes.length} fichas.
        </p>
        <button type="button" onClick={() => void recarregar()} className="mt-3 text-[14px] font-semibold text-escoteiro underline">
          Recarregar da planilha
        </button>
      </section>

      {usuario?.nivel === 'admin' ? (
        <section className="mt-4 rounded-xl bg-card px-4 py-4">
          <p className="font-display text-[15px] font-[700]">Conferência dos dados</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
            Aponta nomes repetidos, chamadas duplicadas, registro UEB vencido e fichas sem ramo. Só lê a planilha,
            não altera nada.
          </p>
          <button
            type="button"
            onClick={() => void rodar()}
            disabled={rodando}
            className="mt-3 rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-paper disabled:opacity-60"
          >
            {rodando ? 'Conferindo' : 'Conferir agora'}
          </button>

          {diag ? (
            <div className="mt-4 space-y-3 text-[13.5px] leading-relaxed">
              <Bloco titulo="Registro UEB vencido" itens={diag.uebVencida} />
              <Bloco titulo="Fichas sem ramo" itens={diag.semRamo} />
              <Bloco titulo="Nomes repetidos entre fichas" itens={diag.nomesDuplicados.map((g) => g.join(' / '))} />
              <Bloco
                titulo="Presenças sem ficha correspondente"
                itens={Object.entries(diag.presencasSemIntegrante).map(([nome, n]) => `${nome} (${n}x)`)}
              />
              <Bloco titulo="Chamadas duplicadas (dia · ramo · pessoa)" itens={diag.presencasRepetidas.map((k) => k.replace(/\|/g, ' · '))} />
            </div>
          ) : null}
        </section>
      ) : null}

      {erro ? <Erro mensagem={erro} /> : null}

      <button type="button" onClick={sair} className="mt-6 w-full rounded-full border border-line py-2.5 text-[15px] font-semibold">
        Sair
      </button>
    </main>
  );
}

function Bloco({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <div>
      <p className="font-medium">
        {titulo} <span className="text-muted">({itens.length})</span>
      </p>
      {itens.length ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
          {itens.slice(0, 40).map((i) => (
            <li key={i}>{i}</li>
          ))}
          {itens.length > 40 ? <li>e mais {itens.length - 40}…</li> : null}
        </ul>
      ) : (
        <p className="mt-0.5 text-muted">Nada a corrigir.</p>
      )}
    </div>
  );
}
