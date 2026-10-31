// Search RAWG for specific game titles and print results.
// Usage: node scripts/search-rawg.js
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://api.rawg.io/api';

async function loadEnvFile() {
  try {
    const text = await readFile(path.join(root, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* ignore */ }
}

async function rawg(key, pathname, params = {}) {
  const url = new URL(BASE + pathname);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set('key', key);
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`RAWG ${res.status}`);
  return res.json();
}

await loadEnvFile();
const key = process.env.RAWG_API_KEY;
if (!key) { console.error('RAWG_API_KEY is not set.'); process.exit(1); }

const queries = ['Troublemaker', 'Troublemaker 2', 'Kulon', 'Bowl Up'];

for (const q of queries) {
  console.log(`\n=== Searching: "${q}" ===`);
  try {
    const res = await rawg(key, '/games', { search: q, page_size: 5 });
    if (!res.results || res.results.length === 0) {
      console.log('  (no results)');
    } else {
      for (const g of res.results) {
        console.log(`  slug=${g.slug}`);
        console.log(`  name=${g.name}`);
        console.log(`  released=${g.released || 'N/A'}`);
        console.log(`  cover=${g.background_image || 'none'}`);
        console.log('  ---');
      }
    }
  } catch (err) {
    console.warn(`  Error: ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 300));
}
