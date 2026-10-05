import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' makes the built site work at any GitHub Pages address
// (https://<user>.github.io/<repo-name>/) without extra setup.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { chunkSizeWarningLimit: 1500, assetsInlineLimit: 200000 },
})
