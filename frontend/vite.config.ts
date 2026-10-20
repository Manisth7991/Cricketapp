import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_PROXY || 'http://localhost:5000';

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      port: Number(env.VITE_DEV_PORT) || 5173,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/uploads': { target: apiTarget, changeOrigin: true },
      },
    },
    preview: { port: 4173 },
    build: {
      target: 'es2022',
      cssCodeSplit: true,
      sourcemap: false,
      reportCompressedSize: true,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'react',
                test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/,
                priority: 30,
              },
              { name: 'query', test: /node_modules[\\/](@tanstack|axios)[\\/]/, priority: 20 },
              {
                name: 'forms',
                test: /node_modules[\\/](react-hook-form|@hookform|zod)[\\/]/,
                priority: 20,
              },
            ],
          },
        },
      },
    },
  };
});
