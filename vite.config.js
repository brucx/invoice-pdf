import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        'invoice-template-pdf': resolve(import.meta.dirname, 'invoice-template-pdf.html'),
        'blank-invoice-template': resolve(import.meta.dirname, 'blank-invoice-template.html'),
        'freelance-invoice-template': resolve(import.meta.dirname, 'freelance-invoice-template.html'),
        'bilingual-invoice-template': resolve(import.meta.dirname, 'bilingual-invoice-template.html'),
        'korean-invoice-template': resolve(import.meta.dirname, 'korean-invoice-template.html'),
        'vietnamese-invoice-template': resolve(import.meta.dirname, 'vietnamese-invoice-template.html'),
        'spanish-invoice-template': resolve(import.meta.dirname, 'spanish-invoice-template.html'),
        'german-invoice-template': resolve(import.meta.dirname, 'german-invoice-template.html'),
        'french-invoice-template': resolve(import.meta.dirname, 'french-invoice-template.html'),
        'indonesian-invoice-template': resolve(import.meta.dirname, 'indonesian-invoice-template.html'),
      },
    },
  },
});
