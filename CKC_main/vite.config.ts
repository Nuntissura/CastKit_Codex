import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  // Packaged Electron builds load `dist/index.html` via `file://` (loadFile).
  // Vite's default `base: '/'` would emit `/assets/...` which breaks in `file://` and causes a white window.
  base: command === 'build' ? './' : '/',
  plugins: [react()],
  server: {
    strictPort: true,
  },
  build: {
    sourcemap: true,
  },
}));
