import baseConfig from "@colloquium/eslint-config/base";

export default [
  ...baseConfig,
  {
    ignores: ["**/node_modules/**", "**/dist/**"],
  },
  {
    rules: {
      // Downgrade to warnings until existing code is cleaned up
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "@typescript-eslint/no-namespace": "warn",
      "prefer-const": "warn",
    },
  },
];
