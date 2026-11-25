import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Tira a abertura assim que a interface aparece.
requestAnimationFrame(() => document.documentElement.classList.add('montado'));

/**
 * Se a folha de estilo não chegou (rede ruim no meio do carregamento), a
 * tela sai sem formatação nenhuma. Nesse caso vale uma recarga, uma vez só,
 * em vez de deixar o chefe diante de um amontoado de texto.
 */
const CHAVE_RECARGA = 'sge:recarregou-sem-estilo';
window.addEventListener('load', () => {
  const pronto = getComputedStyle(document.documentElement).getPropertyValue('--css-pronto').trim() === '1';
  if (pronto) {
    sessionStorage.removeItem(CHAVE_RECARGA);
    return;
  }
  if (!sessionStorage.getItem(CHAVE_RECARGA)) {
    sessionStorage.setItem(CHAVE_RECARGA, '1');
    location.reload();
  }
});

// localhost também é contexto seguro: dá para testar o modo offline na máquina.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  // Quando uma versão nova assume, a página recarrega uma vez sozinha. Sem
  // isso, quem tem o app instalado continua vendo a versão guardada.
  // A primeira tomada de controle não é atualização: recarregar ali seria um
  // piscar à toa. Da segunda em diante, é versão nova e a página recarrega.
  let controlado = !!navigator.serviceWorker.controller;
  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlado) {
      controlado = true;
      return;
    }
    if (recarregando) return;
    recarregando = true;
    location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const registro = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
      // Procura versão nova ao abrir e sempre que o app volta para a frente.
      const procurar = () => {
        if (document.visibilityState === 'visible') void registro.update();
      };
      procurar();
      document.addEventListener('visibilitychange', procurar);
    } catch {
      /* sem service worker o app funciona, só não guarda a casca */
    }
  });
}
