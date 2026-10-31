import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, AppError } from '../public/js/core/store.js';
import { memoryStorage } from '../public/js/core/storage.js';
import { seedIfEmpty, DEMO_PASSWORD } from '../public/js/core/demo.js';

const GAMES = [
  { id: 'best-rpg', title: 'Best RPG', genres: ['RPG'], platforms: ['PC'], year: 2022, isLocal: false },
  { id: 'good-rpg', title: 'Good RPG', genres: ['RPG'], platforms: ['PC', 'Switch'], year: 2020, isLocal: false },
  { id: 'one-review', title: 'One Review RPG', genres: ['RPG'], platforms: ['PC'], year: 2021, isLocal: true },
  { id: 'puzzle', title: 'Puzzle Game', genres: ['Puzzle'], platforms: ['Switch'], year: 2019, isLocal: false },
  { id: 'percent', title: '100% Complete', genres: ['Puzzle'], platforms: ['PC'], year: 2018, isLocal: false },
].map((g) => ({ rawgId: null, description: '', cover: null, ...g }));

// Fast hashing in tests. Each "browser" has its own storage, like a separate visitor.
const newStore = (storage = memoryStorage()) => createStore({ storage, games: GAMES, iterations: 1000 });
const signUp = (store, name) => store.register({ name, email: `${name.toLowerCase()}@test.dev`, password: 'password123' });
const throwsApp = (fn, pattern) => assert.throws(fn, (err) => err instanceof AppError && pattern.test(err.message));

test('register, session, logout, login, and wrong password', async () => {
  const store = newStore();
  await signUp(store, 'Alice');
  assert.equal(store.currentUser().name, 'Alice');

  store.logout();
  assert.equal(store.currentUser(), null);

  assert.equal((await store.login({ email: 'ALICE@test.dev', password: 'password123' })).name, 'Alice');
  await assert.rejects(store.login({ email: 'alice@test.dev', password: 'wrong-password' }), /Invalid email or password/);
  await assert.rejects(signUp(store, 'Alice'), /already registered/);
  await assert.rejects(store.register({ name: 'A', email: 'bad', password: 'x' }), AppError);
});

test('passwords are hashed and sessions survive a reload', async () => {
  const storage = memoryStorage();
  const store = newStore(storage);
  await signUp(store, 'Alice');

  assert.ok(!storage.getItem('gs.users').includes('password123'), 'plain password must not be stored');
  assert.equal(newStore(storage).currentUser().name, 'Alice'); // a new store on the same storage
});

test('writing requires login', () => {
  const store = newStore();
  throwsApp(() => store.addReview('best-rpg', { rating: 5, body: 'Good game overall.' }), /log in/i);
  throwsApp(() => store.setCollection('best-rpg', 'wishlist'), /log in/i);
  throwsApp(() => store.toggleVote(1), /log in/i);
});

test('one review per user per game, with input validation', async () => {
  const store = newStore();
  await signUp(store, 'Alice');
  store.addReview('best-rpg', { rating: 5, body: 'This is a perfectly fine review.' });

  throwsApp(() => store.addReview('best-rpg', { rating: 3, body: 'A second review for the same game.' }), /already reviewed/);
  throwsApp(() => store.addReview('good-rpg', { rating: 6, body: 'Rating is out of range.' }), /Rating/);
  throwsApp(() => store.addReview('good-rpg', { rating: 4, body: 'short' }), /Review must be/);
  throwsApp(() => store.addReview('missing', { rating: 4, body: 'This game does not exist.' }), /not found/);
});

test('average rating is calculated from reviews and follows edits and deletes', async () => {
  const storage = memoryStorage();
  const alice = newStore(storage);
  await signUp(alice, 'Alice');
  const first = alice.addReview('best-rpg', { rating: 5, body: 'Loved every minute of it.' });
  await signUp(alice, 'Bob'); // same browser, switch account
  alice.addReview('best-rpg', { rating: 4, body: 'Solid, with a few rough edges.' });

  let game = alice.getGame('best-rpg');
  assert.equal(game.avgRating, 4.5);
  assert.equal(game.reviewCount, 2);
  assert.deepEqual(game.distribution, { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 });

  throwsApp(() => alice.deleteReview(first.id), /only change your own/); // Bob cannot touch Alice's review

  await alice.login({ email: 'alice@test.dev', password: 'password123' });
  alice.updateReview(first.id, { rating: 1, body: 'Changed my mind about this.' });
  assert.equal(alice.getGame('best-rpg').avgRating, 2.5);

  alice.deleteReview(first.id);
  game = alice.getGame('best-rpg');
  assert.equal(game.avgRating, 4);
  assert.equal(game.reviewCount, 1);
});

test('helpful votes: not on own review, toggle, and they change the order', async () => {
  const store = newStore();
  await signUp(store, 'Alice');
  const aliceReview = store.addReview('best-rpg', { rating: 5, body: 'Alice wrote this review.' });
  await signUp(store, 'Bob');
  const bobReview = store.addReview('best-rpg', { rating: 4, body: 'Bob wrote this review.' });
  throwsApp(() => store.toggleVote(bobReview.id), /own review/);

  await signUp(store, 'Carol');
  assert.deepEqual(store.toggleVote(bobReview.id), { voted: true, votes: 1 });
  const list = store.listReviews('best-rpg');
  assert.equal(list[0].author, 'Bob'); // most helpful first
  assert.equal(list[0].voted, true);
  assert.equal(list[1].id, aliceReview.id);

  assert.deepEqual(store.toggleVote(bobReview.id), { voted: false, votes: 0 });
});

test('deleting a review also removes its votes', async () => {
  const store = newStore();
  await signUp(store, 'Alice');
  const review = store.addReview('best-rpg', { rating: 5, body: 'Alice wrote this review.' });
  await signUp(store, 'Bob');
  store.toggleVote(review.id);
  await store.login({ email: 'alice@test.dev', password: 'password123' });
  store.deleteReview(review.id);
  assert.equal(store.listReviews('best-rpg').length, 0);
});

test('collection keeps one status per user and game', async () => {
  const store = newStore();
  await signUp(store, 'Alice');
  store.setCollection('puzzle', 'wishlist');
  store.setCollection('puzzle', 'completed');
  throwsApp(() => store.setCollection('puzzle', 'nope'), /Status must be/);

  const mine = store.myCollection();
  assert.equal(mine.wishlist.length, 0);
  assert.equal(mine.completed.length, 1);
  assert.equal(store.getGame('puzzle').myStatus, 'completed');

  store.clearCollection('puzzle');
  assert.equal(store.myCollection().completed.length, 0);
});

test('top per genre ranks by average and applies the minimum review threshold', async () => {
  const store = newStore();
  for (const name of ['Alice', 'Bob']) {
    await signUp(store, name);
    store.addReview('best-rpg', { rating: 5, body: 'Best RPG review text.' });
    store.addReview('good-rpg', { rating: 4, body: 'Good RPG review text.' });
    store.addReview('puzzle', { rating: 5, body: 'Puzzle review text here.' });
    if (name === 'Alice') store.addReview('one-review', { rating: 5, body: 'Only one person reviewed this.' });
  }

  const rpg = store.top({ genre: 'RPG' });
  assert.deepEqual(rpg.items.map((g) => [g.rank, g.title]), [[1, 'Best RPG'], [2, 'Good RPG']]); // 'One Review RPG' is below the threshold
  assert.deepEqual(store.top().items.map((g) => g.title), ['Best RPG', 'Puzzle Game', 'Good RPG']);
});

test('catalog search, filters, sorting, and pagination', () => {
  const store = newStore();
  assert.equal(store.listGames({ q: 'rpg' }).total, 3);
  assert.equal(store.listGames({ q: '100%' }).total, 1); // % is treated literally
  assert.equal(store.listGames({ genre: 'Puzzle' }).total, 2);
  assert.equal(store.listGames({ platform: 'Switch' }).total, 2);
  assert.equal(store.listGames({ local: true }).items[0].title, 'One Review RPG');
  assert.equal(store.listGames({ sort: 'newest' }).items[0].title, 'Best RPG');

  const page = store.listGames({ sort: 'title', pageSize: 2, page: 3 });
  assert.equal(page.items.length, 1);
  assert.equal(page.totalPages, 3);
  assert.equal(store.listGames({ page: 99, pageSize: 2 }).page, 3); // out-of-range page is clamped
  assert.deepEqual(store.filters().genres, ['Puzzle', 'RPG']);
});

test('corrupted saved data does not crash the app', () => {
  const storage = memoryStorage();
  storage.setItem('gs.reviews', '{not json');
  assert.equal(newStore(storage).listGames().total, 5);
});

test('demo data loads once and the demo account can log in', async () => {
  const store = createStore({ storage: memoryStorage(), games: GAMES.concat([{ id: 'hades', title: 'Hades', genres: ['Action'], platforms: ['PC'], year: 2020, isLocal: false, rawgId: null, description: '', cover: null }]), iterations: 1000 });
  assert.equal(await seedIfEmpty(store), true);
  assert.equal(await seedIfEmpty(store), false);

  const user = await store.login({ email: 'demo@pustakagame.test', password: DEMO_PASSWORD });
  assert.equal(user.name, 'Demo User');
  assert.equal(store.getGame('hades').reviewCount, 3); // entries for games missing from the catalog are skipped
  assert.ok(store.listReviews('hades').some((r) => r.votes > 0));

  store.reset();
  assert.equal(store.currentUser(), null);
  assert.equal(store.isSeeded(), false);
});
