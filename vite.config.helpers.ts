import { defineConfig } from 'vite';
import { resolve } from 'path';

// Build helper modules
export default defineConfig({
  build: {
    lib: {
      entry: {
        'helpers/openrouter': resolve(__dirname, 'src/helpers/openrouter.ts'),
        'helpers/anthropic': resolve(__dirname, 'src/helpers/anthropic.ts'),
        'helpers/langchain': resolve(__dirname, 'src/helpers/langchain.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['lit', 'lit/decorators.js'],
    },
    emptyOutDir: false,
    sourcemap: true,
  },
});
