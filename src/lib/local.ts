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

const FILA = "sge:fila";

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
export function enfileirar(
  chamada: Omit<ChamadaPendente, "id" | "criadaEm">,
): void {
  const fila = pendentes().filter(
    (c) => !(c.data === chamada.data && c.ramo === chamada.ramo),
  );
  fila.push({
    ...chamada,
    id: `${chamada.data}|${chamada.ramo}`,
    criadaEm: Date.now(),
  });
  gravar(FILA, fila);
}

export function remover(id: string): void {
  gravar(
    FILA,
    pendentes().filter((c) => c.id !== id),
  );
}

export function pendenteDe(
  data: string,
  ramo: string,
): ChamadaPendente | undefined {
  return pendentes().find((c) => c.data === data && c.ramo === ramo);
}

// Só um envio por vez: dois disparos simultâneos mandariam a mesma gravação
// duas vezes. Quem chega durante um envio deixa um pedido, atendido no fim.
let enviandoChamadas = false;
let pedidoDeChamadas = false;
let enviandoGravacoes = false;
let pedidoDeGravacoes = false;

/** Envia as chamadas da fila, uma a uma; para no primeiro erro e o devolve. */
export async function enviarFila(
  enviar: (c: ChamadaPendente) => Promise<unknown>,
): Promise<{ enviadas: number; restantes: number; erro?: unknown }> {
  if (enviandoChamadas) {
    pedidoDeChamadas = true;
    return { enviadas: 0, restantes: pendentes().length };
  }

  enviandoChamadas = true;
  let enviadas = 0;
  let erro: unknown;
  try {
    do {
      pedidoDeChamadas = false;
      for (const chamada of pendentes()) {
        try {
          await enviar(chamada);
          remover(chamada.id);
          enviadas += 1;
        } catch (e) {
          erro = e;
          break;
        }
      }
    } while (pedidoDeChamadas && !erro && pendentes().length);
  } finally {
    enviandoChamadas = false;
  }
  return { enviadas, restantes: pendentes().length, erro };
}

// ------------------------------------------------- gravações em segundo plano

/**
 * Gravações que já foram confirmadas na tela e ainda precisam chegar à
 * planilha. Cada uma leva um id próprio, então reenviar não duplica nada.
 */
export type Gravacao = {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  descricao: string;
  criadaEm: number;
};

const GRAVACOES = 'sge:gravacoes';

export function gravacoesPendentes(): Gravacao[] {
  return ler<Gravacao[]>(GRAVACOES) ?? [];
}

export function enfileirarGravacao(g: Omit<Gravacao, 'criadaEm'>): void {
  const fila = gravacoesPendentes().filter((x) => !(x.action === g.action && x.id === g.id));
  fila.push({ ...g, criadaEm: Date.now() });
  gravar(GRAVACOES, fila);
}

export async function enviarGravacoes(
  enviar: (g: Gravacao) => Promise<unknown>,
): Promise<{ enviadas: number; restantes: number; erro?: unknown; descricao?: string }> {
  if (enviandoGravacoes) {
    pedidoDeGravacoes = true;
    return { enviadas: 0, restantes: gravacoesPendentes().length };
  }

  enviandoGravacoes = true;
  let enviadas = 0;
  let erro: unknown;
  let descricao: string | undefined;
  try {
    do {
      pedidoDeGravacoes = false;
      for (const g of gravacoesPendentes()) {
        try {
          await enviar(g);
          gravar(
            GRAVACOES,
            gravacoesPendentes().filter((x) => !(x.action === g.action && x.id === g.id)),
          );
          enviadas += 1;
        } catch (e) {
          erro = e;
          descricao = g.descricao;
          break;
        }
      }
    } while (pedidoDeGravacoes && !erro && gravacoesPendentes().length);
  } finally {
    enviandoGravacoes = false;
  }
  return { enviadas, restantes: gravacoesPendentes().length, erro, descricao };
}

/** Descarta uma gravação que a planilha recusou e o chefe decidiu abandonar. */
export function descartarGravacao(action: string, id: string): void {
  gravar(
    GRAVACOES,
    gravacoesPendentes().filter((x) => !(x.action === action && x.id === id)),
  );
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

/** Rascunhos de dias antigos não servem mais: saem do aparelho. */
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
