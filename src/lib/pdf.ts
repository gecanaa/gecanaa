import type { jsPDF } from 'jspdf';

/**
 * Recibo e extrato em PDF, montados no próprio aparelho e entregues ao
 * compartilhamento do celular — o chefe manda no WhatsApp sem precisar
 * passar pela impressão nem procurar o arquivo depois.
 */

/** A biblioteca só é baixada quando alguém pede um PDF. */
async function novoDocumento(): Promise<jsPDF> {
  const { jsPDF: Classe } = await import('jspdf');
  return new Classe();
}

const PRETO = '#111111';
const CINZA = '#666666';
const OURO = '#8a6a2c';
const MARGEM = 18;

const dinheiro = (v: number) =>
  (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dataBR = (iso: string) => {
  const m = (iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso ?? '';
};

let logoCache: string | null = null;

/** O brasão entra no papel; sem ele, o documento sai mesmo assim. */
async function logo(): Promise<string | null> {
  if (logoCache !== null) return logoCache || null;
  try {
    const resposta = await fetch(`${import.meta.env.BASE_URL}logo.png`);
    const blob = await resposta.blob();
    logoCache = await new Promise<string>((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onerror = () => reject(new Error('falhou'));
      leitor.onload = () => resolve(String(leitor.result));
      leitor.readAsDataURL(blob);
    });
    return logoCache;
  } catch {
    logoCache = '';
    return null;
  }
}

async function cabecalho(doc: jsPDF, titulo: string, subtitulo: string): Promise<number> {
  const marca = await logo();
  if (marca) doc.addImage(marca, 'PNG', MARGEM, 14, 20, 20);

  doc.setTextColor(PRETO);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(titulo, MARGEM + (marca ? 26 : 0), 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(CINZA);
  doc.text(subtitulo, MARGEM + (marca ? 26 : 0), 28);
  doc.text('Grupo Escoteiro Canaã 52/DF', MARGEM + (marca ? 26 : 0), 33);

  doc.setDrawColor(OURO);
  doc.setLineWidth(0.8);
  doc.line(MARGEM, 38, 210 - MARGEM, 38);
  return 48;
}

function rodape(doc: jsPDF) {
  const altura = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(CINZA);
  doc.text(
    `Emitido pelo sistema do grupo em ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`,
    MARGEM,
    altura - 12,
  );
}

export type DadosRecibo = {
  numero: string;
  data: string;
  nome: string;
  tipo: string;
  categoria: string;
  mes: string;
  valor: number;
  metodo: string;
  registrado: string;
  observacao: string;
};

export async function reciboPDF(r: DadosRecibo): Promise<Blob> {
  const doc = await novoDocumento();
  const entrada = !r.tipo.toLowerCase().startsWith('sa');
  let y = await cabecalho(doc, entrada ? 'Recibo' : 'Comprovante de pagamento', `Nº ${r.numero}`);

  doc.setTextColor(PRETO);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text(dinheiro(r.valor), MARGEM, y + 6);
  y += 18;

  const linha = (rotulo: string, valor: string) => {
    if (!valor) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(CINZA);
    doc.text(rotulo, MARGEM, y);
    doc.setFontSize(11);
    doc.setTextColor(PRETO);
    doc.text(doc.splitTextToSize(valor, 120) as string[], MARGEM + 48, y);
    y += Math.max(8, (doc.splitTextToSize(valor, 120) as string[]).length * 5.5);
  };

  linha(entrada ? 'Recebido de' : 'Pago a', r.nome || '—');
  linha('Referente a', r.categoria + (r.mes && r.mes !== 'Não se aplica' ? ` — ${r.mes}` : ''));
  linha('Data', dataBR(r.data));
  linha('Forma', r.metodo || '—');
  linha('Registrado por', r.registrado || '—');
  linha('Observação', r.observacao || '');

  y += 6;
  doc.setDrawColor('#dddddd');
  doc.setLineWidth(0.3);
  doc.line(MARGEM, y, 210 - MARGEM, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(CINZA);
  doc.text(
    doc.splitTextToSize(
      entrada
        ? 'Este recibo confirma o valor recebido pela tesouraria do grupo e vale como comprovante.'
        : 'Este documento registra a saída de caixa acima, lançada pela tesouraria do grupo.',
      174,
    ) as string[],
    MARGEM,
    y,
  );

  rodape(doc);
  return doc.output('blob');
}

export type Movimento = {
  data: string;
  nome: string;
  tipo: string;
  categoria: string;
  valor: number;
  metodo: string;
};

export async function extratoPDF(dados: {
  de: string;
  ate: string;
  entradas: number;
  saidas: number;
  saldoTotal: number;
  lancamentos: Movimento[];
  categorias: { tipo: string; categoria: string; total: number }[];
}): Promise<Blob> {
  const doc = await novoDocumento();
  let y = await cabecalho(doc, 'Extrato do caixa', `${dataBR(dados.de)} a ${dataBR(dados.ate)}`);

  const caixa = (x: number, rotulo: string, valor: string, cor: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(CINZA);
    doc.text(rotulo, x, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(cor);
    doc.text(valor, x, y + 7);
  };
  caixa(MARGEM, 'Entradas', dinheiro(dados.entradas), '#0f7a3d');
  caixa(MARGEM + 60, 'Saídas', dinheiro(dados.saidas), '#b3261e');
  caixa(MARGEM + 120, 'Saldo do caixa', dinheiro(dados.saldoTotal), PRETO);
  y += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(PRETO);
  doc.text('Lançamentos', MARGEM, y);
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(CINZA);
  doc.setFont('helvetica', 'bold');
  doc.text('Data', MARGEM, y);
  doc.text('Descrição', MARGEM + 20, y);
  doc.text('Valor', 210 - MARGEM, y, { align: 'right' });
  y += 2;
  doc.setDrawColor('#dddddd');
  doc.line(MARGEM, y, 210 - MARGEM, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  dados.lancamentos.forEach((l) => {
    if (y > doc.internal.pageSize.getHeight() - 24) {
      rodape(doc);
      doc.addPage();
      y = 24;
    }
    const saida = l.tipo.toLowerCase().startsWith('sa');
    doc.setTextColor(CINZA);
    doc.text(dataBR(l.data).slice(0, 5), MARGEM, y);
    doc.setTextColor(PRETO);
    const descricao = [l.nome, l.categoria].filter(Boolean).join(' — ');
    doc.text((doc.splitTextToSize(descricao, 120) as string[])[0] ?? '', MARGEM + 20, y);
    doc.setTextColor(saida ? '#b3261e' : '#0f7a3d');
    doc.text(`${saida ? '-' : '+'} ${dinheiro(l.valor)}`, 210 - MARGEM, y, { align: 'right' });
    y += 6;
  });

  if (dados.categorias.length) {
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(PRETO);
    doc.text('Por categoria', MARGEM, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    dados.categorias.forEach((c) => {
      if (y > doc.internal.pageSize.getHeight() - 24) {
        rodape(doc);
        doc.addPage();
        y = 24;
      }
      doc.setTextColor(CINZA);
      doc.text(`${c.categoria} (${c.tipo})`, MARGEM, y);
      doc.setTextColor(c.tipo === 'Saída' ? '#b3261e' : '#0f7a3d');
      doc.text(dinheiro(c.total), 210 - MARGEM, y, { align: 'right' });
      y += 6;
    });
  }

  rodape(doc);
  return doc.output('blob');
}

/** Entrega o PDF ao compartilhamento do celular; se não houver, baixa. */
export async function compartilharPDF(nomeArquivo: string, blob: Blob, texto: string): Promise<'compartilhado' | 'baixado'> {
  const arquivo = new File([blob], nomeArquivo, { type: 'application/pdf' });

  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], text: texto });
      return 'compartilhado';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'compartilhado';
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'baixado';
}
