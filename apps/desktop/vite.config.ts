import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const rendererRoot = fileURLToPath(new URL('./src/renderer', import.meta.url))

export default defineConfig({
  root: rendererRoot,
  base: './',
  build: {
    outDir: fileURLToPath(new URL('./lib/renderer', import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./src/renderer/plugins.html', import.meta.url)),
    },
  },
})
