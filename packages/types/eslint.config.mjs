import baseConfig from "@colloquium/eslint-config/base";

export default [
  ...baseConfig,
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/*.d.ts"],
  },
];
