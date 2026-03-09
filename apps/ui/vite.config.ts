import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const port = parseInt(process.env.PORT ?? "", 10) || 37003;

export default defineConfig({
  plugins: [react()],
  server: {
    port,
  },
  build: {
    outDir: "dist",
  },
});
