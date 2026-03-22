import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: '/game.html',  // Open game directly in dev
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      // Also copy game.html to dist
    }
  },
  publicDir: 'public', // game.html lives in public/
})
