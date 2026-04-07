import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const emptyStub = resolve(__dirname, 'src/utils/empty-stub.js')

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  resolve: {
    alias: {
      fs: emptyStub,
      perf_hooks: emptyStub,
      os: emptyStub,
      worker_threads: emptyStub,
      crypto: emptyStub,
      stream: emptyStub,
    },
  },
  optimizeDeps: {
    exclude: ['opencascade.js'],
  },
  assetsInclude: ['**/*.wasm'],
})
