import { defineConfig } from 'vite';
import { resolve } from 'path';

// Bundled build - includes Lit for CDN/script tag usage
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'LitPromptConfig',
      formats: ['iife'],
      fileName: () => 'lit-prompt-config.bundled.js'
    },
    emptyOutDir: false,
    sourcemap: true
  }
});
