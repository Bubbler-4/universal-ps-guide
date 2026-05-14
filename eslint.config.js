import tseslint from "typescript-eslint";
import solid from "eslint-plugin-solid/configs/typescript";

export default tseslint.config(...tseslint.configs.recommended, {
  files: ["**/*.{ts,tsx}"],
  ...solid,
});
