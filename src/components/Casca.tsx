import { useEffect, useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useDados } from '../lib/dados';
import { Marca } from './Marca';
import { Icone } from './Icone';

const ABAS = [
  { para: '/', rotulo: 'Chamada', icone: 'chamada' },
  { para: '/integrantes', rotulo: 'Integrantes', icone: 'pessoas' },
  { para: '/relatorio', rotulo: 'Relatório', icone: 'relatorio' },
  { para: '/financas', rotulo: 'Finanças', icone: 'dinheiro', soTesouraria: true },
  { para: '/conta', rotulo: 'Conta', icone: 'conta' },
] as const;

export function Casca() {
  const topo = useRef<HTMLElement>(null);
  const { usuario } = useAuth();
  const { gravacoesNaFila, erroDeEnvio, sincronizar } = useDados();
  const cuidaDoCaixa = usuario?.nivel === 'admin' || usuario?.nivel === 'financeiro';
  const abas = ABAS.filter((a) => !('soTesouraria' in a && a.soTesouraria) || cuidaDoCaixa);

  // As barras fixas das telas grudam logo abaixo do cabeçalho, seja qual for
  // a altura dele no aparelho (a faixa de status varia).
  useEffect(() => {
    const no = topo.current;
    if (!no) return;
    const medir = () => document.documentElement.style.setProperty('--topo', `${no.offsetHeight}px`);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(no);
    return () => observador.disconnect();
  }, []);

  return (
    <div className="min-h-dvh bg-paper pb-[calc(56px+env(safe-area-inset-bottom))]">
      <header ref={topo} className="nao-imprime sticky top-0 z-20 border-b-2 border-ouro bg-preto px-4 py-2.5 pt-[calc(0.6rem+env(safe-area-inset-top))]">
        <Marca />
      </header>

      {erroDeEnvio ? (
        <p className="nao-imprime border-b border-falta bg-[color-mix(in_srgb,var(--color-falta)_18%,var(--color-card))] px-4 py-2 text-[13px] leading-relaxed" role="alert">
          {erroDeEnvio}{' '}
          <button type="button" onClick={() => void sincronizar()} className="font-semibold underline">
            Tentar de novo
          </button>
        </p>
      ) : gravacoesNaFila > 0 ? (
        <p className="nao-imprime border-b border-line bg-card px-4 py-1.5 text-[12.5px] text-muted" role="status">
          {gravacoesNaFila === 1 ? 'Enviando uma alteração para a planilha…' : `Enviando ${gravacoesNaFila} alterações para a planilha…`}
        </p>
      ) : null}

      <Outlet />

      <nav
        aria-label="Seções do sistema"
        data-nav
        className="nao-imprime fixed inset-x-0 bottom-0 z-20 grid border-t border-line bg-card pb-[env(safe-area-inset-bottom)]"
        style={{ gridTemplateColumns: `repeat(${abas.length}, minmax(0, 1fr))` }}
      >
        {abas.map((aba) => (
          <NavLink
            key={aba.para}
            to={aba.para}
            end={aba.para === '/'}
            className={({ isActive }) =>
              [
                'flex flex-col items-center gap-0.5 border-t-2 py-1.5 text-[10.5px] font-medium',
                isActive ? 'border-ouro text-texto' : 'border-transparent text-muted',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icone nome={aba.icone} className={isActive ? 'h-5 w-5' : 'h-5 w-5 opacity-70'} />
                {aba.rotulo}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
