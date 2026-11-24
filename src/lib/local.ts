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

// ------------------------------------------------- chamada em andamento

/**
 * O que já foi marcado numa chamada ainda não salva. Fica guardado por dia e
 * ramo, então sair para ver uma ficha, trocar de aba ou fechar o app sem
 * querer não apaga o trabalho.
 */
export type Rascunho = {
  marcas: Record<string, { status: string; justificativa: string }>;
  tocado: boolean;
};

const chaveRascunho = (data: string, ramo: string) => `sge:rascunho:${data}|${ramo}`;

export function lerRascunho(data: string, ramo: string): Rascunho | null {
  return ler<Rascunho>(chaveRascunho(data, ramo));
}

export function gravarRascunho(data: string, ramo: string, rascunho: Rascunho): void {
  gravar(chaveRascunho(data, ramo), rascunho);
}

export function apagarRascunho(data: string, ramo: string): void {
  try {
    localStorage.removeItem(chaveRascunho(data, ramo));
  } catch {
    /* nada a fazer */
  }
}

/** Rascunhos de dias antigos não servem mais: sai do aparelho. */
export function limparRascunhosAntigos(dias = 30): void {
  const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sge:rascunho:'))
      .filter((k) => (k.slice('sge:rascunho:'.length).split('|')[0] ?? '') < limite)
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* nada a fazer */
  }
}
