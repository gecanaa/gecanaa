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
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
