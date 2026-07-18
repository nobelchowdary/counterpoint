import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    reportCompressedSize: false
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
