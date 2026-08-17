import { defineConfig } from 'vite';

// base './' → la pieza se sirve desde una subcarpeta (video-editorial.web.app/BS-015/)
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist'
  }
});
