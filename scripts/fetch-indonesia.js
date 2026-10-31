// Fetches 10 games from RAWG, prioritising Indonesian-made titles,
// and merges them (with cover images) into public/data/games.json.
// Usage: node scripts/fetch-indonesia.js
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapRawgGame, mergeGames } from './lib/rawg.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataFile = path.join(root, 'public', 'data', 'games.json');
const BASE = 'https://api.rawg.io/api';

// Minimal .env reader
async function loadEnvFile() {
  try {
    const text = await readFile(path.join(root, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env file */ }
}

async function rawg(key, pathname, params = {}) {
  const url = new URL(BASE + pathname);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set('key', key);
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`RAWG ${res.status}: ${pathname}`);
  return res.json();
}

// Indonesian game slugs to look up specifically (RAWG slugs)
const INDONESIAN_SLUGS = [
  'dreadout',
  'dreadout-2',
  'coffee-talk',
  'a-space-for-the-unbound',
  'pamali-indonesian-folklore-horror',
  'coral-island',
  'devil-returned-to-school-days',
  'rage-among-the-stars',
];

await loadEnvFile();
const key = process.env.RAWG_API_KEY;
if (!key) {
  console.error('RAWG_API_KEY is not set. Put it in a .env file or in the environment.');
  process.exit(1);
}

const current = JSON.parse(await readFile(dataFile, 'utf8'));
const incoming = [];

// 1. Fetch Indonesian games by slug
console.log('\n=== Fetching Indonesian games ===');
for (const slug of INDONESIAN_SLUGS) {
  if (incoming.length >= 8) break;
  try {
    const data = await rawg(key, `/games/${slug}`);
    incoming.push(mapRawgGame(data));
    console.log(`✓ ${data.name}`);
  } catch (err) {
    console.warn(`  Skipped ${slug}: ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 250));
}

// 2. Fill remaining slots (up to 10) with popular games that have covers
if (incoming.length < 10) {
  const need = 10 - incoming.length;
  console.log(`\n=== Fetching ${need} popular games to fill ===`);
  try {
    const list = await rawg(key, '/games', {
      ordering: '-added',
      page_size: need + 5, // fetch a few extra to account for skips
    });
    const existingSlugs = new Set(incoming.map((g) => g.id));
    for (const item of list.results) {
      if (incoming.length >= 10) break;
      if (existingSlugs.has(item.slug)) continue;
      try {
        const detail = await rawg(key, `/games/${item.id}`);
        incoming.push(mapRawgGame(detail));
        existingSlugs.add(item.slug);
        console.log(`✓ ${item.name}`);
      } catch (err) {
        console.warn(`  Skipped ${item.name}: ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  } catch (err) {
    console.warn(`  Could not fetch popular games: ${err.message}`);
  }
}

const games = mergeGames(current.games, incoming);
await writeFile(dataFile, JSON.stringify({ generatedAt: new Date().toISOString(), source: 'rawg', games }, null, 2) + '\n');
console.log(`\nDone. ${incoming.length} games fetched, ${games.length} total in games.json.`);
