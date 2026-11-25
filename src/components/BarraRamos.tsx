import { useEffect, useRef } from 'react';
import { ramo as corDoRamo } from '../lib/ramos';

type Opcao = { valor: string; rotulo: string; cor: string };

/**
 * Carretel de ramos: nome por extenso, rolando de lado quando não cabe.
 * A cor oficial identifica, e o escolhido fica preenchido e centralizado
 * sozinho — assim o polegar nunca precisa procurar onde parou.
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
  const trilho = useRef<HTMLDivElement>(null);

  const opcoes: Opcao[] = [
    ...(todos ? [{ valor: '', rotulo: todos, cor: 'var(--color-ouro)' }] : []),
    ...ramos.map((nome) => ({ valor: nome, rotulo: nome, cor: corDoRamo(nome).cor })),
  ];

  useEffect(() => {
    const escolhido = trilho.current?.querySelector('[aria-pressed="true"]');
    escolhido?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [ativo]);

  return (
    <div ref={trilho} className="sem-barra -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4">
      {opcoes.map((o) => {
        const escolhido = o.valor === ativo;
        return (
          <button
            key={o.valor || 'todos'}
            type="button"
            onClick={() => aoEscolher(o.valor)}
            aria-pressed={escolhido}
            className="shrink-0 snap-center rounded-full px-4 py-1.5 text-[13.5px] font-semibold whitespace-nowrap"
            style={
              escolhido
                ? { background: o.cor, color: 'var(--color-preto)' }
                : { color: o.cor, boxShadow: `inset 0 0 0 1.5px ${o.cor}` }
            }
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/** O mesmo carretel preso ao rodapé, logo acima das abas. */
export function BarraRamosFixa(props: Parameters<typeof BarraRamos>[0]) {
  return (
    <div className="nao-imprime fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-10 border-t border-line bg-card/95 px-4 py-2 backdrop-blur">
      <BarraRamos {...props} />
    </div>
  );
}
