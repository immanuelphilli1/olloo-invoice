import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The API runs on :8787 in dev (API_PORT to change); same-origin /api keeps cookies simple.
    proxy: { '/api': `http://localhost:${process.env.API_PORT || 8787}` },
  },
});
