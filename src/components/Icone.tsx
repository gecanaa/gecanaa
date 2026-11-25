const CAMINHOS = {
  chamada: 'M4 7h16M4 12h16M4 17h10M18.5 16.2l1.6 1.6 3-3.4',
  pessoas: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 20c0-3 2.9-5.2 6.5-5.2s6.5 2.2 6.5 5.2M17 14.9c2.7.2 4.5 2.2 4.5 5.1',
  conta: 'M12 12.5a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4ZM4 21c0-3.5 3.6-6 8-6s8 2.5 8 6',
  busca: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm4.8.3 4 4',
  voltar: 'M15 5l-7 7 7 7',
  salvar: 'M5 12.5l5 5L19 7',
  relatorio: 'M5 20V9.5M12 20V4.5M19 20v-7M3.5 20h17',
  dinheiro: 'M3.5 7.5h17v9h-17zM12 15a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M6.5 10.2v.01M17.5 13.8v.01',
  compartilhar: 'M12 15.5V4M8.4 7.6 12 4l3.6 3.6M5.5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-6.5',
  imprimir: 'M7 9V4h10v5M7 17H5.5A1.5 1.5 0 0 1 4 15.5v-4A1.5 1.5 0 0 1 5.5 10h13a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5H17M7 14h10v6H7z',
} as const;

export function Icone({ nome, className = 'h-6 w-6' }: { nome: keyof typeof CAMINHOS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={CAMINHOS[nome]} />
    </svg>
  );
}
