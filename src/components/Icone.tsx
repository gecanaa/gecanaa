const CAMINHOS = {
  chamada: 'M4 7h16M4 12h16M4 17h10M18.5 16.2l1.6 1.6 3-3.4',
  pessoas: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 20c0-3 2.9-5.2 6.5-5.2s6.5 2.2 6.5 5.2M17 14.9c2.7.2 4.5 2.2 4.5 5.1',
  conta: 'M12 12.5a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4ZM4 21c0-3.5 3.6-6 8-6s8 2.5 8 6',
  busca: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm4.8.3 4 4',
  voltar: 'M15 5l-7 7 7 7',
  salvar: 'M5 12.5l5 5L19 7',
} as const;

export function Icone({ nome, className = 'h-6 w-6' }: { nome: keyof typeof CAMINHOS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={CAMINHOS[nome]} />
    </svg>
  );
}
