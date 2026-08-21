import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: { popup: resolve(__dirname, 'popup.html'), options: resolve(__dirname, 'options.html'), offscreen: resolve(__dirname, 'offscreen.html'), background: resolve(__dirname, 'src/background/index.ts'), content: resolve(__dirname, 'src/content/index.ts') },
      output: {
        entryFileNames: (chunk) => ['background', 'content'].includes(chunk.name) ? '[name].js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
