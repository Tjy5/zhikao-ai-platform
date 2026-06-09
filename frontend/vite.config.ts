import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const parsePort = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const devPort = parsePort(process.env.FRONTEND_PORT || process.env.PORT, 3000);
const devHost = process.env.FRONTEND_HOST || process.env.HOST || true;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: devPort,
    host: devHost,
  },
  preview: {
    port: devPort,
    host: devHost,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
