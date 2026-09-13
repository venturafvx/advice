import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextConfig from "eslint-config-next";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "**/drizzle/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node } } },
  ...nextConfig.map((config) => ({
    ...config,
    files: ["apps/web/**/*.{ts,tsx}"],
    settings: { ...config.settings, next: { rootDir: "apps/web" } },
  })),
  // O webhook de deploy é um script CommonJS avulso: roda no Node do VPS
  // via systemd, fora do monorepo e sem build. `require` ali é a forma
  // correta, não um resquício — a regra existe para o código TypeScript.
  {
    files: ["infra/webhook/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  eslintConfigPrettier,
);
