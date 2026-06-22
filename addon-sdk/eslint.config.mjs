import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

const nodeGlobals = {
  Buffer: "readonly",
  Headers: "readonly",
  Request: "readonly",
  Response: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  console: "readonly",
  fetch: "readonly",
  process: "readonly",
};

const vitestGlobals = {
  afterEach: "readonly",
  beforeAll: "readonly",
  beforeEach: "readonly",
  describe: "readonly",
  expect: "readonly",
  it: "readonly",
  test: "readonly",
  vi: "readonly",
};

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "*.tgz",
      "../MARKETPLACE_DOCS/**",
      "schemas/clockify-manifests/**",
      "src/clockify/generated/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ["**/*.{js,cjs,mjs,ts}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: nodeGlobals,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-undef": "off",
    },
  },
  {
    files: ["scripts/**/*.cjs", "scripts/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      globals: vitestGlobals,
    },
  },
);
