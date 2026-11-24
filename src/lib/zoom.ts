import { useEffect } from 'react';

const TRAVADO = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
const LIVRE = 'width=device-width, initial-scale=1, viewport-fit=cover';

/**
 * O app fica com o zoom travado, para um toque durante a chamada nunca virar
 * zoom sem querer. Telas de leitura densa (relatório e impressão) liberam.
 */
export function useZoomLiberado() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    meta.setAttribute('content', LIVRE);
    return () => meta.setAttribute('content', TRAVADO);
  }, []);
}
