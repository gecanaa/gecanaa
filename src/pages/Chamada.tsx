import { useEffect, useMemo, useState } from 'react';
import { useApi } from '../lib/auth';
import { ErroApi } from '../lib/api';
import { hojeISO, porExtenso, useDados } from '../lib/dados';
import { ordenarRamos, ramo as corDoRamo } from '../lib/ramos';
import { Avatar, Carregando, Erro, Vazio } from '../components/Estados';
import { Icone } from '../components/Icone';
import type { Chamada as TipoChamada, Integrante, StatusPresenca } from '../lib/tipos';

const CICLO: StatusPresenca[] = ['Presente', 'Falta', 'Falta justificada'];

const APARENCIA: Record<StatusPresenca, { letra: string; cor: string; rotulo: string }> = {
  Presente: { letra: 'P', cor: 'var(--color-presente)', rotulo: 'presente' },
  Falta: { letra: 'F', cor: 'var(--color-falta)', rotulo: 'faltou' },
  'Falta justificada': { letra: 'J', cor: 'var(--color-justificada)', rotulo: 'falta justificada' },
};

type Marca = { status: StatusPresenca; justificativa: string };

export function Chamada() {
  const api = useApi();
  const { integrantes, carregando: carregandoIntegrantes, erro: erroIntegrantes } = useDados();

  const [data, setData] = useState(hojeISO());
  const [ramoAtual, setRamoAtual] = useState(() => localStorage.getItem('sge:ramo') ?? '');
  const [marcas, setMarcas] = useState<Record<string, Marca>>({});
  const [existente, setExistente] = useState<TipoChamada | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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
          if (alvo) {
            iniciais[alvo.id] = {
              status: (CICLO.find((s) => s === r.status) ?? 'Presente') as StatusPresenca,
              justificativa: r.justificativa ?? '',
            };
          }
        });
        setMarcas(iniciais);
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof ErroApi ? e.message : 'Não foi possível buscar a chamada.');
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
      const proximo = agora ? CICLO[(CICLO.indexOf(agora.status) + 1) % CICLO.length] : 'Presente';
      return { ...atual, [id]: { status: proximo, justificativa: agora?.justificativa ?? '' } };
    });
  };

  const todosPresentes = () => {
    setAviso(null);
    setMarcas(Object.fromEntries(lista.map((i) => [i.id, { status: 'Presente' as StatusPresenca, justificativa: '' }])));
  };

  const contagem = useMemo(() => {
    const valores = lista.map((i) => marcas[i.id]?.status);
    return {
      presentes: valores.filter((s) => s === 'Presente').length,
      marcados: valores.filter(Boolean).length,
    };
  }, [lista, marcas]);

  const salvar = async () => {
    const itens = lista
      .filter((i) => marcas[i.id])
      .map((i) => ({
        idIntegrante: i.id,
        nome: i.nome.trim(),
        status: marcas[i.id].status,
        justificativa: marcas[i.id].status === 'Falta justificada' ? marcas[i.id].justificativa : '',
      }));

    if (!itens.length) {
      setAviso('Marque ao menos um integrante antes de salvar.');
      return;
    }

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
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível salvar a chamada.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregandoIntegrantes) return <Carregando texto="Carregando o quadro do grupo" />;
  if (erroIntegrantes) return <Erro mensagem={erroIntegrantes} />;

  return (
    <main className="pb-28">
      <div className="border-b border-line bg-card px-4 py-4">
        <label className="block">
          <span className="font-display text-xl font-[600] tracking-tight">Chamada</span>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="mt-2 block w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[15px]"
          />
        </label>
        <p className="mt-2 text-[13px] text-muted first-letter:uppercase">{porExtenso(data)}</p>

        <div className="-mx-4 mt-3.5 flex gap-2 overflow-x-auto px-4 pb-1">
          {ramos.map((nome) => {
            const r = corDoRamo(nome);
            const ativo = nome === ramoAtual;
            return (
              <button
                key={nome}
                type="button"
                onClick={() => setRamoAtual(nome)}
                aria-pressed={ativo}
                className="shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold"
                style={
                  ativo
                    ? { background: r.cor, color: '#fff' }
                    : { background: 'transparent', color: 'var(--color-ink)', boxShadow: `inset 0 0 0 1.5px ${r.cor}` }
                }
              >
                {nome}
              </button>
            );
          })}
        </div>
      </div>

      {buscando ? <Carregando texto="Buscando a chamada deste dia" /> : null}

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
            <p className="text-[13px] text-muted">Toque na linha para alternar presente, falta e justificada.</p>
            <button type="button" onClick={todosPresentes} className="shrink-0 pl-3 text-[13px] font-semibold text-escoteiro underline">
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
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 border-t border-line bg-card/95 px-4 py-3 backdrop-blur">
          {aviso ? <p className="pb-2 text-[13px] font-medium text-escoteiro" role="status">{aviso}</p> : null}
          <div className="flex items-center gap-3">
            <p className="font-display text-[15px] font-[600]">
              {contagem.presentes} <span className="font-sans text-[13px] font-normal text-muted">presentes · {contagem.marcados}/{lista.length} marcados</span>
            </p>
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={salvando}
              className="ml-auto flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[15px] font-semibold text-paper disabled:opacity-60"
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
        aria-label={`${integrante.nome}${aparencia ? `, ${aparencia.rotulo}` : ', sem marcação'}`}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        style={aparencia ? { background: `color-mix(in srgb, ${aparencia.cor} 10%, white)` } : { background: 'white' }}
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
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-[17px] font-[800] text-white"
          style={{ background: aparencia?.cor ?? 'transparent', boxShadow: aparencia ? 'none' : 'inset 0 0 0 1.5px var(--color-line)' }}
        >
          {aparencia?.letra ?? ''}
        </span>
      </button>

      {marca?.status === 'Falta justificada' ? (
        <label className="block bg-[color-mix(in_srgb,var(--color-justificada)_8%,white)] px-4 pb-3">
          <span className="text-[12px] font-medium text-muted">Motivo da justificativa</span>
          <input
            value={marca.justificativa}
            onChange={(e) => onJustificar(e.target.value)}
            placeholder="Consulta médica, viagem…"
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px]"
          />
        </label>
      ) : null}
    </li>
  );
}
