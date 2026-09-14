import { defineConfig } from 'vite';

const pdfjsCompat = new URL('./src/pdfjsCompat.ts', import.meta.url).pathname;

export default defineConfig({
  base: './',
  resolve: {
    alias: [
      {
        find: /^pdfjs-dist$/,
        replacement: pdfjsCompat,
      },
    ],
  },
  build: {
    target: 'es2022',
  },
});
