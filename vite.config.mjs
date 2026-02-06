import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: path.resolve(__dirname, "src/ts/index.ts"),
        web: path.resolve(__dirname, "src/ts/web.ts"),
        node: path.resolve(__dirname, "src/ts/node.ts"),
        embedded: path.resolve(__dirname, "src/ts/embedded.ts"),
      },
      name: "ProjectorRaysWasm",
      formats: ["es", "cjs"],
      fileName: (format, entryName) => `${entryName}.${format}.js`,
    },
    outDir: "dist/pkg",
    emptyOutDir: false,
    sourcemap: true,
    target: "es2020",
    rollupOptions: {
      external: ["node:fs/promises", "node:module", "node:url"],
    },
  },
});
