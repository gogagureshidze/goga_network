import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
export default defineConfig([
  ...nextVitals,
  // Legacy components predate these opt-in compiler diagnostics; retain core correctness lint.
  {files:['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],rules:{'react-hooks/set-state-in-effect':'off','react-hooks/refs':'off','react-hooks/purity':'off','react-hooks/immutability':'off','react-hooks/preserve-manual-memoization':'off','react-hooks/static-components':'off','react-hooks/incompatible-library':'off','react/no-unescaped-entities':'warn','@next/next/no-html-link-for-pages':'warn','@next/next/no-img-element':'warn'}},
  globalIgnores(['.next/**','src/generated/**','coverage/**','node_modules/**']),
]);
