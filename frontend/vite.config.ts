import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// El puerto 5173 es el contrato del monorepo (CORS del backend apunta a http://localhost:5173).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
});
