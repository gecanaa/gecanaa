import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Só a casca entra na pré-carga: página, estilo, código principal e o
 * brasão. O que é pesado e sob demanda (gerador de PDF, ícones grandes)
 * fica de fora, para a primeira visita não baixar o que talvez nem use.
 */
function essencial(nome: string): boolean {
  if (/\.(map|webmanifest)$/.test(nome) || nome === 'sw.js') return false;
  if (/^(jspdf|html2canvas|index\.es)/.test(nome)) return false;
  if (/^icone-(512|maskable)/.test(nome)) return false;
  return /\.(html|css)$/.test(nome) || /^index-.*\.js$/.test(nome) || /^(logo|favicon)/.test(nome);
}

/** Escreve no service worker a lista de arquivos deste build. */
function precargaDoServiceWorker(base: string): Plugin {
  return {
    name: 'sw-precarga',
    apply: 'build',
    closeBundle() {
      const raiz = 'dist';
      const lista: string[] = [];
      const andar = (pasta: string) => {
        for (const nome of readdirSync(pasta)) {
          const caminho = join(pasta, nome);
          if (statSync(caminho).isDirectory()) andar(caminho);
          else if (essencial(nome)) {
            lista.push(base + relative(raiz, caminho).split('\\').join('/'));
          }
        }
      };
      andar(raiz);
      const sw = readFileSync('public/sw.js', 'utf8').replace("'__ARQUIVOS__'", JSON.stringify(lista));
      writeFileSync(join(raiz, 'sw.js'), sw);
    },
  };
}

// O GitHub Pages serve o site em /<nome-do-repositorio>/.
// Em desenvolvimento (npm run dev) a base é a raiz.
export default defineConfig(({ command }) => {
  const base = command === 'build' ? (process.env.BASE_PATH ?? '/gecanaa/') : '/';
  return {
    base,
    plugins: [react(), tailwindcss(), precargaDoServiceWorker(base)],
  };
});
