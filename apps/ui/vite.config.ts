import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const SERVER_PORT = 37003;
const UI_PORT = Number(process.env.VITE_PORT ?? 37004);

export default defineConfig({
  plugins: [react()],
  server: {
    port: UI_PORT,
    proxy: {
      "/api": `http://127.0.0.1:${SERVER_PORT}`,
      "/ws": {
        target: `ws://127.0.0.1:${SERVER_PORT}`,
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
