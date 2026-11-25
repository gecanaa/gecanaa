/** Cores oficiais dos ramos — são elas que orientam a navegação do app. */
export type Ramo = { nome: string; cor: string; curto: string };

const RAMOS: Ramo[] = [
  { nome: 'Lobinho', cor: 'var(--color-lobinho)', curto: 'LO' },
  { nome: 'Escoteiro', cor: 'var(--color-escoteiro)', curto: 'ES' },
  { nome: 'Sênior', cor: 'var(--color-senior)', curto: 'SE' },
  { nome: 'Pioneiro', cor: 'var(--color-pioneiro)', curto: 'PI' },
];

const EQUIPE: Ramo = { nome: 'Equipe', cor: 'var(--color-equipe)', curto: 'EQ' };

/** Códigos de duas letras para a barra de ramos caber numa linha só. */
const CURTOS: Record<string, string> = {
  lobinho: 'LO',
  escoteiro: 'ES',
  senior: 'SE',
  pioneiro: 'PI',
  escotista: 'ET',
  chefia: 'CH',
  diretoria: 'DI',
  'equipe de apoio': 'AP',
};

function codigo(nome: string): string {
  const limpo = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return CURTOS[limpo] ?? limpo.slice(0, 2).toUpperCase();
}

export const RAMOS_JOVENS = RAMOS;

export function ramo(nome: string | undefined): Ramo {
  const alvo = (nome ?? '').trim().toLowerCase();
  const achado = RAMOS.find((r) => r.nome.toLowerCase() === alvo || r.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() === alvo);
  if (achado) return achado;
  const proprio = (nome ?? '').trim() || 'Sem ramo';
  return { ...EQUIPE, nome: proprio, curto: codigo(proprio) };
}

/** Ordem de exibição: ramos dos jovens primeiro, na ordem da progressão. */
export function ordenarRamos(nomes: string[]): string[] {
  const peso = (n: string) => {
    const i = RAMOS.findIndex((r) => r.nome.toLowerCase() === n.trim().toLowerCase());
    return i === -1 ? 90 : i;
  };
  return [...new Set(nomes.filter(Boolean))].sort((a, b) => peso(a) - peso(b) || a.localeCompare(b, 'pt-BR'));
}
