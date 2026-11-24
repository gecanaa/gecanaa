import { useEffect, useMemo, useState } from 'react';
import { useApi } from '../lib/auth';
import { ErroApi } from '../lib/api';
import { hojeISO, useDados } from '../lib/dados';
import { ordenarRamos, ramo as corDoRamo } from '../lib/ramos';
import { Carregando, Erro, Vazio } from '../components/Estados';

type Pessoa = {
  idIntegrante: string;
  nome: string;
  ramo: string;
  presente: number;
  falta: number;
  justificada: number;
  total: number;
  percentual: number;
};

type Resumo = { chamadas: number; pessoas: Pessoa[] };

function mesesAtras(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

export function Relatorio() {
  const api = useApi();
  const { integrantes } = useDados();

  const [de, setDe] = useState(mesesAtras(3));
  const [ate, setAte] = useState(hojeISO());
  const [filtroRamo, setFiltroRamo] = useState('');
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const ramos = useMemo(() => ordenarRamos(integrantes.map((i) => i.ramo)), [integrantes]);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setErro(null);
    api<Resumo>('presencas.resumo', { de, ate, ramo: filtroRamo })
      .then((r) => {
        if (!cancelado) setResumo(r);
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof ErroApi ? e.message : 'Não foi possível montar o relatório.');
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [api, de, ate, filtroRamo]);

  const media = useMemo(() => {
    if (!resumo?.pessoas.length) return 0;
    const soma = resumo.pessoas.reduce((t, p) => t + p.percentual, 0);
    return Math.round(soma / resumo.pessoas.length);
  }, [resumo]);

  const ordenadas = useMemo(
    () => [...(resumo?.pessoas ?? [])].sort((a, b) => a.percentual - b.percentual || a.nome.localeCompare(b.nome, 'pt-BR')),
    [resumo],
  );

  return (
    <main className="pb-10">
      <div className="nao-imprime border-b border-line bg-card px-4 py-4">
        <h1 className="font-display text-xl font-[600] tracking-tight">Relatório de presença</h1>

        <div className="mt-3 flex gap-3">
          <label className="flex-1">
            <span className="text-[12.5px] text-muted">De</span>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[15px]" />
          </label>
          <label className="flex-1">
            <span className="text-[12.5px] text-muted">Até</span>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[15px]" />
          </label>
        </div>

        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip ativo={!filtroRamo} cor="var(--color-ouro)" onClick={() => setFiltroRamo('')}>
            Todos os ramos
          </Chip>
          {ramos.map((n) => (
            <Chip key={n} ativo={filtroRamo === n} cor={corDoRamo(n).cor} onClick={() => setFiltroRamo(n)}>
              {n}
            </Chip>
          ))}
        </div>
      </div>

      {erro ? <Erro mensagem={erro} /> : null}
      {carregando ? <Carregando texto="Somando as chamadas" /> : null}

      {!carregando && resumo && resumo.pessoas.length === 0 ? (
        <Vazio titulo="Nenhuma chamada no período" convite="Aumente o intervalo de datas ou escolha outro ramo." />
      ) : null}

      {!carregando && resumo && resumo.pessoas.length > 0 ? (
        <>
          <section className="px-4 pt-5">
            <h2 className="hidden font-display text-lg font-[700] print:block">
              Presença de {formatar(de)} a {formatar(ate)}
              {filtroRamo ? ` · ${filtroRamo}` : ''}
            </h2>
            <div className="flex gap-3">
              <Cartao numero={String(resumo.chamadas)} rotulo={resumo.chamadas === 1 ? 'chamada' : 'chamadas'} />
              <Cartao numero={`${media}%`} rotulo="presença média" />
              <Cartao numero={String(resumo.pessoas.length)} rotulo="pessoas" />
            </div>
            <p className="nao-imprime mt-3 text-[13px] leading-relaxed text-muted">
              Em ordem de menor presença — quem precisa de atenção aparece primeiro.
            </p>
          </section>

          <ul className="mt-4">
            {ordenadas.map((p) => {
              const r = corDoRamo(p.ramo);
              return (
                <li key={(p.idIntegrante || p.nome) + p.ramo} className="border-b border-line px-4 py-3" style={{ borderLeft: `4px solid ${r.cor}` }}>
                  <div className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{p.nome}</span>
                    <span className="font-display text-[16px] font-[700]" style={{ color: p.percentual >= 75 ? 'var(--color-presente)' : p.percentual >= 50 ? 'var(--color-justificada)' : 'var(--color-falta)' }}>
                      {p.percentual}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-card-alto">
                    <div className="h-full rounded-full" style={{ width: `${p.percentual}%`, background: r.cor }} />
                  </div>
                  <p className="mt-1.5 text-[12.5px] text-muted">
                    {p.presente} presenças · {p.falta} faltas · {p.justificada} justificadas · {p.total} chamadas
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="nao-imprime px-4 pt-6">
            <button type="button" onClick={() => window.print()} className="w-full rounded-full bg-ouro py-2.5 text-[15px] font-semibold text-preto">
              Imprimir ou salvar em PDF
            </button>
            <p className="mt-2 text-center text-[12.5px] text-muted">
              No celular, escolha "Salvar como PDF" no destino da impressão.
            </p>
          </div>
        </>
      ) : null}
    </main>
  );
}

function Cartao({ numero, rotulo }: { numero: string; rotulo: string }) {
  return (
    <div className="flex-1 rounded-xl bg-card px-3 py-3">
      <p className="font-display text-[1.6rem] leading-none font-[700] text-ouro">{numero}</p>
      <p className="mt-1 text-[12px] text-muted">{rotulo}</p>
    </div>
  );
}

function Chip({ ativo, cor, onClick, children }: { ativo: boolean; cor: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className="shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold"
      style={ativo ? { background: cor, color: 'var(--color-preto)' } : { color: 'var(--color-texto)', boxShadow: `inset 0 0 0 1.5px ${cor}` }}
    >
      {children}
    </button>
  );
}

function formatar(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
