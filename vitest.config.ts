import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "#nitro/virtual/polyfills": path.resolve(__dirname, "./src/test/mocks/empty.ts"),
      "#nitro/virtual/public-assets": path.resolve(__dirname, "./src/test/mocks/nitro-public-assets.ts"),
    },
  },
});
