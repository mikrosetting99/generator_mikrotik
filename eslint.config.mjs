import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Berkas template hotspot disajikan apa adanya ke router, bukan kode aplikasi.
      "public/hotspot-templates/**",
      // Template login page berlisensi: HTML dan JavaScript untuk router,
      // termasuk md5.js bawaan MikroTik yang sengaja tidak disentuh.
      "templates/**",
      // Bahan rujukan lokal, tidak ikut ter-commit.
      "_contoh-hotspot/**",
    ],
  },
];

export default eslintConfig;
