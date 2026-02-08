import colloquiumConfig from "@colloquium/eslint-config";

export default [
  ...colloquiumConfig,
  {
    ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
  },
];
