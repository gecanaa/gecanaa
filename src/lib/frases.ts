/** Frases do escotismo, para a espera render alguma coisa. */
const FRASES = [
  'Sempre alerta para servir.',
  'Deixe o mundo melhor do que você o encontrou.',
  'Melhor esforço, todo dia.',
  'Uma boa ação por dia.',
  'Aqui se aprende fazendo.',
  'A felicidade está em fazer os outros felizes.',
  'O escoteiro é amigo de todos e irmão dos demais escoteiros.',
  'Natureza, serviço e amizade.',
  'Escoteiro uma vez, escoteiro sempre.',
  'O caminho se faz caminhando.',
];

export function frase(): string {
  return FRASES[Math.floor(Math.random() * FRASES.length)];
}
