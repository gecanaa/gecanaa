import { NavLink, Outlet } from 'react-router-dom';
import { Marca } from './Marca';
import { Icone } from './Icone';

const ABAS = [
  { para: '/', rotulo: 'Chamada', icone: 'chamada' },
  { para: '/integrantes', rotulo: 'Integrantes', icone: 'pessoas' },
  { para: '/conta', rotulo: 'Conta', icone: 'conta' },
] as const;

export function Casca() {
  return (
    <div className="min-h-dvh bg-paper pb-[calc(64px+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 bg-ink px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <Marca />
      </header>

      <Outlet />

      <nav
        aria-label="Seções do sistema"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]"
      >
        {ABAS.map((aba) => (
          <NavLink
            key={aba.para}
            to={aba.para}
            end={aba.para === '/'}
            className={({ isActive }) =>
              [
                'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium',
                isActive ? 'text-ink' : 'text-muted',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icone nome={aba.icone} className={isActive ? 'h-6 w-6' : 'h-6 w-6 opacity-70'} />
                {aba.rotulo}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
