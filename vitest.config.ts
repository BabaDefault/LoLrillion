import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Load .env / .env.local so the Supabase contract tests run when the project is configured.
    env: loadEnv(mode, process.cwd(), "SUPABASE_"),
  },
}));
