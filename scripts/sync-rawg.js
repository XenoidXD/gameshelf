// Usage: npm run sync [count]     (count: 1 to 40, default 20)
// Fetches popular games from RAWG and merges them into public/data/games.json.
// Runs on your machine or in GitHub Actions, so the API key never reaches the website.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapRawgGame, mergeGames } from './lib/rawg.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataFile = path.join(root, 'public', 'data', 'games.json');
const BASE = 'https://api.rawg.io/api';

// Minimal .env reader so the project needs no dependencies.
async function loadEnvFile() {
  try {
    const text = await readFile(path.join(root, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env file, rely on real environment variables */ }
}

async function rawg(key, pathname, params = {}) {
  const url = new URL(BASE + pathname);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set('key', key);
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`RAWG responded with status ${res.status}`);
  return res.json();
}

await loadEnvFile();
const key = process.env.RAWG_API_KEY;
if (!key) {
  console.error('RAWG_API_KEY is not set. Put it in a .env file (see .env.example) or in the environment.');
  process.exit(1);
}

const count = Math.min(40, Math.max(1, parseInt(process.argv[2], 10) || 20));
const current = JSON.parse(await readFile(dataFile, 'utf8'));

try {
  const list = await rawg(key, '/games', { ordering: '-added', page_size: count });
  const incoming = [];
  for (const item of list.results) {
    try {
      incoming.push(mapRawgGame(await rawg(key, `/games/${item.id}`))); // the list endpoint has no description
      console.log('Fetched:', item.name);
    } catch (err) {
      console.warn(`Skipped ${item.name}: ${err.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200)); // be polite to the API
  }

  const games = mergeGames(current.games, incoming);
  await writeFile(dataFile, JSON.stringify({ generatedAt: new Date().toISOString(), source: 'rawg', games }, null, 2) + '\n');
  console.log(`Done. ${incoming.length} games fetched, ${games.length} games in total.`);
} catch (err) {
  console.error('Sync failed:', err.message);
  process.exit(1);
}
