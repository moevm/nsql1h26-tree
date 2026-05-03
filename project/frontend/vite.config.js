import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0", // чтобы Vite был доступен снаружи контейнера
    proxy: {
      "/api": {
        target: "http://backend:8000", // имя сервиса из docker-compose
        changeOrigin: true,
      },
    },
  },
});