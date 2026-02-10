import colloquiumConfig from "@colloquium/eslint-config";

export default [
  ...colloquiumConfig,
  {
    ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
  },
  {
    rules: {
      // Downgrade to warnings until existing code is cleaned up
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "prefer-const": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];
