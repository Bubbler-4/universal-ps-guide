import tseslint from "typescript-eslint";

export default tseslint.config(...tseslint.configs.recommended, {
  files: ["**/*.{ts,tsx}"],
  rules: {
    // SolidJS uses `ref` prop to assign variables without reassignment in code
    "@typescript-eslint/no-unused-vars": "off",
  },
});
