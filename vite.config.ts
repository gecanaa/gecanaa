import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// O GitHub Pages serve o site em /<nome-do-repositorio>/.
// Em desenvolvimento (npm run dev) a base é a raiz.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.BASE_PATH ?? '/gecanaa/') : '/',
  plugins: [react(), tailwindcss()],
}));
