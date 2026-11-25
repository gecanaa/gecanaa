import { useEffect, useRef } from 'react';
import { ramo as corDoRamo } from '../lib/ramos';

type Opcao = { valor: string; rotulo: string; cor: string };

/** Largura fixa de cada item: deixa a conta do item centralizado exata. */
const LARGURA = 128;

/**
 * Roda de ramos: rolar de lado já escolhe, como os seletores do iPhone.
 * O item no centro é o selecionado; tocar em outro traz ele para o centro.
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
  /** Rótulo da opção que não filtra nada; ausente, a roda só tem ramos. */
  todos?: string;
}) {
  const trilho = useRef<HTMLDivElement>(null);
  const rolandoSozinho = useRef(false);
  const quadro = useRef(0);

  const opcoes: Opcao[] = [
    ...(todos ? [{ valor: '', rotulo: todos, cor: 'var(--color-ouro)' }] : []),
    ...ramos.map((nome) => ({ valor: nome, rotulo: nome, cor: corDoRamo(nome).cor })),
  ];

  const indiceAtivo = Math.max(0, opcoes.findIndex((o) => o.valor === ativo));

  // Quem muda o ramo de fora (ou ao abrir a tela) traz o item para o centro.
  useEffect(() => {
    const no = trilho.current;
    if (!no) return;
    const destino = indiceAtivo * LARGURA;
    if (Math.abs(no.scrollLeft - destino) < 2) return;
    rolandoSozinho.current = true;
    no.scrollTo({ left: destino, behavior: 'smooth' });
    const solta = window.setTimeout(() => {
      rolandoSozinho.current = false;
    }, 450);
    return () => window.clearTimeout(solta);
  }, [indiceAtivo, opcoes.length]);

  // Rolar é escolher: o item parado no centro vira o selecionado.
  const aoRolar = () => {
    if (rolandoSozinho.current) return;
    cancelAnimationFrame(quadro.current);
    quadro.current = requestAnimationFrame(() => {
      const no = trilho.current;
      if (!no) return;
      const indice = Math.min(opcoes.length - 1, Math.max(0, Math.round(no.scrollLeft / LARGURA)));
      const escolhido = opcoes[indice];
      if (escolhido && escolhido.valor !== ativo) aoEscolher(escolhido.valor);
    });
  };

  return (
    <div className="relative">
      <div
        ref={trilho}
        onScroll={aoRolar}
        role="radiogroup"
        aria-label="Ramo"
        className="sem-barra flex snap-x snap-mandatory overflow-x-auto"
        style={{ paddingInline: `calc(50% - ${LARGURA / 2}px)`, scrollPaddingInline: `calc(50% - ${LARGURA / 2}px)` }}
      >
        {opcoes.map((o) => {
          const escolhido = o.valor === ativo;
          return (
            <button
              key={o.valor || 'todos'}
              type="button"
              role="radio"
              aria-checked={escolhido}
              onClick={() => aoEscolher(o.valor)}
              className="shrink-0 snap-center px-1"
              style={{ width: LARGURA }}
            >
              <span
                className={`block truncate rounded-full px-3 py-1.5 font-semibold transition-all duration-150 ${
                  escolhido ? 'text-[14px]' : 'text-[13px] opacity-55'
                }`}
                style={
                  escolhido
                    ? { background: o.cor, color: 'var(--color-preto)' }
                    : { color: o.cor, boxShadow: `inset 0 0 0 1.5px ${o.cor}` }
                }
              >
                {o.rotulo}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A mesma roda presa ao rodapé, logo acima das abas. */
export function BarraRamosFixa(props: Parameters<typeof BarraRamos>[0]) {
  return (
    <div className="nao-imprime fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-10 border-t border-line bg-card/95 py-2 backdrop-blur">
      <BarraRamos {...props} />
    </div>
  );
}
