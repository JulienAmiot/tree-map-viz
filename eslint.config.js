import tseslint from "typescript-eslint";
import globals from "globals";

const FORBID_LIT = ["lit", "lit/decorators.js", "lit/directives/class-map.js", "lit/directives/style-map.js", "lit-html"];

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "src/test/e2e/.features-gen/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
      ".scannerwork/**",
    ],
  },
  {
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ["src/domain/**/*.ts", "src/test/unit/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: ["**/application/**", "**/adapters/**", "**/main", "**/main.ts"],
        paths: FORBID_LIT,
      }],
    },
  },
  {
    files: ["src/application/**/*.ts", "src/test/unit/application/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: ["**/adapters/**", "**/main", "**/main.ts"],
        paths: FORBID_LIT,
      }],
    },
  },
  {
    files: ["src/adapters/**/*.ts", "src/test/unit/adapters/**/*.ts"],
    ignores: ["src/adapters/ui/**", "src/test/unit/adapters/ui/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: ["**/main", "**/main.ts"],
        paths: FORBID_LIT,
      }],
    },
  },
  {
    files: ["src/adapters/ui/**/*.ts", "src/test/unit/adapters/ui/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: ["**/main", "**/main.ts"],
      }],
    },
  },
  {
    files: ["src/test/e2e/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          "**/src/**",
          "**/domain/**",
          "**/application/**",
          "**/adapters/**",
          "**/main",
          "**/main.ts",
        ],
      }],
    },
  },
);
