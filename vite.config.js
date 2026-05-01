import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/grimveil/',
  publicDir: 'assets',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
  },
});
