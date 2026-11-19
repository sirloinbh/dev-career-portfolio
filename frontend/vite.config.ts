// Managed file. Edit it in sirloinbh/project-standards templates/app/frontend/
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
// Ports come from the central registry (slot 8). Browser tests run the API on 3208 so a local dev server can keep 3108.
const api = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3108';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5208, strictPort: true, proxy: { '/api': api } },
});
