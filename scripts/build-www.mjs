// Copies the web app into www/ for the native apps. The service worker is left out:
// native builds bundle the whole library and fetch weekly updates directly.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const out = 'www';
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ['index.html', 'app.js', 'manifest.webmanifest', 'privacy.html', 'support.html']) {
  try { cpSync(f, `${out}/${f}`); } catch {}
}
for (const d of ['icons', 'data']) cpSync(d, `${out}/${d}`, { recursive: true });
// stamp build time so the app knows how fresh its bundled library is
const idx = JSON.parse(readFileSync(`${out}/data/index.json`, 'utf8'));
idx.bundled = new Date().toISOString();
writeFileSync(`${out}/data/index.json`, JSON.stringify(idx));
console.log('www/ ready');
