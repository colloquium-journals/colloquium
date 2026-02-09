import reactConfig from "@colloquium/eslint-config/react";

export default [
  ...reactConfig,
  {
    ignores: ["**/node_modules/**", "**/dist/**"],
  },
];
