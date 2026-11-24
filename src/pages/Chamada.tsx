import { useEffect, useMemo, useState } from 'react';
import { useApi } from '../lib/auth';
import { ErroApi } from '../lib/api';
import { hojeISO, porExtenso, useDados } from '../lib/dados';
import { ordenarRamos, ramo as corDoRamo } from '../lib/ramos';
import { Avatar, Carregando, Erro, Vazio } from '../components/Estados';
import { enfileirar, enviarFila, pendenteDe, pendentes } from '../lib/local';
import { Icone } from '../components/Icone';
import type { Chamada as TipoChamada, Integrante, StatusPresenca } from '../lib/tipos';

/**
 * Quem está marcado é presença; linha em branco conta como falta na hora de
 * salvar. A justificativa só entra no ciclo se o grupo tiver ativado.
 */
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
  const [existente, setExistente] = useState<TipoChamada | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [naFila, setNaFila] = useState(() => pendentes().length);
  const [compacto, setCompacto] = useState(false);

  // O topo encolhe ao rolar, mas nunca sai da tela: data e ramo continuam à mão.
  useEffect(() => {
    const aoRolar = () => setCompacto(window.scrollY > 36);
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  // Tenta esvaziar a fila ao abrir e sempre que a internet voltar.
  useEffect(() => {
    const despachar = async () => {
      if (!pendentes().length) return;
      const r = await enviarFila((c) => api('presencas.salvar', { data: c.data, ramo: c.ramo, itens: c.itens }));
      setNaFila(r.restantes);
      if (r.enviadas) setAviso(`${r.enviadas} ${r.enviadas === 1 ? 'chamada guardada foi enviada' : 'chamadas guardadas foram enviadas'}.`);
    };
    void despachar();
    window.addEventListener('online', despachar);
    return () => window.removeEventListener('online', despachar);
  }, [api]);

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

  // Busca o que já foi registrado para a data e o ramo escolhidos.
  useEffect(() => {
    if (!data || !ramoAtual) return;
    let cancelado = false;
    setBuscando(true);
    setErro(null);
    setAviso(null);
    api<TipoChamada>('presencas.chamada', { data, ramo: ramoAtual })
      .then((c) => {
        if (cancelado) return;
        setExistente(c);
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
          setExistente(null);
          setMarcas({});
        } else {
          setErro(e instanceof ErroApi ? e.message : 'Não foi possível buscar a chamada.');
        }
      })
      .finally(() => {
        if (!cancelado) setBuscando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [api, data, ramoAtual, lista]);

  const alternar = (id: string) => {
    setAviso(null);
    setMarcas((atual) => {
      const agora = atual[id];
      const proximas = { ...atual };
      if (!agora) {
        proximas[id] = { status: 'Presente', justificativa: '' };
      } else if (agora.status === 'Presente' && config.justificativaAtiva) {
        proximas[id] = { status: 'Falta justificada', justificativa: agora.justificativa };
      } else {
        delete proximas[id];
      }
      return proximas;
    });
  };

  const todosPresentes = () => {
    setAviso(null);
    setMarcas(Object.fromEntries(lista.map((i) => [i.id, { status: 'Presente', justificativa: '' } as Marca])));
  };

  const contagem = useMemo(() => {
    const valores = lista.map((i) => marcas[i.id]?.status);
    const presentes = valores.filter((s) => s === 'Presente').length;
    return { presentes, faltas: lista.length - presentes };
  }, [lista, marcas]);

  const salvar = async () => {
    const itens = lista.map((i) => {
      const marca = marcas[i.id];
      return {
        idIntegrante: i.id,
        nome: i.nome.trim(),
        status: (marca?.status ?? 'Falta') as StatusPresenca,
        justificativa: marca?.status === 'Falta justificada' ? marca.justificativa : '',
      };
    });

    setSalvando(true);
    setErro(null);
    try {
      const r = await api<{ gravados: number; presentes: number }>('presencas.salvar', {
        data,
        ramo: ramoAtual,
        itens,
      });
      setAviso(`Chamada salva: ${r.presentes} presentes de ${r.gravados}.`);
      setExistente({ data, ramo: ramoAtual, registros: {}, total: r.gravados });
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'SEM_REDE') {
        enfileirar({ data, ramo: ramoAtual, itens });
        setNaFila(pendentes().length);
        setAviso('Sem internet agora. A chamada ficou guardada no aparelho e vai sozinha quando a conexão voltar.');
      } else {
        setErro(e instanceof ErroApi ? e.message : 'Não foi possível salvar a chamada.');
      }
    } finally {
      setSalvando(false);
    }
  };

  if (carregandoIntegrantes) return <Carregando texto="Carregando o quadro do grupo" />;
  if (erroIntegrantes) return <Erro mensagem={erroIntegrantes} />;

  return (
    <main className="pb-24">
      <div className={`sticky top-[52px] z-10 border-b border-line bg-card px-4 ${compacto ? 'py-2' : 'py-3.5'}`}>
        <label className="block">
          {compacto ? null : (
            <span className="font-display text-xl font-[600] tracking-tight">Chamada</span>
          )}
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className={`block w-full rounded-lg border border-line bg-paper px-3 ${
              compacto ? 'py-1.5 text-[14px]' : 'mt-2 py-2.5 text-[15px]'
            }`}
          />
        </label>
        {compacto ? null : (
          <p className="mt-2 text-[13px] text-muted first-letter:uppercase">{porExtenso(data)}</p>
        )}

        <div className={`-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 ${compacto ? 'mt-2' : 'mt-3.5'}`}>
          {ramos.map((nome) => {
            const r = corDoRamo(nome);
            const ativo = nome === ramoAtual;
            return (
              <button
                key={nome}
                type="button"
                onClick={() => setRamoAtual(nome)}
                aria-pressed={ativo}
                className={`shrink-0 rounded-full font-semibold ${compacto ? 'px-3.5 py-1.5 text-[13px]' : 'px-4 py-2 text-[14px]'}`}
                style={
                  ativo
                    ? { background: r.cor, color: 'var(--color-preto)' }
                    : { background: 'transparent', color: 'var(--color-texto)', boxShadow: `inset 0 0 0 1.5px ${r.cor}` }
                }
              >
                {nome}
              </button>
            );
          })}
        </div>

        {/* Carregar é detalhe: uma linha fina, sem empurrar a lista para baixo. */}
        <div aria-hidden={!buscando} className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden">
          {buscando ? <div className="h-full w-1/3 animate-[desliza_1.1s_ease-in-out_infinite] bg-ouro" /> : null}
        </div>
        <span className="sr-only" role="status">
          {buscando ? 'Buscando a chamada deste dia' : ''}
        </span>
      </div>

      {existente && existente.total > 0 && !buscando ? (
        <p className="mx-4 mt-4 rounded-lg bg-card px-3.5 py-2.5 text-[13px] leading-relaxed text-muted">
          Já existe chamada deste dia para {ramoAtual}. Ao salvar, ela é substituída pela desta tela.
        </p>
      ) : null}

      {erro ? <Erro mensagem={erro} /> : null}

      {!buscando && lista.length === 0 ? (
        <Vazio
          titulo="Nenhum integrante ativo neste ramo"
          convite="Cadastre os integrantes ou confira o ramo na ficha de cada um, em Integrantes."
        />
      ) : null}

      {lista.length > 0 ? (
        <>
          <div className="flex items-center justify-between px-4 pt-5 pb-2">
            <p className="text-[13px] text-muted">
              {config.justificativaAtiva
                ? 'Toque para marcar presença, de novo para justificar a falta. Em branco conta como falta.'
                : 'Toque para marcar presença. Quem ficar em branco conta como falta.'}
            </p>
            <button type="button" onClick={todosPresentes} className="shrink-0 pl-3 text-[13px] font-semibold text-ouro underline">
              Todos presentes
            </button>
          </div>

          <ul>
            {lista.map((i) => (
              <LinhaChamada key={i.id} integrante={i} marca={marcas[i.id]} onToque={() => alternar(i.id)} onJustificar={(texto) =>
                setMarcas((atual) => ({ ...atual, [i.id]: { status: 'Falta justificada', justificativa: texto } }))
              } />
            ))}
          </ul>
        </>
      ) : null}

      {lista.length > 0 ? (
        <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-10 border-t border-line bg-card/95 px-4 py-2 backdrop-blur">
          {aviso ? <p className="pb-1.5 text-[13px] font-medium text-ouro" role="status">{aviso}</p> : null}
          {naFila > 0 && !aviso ? (
            <p className="pb-1.5 text-[13px] font-medium text-justificada" role="status">
              {naFila === 1 ? '1 chamada guardada no aparelho' : `${naFila} chamadas guardadas no aparelho`}, aguardando internet.
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <p className="font-display text-[15px] font-[600]">
              {contagem.presentes} <span className="font-sans text-[13px] font-normal text-muted">presentes · {contagem.faltas} faltas</span>
            </p>
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={salvando}
              className="ml-auto flex items-center gap-2 rounded-full bg-ouro px-5 py-2 text-[15px] font-semibold text-preto disabled:opacity-60"
            >
              <Icone nome="salvar" className="h-4.5 w-4.5" />
              {salvando ? 'Salvando' : 'Salvar chamada'}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function LinhaChamada({
  integrante,
  marca,
  onToque,
  onJustificar,
}: {
  integrante: Integrante;
  marca?: Marca;
  onToque: () => void;
  onJustificar: (texto: string) => void;
}) {
  const r = corDoRamo(integrante.ramo);
  const aparencia = marca ? APARENCIA[marca.status] : null;

  return (
    <li className="border-b border-line">
      <button
        type="button"
        onClick={onToque}
        aria-label={`${integrante.nome}${aparencia ? `, ${aparencia.rotulo}` : ', falta'}`}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        style={aparencia ? { background: `color-mix(in srgb, ${aparencia.cor} 18%, var(--color-card))` } : { background: 'var(--color-card)' }}
      >
        <Avatar foto={integrante.foto} nome={integrante.nome} cor={r.cor} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{integrante.nome.trim()}</span>
          {integrante.alergia && integrante.alergia.toLowerCase() !== 'nenhuma' ? (
            <span className="block truncate text-[12px] text-falta">Alergia: {integrante.alergia}</span>
          ) : null}
        </span>
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-[17px] font-[800] text-preto"
          style={{ background: aparencia?.cor ?? 'transparent', boxShadow: aparencia ? 'none' : 'inset 0 0 0 1.5px var(--color-line)' }}
        >
          {aparencia?.letra ?? ''}
        </span>
      </button>

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
