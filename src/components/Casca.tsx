import { NavLink, Outlet } from 'react-router-dom';
import { Marca } from './Marca';
import { Icone } from './Icone';

const ABAS = [
  { para: '/', rotulo: 'Chamada', icone: 'chamada' },
  { para: '/integrantes', rotulo: 'Integrantes', icone: 'pessoas' },
  { para: '/relatorio', rotulo: 'Relatório', icone: 'relatorio' },
  { para: '/conta', rotulo: 'Conta', icone: 'conta' },
] as const;

export function Casca() {
  return (
    <div className="min-h-dvh bg-paper pb-[calc(56px+env(safe-area-inset-bottom))]">
      <header className="nao-imprime sticky top-0 z-20 border-b-2 border-ouro bg-preto px-4 py-2.5 pt-[calc(0.6rem+env(safe-area-inset-top))]">
        <Marca />
      </header>

      <Outlet />

      <nav
        aria-label="Seções do sistema"
        data-nav
        className="nao-imprime fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]"
      >
        {ABAS.map((aba) => (
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
