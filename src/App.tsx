import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProvedorAuth, useAuth } from './lib/auth';
import { ProvedorDados } from './lib/dados';
import { Casca } from './components/Casca';
import { Login } from './pages/Login';
import { Chamada } from './pages/Chamada';
import { Integrantes } from './pages/Integrantes';
import { Ficha } from './pages/Ficha';
import { Conta } from './pages/Conta';

function Rotas() {
  const { usuario, carregando } = useAuth();

  if (!usuario) {
    return carregando ? (
      <main className="grid min-h-dvh place-items-center bg-ink text-paper">
        <p className="text-sm text-paper/70">Verificando seu acesso…</p>
      </main>
    ) : (
      <Login />
    );
  }

  return (
    <ProvedorDados>
      <Routes>
        <Route element={<Casca />}>
          <Route path="/" element={<Chamada />} />
          <Route path="/integrantes" element={<Integrantes />} />
          <Route path="/integrantes/:id" element={<Ficha />} />
          <Route path="/conta" element={<Conta />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ProvedorDados>
  );
}

export function App() {
  return (
    <HashRouter>
      <ProvedorAuth>
        <Rotas />
      </ProvedorAuth>
    </HashRouter>
  );
}
