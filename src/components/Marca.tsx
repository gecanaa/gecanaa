const LOGO = `${import.meta.env.BASE_URL}logo.png`;

/** Brasão do Grupo Escoteiro Canaã 52/DF. */
export function Brasao({ tamanho = 28, titulo }: { tamanho?: number; titulo?: string }) {
  return (
    <img
      src={LOGO}
      alt={titulo ?? ''}
      width={tamanho}
      height={tamanho}
      style={{ width: tamanho, height: tamanho }}
      className="shrink-0 object-contain"
    />
  );
}

export function Marca() {
  return (
    <span className="flex items-center gap-2.5">
      <Brasao tamanho={34} titulo="Grupo Escoteiro Canaã 52" />
      <span className="font-display text-[15px] leading-none font-[600] tracking-tight text-paper">
        Canaã 52
        <span className="ml-1.5 font-sans text-[11px] font-medium text-ouro">DF</span>
      </span>
    </span>
  );
}
