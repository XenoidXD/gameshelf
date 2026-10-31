// Fetches 100 popular games from RAWG (via pagination, max 40 per request)
// and merges them into public/data/games.json.
// Usage: node scripts/add-100-games.js
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapRawgGame, mergeGames } from './lib/rawg.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataFile = path.join(root, 'public', 'data', 'games.json');
const BASE = 'https://api.rawg.io/api';
const TARGET = 100;
const PAGE_SIZE = 40; // RAWG max per page

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
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`RAWG ${res.status}: ${pathname}`);
  return res.json();
}

await loadEnvFile();
const key = process.env.RAWG_API_KEY;
if (!key) {
  console.error('RAWG_API_KEY is not set. Put it in a .env file or in the environment.');
  process.exit(1);
}

const current = JSON.parse(await readFile(dataFile, 'utf8'));
// Track existing slugs so we skip duplicates
const existingSlugs = new Set(current.games.map((g) => g.id));

const incoming = [];
let page = 1;
let totalFetched = 0;

console.log(`Fetching ${TARGET} games from RAWG (page_size=${PAGE_SIZE})...\n`);

outer:
while (incoming.length < TARGET) {
  let list;
  try {
    list = await rawg(key, '/games', { ordering: '-added', page_size: PAGE_SIZE, page });
  } catch (err) {
    console.error(`Failed to fetch page ${page}: ${err.message}`);
    break;
  }

  if (!list.results || list.results.length === 0) break;

  for (const item of list.results) {
    if (incoming.length >= TARGET) break outer;
    // Skip if already in the list (by slug)
    if (existingSlugs.has(item.slug)) {
      console.log(`  (skip existing) ${item.name}`);
      continue;
    }
    try {
      const detail = await rawg(key, `/games/${item.id}`);
      const mapped = mapRawgGame(detail);
      incoming.push(mapped);
      existingSlugs.add(mapped.id);
      totalFetched++;
      console.log(`[${totalFetched}/${TARGET}] ${item.name}`);
    } catch (err) {
      console.warn(`  Skipped ${item.name}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  // No more pages
  if (!list.next) break;
  page++;
}

if (incoming.length === 0) {
  console.log('No new games fetched.');
  process.exit(0);
}

const games = mergeGames(current.games, incoming);
await writeFile(dataFile, JSON.stringify({ generatedAt: new Date().toISOString(), source: 'rawg', games }, null, 2) + '\n');
console.log(`\nDone. ${incoming.length} new games added. Total: ${games.length} games in games.json.`);
