import { defineConfig } from "vitest/config";

// Engine tests are pure TypeScript (no DOM); a node environment is enough. Individual
// files that need a DOM can opt in with a `// @vitest-environment jsdom` header.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
