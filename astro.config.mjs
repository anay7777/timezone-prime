// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://timezoneprime.com',
  trailingSlash: 'always',
  output: 'static',
  compressHTML: true,
  devToolbar: {
    enabled: false,
  },
  build: {
    format: 'directory',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
