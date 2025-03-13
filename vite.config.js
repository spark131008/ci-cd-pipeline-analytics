import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3001,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
        onError(err, req, res) {
          console.error("Proxy error:", err);
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Proxy error, backend is unreachable.");
        },
      },
    },
    open: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});