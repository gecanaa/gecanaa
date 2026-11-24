const URL_API = import.meta.env.VITE_API_URL as string | undefined;

export class ErroApi extends Error {
  constructor(message: string, readonly codigo: string) {
    super(message);
  }
}

const MENSAGENS: Record<string, string> = {
  SEM_LOGIN: 'Entre com sua conta Google para continuar.',
  LOGIN_INVALIDO: 'Esse login não foi aceito pelo Google. Tente entrar de novo.',
  LOGIN_EXPIRADO: 'Sua sessão expirou. Entre de novo para continuar.',
  NAO_AUTORIZADO: 'Sua conta Google ainda não está liberada. Peça a um administrador para incluir seu e-mail na aba Usuarios da planilha.',
};

/**
 * Chama o Apps Script. Usa text/plain de propósito: evita a requisição de
 * verificação (preflight) que o Apps Script não responde.
 */
export async function chamar<T>(action: string, payload: unknown = {}, token?: string | null): Promise<T> {
  if (!URL_API) {
    throw new ErroApi('O endereço da API não está configurado neste site (VITE_API_URL).', 'SEM_CONFIG');
  }

  let resposta: Response;
  try {
    resposta = await fetch(URL_API, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload, token }),
    });
  } catch {
    throw new ErroApi('Não foi possível falar com o servidor. Verifique sua conexão.', 'SEM_REDE');
  }

  if (!resposta.ok) {
    throw new ErroApi(`O servidor respondeu ${resposta.status}. Confira se o Web App está publicado para "qualquer pessoa".`, 'HTTP_' + resposta.status);
  }

  const texto = await resposta.text();
  let corpo: { ok: boolean; data?: T; erro?: string };
  try {
    corpo = JSON.parse(texto);
  } catch {
    throw new ErroApi('O servidor respondeu em um formato inesperado. Reimplante o Web App do Apps Script.', 'RESPOSTA_INVALIDA');
  }

  if (!corpo.ok) {
    const codigo = corpo.erro ?? 'ERRO';
    throw new ErroApi(MENSAGENS[codigo] ?? codigo, codigo);
  }
  return corpo.data as T;
}
