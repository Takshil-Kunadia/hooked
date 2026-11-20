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
    include: ["src/**/*.test.{ts,tsx}", "tools/**/*.test.ts", "tests/data/**/*.test.ts", "tests/e2e/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        // The Hook Lab and the story trust this engine to behave exactly like WordPress.
        "src/lib/hook-engine/**": { lines: 95, functions: 95, branches: 95, statements: 95 },
      },
    },
  },
});
