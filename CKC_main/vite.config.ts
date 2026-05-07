import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const MEDIAPIPE_WASM_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_module_internal.js',
  'vision_wasm_module_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

function mediapipeWasmSourceDir() {
  return path.resolve(process.cwd(), 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
}

function copyMediapipeWasmPlugin() {
  let resolvedOutDir = path.resolve(process.cwd(), '..', 'CKC_GOV', 'targets', 'scratch', 'renderer-dist');
  return {
    name: 'copy-mediapipe-wasm',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const requestPath = String(req.url || '').split('?')[0];
        if (!requestPath.startsWith('/wasm/')) {
          next();
          return;
        }
        const fileName = path.basename(requestPath);
        if (!MEDIAPIPE_WASM_FILES.includes(fileName)) {
          next();
          return;
        }
        const src = path.join(mediapipeWasmSourceDir(), fileName);
        if (!existsSync(src)) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        res.setHeader('content-type', fileName.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        res.end(readFileSync(src));
      });
    },
    configResolved(config) {
      resolvedOutDir = config.build.outDir;
    },
    closeBundle() {
      const srcDir = mediapipeWasmSourceDir();
      const outDir = path.resolve(resolvedOutDir, 'wasm');
      if (!existsSync(srcDir)) return;
      mkdirSync(outDir, { recursive: true });
      for (const fileName of MEDIAPIPE_WASM_FILES) {
        const src = path.join(srcDir, fileName);
        if (existsSync(src)) copyFileSync(src, path.join(outDir, fileName));
      }
    },
  };
}

export default defineConfig(({ command }) => ({
  // Packaged Electron builds load `dist/index.html` via `file://` (loadFile).
  // Vite's default `base: '/'` would emit `/assets/...` which breaks in `file://` and causes a white window.
  base: command === 'build' ? './' : '/',
  plugins: [react(), copyMediapipeWasmPlugin()],
  server: {
    strictPort: true,
  },
  build: {
    sourcemap: true,
  },
  worker: {
    format: 'es',
  },
}));
