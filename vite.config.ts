import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/backend-api": {
          target: env.BACKEND_URL || "http://localhost:8080",
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/backend-api/, "/api"),
        },
      },
    },
  };
});
