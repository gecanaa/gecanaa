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
import { gravarUltima, lerUltima } from '../lib/local';
import { compartilhar } from '../lib/compartilhar';
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
  /** Quem pagou, quando não é o próprio integrante — em geral, os pais. */
  pagador: string;
  /** Centro de custo: acampamento, rifa, JOTA-JOTI. */
  atividade: string;
  /** Quem tirou do próprio bolso e espera devolução. */
  adiantadoPor: string;
  reembolsado: boolean;
  onde: 'Conta' | 'Espécie';
};

type Caixa = {
  lancamentos: Lancamento[];
  entradas: number;
  saidas: number;
  saldoPeriodo: number;
  saldoTotal: number;
  saldoConta: number;
  saldoEspecie: number;
  categorias: { tipo: string; categoria: string; total: number }[];
  atividades: { atividade: string; entradas: number; saidas: number; saldo: number; ultima: string }[];
  reembolsos: { id: string; data: string; quem: string; valor: number; categoria: string; nome: string }[];
  ultimoFechamento: { data: string; conta: number; especie: number; sistema: number; diferenca: number; por: string } | null;
};

type Devedores = {
  meses: string[];
  chavePix: string;
  pessoas: { id: string; nome: string; ramo: string; responsavel: string; telefone: string; mesesEmAberto: string[]; total: number }[];
};

type Pagamento = {
  id: string;
  data: string;
  valor: number;
  metodo: string;
  comprovante: string;
  observacao: string;
  registrado: string;
  pagador?: string;
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
  const chaveCache = `caixa|${de}|${ate}`;
  const [caixa, setCaixa] = useState<Caixa | null>(() => lerUltima<Caixa>(chaveCache));
  const [carregando, setCarregando] = useState(!caixa);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<Partial<Lancamento> | null>(null);
  const [gerando, setGerando] = useState(false);
  const [conferindo, setConferindo] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const novo = await api<Caixa>('financeiro.listar', { de, ate });
      setCaixa(novo);
      gravarUltima(chaveCache, novo);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível abrir o caixa.');
    } finally {
      setCarregando(false);
    }
  }, [api, de, ate, chaveCache]);

  useEffect(() => {
    const guardado = lerUltima<Caixa>(chaveCache);
    if (guardado) {
      setCaixa(guardado);
      setCarregando(false);
    }
    void carregar();
  }, [carregar, chaveCache]);

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
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-[13px]">
                <span>
                  <span className="block text-muted">Na conta</span>
                  <span className="font-display text-[15px] font-[700]">{moeda(caixa.saldoConta)}</span>
                </span>
                <span>
                  <span className="block text-muted">Em espécie</span>
                  <span className="font-display text-[15px] font-[700]">{moeda(caixa.saldoEspecie)}</span>
                </span>
              </div>
              <div className="mt-3 flex items-center gap-4 border-t border-line pt-3 text-[13px]">
                <span className="text-presente">+{moeda(caixa.entradas)}</span>
                <span className="text-falta">−{moeda(caixa.saidas)}</span>
                <span className="text-muted">no período</span>
                <button type="button" onClick={() => setConferindo(true)} className="ml-auto text-[13px] font-semibold text-ouro underline">
                  Conferir caixa
                </button>
              </div>
              {caixa.ultimoFechamento ? (
                <p className="mt-2 text-[12px] text-muted">
                  Última conferência em {formatarData(caixa.ultimoFechamento.data)}
                  {Math.abs(caixa.ultimoFechamento.diferenca) > 0.009 ? (
                    <span className="text-falta"> · diferença de {moeda(caixa.ultimoFechamento.diferenca)}</span>
                  ) : ' · sem diferença'}
                </p>
              ) : null}
            </div>

            {caixa.reembolsos.length ? (
              <div className="mt-3 rounded-xl border-l-4 border-justificada bg-card px-4 py-3.5">
                <p className="font-display text-[15px] font-[700]">
                  A devolver <span className="font-sans text-[13px] font-normal text-muted">({caixa.reembolsos.length})</span>
                </p>
                <ul className="mt-2 space-y-1.5 text-[13.5px]">
                  {caixa.reembolsos.map((r) => (
                    <li key={r.id} className="flex items-baseline gap-3">
                      <span className="min-w-0 flex-1 truncate">{nomeBonito(r.quem)}</span>
                      <span className="shrink-0 text-muted">{r.categoria}</span>
                      <span className="shrink-0 font-semibold">{moeda(r.valor)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {caixa.atividades.length ? (
              <div className="mt-3 rounded-xl bg-card px-4 py-3.5">
                <p className="font-display text-[15px] font-[700]">Por atividade</p>
                <ul className="mt-2 space-y-2 text-[13.5px]">
                  {caixa.atividades.map((a) => (
                    <li key={a.atividade}>
                      <div className="flex items-baseline gap-3">
                        <span className="min-w-0 flex-1 truncate">{a.atividade}</span>
                        <span
                          className="shrink-0 font-display font-[700]"
                          style={{ color: a.saldo < 0 ? 'var(--color-falta)' : 'var(--color-presente)' }}
                        >
                          {a.saldo >= 0 ? '+' : '−'} {moeda(Math.abs(a.saldo))}
                        </span>
                      </div>
                      <p className="text-[12px] text-muted">
                        entrou {moeda(a.entradas)} · saiu {moeda(a.saidas)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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

      {conferindo && caixa ? (
        <ConferirCaixa
          api={api}
          saldoDoSistema={caixa.saldoTotal}
          conta={caixa.saldoConta}
          especie={caixa.saldoEspecie}
          aoFechar={() => setConferindo(false)}
          aoConferir={() => {
            setConferindo(false);
            void carregar();
          }}
        />
      ) : null}

      {editando ? (
        <FormularioLancamento
          api={api}
          integrantes={integrantes}
          atividades={(caixa?.atividades ?? []).map((a) => a.atividade)}
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
  atividades,
  aoFechar,
  aoSalvar,
}: {
  api: Api;
  integrantes: Integrante[];
  inicial: Partial<Lancamento>;
  atividades: string[];
  aoFechar: () => void;
  /** Sem argumento quando o lançamento foi excluído. */
  aoSalvar: (salvo?: Lancamento) => void;
}) {
  const { gravarDepois } = useDados();
  const [l, setL] = useState<Partial<Lancamento>>(inicial);
  // Lançamento existente abre para leitura; editar é uma decisão, não um
  // toque sem querer em cima de dinheiro já registrado.
  const [editando, setEditando] = useState(!inicial.id);
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
    if (ehMensalidade && !l.idIntegrante) {
      setErro('Escolha de quem é a mensalidade.');
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
        nome: nomeBonito(l.nome ?? ''),
        tipo: l.tipo ?? 'Entrada',
        categoria: l.categoria ?? '',
        mes: l.mes && l.mes !== 'Não se aplica' ? nomeDoMes(l.mes) : '',
        valor: Number(l.valor ?? 0),
        metodo: l.metodo ?? '',
        registrado: l.registrado ?? '',
        observacao: l.observacao ?? '',
        pagador: nomeBonito(l.pagador ?? ''),
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

        {!editando ? (
          <>
            <p
              className="mt-4 font-display text-[2rem] leading-none font-[800]"
              style={{ color: saida ? 'var(--color-falta)' : 'var(--color-presente)' }}
            >
              {saida ? '−' : '+'} {moeda(Number(l.valor ?? 0))}
            </p>

            <dl className="mt-4 space-y-2 text-[14px]">
              <LinhaLeitura rotulo={saida ? 'Pago a' : 'Recebido de'} valor={nomeBonito(l.nome ?? '')} />
              {l.pagador?.trim() ? <LinhaLeitura rotulo="Pago por" valor={nomeBonito(l.pagador)} /> : null}
              <LinhaLeitura rotulo="Categoria" valor={l.categoria} />
              {ehMensalidade ? <LinhaLeitura rotulo="Mês" valor={l.mes ? nomeDoMes(l.mes) : ''} /> : null}
              <LinhaLeitura rotulo="Data" valor={formatarData(l.data ?? '')} />
              <LinhaLeitura rotulo="Forma" valor={l.metodo} />
              {l.atividade?.trim() ? <LinhaLeitura rotulo="Atividade" valor={l.atividade} /> : null}
              {l.adiantadoPor?.trim() ? (
                <LinhaLeitura rotulo="Adiantado por" valor={`${nomeBonito(l.adiantadoPor)}${l.reembolsado ? ' · já devolvido' : ' · a devolver'}`} />
              ) : null}
              <LinhaLeitura rotulo="Registrado por" valor={l.registrado} />
              <LinhaLeitura rotulo="Observação" valor={l.observacao} />
            </dl>

            {l.comprovante ? (
              <a href={l.comprovante} target="_blank" rel="noopener" className="mt-3 block">
                <img src={l.comprovante} alt="Comprovante" className="h-28 w-full rounded-lg object-cover" />
              </a>
            ) : null}

            <div className="mt-5 flex gap-3">
              <button type="button" onClick={aoFechar} className="rounded-full border border-line px-5 py-2.5 text-[15px] font-semibold">
                Fechar
              </button>
              <button
                type="button"
                onClick={() => void enviarRecibo()}
                disabled={gerandoRecibo}
                aria-label="Recibo em PDF"
                title="Recibo em PDF"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ouro shadow-[inset_0_0_0_1.5px_var(--color-ouro)] disabled:opacity-50"
              >
                <Icone nome="imprimir" className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="flex-1 rounded-full bg-ouro py-2.5 text-[15px] font-semibold text-preto"
              >
                Editar
              </button>
            </div>
          </>
        ) : null}

        {editando ? (
        <>
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

        {ehMensalidade ? (
          <label className="mt-3 block">
            <span className="text-[12.5px] text-muted">Recebido de</span>
            <select
              value={l.idIntegrante ?? ''}
              onChange={(e) => {
                const escolhido = integrantes.find((i) => i.id === e.target.value);
                setL({
                  ...l,
                  idIntegrante: escolhido?.id ?? '',
                  nome: escolhido ? escolhido.nome.trim() : '',
                  // Sugere o responsável da ficha; dá para trocar ou apagar.
                  pagador: l.pagador?.trim() ? l.pagador : (escolhido?.contatoEmergencia ?? '').trim(),
                });
                setBusca(escolhido ? escolhido.nome.trim() : '');
              }}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[15px]"
            >
              <option value="">Escolha o integrante</option>
              {integrantes
                .filter((i) => i.status === 'Ativo')
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {nomeBonito(i.nome)} · {i.ramo || 'sem ramo'}
                  </option>
                ))}
            </select>
          </label>
        ) : (
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
        )}
        {ehMensalidade ? (
          <label className="mt-3 block">
            <span className="text-[12.5px] text-muted">Pago por</span>
            <input
              value={l.pagador ?? ''}
              onChange={(e) => setL({ ...l, pagador: e.target.value })}
              placeholder="Mãe, pai ou responsável — deixe em branco se foi o próprio"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[15px]"
            />
          </label>
        ) : null}
        {!ehMensalidade && sugestoes.length ? (
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
          <span className="text-[12.5px] text-muted">Atividade</span>
          <input
            list="atividades-conhecidas"
            value={l.atividade ?? ''}
            onChange={(e) => setL({ ...l, atividade: e.target.value })}
            placeholder="Acampamento de fevereiro, rifa, JOTA-JOTI…"
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[15px]"
          />
          <datalist id="atividades-conhecidas">
            {atividades.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
          <span className="mt-1 block text-[12px] text-muted">
            Deixe em branco no que é do grupo em geral. Com a atividade preenchida, o caixa mostra se ela se pagou.
          </span>
        </label>

        {saida ? (
          <div className="mt-3">
            <label className="block">
              <span className="text-[12.5px] text-muted">Adiantado por</span>
              <input
                value={l.adiantadoPor ?? ''}
                onChange={(e) => setL({ ...l, adiantadoPor: e.target.value })}
                placeholder="Quem tirou do próprio bolso"
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[15px]"
              />
            </label>
            {l.adiantadoPor?.trim() ? (
              <label className="mt-2 flex items-center gap-2 text-[14px]">
                <input
                  type="checkbox"
                  checked={!!l.reembolsado}
                  onChange={(e) => setL({ ...l, reembolsado: e.target.checked })}
                  className="h-5 w-5 accent-[var(--color-ouro)]"
                />
                Já devolvido
              </label>
            ) : null}
          </div>
        ) : null}

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
          <button type="button" onClick={() => void excluir()} disabled={salvando} className="mt-3 w-full text-[13.5px] font-semibold text-falta underline">
            Excluir este lançamento
          </button>
        ) : null}
        </>
        ) : null}
      </div>
    </div>
  );
}

/** Conferência: o que o sistema diz contra o que existe de fato. */
function ConferirCaixa({
  api,
  saldoDoSistema,
  conta,
  especie,
  aoFechar,
  aoConferir,
}: {
  api: Api;
  saldoDoSistema: number;
  conta: number;
  especie: number;
  aoFechar: () => void;
  aoConferir: () => void;
}) {
  const [informadoConta, setInformadoConta] = useState(String(conta.toFixed(2)));
  const [informadoEspecie, setInformadoEspecie] = useState(String(especie.toFixed(2)));
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const informado = Number(informadoConta || 0) + Number(informadoEspecie || 0);
  const diferenca = Math.round((informado - saldoDoSistema) * 100) / 100;

  const confirmar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await api('caixa.fechar', {
        data: hojeISO(),
        conta: Number(informadoConta || 0),
        especie: Number(informadoEspecie || 0),
        observacao,
      });
      aoConferir();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível registrar a conferência.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-center sm:p-6" onClick={aoFechar} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Conferir o caixa"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t-2 border-ouro bg-card px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-2xl"
      >
        <h2 className="font-display text-[1.15rem] font-[700]">Conferir o caixa</h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
          Informe o que existe de verdade: o saldo do extrato e o dinheiro contado. A diferença aponta lançamento
          esquecido.
        </p>

        {erro ? <Erro mensagem={erro} /> : null}

        <label className="mt-4 block">
          <span className="text-[12.5px] text-muted">Saldo no extrato da conta</span>
          <input type="number" inputMode="decimal" step="0.01" value={informadoConta} onChange={(e) => setInformadoConta(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[16px]" />
        </label>
        <label className="mt-3 block">
          <span className="text-[12.5px] text-muted">Dinheiro contado</span>
          <input type="number" inputMode="decimal" step="0.01" value={informadoEspecie} onChange={(e) => setInformadoEspecie(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[16px]" />
        </label>

        <dl className="mt-4 space-y-2 rounded-lg bg-card-alto px-3.5 py-3 text-[14px]">
          <LinhaLeitura rotulo="O sistema diz" valor={moeda(saldoDoSistema)} />
          <LinhaLeitura rotulo="Você contou" valor={moeda(informado)} />
          <div className="flex items-baseline gap-3 border-t border-line pt-2">
            <dt className="w-[42%] shrink-0 text-[12.5px] text-muted">Diferença</dt>
            <dd className="font-display font-[700]" style={{ color: Math.abs(diferenca) < 0.01 ? 'var(--color-presente)' : 'var(--color-falta)' }}>
              {Math.abs(diferenca) < 0.01 ? 'bate certo' : moeda(diferenca)}
            </dd>
          </div>
        </dl>

        <label className="mt-3 block">
          <span className="text-[12.5px] text-muted">Observação</span>
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[15px]" />
        </label>

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={aoFechar} className="rounded-full border border-line px-5 py-2.5 text-[15px] font-semibold">
            Cancelar
          </button>
          <button type="button" onClick={() => void confirmar()} disabled={salvando} className="flex-1 rounded-full bg-ouro py-2.5 text-[15px] font-semibold text-preto disabled:opacity-60">
            {salvando ? 'Registrando' : 'Registrar conferência'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Cobrança de vários meses de uma vez, uma mensagem por responsável. */
function CobrarEmAberto({ api, mesAtual, aoFechar }: { api: Api; mesAtual: string; aoFechar: () => void }) {
  const [quantos, setQuantos] = useState(3);
  const [dados, setDados] = useState<Devedores | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const meses = useMemo(() => {
    const [ano, mes] = mesAtual.split('-').map(Number);
    return Array.from({ length: quantos }, (_, i) => {
      const d = new Date(ano, mes - 1 - i, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }).reverse();
  }, [mesAtual, quantos]);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setErro(null);
    api<Devedores>('mensalidades.devedores', { meses })
      .then((d) => {
        if (!cancelado) setDados(d);
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof ErroApi ? e.message : 'Não foi possível montar a cobrança.');
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [api, meses]);

  const mensagem = (p: Devedores['pessoas'][number]) => {
    const quem = nomeBonito(p.responsavel) || 'Olá';
    const lista = p.mesesEmAberto.map((m) => nomeDoMes(m)).join(', ');
    return [
      `Oi, ${quem}! Tudo bem?`,
      '',
      p.mesesEmAberto.length === 1
        ? `A mensalidade de ${lista.toLowerCase()} de ${nomeBonito(p.nome)} está em aberto: *${moeda(p.total)}*.`
        : `${nomeBonito(p.nome)} está com ${p.mesesEmAberto.length} mensalidades em aberto (${lista}), somando *${moeda(p.total)}*.`,
      ...(dados?.chavePix ? ['', `PIX do grupo: *${dados.chavePix}*`] : []),
      '',
      'Qualquer dúvida é só chamar. Obrigado!',
      '🏕️ _Grupo Escoteiro Canaã 52/DF_',
    ].join('\n');
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-center sm:p-6" onClick={aoFechar} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cobrar mensalidades em aberto"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t-2 border-ouro bg-card px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-2xl"
      >
        <h2 className="font-display text-[1.15rem] font-[700]">Cobrar em aberto</h2>

        <div className="mt-3 flex gap-2">
          {[1, 3, 6].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setQuantos(n)}
              aria-pressed={quantos === n}
              className="flex-1 rounded-full py-2 text-[13.5px] font-semibold"
              style={
                quantos === n
                  ? { background: 'var(--color-ouro)', color: 'var(--color-preto)' }
                  : { boxShadow: 'inset 0 0 0 1.5px var(--color-line)' }
              }
            >
              {n === 1 ? 'Este mês' : `Últimos ${n}`}
            </button>
          ))}
        </div>

        {erro ? <Erro mensagem={erro} /> : null}
        {carregando ? <Carregando texto="Somando o que está em aberto" /> : null}

        {dados && !carregando ? (
          dados.pessoas.length === 0 ? (
            <Vazio titulo="Ninguém em aberto" convite="Todo mundo com mensalidade prevista está em dia no período." />
          ) : (
            <>
              <p className="mt-3 text-[13px] text-muted">
                {dados.pessoas.length} {dados.pessoas.length === 1 ? 'responsável' : 'responsáveis'} ·{' '}
                {moeda(dados.pessoas.reduce((t, p) => t + p.total, 0))} em aberto
              </p>
              <ul className="mt-2">
                {dados.pessoas.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 border-b border-line py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-medium">{nomeBonito(p.nome)}</span>
                      <span className="block truncate text-[12.5px] text-muted">
                        {p.mesesEmAberto.length} {p.mesesEmAberto.length === 1 ? 'mês' : 'meses'} · {moeda(p.total)}
                        {p.responsavel ? ` · ${nomeBonito(p.responsavel)}` : ' · sem responsável na ficha'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void compartilhar(`Mensalidade de ${nomeBonito(p.nome)}`, mensagem(p))}
                      className="shrink-0 rounded-full bg-ouro px-3.5 py-1.5 text-[13px] font-semibold text-preto"
                    >
                      Cobrar
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )
        ) : null}

        <button type="button" onClick={aoFechar} className="mt-5 w-full rounded-full border border-line py-2.5 text-[15px] font-semibold">
          Fechar
        </button>
      </div>
    </div>
  );
}

function LinhaLeitura({ rotulo, valor }: { rotulo: string; valor?: string }) {
  const vazio = !valor?.trim();
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-[42%] shrink-0 text-[12.5px] text-muted">{rotulo}</dt>
      <dd className={vazio ? 'text-muted' : ''}>{vazio ? 'Não informado' : valor}</dd>
    </div>
  );
}

function MensalidadesTela({ api }: { api: Api }) {
  const { integrantes, config } = useDados();
  const atividadesConhecidas = (lerUltima<Caixa>('caixa|') ?? { atividades: [] }).atividades?.map((a) => a.atividade) ?? [];
  const [mes, setMes] = useState(mesAtual());
  const chaveCache = `mensalidades|${mes}`;
  const [dados, setDados] = useState<Mensalidades | null>(() => lerUltima<Mensalidades>(chaveCache));
  const [carregando, setCarregando] = useState(!dados);
  const [erro, setErro] = useState<string | null>(null);
  const [soDevendo, setSoDevendo] = useState(false);
  const [lancando, setLancando] = useState<Partial<Lancamento> | null>(null);
  const [cobrando, setCobrando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const novo = await api<Mensalidades>('mensalidades.mes', { mes });
      setDados(novo);
      gravarUltima(chaveCache, novo);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível abrir as mensalidades.');
    } finally {
      setCarregando(false);
    }
  }, [api, mes, chaveCache]);

  useEffect(() => {
    const guardado = lerUltima<Mensalidades>(chaveCache);
    if (guardado) {
      setDados(guardado);
      setCarregando(false);
    }
    void carregar();
  }, [carregar, chaveCache]);

  const lista = useMemo(
    () => (dados?.pessoas ?? []).filter((p) => !soDevendo || p.situacao === 'Em aberto' || p.situacao === 'Parcial'),
    [dados, soDevendo],
  );

  /** Mensagem de cobrança de um mês, pronta para o WhatsApp do responsável. */
  const cobrar = async (p: Pessoa) => {
    const integrante = integrantes.find((i) => i.id === p.id);
    const tratamento = nomeBonito(integrante?.contatoEmergencia ?? '') || 'Olá';
    const falta = p.esperado - p.pago;
    const linhas = [
      `Oi, ${tratamento}! Tudo bem?`,
      '',
      `A mensalidade de ${nomeDoMes(mes).toLowerCase()} de ${nomeBonito(p.nome)} está em aberto: *${moeda(falta)}*.`,
      ...(config.chavePix ? ['', `PIX do grupo: *${config.chavePix}*`] : []),
      '',
      'Qualquer dúvida é só chamar. Obrigado!',
      '🏕️ _Grupo Escoteiro Canaã 52/DF_',
    ];
    await compartilhar(`Mensalidade de ${nomeBonito(p.nome)}`, linhas.join('\n'));
  };

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
      pagador: '',
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
            <div className="mt-3 flex items-center gap-3">
              <label className="flex flex-1 items-center gap-2 text-[13px] text-muted">
                <input type="checkbox" checked={soDevendo} onChange={(e) => setSoDevendo(e.target.checked)} className="h-4 w-4 accent-[var(--color-ouro)]" />
                Mostrar só quem está devendo
              </label>
              <button
                type="button"
                onClick={() => setCobrando(true)}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-ouro shadow-[inset_0_0_0_1.5px_var(--color-ouro)]"
              >
                Cobrar em aberto
              </button>
            </div>
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
                        <span className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void cobrar(p)}
                            aria-label={`Cobrar ${nomeBonito(p.nome)}`}
                            title="Cobrar no WhatsApp"
                            className="grid h-9 w-9 place-items-center rounded-full text-ouro shadow-[inset_0_0_0_1.5px_var(--color-ouro)]"
                          >
                            <Icone nome="compartilhar" className="h-4.5 w-4.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirRecebimento(p)}
                            className="rounded-full bg-ouro px-3.5 py-1.5 text-[13px] font-semibold text-preto"
                          >
                            Receber {moeda(p.esperado - p.pago)}
                          </button>
                        </span>
                      )}
                    </div>

                    {pagamentos.length ? (
                      <ul className="mt-2 space-y-1">
                        {pagamentos.map((pg) => (
                          <li key={pg.id}>
                            <button
                              type="button"
                              onClick={() => setLancando({ ...pg, nome: p.nome, idIntegrante: p.id, tipo: 'Entrada', categoria: 'Mensalidade', mes, pagador: pg.pagador ?? '' })}
                              className="flex w-full items-center gap-2 rounded-lg bg-card-alto px-3 py-2 text-left text-[12.5px]"
                            >
                              <span className="text-presente">{moeda(pg.valor)}</span>
                              <span className="min-w-0 flex-1 truncate text-muted">
                                {formatarData(pg.data)} · {pg.metodo || 'forma não informada'}
                                {pg.pagador ? ` · pago por ${nomeBonito(pg.pagador)}` : ''}
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

      {cobrando ? (
        <CobrarEmAberto api={api} mesAtual={mes} aoFechar={() => setCobrando(false)} />
      ) : null}

      {lancando ? (
        <FormularioLancamento
          api={api}
          integrantes={integrantes}
          atividades={atividadesConhecidas}
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
