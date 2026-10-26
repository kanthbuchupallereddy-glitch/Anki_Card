import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Development and production both serve compiled assets through the local API.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: { outDir: 'dist', assetsDir: 'assets', sourcemap: false, emptyOutDir: true },
});
