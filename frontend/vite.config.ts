import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The FastAPI backend runs on :8000. Proxy API calls and product images so the
// front end can use relative URLs like /api/products and /media/products/x.jpg.
const BACKEND = 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': BACKEND,
      '/media': BACKEND,
    },
  },
})
