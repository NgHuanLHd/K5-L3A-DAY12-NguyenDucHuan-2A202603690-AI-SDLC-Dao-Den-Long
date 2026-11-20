import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { outDir: "dist-web", emptyOutDir: true, chunkSizeWarningLimit: 800 },
  test: { include: ["tests/**/*.test.ts"] },
} as never);
