import { useEffect, useRef } from 'react';
import { useAuth } from '../lib/auth';
import { FlorDeLis } from '../components/Marca';

export function Login() {
  const { montarBotao, erro, carregando } = useAuth();
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (caixa.current) montarBotao(caixa.current);
  }, [montarBotao]);

  return (
    <main className="grid min-h-dvh place-items-center bg-ink px-6 py-12 text-paper">
      <div className="w-full max-w-sm">
        <FlorDeLis className="h-16 w-16 text-paper/90" titulo="" />
        <h1 className="mt-7 font-display text-[2.6rem] leading-[1.05] font-[800] tracking-[-0.02em]">
          Grupo Escoteiro
          <br />
          Canaã 52/DF
        </h1>
        <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-paper/65">
          Chamada, fichas dos integrantes e progressão do grupo. O acesso é dos chefes cadastrados.
        </p>

        <div className="mt-9 min-h-[44px]" ref={caixa} />
        {carregando ? <p className="mt-4 text-sm text-paper/60">Verificando seu acesso…</p> : null}
        {erro ? (
          <p className="mt-5 border-l-4 border-lobinho bg-paper/10 px-3.5 py-3 text-sm leading-relaxed" role="alert">
            {erro}
          </p>
        ) : null}
      </div>
    </main>
  );
}
