import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Pure logic in src/lib runs in Node. Component tests opt into a DOM per file
 * with a `// @vitest-environment jsdom` comment once they exist.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
