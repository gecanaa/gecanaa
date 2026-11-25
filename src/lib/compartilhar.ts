/**
 * Manda o texto para onde o chefe quiser — na prática, o grupo de WhatsApp.
 * Usa o compartilhamento do próprio celular; onde ele não existe, cai no
 * WhatsApp Web e, por último, na área de transferência.
 */
export async function compartilhar(titulo: string, texto: string): Promise<'compartilhado' | 'whatsapp' | 'copiado'> {
  if (navigator.share) {
    try {
      await navigator.share({ title: titulo, text: texto });
      return 'compartilhado';
    } catch (e) {
      // Cancelar o menu não é erro: não abre mais nada.
      if (e instanceof DOMException && e.name === 'AbortError') return 'compartilhado';
    }
  }

  try {
    await navigator.clipboard.writeText(texto);
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    return 'whatsapp';
  } catch {
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    return 'copiado';
  }
}
