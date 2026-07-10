import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/clockify/generated/**", "src/**/*.d.ts"],
      thresholds: {
        statements: 97,
        branches: 92,
        functions: 98,
        lines: 98,
      },
    },
    typecheck: {
      checker: "tsc",
    },
  },
});
