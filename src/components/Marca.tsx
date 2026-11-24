/** Flor-de-lis do grupo, usada como marca e como ícone do app. */
export function FlorDeLis({ className = '', titulo }: { className?: string; titulo?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role={titulo ? 'img' : 'presentation'} aria-label={titulo} fill="currentColor">
      <path d="M24 2c-2.6 4.1-3.9 8.1-3.9 11.8 0 2.2.5 4.3 1.4 6.3-3-2.6-6.2-3.9-9.6-3.9-4.6 0-8 2.5-8 6.1 0 3.3 2.6 5.7 6.2 5.7 1.7 0 3.2-.5 4.5-1.4-1.1 2-1.7 4-1.7 6 0 1.6.4 3.1 1.1 4.6 1.5-2.2 3.4-3.7 5.6-4.6l-.9 8.3h10.6l-.9-8.3c2.2.9 4.1 2.4 5.6 4.6.7-1.5 1.1-3 1.1-4.6 0-2-.6-4-1.7-6 1.3.9 2.8 1.4 4.5 1.4 3.6 0 6.2-2.4 6.2-5.7 0-3.6-3.4-6.1-8-6.1-3.4 0-6.6 1.3-9.6 3.9.9-2 1.4-4.1 1.4-6.3C27.9 10.1 26.6 6.1 24 2z" />
      <rect x="14" y="38" width="20" height="3.4" rx="1.7" />
      <rect x="17" y="43" width="14" height="3" rx="1.5" />
    </svg>
  );
}

export function Marca() {
  return (
    <span className="flex items-center gap-2.5">
      <FlorDeLis className="h-7 w-7 text-paper" titulo="Grupo Escoteiro Canaã 52" />
      <span className="font-display text-[15px] leading-none font-[600] tracking-tight text-paper">
        Canaã 52
        <span className="ml-1.5 font-sans text-[11px] font-medium text-paper/55">DF</span>
      </span>
    </span>
  );
}
