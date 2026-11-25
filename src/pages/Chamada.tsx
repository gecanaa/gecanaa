import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApi } from '../lib/auth';
import { ErroApi } from '../lib/api';
import { hojeISO, porExtenso, useDados } from '../lib/dados';
import { ordenarRamos, ramo as corDoRamo } from '../lib/ramos';
import { Avatar, Carregando, Erro, Vazio } from '../components/Estados';
import { BarraRamosFixa } from '../components/BarraRamos';
import { ModalIntegrante } from '../components/ModalIntegrante';
import { enfileirar, enviarFila, gravarRascunho, lerRascunho, pendenteDe, pendentes } from '../lib/local';
import { avisarDesmarcou, avisarMarcou, lerFeedback } from '../lib/feedback';
import { compartilhar } from '../lib/compartilhar';
import { Icone } from '../components/Icone';
import type { Chamada as TipoChamada, Integrante, StatusPresenca } from '../lib/tipos';

/**
 * Quem está marcado é presença; linha em branco conta como falta na hora de
 * salvar. A justificativa só entra no ciclo se o grupo tiver ativado.
 */
/** Tempo de calma depois do último toque antes de gravar. */
const ESPERA_ATE_GRAVAR = 2500;

const APARENCIA: Record<'Presente' | 'Falta justificada', { letra: string; cor: string; rotulo: string }> = {
  Presente: { letra: 'P', cor: 'var(--color-presente)', rotulo: 'presente' },
  'Falta justificada': { letra: 'J', cor: 'var(--color-justificada)', rotulo: 'falta justificada' },
};

type Marca = { status: 'Presente' | 'Falta justificada'; justificativa: string };

export function Chamada() {
  const api = useApi();
  const { integrantes, config, carregando: carregandoIntegrantes, erro: erroIntegrantes } = useDados();

  const [data, setData] = useState(hojeISO());
  const [ramoAtual, setRamoAtual] = useState(() => localStorage.getItem('sge:ramo') ?? '');
  const [marcas, setMarcas] = useState<Record<string, Marca>>({});
  // "tocado" marca que o chefe já mexeu nesta chamada: a partir daí, o que
  // chega do servidor não sobrescreve o que está na tela.
  const [tocado, setTocado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [vendo, setVendo] = useState<Integrante | null>(null);
  const [resumoPronto, setResumoPronto] = useState<string | null>(null);
  const [gravadoNaPlanilha, setGravadoNaPlanilha] = useState(false);

  // Tenta esvaziar a fila ao abrir e sempre que a internet voltar.
  const despachar = useCallback(async () => {
    if (!pendentes().length) return;
    const r = await enviarFila((c) => api('presencas.salvar', { data: c.data, ramo: c.ramo, itens: c.itens }));
    if (r.erro && !(r.erro instanceof ErroApi && r.erro.codigo === 'SEM_REDE')) {
      setErro(r.erro instanceof ErroApi ? r.erro.message : 'A planilha recusou a chamada guardada.');
    }
  }, [api]);

  useEffect(() => {
    void despachar();
    const aoVoltar = () => void despachar();
    window.addEventListener('online', aoVoltar);
    return () => window.removeEventListener('online', aoVoltar);
  }, [despachar]);

  const ramos = useMemo(
    () => ordenarRamos(integrantes.filter((i) => i.status === 'Ativo').map((i) => i.ramo)),
    [integrantes],
  );

  useEffect(() => {
    if (!ramoAtual && ramos.length) setRamoAtual(ramos[0]);
  }, [ramos, ramoAtual]);

  useEffect(() => {
    if (ramoAtual) localStorage.setItem('sge:ramo', ramoAtual);
  }, [ramoAtual]);

  const lista = useMemo(
    () => integrantes.filter((i) => i.status === 'Ativo' && i.ramo === ramoAtual),
    [integrantes, ramoAtual],
  );

  // Ao trocar de dia ou ramo, retoma o rascunho guardado no aparelho.
  useEffect(() => {
    if (!data || !ramoAtual) return;
    const guardado = lerRascunho(data, ramoAtual);
    setMarcas((guardado?.marcas as Record<string, Marca>) ?? {});
    setTocado(!!guardado?.tocado);
  }, [data, ramoAtual]);

  // Guarda cada mudança, para sair da tela não apagar o trabalho.
  useEffect(() => {
    if (!data || !ramoAtual || !tocado) return;
    gravarRascunho(data, ramoAtual, { marcas, tocado });
  }, [data, ramoAtual, marcas, tocado]);

  // Busca o que já foi registrado para a data e o ramo escolhidos.
  useEffect(() => {
    if (!data || !ramoAtual) return;
    let cancelado = false;
    setErro(null);
    api<TipoChamada>('presencas.chamada', { data, ramo: ramoAtual })
      .then((c) => {
        if (cancelado) return;
        const iniciais: Record<string, Marca> = {};
        Object.values(c.registros).forEach((r) => {
          const alvo =
            lista.find((i) => i.id && i.id === r.idIntegrante) ??
            lista.find((i) => i.nome.trim().toLowerCase() === String(r.nome).trim().toLowerCase());
          const status = String(r.status ?? '');
          if (alvo && status.toLowerCase().indexOf('falta') !== 0) {
            iniciais[alvo.id] = { status: 'Presente', justificativa: '' };
          } else if (alvo && status.toLowerCase().indexOf('justific') >= 0) {
            iniciais[alvo.id] = { status: 'Falta justificada', justificativa: r.justificativa ?? '' };
          }
        });
        // Se já houve marcação nesta tela, ela manda: o que chega do
        // servidor não apaga o que o chefe acabou de tocar.
        if (lerRascunho(data, ramoAtual)?.tocado) return;

        const guardada = pendenteDe(data, ramoAtual);
        if (guardada) {
          const daFila: Record<string, Marca> = {};
          guardada.itens.forEach((item) => {
            if (item.status === 'Presente') daFila[item.idIntegrante] = { status: 'Presente', justificativa: '' };
            else if (item.status === 'Falta justificada')
              daFila[item.idIntegrante] = { status: 'Falta justificada', justificativa: item.justificativa };
          });
          setMarcas(daFila);
        } else {
          setMarcas(iniciais);
        }
      })
      .catch((e) => {
        if (cancelado) return;
        if (e instanceof ErroApi && e.codigo === 'SEM_REDE') {
          setMarcas({});
        } else {
          setErro(e instanceof ErroApi ? e.message : 'Não foi possível buscar a chamada.');
        }
      });
    return () => {
      cancelado = true;
    };
  }, [api, data, ramoAtual, lista]);

  const alternar = (id: string) => {
    setGravadoNaPlanilha(false);
    setTocado(true);
    const sentido = lerFeedback();
    setMarcas((atual) => {
      const agora = atual[id];
      const proximas = { ...atual };
      if (!agora) {
        proximas[id] = { status: 'Presente', justificativa: '' };
        avisarMarcou(sentido);
      } else if (agora.status === 'Presente' && config.justificativaAtiva) {
        proximas[id] = { status: 'Falta justificada', justificativa: agora.justificativa };
        avisarMarcou(sentido);
      } else {
        delete proximas[id];
        avisarDesmarcou(sentido);
      }
      return proximas;
    });
  };

  const todosPresentes = () => {
    setTocado(true);
    avisarMarcou(lerFeedback());
    setMarcas(Object.fromEntries(lista.map((i) => [i.id, { status: 'Presente', justificativa: '' } as Marca])));
  };

  const contagem = useMemo(() => {
    const valores = lista.map((i) => marcas[i.id]?.status);
    const presentes = valores.filter((s) => s === 'Presente').length;
    return { presentes, faltas: lista.length - presentes };
  }, [lista, marcas]);

  const salvar = useCallback(() => {
    if (!lista.length) return;
    const itens = lista.map((i) => {
      const marca = marcas[i.id];
      return {
        idIntegrante: i.id,
        nome: i.nome.trim(),
        status: (marca?.status ?? 'Falta') as StatusPresenca,
        justificativa: marca?.status === 'Falta justificada' ? marca.justificativa : '',
      };
    });

    // Guarda no aparelho e manda para a planilha em segundo plano. O
    // rascunho fica onde está: a chamada segue aberta e pode mudar.
    enfileirar({ data, ramo: ramoAtual, itens });
    setErro(null);

    setResumoPronto(textoDoResumo(data, ramoAtual, itens));

    void despachar().then(() => setGravadoNaPlanilha(!pendentes().length));
  }, [data, ramoAtual, lista, marcas, despachar]);

  // Marcar já confirma: a gravação sai sozinha pouco depois do último toque,
  // para a chamada inteira virar uma escrita só em vez de uma por pessoa.
  useEffect(() => {
    if (!tocado || !lista.length) return;
    const relogio = window.setTimeout(() => salvar(), ESPERA_ATE_GRAVAR);
    return () => window.clearTimeout(relogio);
  }, [tocado, marcas, lista.length, salvar]);

  // Sair da tela ou esconder o app grava o que ainda não foi. Guardo a
  // função numa referência: se dependesse dela, cada toque disparava uma
  // gravação, em vez de uma só depois da pausa.
  const ultimoSalvar = useRef(salvar);
  const temPendente = useRef(false);
  ultimoSalvar.current = salvar;
  temPendente.current = tocado && !gravadoNaPlanilha;

  useEffect(() => {
    const aoEsconder = () => {
      if (document.visibilityState === 'hidden' && temPendente.current) ultimoSalvar.current();
    };
    document.addEventListener('visibilitychange', aoEsconder);
    return () => {
      document.removeEventListener('visibilitychange', aoEsconder);
      if (temPendente.current) ultimoSalvar.current();
    };
  }, []);

  if (carregandoIntegrantes) return <Carregando texto="Carregando o quadro do grupo" />;
  if (erroIntegrantes) return <Erro mensagem={erroIntegrantes} />;

  return (
    <main className="pb-28">
      {/* Título e data por extenso rolam junto com a lista. */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-[600] tracking-tight">Chamada</h1>
          <p className="mt-1 text-[13px] text-muted first-letter:uppercase">{porExtenso(data)}</p>
        </div>
        {lista.length ? (
          <button type="button" onClick={todosPresentes} className="shrink-0 pt-1 text-[13px] font-semibold text-ouro underline">
            Todos presentes
          </button>
        ) : null}
      </div>

      {/* Esta barra fica. Altura sempre a mesma, para a lista nunca pular. */}
      <div className="sticky top-[var(--topo,52px)] z-10 flex items-center gap-3 border-b border-line bg-card px-4 py-2">
        <input
          type="date"
          aria-label="Data da chamada"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-[14px]"
        />
        {lista.length ? (
          <>
            <p className="shrink-0 font-display text-[15px] font-[700]">
              {contagem.presentes}
              <span className="font-sans text-[13px] font-normal text-muted">/{lista.length}</span>
            </p>
            <button
              type="button"
              onClick={() => resumoPronto && void compartilhar(`Chamada ${ramoAtual}`, resumoPronto)}
              disabled={!gravadoNaPlanilha || !resumoPronto}
              aria-label="Compartilhar o resumo da chamada"
              title={gravadoNaPlanilha ? 'Compartilhar o resumo da chamada' : 'Disponível assim que a chamada chegar à planilha'}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ouro text-preto transition-opacity disabled:bg-transparent disabled:text-muted disabled:opacity-60 disabled:shadow-[inset_0_0_0_1.5px_var(--color-line)]"
            >
              <Icone nome="compartilhar" className="h-4.5 w-4.5" />
            </button>
          </>
        ) : null}
      </div>

      {erro ? <Erro mensagem={erro} /> : null}

      {lista.length === 0 ? (
        <Vazio
          titulo="Nenhum integrante ativo neste ramo"
          convite="Cadastre os integrantes ou confira o ramo na ficha de cada um, em Integrantes."
        />
      ) : null}

      {lista.length > 0 ? (
        <>
          <ul className="pt-1">
            {lista.map((i) => (
              <LinhaChamada key={i.id} integrante={i} marca={marcas[i.id]} onToque={() => alternar(i.id)} onAbrir={() => setVendo(i)} onJustificar={(texto) => {
                setTocado(true);
                setMarcas((atual) => ({ ...atual, [i.id]: { status: 'Falta justificada', justificativa: texto } }));
              }} />
            ))}
          </ul>
        </>
      ) : null}

      {lista.length > 0 ? <BarraRamosFixa ramos={ramos} ativo={ramoAtual} aoEscolher={setRamoAtual} /> : null}

      {vendo ? <ModalIntegrante integrante={vendo} aoFechar={() => setVendo(null)} /> : null}
    </main>
  );
}

function LinhaChamada({
  integrante,
  marca,
  onToque,
  onAbrir,
  onJustificar,
}: {
  integrante: Integrante;
  marca?: Marca;
  onToque: () => void;
  onAbrir: () => void;
  onJustificar: (texto: string) => void;
}) {
  const r = corDoRamo(integrante.ramo);
  const aparencia = marca ? APARENCIA[marca.status] : null;

  return (
    <li className="border-b border-line">
      <div
        className="flex items-center gap-3 px-4 py-3 transition-colors duration-200"
        style={aparencia ? { background: `color-mix(in srgb, ${aparencia.cor} 18%, var(--color-card))` } : { background: 'var(--color-card)' }}
      >
        <button type="button" onClick={onAbrir} aria-label={`Ver dados de ${integrante.nome.trim()}`} className="shrink-0 rounded-full">
          <Avatar foto={integrante.foto} nome={integrante.nome} cor={r.cor} />
        </button>

        <button
          type="button"
          onClick={onToque}
          aria-label={`${integrante.nome}${aparencia ? `, ${aparencia.rotulo}` : ', falta'}`}
          className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">{integrante.nome.trim()}</span>
            {integrante.alergia && integrante.alergia.toLowerCase() !== 'nenhuma' ? (
              <span className="block truncate text-[12px] text-falta">Alergia: {integrante.alergia}</span>
            ) : null}
          </span>
          <span
            key={aparencia?.letra ?? 'vazio'}
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-[17px] font-[800] text-preto"
            style={{
              background: aparencia?.cor ?? 'transparent',
              boxShadow: aparencia ? 'none' : 'inset 0 0 0 1.5px var(--color-line)',
              animation: aparencia ? 'marcou 220ms cubic-bezier(.2,.9,.3,1.4)' : 'acende 180ms ease-out',
            }}
          >
            {aparencia?.letra ?? ''}
          </span>
        </button>
      </div>

      {marca?.status === 'Falta justificada' ? (
        <label className="block bg-[color-mix(in_srgb,var(--color-justificada)_14%,var(--color-card))] px-4 pb-3">
          <span className="text-[12px] font-medium text-muted">Motivo da justificativa</span>
          <input
            value={marca.justificativa}
            onChange={(e) => onJustificar(e.target.value)}
            placeholder="Consulta médica, viagem…"
            className="mt-1 w-full rounded-lg border border-line bg-card-alto px-3 py-2 text-[14px]"
          />
        </label>
      ) : null}
    </li>
  );
}

/** Texto pronto para mandar no grupo de WhatsApp dos chefes e dos pais. */
function textoDoResumo(
  data: string,
  ramo: string,
  itens: { nome: string; status: string; justificativa: string }[],
): string {
  const presentes = itens.filter((i) => i.status === 'Presente');
  const justificadas = itens.filter((i) => i.status === 'Falta justificada');
  const faltas = itens.filter((i) => i.status === 'Falta');
  const [ano, mes, dia] = data.split('-');
  const porExtensoCurto = new Date(Number(ano), Number(mes) - 1, Number(dia)).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  const nomes = (lista: typeof itens, sufixo?: (i: (typeof itens)[number]) => string) =>
    lista.map((i) => `• ${i.nome.trim()}${sufixo ? sufixo(i) : ''}`).join('\n');

  const partes = [
    `⚜️ *${ramo} — ${dia}/${mes}/${ano}*`,
    `_${porExtensoCurto}_`,
    '',
    `✅ *Presentes (${presentes.length}/${itens.length})*`,
    presentes.length ? nomes(presentes) : '• ninguém registrado',
  ];

  if (justificadas.length) {
    partes.push(
      '',
      `📝 *Faltas justificadas (${justificadas.length})*`,
      nomes(justificadas, (i) => (i.justificativa ? ` — ${i.justificativa}` : '')),
    );
  }
  if (faltas.length) {
    partes.push('', `❌ *Faltas (${faltas.length})*`, nomes(faltas));
  }

  const taxa = itens.length ? Math.round((presentes.length / itens.length) * 100) : 0;
  partes.push('', `📊 Presença: *${taxa}%*`, '', '🏕️ _Grupo Escoteiro Canaã 52/DF_');
  return partes.join('\n');
}
