// Syncs the HarfBuzz subsetter wasm out of node_modules (its package exports
// block subpath imports, so Vite can't reference it directly).
// Re-run after upgrading harfbuzzjs: node scripts/copy-wasm.mjs
import { copyFile } from 'node:fs/promises';

const src = new URL('../node_modules/harfbuzzjs/dist/harfbuzz-subset.wasm', import.meta.url);
const dest = new URL('../public/hb-subset.wasm', import.meta.url);
await copyFile(src, dest);
console.log('public/hb-subset.wasm synced');
