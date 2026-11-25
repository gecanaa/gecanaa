/**
 * Símbolos dos ramos, desenhados no mesmo traço: silhuetas cheias, mesma
 * caixa de 24 e mesmo peso visual, para a fileira parecer um conjunto e
 * não cinco figuras avulsas.
 */
const SIMBOLOS: Record<string, string> = {
  // Lobinho: cabeça de lobo, com as orelhas e o focinho marcados.
  lobo:
    'M2.4 12.6 7.3 10l1.9-3 .1-4.6 3.3 3.3 3.2-.2 2.3-3 .9 5.1 3 1.6-2.3 1.5c.4.7.6 1.5.6 2.3 0 3.6-3.4 6.4-7.9 6.4-1.9 0-3.6-.5-5-1.3l-3.9.9 1.6-2.4-2.5-.9 1.8-1.5zm6.3-.6a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-3.3 2.2 2.6 1.4-2.6.6z',
  // Escoteiro: flor-de-lis.
  lis:
    'M12 1.4c-1.3 2-2 3.9-2 5.7 0 1 .2 2 .6 3-1.4-1.2-2.9-1.8-4.5-1.8-2.2 0-3.8 1.2-3.8 2.9 0 1.6 1.2 2.7 3 2.7.8 0 1.5-.2 2.1-.6-.5 1-.8 1.9-.8 2.8 0 .8.2 1.5.5 2.2.7-1 1.6-1.8 2.7-2.2l-.5 3.9h5.4l-.5-3.9c1.1.4 2 1.2 2.7 2.2.3-.7.5-1.4.5-2.2 0-.9-.3-1.8-.8-2.8.6.4 1.3.6 2.1.6 1.8 0 3-1.1 3-2.7 0-1.7-1.6-2.9-3.8-2.9-1.6 0-3.1.6-4.5 1.8.4-1 .6-2 .6-3 0-1.8-.7-3.7-2-5.7zM7.6 20.1h8.8v1.5H7.6zm1.6 2.4h5.6V24H9.2z',
  // Sênior: rosa dos ventos.
  rosa:
    'M12 .9 13.9 9c.2.1.4.2.6.4l7.6-2.9-5.9 5.6c0 .3 0 .6-.1.9l6.2 4.4-7.5-1.8c-.2.2-.4.4-.7.5L12 23.1l-2.1-6.9c-.3-.1-.5-.3-.7-.5L1.7 17.5l6.2-4.4c-.1-.3-.1-.6-.1-.9L1.9 6.5l7.6 2.9c.2-.2.4-.3.6-.4z',
  // Pioneiro: forquilha.
  forquilha:
    'M10.8 22.4v-8.9L5.6 8.1a1.35 1.35 0 0 1 1.9-1.9L12 10.6l4.5-4.4a1.35 1.35 0 0 1 1.9 1.9l-5.2 5.4v8.9zM9.6 15.6h4.8v1.7H9.6z',
  // Equipe de adultos: chapéu escoteiro.
  chapeu:
    'M12 3.6c-2.4 0-4.1 2.5-4.5 6.4-.1 1.2-.2 2.8-.2 4.1h9.4c0-1.3-.1-2.9-.2-4.1-.4-3.9-2.1-6.4-4.5-6.4zm-.75 2.1h1.5v3.4h-1.5zM2.8 15.1h18.4c.7 0 1.2.6 1.1 1.3-.4 2.2-4.9 3.6-10.3 3.6S2.1 18.6 1.7 16.4c-.1-.7.4-1.3 1.1-1.3z',
  // Opção "todos", nas telas de filtro.
  tudo:
    'M12 2.2a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zm0 7.7a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zm0 7.7a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zM4.4 6.1a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zm15.2 0a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zM4.4 13.8a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zm15.2 0a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2z',
};

const POR_RAMO: Record<string, keyof typeof SIMBOLOS> = {
  lobinho: 'lobo',
  escoteiro: 'lis',
  senior: 'rosa',
  pioneiro: 'forquilha',
  escotista: 'chapeu',
  chefia: 'chapeu',
  diretoria: 'chapeu',
};

function chave(nome: string): keyof typeof SIMBOLOS {
  const limpo = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
  return POR_RAMO[limpo] ?? 'chapeu';
}

export function IconeDoRamo({
  ramo,
  todos,
  className = 'h-5 w-5',
}: {
  ramo?: string;
  /** Marca a opção que não filtra nada. */
  todos?: boolean;
  className?: string;
}) {
  const simbolo = todos ? SIMBOLOS.tudo : SIMBOLOS[chave(ramo ?? '')];
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d={simbolo} fillRule="evenodd" />
    </svg>
  );
}
