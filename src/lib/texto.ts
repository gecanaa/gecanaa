const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du', 'van', 'von', 'y']);

/**
 * A planilha tem nomes em caixa alta e em caixa normal, misturados. Na tela
 * todos aparecem capitalizados: o dado original fica intacto, e a lista para
 * de gritar — o caixa alta ainda ocupa mais largura e trunca mais.
 */
export function nomeBonito(nome: string): string {
  const limpo = (nome ?? '').trim().replace(/\s+/g, ' ');
  if (!limpo) return '';
  // Nome já escrito com maiúsculas e minúsculas é respeitado como está.
  if (limpo !== limpo.toUpperCase()) return limpo;

  return limpo
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((parte, i) => {
      if (i > 0 && MINUSCULAS.has(parte)) return parte;
      return parte.replace(/^[\p{L}]/u, (letra) => letra.toLocaleUpperCase('pt-BR'));
    })
    .join(' ');
}

/** "há 7 dias" lê mais rápido que "18/11/2026" quando o que importa é a distância. */
export function haQuantoTempo(iso: string): string {
  const m = (iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso ?? '';
  const quando = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const hoje = new Date();
  const dias = Math.round((hoje.setHours(0, 0, 0, 0) - quando.setHours(0, 0, 0, 0)) / 86_400_000);

  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 31) return `há ${dias} dias`;
  const meses = Math.round(dias / 30);
  if (meses < 12) return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  const anos = Math.floor(meses / 12);
  return `há ${anos} ${anos === 1 ? 'ano' : 'anos'}`;
}
