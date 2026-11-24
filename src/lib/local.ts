/**
 * Guarda no aparelho o que o app precisa para funcionar sem internet:
 * uma cópia dos dados lidos e a fila de chamadas ainda não enviadas.
 */
export type ItemChamada = {
  idIntegrante: string;
  nome: string;
  status: string;
  justificativa: string;
};

export type ChamadaPendente = {
  id: string;
  data: string;
  ramo: string;
  itens: ItemChamada[];
  criadaEm: number;
};

const FILA = 'sge:fila';

export function ler<T>(chave: string): T | null {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
}

export function gravar(chave: string, valor: unknown): void {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* aparelho sem espaço ou em aba privada: seguir sem cache */
  }
}

export function pendentes(): ChamadaPendente[] {
  return ler<ChamadaPendente[]>(FILA) ?? [];
}

/** Uma chamada por dia e ramo: reenfileirar substitui a anterior. */
export function enfileirar(chamada: Omit<ChamadaPendente, 'id' | 'criadaEm'>): void {
  const fila = pendentes().filter((c) => !(c.data === chamada.data && c.ramo === chamada.ramo));
  fila.push({ ...chamada, id: `${chamada.data}|${chamada.ramo}`, criadaEm: Date.now() });
  gravar(FILA, fila);
}

export function remover(id: string): void {
  gravar(FILA, pendentes().filter((c) => c.id !== id));
}

export function pendenteDe(data: string, ramo: string): ChamadaPendente | undefined {
  return pendentes().find((c) => c.data === data && c.ramo === ramo);
}

/** Envia o que está na fila, uma a uma; para no primeiro erro de rede. */
export async function enviarFila(
  enviar: (c: ChamadaPendente) => Promise<unknown>,
): Promise<{ enviadas: number; restantes: number }> {
  let enviadas = 0;
  for (const chamada of pendentes()) {
    try {
      await enviar(chamada);
      remover(chamada.id);
      enviadas += 1;
    } catch {
      break;
    }
  }
  return { enviadas, restantes: pendentes().length };
}
