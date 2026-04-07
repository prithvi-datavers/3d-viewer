import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const emptyStub = path.resolve(__dirname, 'src/utils/empty-stub.js')

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  resolve: {
    alias: {
      // Stub Node.js builtins required by opencascade.js in browser
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
