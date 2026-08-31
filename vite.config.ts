import { defineConfig } from "vite";

export default defineConfig({
  // Relative paths so the same build works from any path, and so the service
  // worker's precache entries resolve the same way the browser requests them.
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
    // Every asset stays a real file so the service worker can cache it. An
    // inlined asset is one the SW cannot see and cannot serve offline.
    assetsInlineLimit: 0,
  },
});
