import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const target = env.VITE_OMADA_BASE_URL;

  return {
    plugins: [react()],
    server: {
      proxy: target
        ? {
            '/omada-api': {
              target,
              changeOrigin: true,
              secure: true,
              rewrite: (path: string) => path.replace(/^\/omada-api/, ''),
            },
          }
        : undefined,
    },
  };
});
