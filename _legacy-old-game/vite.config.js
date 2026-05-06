import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: process.env.VERCEL ? '/' : '/grimveil/',
  publicDir: 'assets',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html',
        game: './game.html',
      },
    },
  },
});
