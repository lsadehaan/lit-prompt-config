import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'LitPromptConfig',
      formats: ['es'],
      fileName: 'lit-prompt-config'
    },
    rollupOptions: {
      external: ['lit', 'lit/decorators.js'],
      output: {
        globals: {
          lit: 'Lit',
          'lit/decorators.js': 'Lit'
        }
      }
    },
    emptyOutDir: false,
    sourcemap: true
  }
});
