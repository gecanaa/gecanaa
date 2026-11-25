import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProvedorAuth, useAuth } from './lib/auth';
import { frase } from './lib/frases';
import { ProvedorDados } from './lib/dados';
import { Casca } from './components/Casca';
import { Login } from './pages/Login';
import { Chamada } from './pages/Chamada';
import { Integrantes } from './pages/Integrantes';
import { Ficha } from './pages/Ficha';
import { Relatorio } from './pages/Relatorio';
import { Imprimir } from './pages/Imprimir';
import { Financas } from './pages/Financas';
import { Conta } from './pages/Conta';

function Rotas() {
  const { usuario, carregando } = useAuth();

  if (!usuario) {
    return carregando ? (
      <main className="grid min-h-dvh place-items-center gap-5 bg-preto text-texto">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="h-44 w-44" />
        <p className="max-w-[24ch] px-6 text-center font-display text-[21px] font-[600] leading-snug text-ouro">{frase()}</p>
        <p className="text-[13px] text-muted">Verificando seu acesso…</p>
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
          <Route path="/relatorio" element={<Relatorio />} />
          <Route path="/financas" element={<Financas />} />
          <Route path="/imprimir" element={<Imprimir />} />
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
