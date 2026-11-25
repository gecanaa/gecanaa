import { ramo as corDoRamo } from '../lib/ramos';

export type OpcaoRamo = { valor: string; rotulo: string; curto: string; cor: string };

/** Acima disso, o nome inteiro não cabe na largura de um celular. */
const CABEM_POR_EXTENSO = 5;

/**
 * Seletor de ramo em uma linha: os nomes dividem a largura por igual, em
 * corpo pequeno, e o escolhido cresce. A cor oficial de cada ramo é o que
 * identifica de relance; o nome está ali para não haver dúvida.
 */
export function BarraRamos({
  ramos,
  ativo,
  aoEscolher,
  todos,
}: {
  ramos: string[];
  ativo: string;
  aoEscolher: (valor: string) => void;
  /** Rótulo da opção que não filtra nada; ausente, a barra só tem ramos. */
  todos?: string;
}) {
  const opcoes: OpcaoRamo[] = [
    ...(todos ? [{ valor: '', rotulo: todos, curto: todos, cor: 'var(--color-ouro)' }] : []),
    ...ramos.map((nome) => {
      const r = corDoRamo(nome);
      return { valor: nome, rotulo: nome, curto: r.curto, cor: r.cor };
    }),
  ];

  // Com poucos ramos cabe tudo escrito; com muitos, só o escolhido aparece
  // por extenso e os outros ficam na sigla, que a cor completa.
  const apertado = opcoes.length > CABEM_POR_EXTENSO;

  return (
    <div className="flex items-stretch gap-1.5">
      {opcoes.map((o) => {
        const escolhido = o.valor === ativo;
        return (
          <button
            key={o.valor || 'todos'}
            type="button"
            onClick={() => aoEscolher(o.valor)}
            aria-pressed={escolhido}
            title={o.rotulo}
            className={`min-w-0 basis-0 truncate rounded-full px-1.5 py-1.5 font-semibold ${
              escolhido ? 'grow-[2.4] text-[13px]' : `grow ${apertado ? 'text-[12px]' : 'text-[11.5px]'}`
            }`}
            style={
              escolhido
                ? { background: o.cor, color: 'var(--color-preto)' }
                : { color: o.cor, boxShadow: `inset 0 0 0 1.5px ${o.cor}` }
            }
          >
            {apertado && !escolhido ? o.curto : o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
