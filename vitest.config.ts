import { defineConfig } from "vitest/config";
import { resolve } from "path";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "~": resolve(__dirname, "./src"),
    },
  },
});
