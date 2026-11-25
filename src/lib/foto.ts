/**
 * Reduz a imagem antes de enviar. 600px bastam para o avatar e para a ficha
 * impressa; um comprovante precisa de mais, para o texto do recibo ficar
 * legível. De todo jeito sobe rápido em 4G fraco.
 */
const LADO_PADRAO = 600;

export function reduzir(arquivo: File, ladoMaximo = LADO_PADRAO): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Essa imagem não pôde ser aberta.'));
      img.onload = () => {
        const escala = Math.min(1, ladoMaximo / Math.max(img.width, img.height));
        const largura = Math.round(img.width * escala);
        const altura = Math.round(img.height * escala);
        const tela = document.createElement('canvas');
        tela.width = largura;
        tela.height = altura;
        const pincel = tela.getContext('2d');
        if (!pincel) {
          reject(new Error('Este navegador não conseguiu preparar a imagem.'));
          return;
        }
        pincel.drawImage(img, 0, 0, largura, altura);
        resolve(tela.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(leitor.result);
    };
    leitor.readAsDataURL(arquivo);
  });
}
