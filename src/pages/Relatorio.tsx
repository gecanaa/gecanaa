import { useEffect, useMemo, useState } from 'react';
import { useApi } from '../lib/auth';
import { ErroApi } from '../lib/api';
import { hojeISO, useDados } from '../lib/dados';
import { ordenarRamos, ramo as corDoRamo } from '../lib/ramos';
import { useZoomLiberado } from '../lib/zoom';
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
  faltasSeguidas?: number;
  ultimaPresenca?: string;
};

type Resumo = { chamadas: number; pessoas: Pessoa[] };

function mesesAtras(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

export function Relatorio() {
  useZoomLiberado();
  const api = useApi();
  const { integrantes, config } = useDados();

  const [modo, setModo] = useState<'acompanhamento' | 'ranking'>('acompanhamento');
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

  const ordenadas = useMemo(() => {
    const lista = [...(resumo?.pessoas ?? [])];
    return modo === 'ranking'
      ? lista.sort((a, b) => b.percentual - a.percentual || b.presente - a.presente || a.nome.localeCompare(b.nome, 'pt-BR'))
      : lista.sort((a, b) => a.percentual - b.percentual || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [resumo, modo]);

  const podio = modo === 'ranking' ? ordenadas.slice(0, 3) : [];

  // Quem já soma três faltas, ou faltou nas três últimas seguidas, precisa de
  // um telefonema antes de virar desligamento.
  const emAlerta = useMemo(
    () =>
      (resumo?.pessoas ?? [])
        .filter((p) => p.falta >= 3 || (p.faltasSeguidas ?? 0) >= 3)
        .sort((a, b) => (b.faltasSeguidas ?? 0) - (a.faltasSeguidas ?? 0) || b.falta - a.falta),
    [resumo],
  );
  const temPremiacao = !!(config.rankingDe && config.rankingAte);
  const noPeriodoDaPremiacao = temPremiacao && de === config.rankingDe && ate === config.rankingAte;

  const usarPeriodoDaPremiacao = () => {
    if (!temPremiacao) return;
    setDe(config.rankingDe);
    setAte(config.rankingAte);
    setModo('ranking');
  };

  return (
    <main className="pb-10">
      <div className="nao-imprime border-b border-line bg-card px-4 py-4">
        <h1 className="font-display text-xl font-[600] tracking-tight">
          {modo === 'ranking' ? 'Ranking de assiduidade' : 'Relatório de presença'}
        </h1>

        <div className="mt-3 flex gap-2">
          {([
            ['acompanhamento', 'Acompanhamento'],
            ['ranking', 'Ranking'],
          ] as const).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setModo(valor)}
              aria-pressed={modo === valor}
              className="flex-1 rounded-full py-2 text-[14px] font-semibold"
              style={
                modo === valor
                  ? { background: 'var(--color-ouro)', color: 'var(--color-preto)' }
                  : { boxShadow: 'inset 0 0 0 1.5px var(--color-line)' }
              }
            >
              {rotulo}
            </button>
          ))}
        </div>

        {modo === 'ranking' && temPremiacao && !noPeriodoDaPremiacao ? (
          <button type="button" onClick={usarPeriodoDaPremiacao} className="mt-3 w-full rounded-lg border border-ouro/50 py-2 text-[13.5px] font-semibold text-ouro">
            Ver o período da premiação ({formatar(config.rankingDe)} a {formatar(config.rankingAte)})
          </button>
        ) : null}

        {modo === 'ranking' && noPeriodoDaPremiacao ? (
          <p className="mt-3 text-[13px] text-ouro">Período da premiação definido pelo grupo.</p>
        ) : null}

        {modo === 'ranking' && !temPremiacao ? (
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            Um administrador pode fixar o período da premiação em Conta, e aí todos os chefes veem o mesmo recorte.
          </p>
        ) : null}

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
              {modo === 'ranking' ? 'Ranking de assiduidade' : 'Presença'} de {formatar(de)} a {formatar(ate)}
              {filtroRamo ? ` · ${filtroRamo}` : ''}
            </h2>
            <div className="flex gap-3">
              <Cartao numero={String(resumo.chamadas)} rotulo={resumo.chamadas === 1 ? 'chamada' : 'chamadas'} />
              <Cartao numero={`${media}%`} rotulo="presença média" />
              <Cartao numero={String(resumo.pessoas.length)} rotulo="pessoas" />
            </div>
            <p className="nao-imprime mt-3 text-[13px] leading-relaxed text-muted">
              {modo === 'ranking'
                ? 'Em ordem de maior presença. O percentual compara cada um com as chamadas do seu ramo, então quem entrou depois não fica em desvantagem.'
                : 'Em ordem de menor presença — quem precisa de atenção aparece primeiro.'}
            </p>
          </section>

          {podio.length ? (
            <ol className="mt-4 px-4" aria-label="Três primeiros colocados">
              {podio.map((p, i) => {
                const r = corDoRamo(p.ramo);
                const medalhas = ['1º', '2º', '3º'];
                return (
                  <li
                    key={(p.idIntegrante || p.nome) + p.ramo}
                    className="mb-2 flex items-center gap-3.5 rounded-xl px-4 py-3.5"
                    style={{
                      background: i === 0 ? 'color-mix(in srgb, var(--color-ouro) 20%, var(--color-card))' : 'var(--color-card)',
                      boxShadow: i === 0 ? 'inset 0 0 0 1.5px var(--color-ouro)' : 'none',
                    }}
                  >
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-[15px] font-[800]"
                      style={{ background: i === 0 ? 'var(--color-ouro)' : 'var(--color-card-alto)', color: i === 0 ? 'var(--color-preto)' : 'var(--color-texto)' }}
                    >
                      {medalhas[i]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[16px] font-[700]">{p.nome}</span>
                      <span className="block text-[12.5px]" style={{ color: r.cor }}>
                        {p.ramo} · {p.presente} de {p.total} chamadas
                      </span>
                    </span>
                    <span className="font-display text-[22px] font-[800] text-ouro">{p.percentual}%</span>
                  </li>
                );
              })}
            </ol>
          ) : null}

          {modo === 'acompanhamento' && emAlerta.length ? (
            <section className="mx-4 mt-5 rounded-xl border-l-4 border-falta bg-card px-4 py-3.5">
              <h2 className="font-display text-[15px] font-[700]">
                Precisam de atenção <span className="font-sans text-[13px] font-normal text-muted">({emAlerta.length})</span>
              </h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                Três faltas no período, ou três chamadas seguidas sem aparecer.
              </p>
              <ul className="mt-2.5 space-y-2">
                {emAlerta.map((p) => (
                  <li key={(p.idIntegrante || p.nome) + p.ramo} className="flex items-baseline gap-3 text-[14px]">
                    <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                    <span className="shrink-0 text-[12.5px] text-muted">
                      {(p.faltasSeguidas ?? 0) >= 3 ? `${p.faltasSeguidas} seguidas` : `${p.falta} faltas`}
                      {p.ultimaPresenca ? ` · veio em ${formatar(p.ultimaPresenca)}` : ' · nunca veio'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <ul className={podio.length ? 'mt-3' : 'mt-4'}>
            {ordenadas.slice(podio.length).map((p, i) => {
              const r = corDoRamo(p.ramo);
              return (
                <li key={(p.idIntegrante || p.nome) + p.ramo} className="border-b border-line px-4 py-3" style={{ borderLeft: `4px solid ${r.cor}` }}>
                  <div className="flex items-baseline gap-3">
                    {modo === 'ranking' ? (
                      <span className="w-7 shrink-0 font-display text-[14px] font-[700] text-muted">{i + podio.length + 1}º</span>
                    ) : null}
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
                    {(p.faltasSeguidas ?? 0) >= 2 ? (
                      <span className="text-falta"> · {p.faltasSeguidas} seguidas</span>
                    ) : null}
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="nao-imprime px-4 pt-6">
            <button type="button" onClick={() => window.print()} className="w-full rounded-full bg-ouro py-2.5 text-[15px] font-semibold text-preto">
              {modo === 'ranking' ? 'Imprimir o ranking ou salvar em PDF' : 'Imprimir ou salvar em PDF'}
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
