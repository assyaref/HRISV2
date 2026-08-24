import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build version di-inject saat build supaya bisa diverifikasi di console
// browser bahwa bundle terbaru benar-benar dipakai (bukan cache lama).
const buildVersion = `${new Date().toISOString().slice(0, 10)}.${Date.now().toString(36)}`;

// https://vite.dev/config/
export default defineConfig({
  // Relative assets keep the build portable for both project Pages and
  // user/organisation Pages URLs.
  base: './',
  plugins: [react(), tailwindcss()/*, viteSingleFile()*/],
  build: {
    minify: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  define: {
    __BUILD_VERSION__: JSON.stringify(buildVersion),
  },
});