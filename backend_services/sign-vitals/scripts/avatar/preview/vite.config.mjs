// Dev-only preview harness for the 3D signer (screenshots + frame rate).
// Not part of the app. Run from backend_services/sign-vitals:
//   node ../../frontend/node_modules/vite/bin/vite.js --config scripts/avatar/preview/vite.config.mjs
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../../../..");
const MODULE = path.join(REPO, "frontend/src/modules/sign-vitals").replaceAll("\\", "/");
// The app's own Tailwind setup, so harness pages look like the app (styles.css).
const { default: tailwindcss } = await import(pathToFileURL(path.join(REPO, "frontend/node_modules/@tailwindcss/vite/dist/index.mjs")).href);

export default {
  root: HERE,
  publicDir: false,
  plugins: [tailwindcss()],
  css: { postcss: {} }, // don't search parent folders for a PostCSS config
  cacheDir: path.join(os.tmpdir(), "gloss-avatar-preview-vite"),
  define: { __MODULE_DIR__: JSON.stringify(MODULE) },
  // component.ts lives outside the frontend: resolve React from there.
  resolve: {
    alias: [{ find: /^(react|react-dom)(\/.*)?$/, replacement: `${REPO.replaceAll("\\", "/")}/frontend/node_modules/$1$2` }],
  },
  server: { port: 5199, strictPort: true, fs: { allow: [REPO] } },
};
