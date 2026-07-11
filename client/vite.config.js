import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: { "/api": { target: "http://localhost:9000", changeOrigin: true } } },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split large, rarely-changing vendor libraries out of the main
        // entry chunk so they cache independently across app deploys
        // (returning visitors re-download only the app-code chunk, not
        // React/Redux again) instead of all bundling into one ~578kB file.
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "redux-vendor": ["@reduxjs/toolkit", "react-redux", "redux-persist"],
        },
      },
    },
  },
});
