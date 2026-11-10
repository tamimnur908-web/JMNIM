import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5897,
    host: true, // Listen on all local addresses so localhost:5897 and network work reliably
  },
});
