import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => {
          // Extract the 'path' query parameter value for the local proxy
          const url = new URL(path, 'http://localhost');
          const yahooPath = url.searchParams.get('path');
          return yahooPath ? `/${yahooPath}` : path.replace(/^\/api\/yahoo/, '');
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://finance.yahoo.com'
        }
      }
    }
  }
})
