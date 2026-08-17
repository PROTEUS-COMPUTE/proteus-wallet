import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tauri expects a fixed port and drives the dev server itself.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: {
    target: 'es2021',
    outDir: 'dist',
    // @polkadot/api is large and split across many chunks; the default 500 kB
    // warning fires on a build that is perfectly fine for a local app.
    chunkSizeWarningLimit: 2500,
  },
});
