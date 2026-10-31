// Fetches and adds specific games by RAWG slug into games.json.
// Usage: node scripts/patch-covers.js
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataFile = path.join(root, 'public', 'data', 'games.json');
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

function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function rawg(key, slug) {
  const url = new URL(`${BASE}/games/${slug}`);
  url.searchParams.set('key', key);
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`RAWG ${res.status}`);
  return res.json();
}

await loadEnvFile();
const key = process.env.RAWG_API_KEY;
if (!key) { console.error('RAWG_API_KEY is not set.'); process.exit(1); }

// New Indonesian games to add (RAWG slug used as game id)
const NEW_SLUGS = [
  'troublemaker',
  'troublemaker-2-beyond-dream',
  'kuloniku-bowl-up',
];

const data = JSON.parse(await readFile(dataFile, 'utf8'));
const existingIds = new Set(data.games.map((g) => g.id));

for (const slug of NEW_SLUGS) {
  if (existingIds.has(slug)) {
    console.log(`(already exists) ${slug}`);
    continue;
  }
  try {
    const raw = await rawg(key, slug);
    const game = {
      id: raw.slug || `game-${raw.id}`,
      rawgId: raw.id,
      title: raw.name,
      description: stripHtml(raw.description_raw || raw.description),
      cover: raw.background_image || null,
      year: raw.released ? (Number(String(raw.released).slice(0, 4)) || null) : null,
      genres: (raw.genres || []).map((x) => x.name),
      platforms: (raw.platforms || []).map((p) => p.platform?.name).filter(Boolean),
      isLocal: true,
    };
    data.games.push(game);
    existingIds.add(game.id);
    console.log(`✓ ${raw.name}  cover: ${raw.background_image ? 'yes' : 'NONE'}`);
  } catch (err) {
    console.warn(`✗ ${slug}: ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 250));
}

data.generatedAt = new Date().toISOString();
await writeFile(dataFile, JSON.stringify(data, null, 2) + '\n');
console.log('\nDone. games.json updated.');
