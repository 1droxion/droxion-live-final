// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",                     // <-- IMPORTANT for Capacitor
  plugins: [react()],
  build: { outDir: "dist" }       // Capacitor uses the "dist" folder
});