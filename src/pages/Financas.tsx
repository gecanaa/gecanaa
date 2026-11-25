import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nomeBonito } from '../lib/texto';
import { useApi, useAuth } from '../lib/auth';
import { ErroApi } from '../lib/api';
import { hojeISO, semAcento, useDados } from '../lib/dados';
import { ramo as corDoRamo } from '../lib/ramos';
import { Carregando, Erro, Vazio } from '../components/Estados';
import { Icone } from '../components/Icone';
import { Segmentado } from '../components/Segmentado';
import { reduzir } from '../lib/foto';
import { compartilharPDF, extratoPDF, reciboPDF } from '../lib/pdf';
import type { Integrante } from '../lib/tipos';

type Lancamento = {
  id: string;
  data: string;
  nome: string;
  tipo: string;
  categoria: string;
  mes: string;
  valor: number;
  metodo: string;
  registrado: string;
  observacao: string;
  idIntegrante: string;
  comprovante: string;
};

type Caixa = {
  lancamentos: Lancamento[];
  entradas: number;
  saidas: number;
  saldoPeriodo: number;
  saldoTotal: number;
  categorias: { tipo: string; categoria: string; total: number }[];
};

type Pagamento = {
  id: string;
  data: string;
  valor: number;
  metodo: string;
  comprovante: string;
  observacao: string;
  registrado: string;
};

type Pessoa = {
  id: string;
  nome: string;
  ramo: string;
  plano: string;
  esperado: number;
  pago: number;
  situacao: string;
  pagamentos?: Pagamento[];
};

type Mensalidades = {
  mes: string;
  mensalidadeCheia: number;
  recebido: number;
  esperado: number;
  pessoas: Pessoa[];
};

const CATEGORIAS_ENTRADA = ['Mensalidade', 'Lojinha/Bazar', 'Evento', 'Rifa', 'Doação', 'Outros'];
const CATEGORIAS_SAIDA = ['Material', 'Alimentação', 'Manutenção', 'Taxa UEB', 'Transporte', 'Outros'];
const METODOS = ['Transferência PIX', 'Dinheiro', 'Cartão', 'Outro'];

/** Resposta incompleta do servidor não pode derrubar a tela inteira. */
export const moeda = (v: number | undefined | null) =>
  (Number.isFinite(Number(v)) ? Number(v) : 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });

const mesAtual = () => hojeISO().slice(0, 7);
const primeiroDiaDoMes = () => `${mesAtual()}-01`;

export function Financas() {
  const { usuario } = useAuth();
  const api = useApi();
  const podeVer = usuario?.nivel === 'admin' || usuario?.nivel === 'financeiro';

  const [aba, setAba] = useState<'caixa' | 'mensalidades'>('caixa');

  if (!podeVer) {
    return (
      <main className="px-4 pt-6">
        <Vazio
          titulo="Finanças é da tesouraria"
          convite="Seu acesso não inclui o caixa. Um administrador pode mudar seu nível para financeiro na aba Usuarios da planilha."
        />
      </main>
    );
  }

  return (
    <main className="pb-24">
      <div className="border-b border-line bg-card px-4 py-3">
        <Segmentado
          rotulo="Vista das finanças"
          valor={aba}
          aoEscolher={setAba}
          opcoes={[
            ['caixa', 'Caixa'],
            ['mensalidades', 'Mensalidades'],
          ] as const}
        />
      </div>

      {aba === 'caixa' ? <Caixa_ api={api} /> : <MensalidadesTela api={api} />}
    </main>
  );
}

type Api = <T,>(action: string, payload?: unknown) => Promise<T>;

function Caixa_({ api }: { api: Api }) {
  const { integrantes } = useDados();
  const [de, setDe] = useState(primeiroDiaDoMes());
  const [ate, setAte] = useState(hojeISO());
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<Partial<Lancamento> | null>(null);
  const [gerando, setGerando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setCaixa(await api<Caixa>('financeiro.listar', { de, ate }));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível abrir o caixa.');
    } finally {
      setCarregando(false);
    }
  }, [api, de, ate]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const lancamentos = caixa?.lancamentos ?? [];
  const categorias = caixa?.categorias ?? [];

  const enviarExtrato = async () => {
    if (!caixa) return;
    setGerando(true);
    setErro(null);
    try {
      const pdf = await extratoPDF({ de, ate, ...caixa });
      await compartilharPDF(
        `extrato-canaa52-${de}-a-${ate}.pdf`,
        pdf,
        `Extrato do caixa de ${de.split('-').reverse().join('/')} a ${ate.split('-').reverse().join('/')} — Grupo Escoteiro Canaã 52/DF`,
      );
    } catch (e) {
      setErro('Não foi possível gerar o extrato.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <>
      <div className="flex gap-3 px-4 pt-4">
        <label className="flex-1">
          <span className="text-[12.5px] text-muted">De</span>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-[14px]" />
        </label>
        <label className="flex-1">
          <span className="text-[12.5px] text-muted">Até</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-[14px]" />
        </label>
      </div>

      {erro ? <Erro mensagem={erro} /> : null}
      {carregando ? <Carregando texto="Somando o caixa" /> : null}

      {caixa ? (
        <>
          <section className="px-4 pt-4">
            <div className="rounded-xl bg-card px-4 py-4">
              <p className="text-[12.5px] text-muted">Saldo do caixa, considerando tudo</p>
              <p className="font-display text-[2rem] leading-none font-[800]" style={{ color: caixa.saldoTotal < 0 ? 'var(--color-falta)' : 'var(--color-ouro)' }}>
                {moeda(caixa.saldoTotal)}
              </p>
              <div className="mt-3 flex gap-4 text-[13px]">
                <span className="text-presente">Entrou {moeda(caixa.entradas)}</span>
                <span className="text-falta">Saiu {moeda(caixa.saidas)}</span>
                <span className="text-muted">no período</span>
              </div>
            </div>
          </section>

          <div className="flex items-baseline justify-between gap-3 px-4 pt-5 pb-1">
            <p className="text-[13px] text-muted">
              {lancamentos.length} {lancamentos.length === 1 ? 'lançamento' : 'lançamentos'}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {lancamentos.length ? (
                <button
                  type="button"
                  onClick={() => void enviarExtrato()}
                  disabled={gerando}
                  aria-label="Extrato do período em PDF"
                  title="Extrato do período em PDF"
                  className="grid h-11 w-11 place-items-center rounded-full text-ouro shadow-[inset_0_0_0_1.5px_var(--color-ouro)] disabled:opacity-50"
                >
                  <Icone nome="imprimir" className="h-5 w-5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setEditando({ data: hojeISO(), tipo: 'Entrada', categoria: 'Mensalidade', metodo: 'Transferência PIX' })}
                className="rounded-full bg-ouro px-4 py-2 text-[14px] font-semibold text-preto"
              >
                Novo lançamento
              </button>
            </div>
          </div>

          {lancamentos.length === 0 ? (
            <Vazio titulo="Nada lançado neste período" convite="Mude as datas ou registre o primeiro lançamento." />
          ) : (
            <ul>
              {lancamentos.map((l) => {
                const saida = l.tipo.toLowerCase().startsWith('sa');
                return (
                  <li key={l.id} className="border-b border-line">
                    <button type="button" onClick={() => setEditando(l)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{nomeBonito(l.nome) || l.categoria}</span>
                        <span className="block truncate text-[12.5px] text-muted">
                          {l.comprovante ? '📎 ' : ''}
                          {formatarData(l.data)} · {l.categoria}
                          {l.mes && l.mes !== 'Não se aplica' ? ` · ${nomeDoMes(l.mes)}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 font-display text-[15px] font-[700]" style={{ color: saida ? 'var(--color-falta)' : 'var(--color-presente)' }}>
                        {saida ? '−' : '+'} {moeda(l.valor)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {categorias.length ? (
            <section className="px-4 pt-6">
              <h2 className="font-display text-[15px] font-[700]">Por categoria</h2>
              <ul className="mt-2 space-y-1.5 text-[14px]">
                {categorias.map((c) => (
                  <li key={c.tipo + c.categoria} className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1 truncate">
                      {c.categoria} <span className="text-[12px] text-muted">{c.tipo}</span>
                    </span>
                    <span style={{ color: c.tipo === 'Saída' ? 'var(--color-falta)' : 'var(--color-presente)' }}>{moeda(c.total)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      {editando ? (
        <FormularioLancamento
          api={api}
          integrantes={integrantes}
          inicial={editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={(salvo) => {
            setEditando(null);
            if (!salvo) {
              void carregar();
              return;
            }
            setCaixa((atual) =>
              atual
                ? {
                    ...atual,
                    lancamentos: [salvo, ...atual.lancamentos.filter((x) => x.id !== salvo.id)].sort((a, b) =>
                      a.data < b.data ? 1 : -1,
                    ),
                  }
                : atual,
            );
            window.setTimeout(() => void carregar(), 4000);
          }}
        />
      ) : null}
    </>
  );
}

function FormularioLancamento({
  api,
  integrantes,
  inicial,
  aoFechar,
  aoSalvar,
}: {
  api: Api;
  integrantes: Integrante[];
  inicial: Partial<Lancamento>;
  aoFechar: () => void;
  /** Sem argumento quando o lançamento foi excluído. */
  aoSalvar: (salvo?: Lancamento) => void;
}) {
  const { gravarDepois } = useDados();
  const [l, setL] = useState<Partial<Lancamento>>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [enviandoComprovante, setEnviandoComprovante] = useState(false);
  const [gerandoRecibo, setGerandoRecibo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState(inicial.nome ?? '');
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  const anexar = async (arquivo: File) => {
    setEnviandoComprovante(true);
    setErro(null);
    try {
      const imagem = await reduzir(arquivo, 1400);
      const r = await api<{ url: string }>('foto.enviar', {
        imagem,
        tipo: 'recibo',
        nome: `comprovante ${l.categoria || ''} ${l.nome || ''}`.trim(),
      });
      setL((atual) => ({ ...atual, comprovante: r.url }));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível enviar o comprovante.');
    } finally {
      setEnviandoComprovante(false);
    }
  };

  const saida = (l.tipo ?? 'Entrada').toLowerCase().startsWith('sa');
  const categorias = saida ? CATEGORIAS_SAIDA : CATEGORIAS_ENTRADA;
  const ehMensalidade = (l.categoria ?? '').toLowerCase().startsWith('mensalidade');

  const sugestoes = useMemo(() => {
    const termo = semAcento(busca.trim());
    if (!termo || termo === semAcento(l.nome ?? '')) return [];
    return integrantes.filter((i) => semAcento(i.nome).includes(termo)).slice(0, 6);
  }, [busca, integrantes, l.nome]);

  // Confirma na hora; a planilha recebe em segundo plano.
  const guardar = () => {
    if (!Number(l.valor)) {
      setErro('Informe um valor maior que zero.');
      return;
    }
    const registro = {
      ...l,
      id: l.id || String(Date.now()),
      mes: ehMensalidade ? l.mes || mesAtual() : 'Não se aplica',
    };
    gravarDepois('financeiro.salvar', registro.id, registro as unknown as Record<string, unknown>,
      `O lançamento de ${moeda(Number(registro.valor))}`);
    aoSalvar(registro as Lancamento);
  };

  const enviarRecibo = async () => {
    setGerandoRecibo(true);
    setErro(null);
    try {
      const pdf = await reciboPDF({
        numero: String(l.id ?? ''),
        data: l.data ?? '',
        nome: l.nome ?? '',
        tipo: l.tipo ?? 'Entrada',
        categoria: l.categoria ?? '',
        mes: l.mes && l.mes !== 'Não se aplica' ? nomeDoMes(l.mes) : '',
        valor: Number(l.valor ?? 0),
        metodo: l.metodo ?? '',
        registrado: l.registrado ?? '',
        observacao: l.observacao ?? '',
      });
      const quem = (l.nome ?? 'recibo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await compartilharPDF(
        `recibo-${quem || 'canaa52'}-${l.data ?? ''}.pdf`,
        pdf,
        `Recibo do Grupo Escoteiro Canaã 52/DF — ${l.categoria ?? ''}`,
      );
    } catch (e) {
      setErro('Não foi possível gerar o recibo.');
    } finally {
      setGerandoRecibo(false);
    }
  };

  const excluir = async () => {
    if (!l.id) return;
    setSalvando(true);
    setErro(null);
    try {
      await api('financeiro.excluir', { id: l.id });
      aoSalvar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível excluir.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-center sm:p-6" onClick={aoFechar} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={l.id ? 'Editar lançamento' : 'Novo lançamento'}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t-2 border-ouro bg-card px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-2xl"
      >
        <h2 className="font-display text-[1.15rem] font-[700]">{l.id ? 'Lançamento' : 'Novo lançamento'}</h2>

        {erro ? <Erro mensagem={erro} /> : null}

        <div className="mt-4 flex gap-2">
          {['Entrada', 'Saída'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setL({ ...l, tipo: t, categoria: '' })}
              aria-pressed={(l.tipo ?? '') === t}
              className="flex-1 rounded-full py-2 text-[14px] font-semibold"
              style={
                (l.tipo ?? '') === t
                  ? { background: t === 'Saída' ? 'var(--color-falta)' : 'var(--color-presente)', color: 'var(--color-preto)' }
                  : { boxShadow: 'inset 0 0 0 1.5px var(--color-line)' }
              }
            >
              {t}
            </button>
          ))}
        </div>

        <label className="mt-3 block">
          <span className="text-[12.5px] text-muted">Valor</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={l.valor ?? ''}
            onChange={(e) => setL({ ...l, valor: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 font-display text-[20px] font-[700]"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-[12.5px] text-muted">Data</span>
          <input type="date" value={l.data ?? hojeISO()} onChange={(e) => setL({ ...l, data: e.target.value })} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[15px]" />
        </label>

        <div className="mt-3">
          <span className="text-[12.5px] text-muted">Categoria</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {categorias.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setL({ ...l, categoria: c })}
                aria-pressed={l.categoria === c}
                className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
                style={l.categoria === c ? { background: 'var(--color-ouro)', color: 'var(--color-preto)' } : { boxShadow: 'inset 0 0 0 1.5px var(--color-line)' }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {ehMensalidade ? (
          <label className="mt-3 block">
            <span className="text-[12.5px] text-muted">Mês de referência</span>
            <input type="month" value={l.mes && l.mes !== 'Não se aplica' ? l.mes : mesAtual()} onChange={(e) => setL({ ...l, mes: e.target.value })} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[15px]" />
          </label>
        ) : null}

        <label className="mt-3 block">
          <span className="text-[12.5px] text-muted">{saida ? 'Pago a' : 'Recebido de'}</span>
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setL({ ...l, nome: e.target.value, idIntegrante: '' });
            }}
            placeholder="Nome"
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[15px]"
          />
        </label>
        {sugestoes.length ? (
          <ul className="mt-1 overflow-hidden rounded-lg border border-line">
            {sugestoes.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => {
                    setL({ ...l, nome: i.nome.trim(), idIntegrante: i.id });
                    setBusca(i.nome.trim());
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px]"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: corDoRamo(i.ramo).cor }} />
                  <span className="truncate">{i.nome.trim()}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-3">
          <span className="text-[12.5px] text-muted">Forma</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {METODOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setL({ ...l, metodo: m })}
                aria-pressed={l.metodo === m}
                className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
                style={l.metodo === m ? { background: 'var(--color-ouro)', color: 'var(--color-preto)' } : { boxShadow: 'inset 0 0 0 1.5px var(--color-line)' }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 border-t border-line pt-3.5">
          <span className="text-[12.5px] text-muted">Comprovante</span>
          <input
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void anexar(f);
            }}
          />
          <input
            ref={galeria}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void anexar(f);
            }}
          />

          {l.comprovante ? (
            <div className="mt-2 flex items-center gap-3">
              <a href={l.comprovante} target="_blank" rel="noopener" className="shrink-0">
                <img src={l.comprovante} alt="Comprovante anexado" className="h-16 w-16 rounded-lg object-cover" />
              </a>
              <button type="button" onClick={() => setL({ ...l, comprovante: '' })} className="text-[13.5px] font-semibold text-falta underline">
                Remover
              </button>
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => camera.current?.click()}
                disabled={enviandoComprovante}
                className="flex-1 rounded-full border border-line py-2 text-[13.5px] font-semibold disabled:opacity-60"
              >
                {enviandoComprovante ? 'Enviando…' : 'Tirar foto'}
              </button>
              <button
                type="button"
                onClick={() => galeria.current?.click()}
                disabled={enviandoComprovante}
                className="flex-1 rounded-full border border-line py-2 text-[13.5px] font-semibold disabled:opacity-60"
              >
                Escolher imagem
              </button>
            </div>
          )}
        </div>

        <label className="mt-3 block">
          <span className="text-[12.5px] text-muted">Observação</span>
          <input value={l.observacao ?? ''} onChange={(e) => setL({ ...l, observacao: e.target.value })} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[15px]" />
        </label>

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={aoFechar} className="rounded-full border border-line px-5 py-2.5 text-[15px] font-semibold">
            Cancelar
          </button>
          <button type="button" onClick={guardar} className="flex-1 rounded-full bg-ouro py-2.5 text-[15px] font-semibold text-preto">
            Salvar
          </button>
        </div>
        {l.id ? (
          <>
            <button
              type="button"
              onClick={() => void enviarRecibo()}
              disabled={gerandoRecibo}
              className="mt-3 w-full rounded-full border border-ouro py-2.5 text-[14px] font-semibold text-ouro disabled:opacity-60"
            >
              {gerandoRecibo ? 'Gerando recibo…' : 'Recibo em PDF para o WhatsApp'}
            </button>
            <button type="button" onClick={() => void excluir()} disabled={salvando} className="mt-3 w-full text-[13.5px] font-semibold text-falta underline">
              Excluir este lançamento
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function MensalidadesTela({ api }: { api: Api }) {
  const { integrantes } = useDados();
  const [mes, setMes] = useState(mesAtual());
  const [dados, setDados] = useState<Mensalidades | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [soDevendo, setSoDevendo] = useState(false);
  const [lancando, setLancando] = useState<Partial<Lancamento> | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setDados(await api<Mensalidades>('mensalidades.mes', { mes }));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível abrir as mensalidades.');
    } finally {
      setCarregando(false);
    }
  }, [api, mes]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const lista = useMemo(
    () => (dados?.pessoas ?? []).filter((p) => !soDevendo || p.situacao === 'Em aberto' || p.situacao === 'Parcial'),
    [dados, soDevendo],
  );

  // Abre o lançamento já preenchido: o chefe ainda escolhe forma de
  // pagamento, anexa o comprovante e ajusta o valor, se for o caso.
  const abrirRecebimento = (pessoa: Pessoa) =>
    setLancando({
      data: hojeISO(),
      nome: pessoa.nome,
      idIntegrante: pessoa.id,
      tipo: 'Entrada',
      categoria: 'Mensalidade',
      mes,
      valor: Math.max(0, pessoa.esperado - pessoa.pago),
      metodo: 'Transferência PIX',
      observacao: `Mensalidade ${nomeDoMes(mes)}`,
    });

  return (
    <>
      <div className="px-4 pt-4">
        <label className="block">
          <span className="text-[12.5px] text-muted">Mês</span>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-[15px]" />
        </label>
      </div>

      {erro ? <Erro mensagem={erro} /> : null}
      {carregando ? <Carregando texto="Conferindo as mensalidades" /> : null}

      {dados ? (
        <>
          <section className="px-4 pt-4">
            {dados.mensalidadeCheia === 0 ? (
              <div className="mb-3 rounded-xl border-l-4 border-justificada bg-card px-4 py-3.5">
                <p className="font-display text-[15px] font-[700]">Falta dizer quanto custa a mensalidade</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
                  Enquanto o valor cheio não for definido, o sistema não tem como calcular quem deve o quê. Defina em
                  <strong className="text-texto"> Conta → Mensalidade cheia</strong>; a partir dele, Integral paga o
                  valor inteiro, Desconto 50% paga metade e Isento não paga.
                </p>
              </div>
            ) : null}
            <div className="flex gap-3">
              <div className="flex-1 rounded-xl bg-card px-3 py-3">
                <p className="font-display text-[1.4rem] leading-none font-[700] text-presente">{moeda(dados.recebido)}</p>
                <p className="mt-1 text-[12px] text-muted">recebido</p>
              </div>
              <div className="flex-1 rounded-xl bg-card px-3 py-3">
                <p className="font-display text-[1.4rem] leading-none font-[700] text-ouro">{moeda(dados.esperado)}</p>
                <p className="mt-1 text-[12px] text-muted">previsto</p>
              </div>
            </div>
            {dados.mensalidadeCheia === 0 ? (
              <p className="mt-3 rounded-lg border-l-4 border-justificada bg-card px-3 py-2.5 text-[13px] leading-relaxed">
                O valor da mensalidade ainda não foi definido. Um administrador configura em Conta, e aí cada plano
                financeiro da ficha passa a calcular sozinho.
              </p>
            ) : null}
            <label className="mt-3 flex items-center gap-2 text-[13px] text-muted">
              <input type="checkbox" checked={soDevendo} onChange={(e) => setSoDevendo(e.target.checked)} className="h-4 w-4 accent-[var(--color-ouro)]" />
              Mostrar só quem está devendo
            </label>
          </section>

          {lista.length === 0 ? (
            <Vazio titulo="Ninguém em aberto" convite="Todo mundo com mensalidade prevista já pagou este mês." />
          ) : (
            <ul className="mt-3">
              {lista.map((p) => {
                const cor =
                  p.situacao === 'Pago' ? 'var(--color-presente)'
                  : p.situacao === 'Parcial' ? 'var(--color-justificada)'
                  : p.situacao === 'Isento' || p.situacao === 'Sem valor' ? 'var(--color-muted)'
                  : 'var(--color-falta)';
                const pagamentos = p.pagamentos ?? [];
                return (
                  <li key={p.id} className="border-b border-line px-4 py-3" style={{ borderLeft: `4px solid ${corDoRamo(p.ramo).cor}` }}>
                    <div className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{nomeBonito(p.nome)}</span>
                        <span className="block text-[12.5px] text-muted">
                          {p.plano}
                          {p.situacao === 'Sem valor' ? ' · valor não definido' : ` · previsto ${moeda(p.esperado)}`}
                          {p.pago > 0 ? ` · pago ${moeda(p.pago)}` : ''}
                        </span>
                      </span>
                      {p.situacao === 'Isento' || p.situacao === 'Sem valor' ? (
                        <span className="shrink-0 text-[13px] font-semibold" style={{ color: cor }}>
                          {p.situacao}
                        </span>
                      ) : p.situacao === 'Pago' ? (
                        <span className="shrink-0 text-[13px] font-semibold" style={{ color: cor }}>
                          Pago
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => abrirRecebimento(p)}
                          className="shrink-0 rounded-full bg-ouro px-3.5 py-1.5 text-[13px] font-semibold text-preto"
                        >
                          Receber {moeda(p.esperado - p.pago)}
                        </button>
                      )}
                    </div>

                    {pagamentos.length ? (
                      <ul className="mt-2 space-y-1">
                        {pagamentos.map((pg) => (
                          <li key={pg.id}>
                            <button
                              type="button"
                              onClick={() => setLancando({ ...pg, nome: p.nome, idIntegrante: p.id, tipo: 'Entrada', categoria: 'Mensalidade', mes })}
                              className="flex w-full items-center gap-2 rounded-lg bg-card-alto px-3 py-2 text-left text-[12.5px]"
                            >
                              <span className="text-presente">{moeda(pg.valor)}</span>
                              <span className="min-w-0 flex-1 truncate text-muted">
                                {formatarData(pg.data)} · {pg.metodo || 'forma não informada'}
                                {pg.registrado ? ` · ${pg.registrado}` : ''}
                              </span>
                              {pg.comprovante ? <span aria-label="tem comprovante">📎</span> : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}

      {lancando ? (
        <FormularioLancamento
          api={api}
          integrantes={integrantes}
          inicial={lancando}
          aoFechar={() => setLancando(null)}
          aoSalvar={() => {
            setLancando(null);
            window.setTimeout(() => void carregar(), 4000);
          }}
        />
      ) : null}
    </>
  );
}

function formatarData(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : iso;
}

export function nomeDoMes(mes: string): string {
  const m = mes.match(/^(\d{4})-(\d{2})$/);
  if (!m) return mes;
  const nome = new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}
