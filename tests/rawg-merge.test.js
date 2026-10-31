import test from 'node:test';
import assert from 'node:assert/strict';
import { mapRawgGame, mergeGames } from '../scripts/lib/rawg.js';

const raw = (over = {}) => ({
  id: 3328,
  slug: 'the-witcher-3-wild-hunt',
  name: 'The Witcher 3: Wild Hunt',
  description_raw: '<p>An open world RPG.</p>',
  background_image: 'https://media.rawg.io/media/games/a.jpg',
  released: '2015-05-18',
  genres: [{ name: 'Action' }, { name: 'RPG' }],
  platforms: [{ platform: { name: 'PC' } }, { platform: { name: 'PlayStation 4' } }],
  ...over,
});

test('mapRawgGame converts a RAWG game to our format', () => {
  const g = mapRawgGame(raw());
  assert.equal(g.id, 'the-witcher-3-wild-hunt');
  assert.equal(g.year, 2015);
  assert.equal(g.description, 'An open world RPG.');
  assert.deepEqual(g.genres, ['Action', 'RPG']);
  assert.deepEqual(g.platforms, ['PC', 'PlayStation 4']);
  assert.equal(g.isLocal, false);
});

test('mapRawgGame copes with missing fields', () => {
  const g = mapRawgGame({ id: 9, name: 'Mystery' });
  assert.equal(g.id, 'game-9');
  assert.equal(g.cover, null);
  assert.equal(g.year, null);
  assert.deepEqual(g.genres, []);
});

test('mergeGames enriches matches, keeps ids and the local flag, and appends new games', () => {
  const existing = [
    { id: 'witcher-old-id', rawgId: null, title: 'The Witcher 3: Wild Hunt', description: 'old', cover: null, year: 2015, genres: ['RPG'], platforms: ['PC'], isLocal: false },
    { id: 'dreadout', rawgId: null, title: 'DreadOut', description: 'local game', cover: null, year: 2014, genres: ['Horror'], platforms: ['PC'], isLocal: true },
  ];
  const incoming = [
    mapRawgGame(raw()),
    mapRawgGame(raw({ id: 111, slug: 'dreadout', name: 'Dreadout', description_raw: '', background_image: null })),
    mapRawgGame(raw({ id: 222, slug: 'new-game', name: 'New Game' })),
  ];

  const merged = mergeGames(existing, incoming);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].id, 'witcher-old-id'); // id is kept so saved reviews still match
  assert.equal(merged[0].cover, 'https://media.rawg.io/media/games/a.jpg');
  assert.equal(merged[0].rawgId, 3328);
  assert.equal(merged[1].isLocal, true); // local flag survives
  assert.equal(merged[1].title, 'DreadOut');
  assert.equal(merged[1].description, 'local game'); // empty RAWG description does not erase ours
  assert.equal(merged[2].id, 'new-game');
});

test('mergeGames avoids duplicate ids and is idempotent', () => {
  const existing = [{ id: 'clash', rawgId: 1, title: 'Other', description: '', cover: null, year: 2000, genres: [], platforms: [], isLocal: false }];
  const incoming = [mapRawgGame(raw({ id: 5, slug: 'clash', name: 'Clashing Game' }))];
  const once = mergeGames(existing, incoming);
  assert.deepEqual(once.map((g) => g.id), ['clash', 'clash-5']);
  assert.equal(mergeGames(once, incoming).length, 2);
});
