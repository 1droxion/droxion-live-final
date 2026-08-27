import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "./livekit/livekitRoom",
        replacement: fileURLToPath(new URL("./src/livekit/livekitRoomV2Compat.js", import.meta.url)),
      },
    ],
  },
  build: {
    outDir: "dist",
  },
});
