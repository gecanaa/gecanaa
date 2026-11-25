import { IconeDoRamo } from './IconesRamo';
import { ramo as corDoRamo } from '../lib/ramos';

type Opcao = { valor: string; rotulo: string; curto: string; cor: string };

/**
 * Ramos como uma fileira de ícones, no estilo das abas: a cor oficial
 * identifica, a sigla desambigua e o nome fica pequeno embaixo. Tudo visível
 * de uma vez, sem rolagem.
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
  /** Rótulo da opção que não filtra nada; ausente, a fileira só tem ramos. */
  todos?: string;
}) {
  const opcoes: Opcao[] = [
    ...(todos ? [{ valor: '', rotulo: todos, curto: '✳', cor: 'var(--color-ouro)' }] : []),
    ...ramos.map((nome) => {
      const r = corDoRamo(nome);
      return { valor: nome, rotulo: nome, curto: r.curto, cor: r.cor };
    }),
  ];

  return (
    <div role="radiogroup" aria-label="Ramo" className="flex items-start">
      {opcoes.map((o) => {
        const escolhido = o.valor === ativo;
        return (
          <button
            key={o.valor || 'todos'}
            type="button"
            role="radio"
            aria-checked={escolhido}
            onClick={() => aoEscolher(o.valor)}
            className="flex min-w-0 basis-0 grow flex-col items-center gap-1 px-0.5 py-0.5"
          >
            <span
              aria-hidden="true"
              className="grid h-10 w-10 place-items-center rounded-full"
              style={
                escolhido
                  ? { background: o.cor, color: 'var(--color-preto)' }
                  : { color: o.cor, boxShadow: `inset 0 0 0 1.5px ${o.cor}` }
              }
            >
              <IconeDoRamo ramo={o.valor} todos={!o.valor && !!todos} className="h-6 w-6" />
            </span>
            <span
              className={`w-full truncate text-center text-[10.5px] leading-tight ${
                escolhido ? 'font-semibold text-texto' : 'text-muted'
              }`}
            >
              {o.rotulo}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A mesma fileira presa ao rodapé, logo acima das abas. */
export function BarraRamosFixa(props: Parameters<typeof BarraRamos>[0]) {
  return (
    <div className="nao-imprime fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] z-10 border-t border-line bg-card/95 px-2 py-1.5 backdrop-blur">
      <BarraRamos {...props} />
    </div>
  );
}
