/**
 * Troca de vista, não ação: fica sobre um trilho escuro, com o item ativo
 * menor e preenchido. Assim não se confunde com os botões dourados, que
 * criam ou enviam alguma coisa.
 */
export function Segmentado<T extends string>({
  opcoes,
  valor,
  aoEscolher,
  rotulo,
}: {
  opcoes: readonly (readonly [T, string])[];
  valor: T;
  aoEscolher: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div role="tablist" aria-label={rotulo} className="flex gap-1 rounded-full bg-card-alto p-1">
      {opcoes.map(([v, texto]) => {
        const ativo = v === valor;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => aoEscolher(v)}
            className={`flex-1 rounded-full py-1.5 text-[13.5px] font-semibold transition-colors ${
              ativo ? 'bg-ouro text-preto' : 'text-muted'
            }`}
          >
            {texto}
          </button>
        );
      })}
    </div>
  );
}
