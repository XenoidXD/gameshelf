// All application logic lives here, with no DOM access, so it can be tested in
// Node.js. Games are read-only data (from data/games.json); users, reviews,
// votes, collections, and the session are saved through the storage backend.
import { hashPassword, randomSalt, safeEqual } from './crypto.js';

export class AppError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AppError';
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES = ['wishlist', 'playing', 'completed'];
const KEYS = {
  users: 'gs.users',
  reviews: 'gs.reviews',
  votes: 'gs.votes',
  collections: 'gs.collections',
  session: 'gs.session',
  seeded: 'gs.seeded',
};

const cmp = (a, b) => String(a).localeCompare(String(b));
const SORTS = {
  top: (a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1) || b.reviewCount - a.reviewCount || cmp(a.title, b.title),
  newest: (a, b) => (b.year ?? 0) - (a.year ?? 0) || cmp(a.title, b.title),
  reviews: (a, b) => b.reviewCount - a.reviewCount || cmp(a.title, b.title),
  title: (a, b) => cmp(a.title, b.title),
};

function cleanText(value, min, max, label) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (s.length < min || s.length > max) throw new AppError(`${label} must be ${min} to ${max} characters`);
  return s;
}

function checkRating(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new AppError('Rating must be a whole number from 1 to 5');
  return n;
}

export function createStore({ storage, games, iterations = 100000, now = () => new Date().toISOString(), minReviewsForTop = 2 }) {
  const gameById = new Map(games.map((g) => [g.id, g]));

  const read = (key) => {
    try {
      const value = JSON.parse(storage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };
  const write = (key, value) => storage.setItem(key, JSON.stringify(value));
  const nextId = (list) => list.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

  async function makeCredentials(password) {
    const salt = randomSalt();
    return { salt, iterations, hash: await hashPassword(password, salt, iterations) };
  }

  function currentUser() {
    const id = Number(storage.getItem(KEYS.session));
    if (!Number.isInteger(id) || id < 1) return null;
    const user = read(KEYS.users).find((u) => u.id === id);
    return user ? publicUser(user) : null;
  }

  function requireUser() {
    const user = currentUser();
    if (!user) throw new AppError('Please log in first');
    return user;
  }

  function requireGame(id) {
    const game = gameById.get(String(id));
    if (!game) throw new AppError('Game not found');
    return game;
  }

  // Average rating is always calculated from reviews, never stored.
  function statsByGame() {
    const map = new Map();
    for (const r of read(KEYS.reviews)) {
      const s = map.get(r.gameId) || { sum: 0, count: 0 };
      s.sum += r.rating;
      s.count += 1;
      map.set(r.gameId, s);
    }
    return map;
  }
  const withStats = (game, map) => {
    const s = map.get(game.id);
    return { ...game, reviewCount: s ? s.count : 0, avgRating: s ? Math.round((s.sum / s.count) * 10) / 10 : null };
  };

  function ownReview(id) {
    const user = requireUser();
    const review = read(KEYS.reviews).find((r) => r.id === Number(id));
    if (!review) throw new AppError('Review not found');
    if (review.userId !== user.id) throw new AppError('You can only change your own review');
    return review;
  }

  return {
    persistent: storage.persistent !== false,
    makeCredentials,
    hasGame: (id) => gameById.has(id),

    // Accounts
    currentUser,

    async register({ name, email, password }) {
      name = cleanText(name, 2, 40, 'Name');
      email = cleanText(email, 5, 120, 'Email').toLowerCase();
      if (!EMAIL_RE.test(email)) throw new AppError('Invalid email address');
      if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
        throw new AppError('Password must be 8 to 72 characters');
      }
      const credentials = await makeCredentials(password);
      const users = read(KEYS.users); // read after hashing so a second tab cannot be overwritten
      if (users.some((u) => u.email === email)) throw new AppError('Email is already registered');
      const user = { id: nextId(users), name, email, createdAt: now(), ...credentials };
      write(KEYS.users, [...users, user]);
      storage.setItem(KEYS.session, String(user.id));
      return publicUser(user);
    },

    async login({ email, password }) {
      const wanted = String(email || '').trim().toLowerCase();
      const user = read(KEYS.users).find((u) => u.email === wanted);
      const ok = user && safeEqual(await hashPassword(String(password || ''), user.salt, user.iterations), user.hash);
      if (!ok) throw new AppError('Invalid email or password');
      storage.setItem(KEYS.session, String(user.id));
      return publicUser(user);
    },

    logout() {
      storage.removeItem(KEYS.session);
    },

    // Catalog
    filters() {
      const genres = new Set();
      const platforms = new Set();
      for (const g of games) {
        g.genres.forEach((x) => genres.add(x));
        g.platforms.forEach((x) => platforms.add(x));
      }
      return { genres: [...genres].sort(cmp), platforms: [...platforms].sort(cmp) };
    },

    listGames({ q = '', genre = '', platform = '', local = false, sort = 'top', page = 1, pageSize = 12 } = {}) {
      const needle = String(q).trim().toLowerCase();
      const stats = statsByGame();
      const filtered = games
        .filter((g) => !needle || g.title.toLowerCase().includes(needle))
        .filter((g) => !genre || g.genres.includes(genre))
        .filter((g) => !platform || g.platforms.includes(platform))
        .filter((g) => !local || g.isLocal)
        .map((g) => withStats(g, stats))
        .sort(SORTS[sort] || SORTS.top);

      const size = Math.min(48, Math.max(1, Number(pageSize) || 12));
      const totalPages = Math.max(1, Math.ceil(filtered.length / size));
      const current = Math.min(totalPages, Math.max(1, Number(page) || 1));
      return {
        items: filtered.slice((current - 1) * size, current * size),
        page: current,
        pageSize: size,
        total: filtered.length,
        totalPages,
      };
    },

    getGame(id) {
      const game = requireGame(id);
      const reviews = read(KEYS.reviews).filter((r) => r.gameId === game.id);
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      reviews.forEach((r) => { distribution[r.rating] += 1; });

      const user = currentUser();
      const mine = user && read(KEYS.collections).find((c) => c.userId === user.id && c.gameId === game.id);
      return { ...withStats(game, statsByGame()), distribution, myStatus: mine ? mine.status : null };
    },

    // Reviews: most helpful first, then newest.
    listReviews(gameId) {
      const user = currentUser();
      const users = new Map(read(KEYS.users).map((u) => [u.id, u.name]));
      const votes = read(KEYS.votes);
      return read(KEYS.reviews)
        .filter((r) => r.gameId === String(gameId))
        .map((r) => ({
          id: r.id,
          rating: r.rating,
          body: r.body,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          author: users.get(r.userId) || 'Unknown',
          votes: votes.filter((v) => v.reviewId === r.id).length,
          voted: Boolean(user && votes.some((v) => v.reviewId === r.id && v.userId === user.id)),
          mine: Boolean(user && r.userId === user.id),
        }))
        .sort((a, b) => b.votes - a.votes || cmp(b.createdAt, a.createdAt) || b.id - a.id);
    },

    // One review per user per game.
    addReview(gameId, { rating, body }) {
      const user = requireUser();
      const game = requireGame(gameId);
      const value = checkRating(rating);
      const text = cleanText(body, 10, 2000, 'Review');
      const reviews = read(KEYS.reviews);
      if (reviews.some((r) => r.gameId === game.id && r.userId === user.id)) {
        throw new AppError('You already reviewed this game. Edit your existing review instead.');
      }
      const review = { id: nextId(reviews), gameId: game.id, userId: user.id, rating: value, body: text, createdAt: now(), updatedAt: now() };
      write(KEYS.reviews, [...reviews, review]);
      return review;
    },

    updateReview(id, { rating, body }) {
      const review = ownReview(id);
      const value = checkRating(rating);
      const text = cleanText(body, 10, 2000, 'Review');
      write(KEYS.reviews, read(KEYS.reviews).map((r) => (r.id === review.id ? { ...r, rating: value, body: text, updatedAt: now() } : r)));
    },

    deleteReview(id) {
      const review = ownReview(id);
      write(KEYS.reviews, read(KEYS.reviews).filter((r) => r.id !== review.id));
      write(KEYS.votes, read(KEYS.votes).filter((v) => v.reviewId !== review.id));
    },

    // Toggle a "helpful" vote. Not allowed on your own review.
    toggleVote(reviewId) {
      const user = requireUser();
      const review = read(KEYS.reviews).find((r) => r.id === Number(reviewId));
      if (!review) throw new AppError('Review not found');
      if (review.userId === user.id) throw new AppError('You cannot vote on your own review');

      let votes = read(KEYS.votes);
      const exists = votes.some((v) => v.reviewId === review.id && v.userId === user.id);
      votes = exists
        ? votes.filter((v) => !(v.reviewId === review.id && v.userId === user.id))
        : [...votes, { reviewId: review.id, userId: user.id }];
      write(KEYS.votes, votes);
      return { voted: !exists, votes: votes.filter((v) => v.reviewId === review.id).length };
    },

    // Collection: one status per user and game.
    setCollection(gameId, status) {
      const user = requireUser();
      const game = requireGame(gameId);
      if (!STATUSES.includes(status)) throw new AppError('Status must be wishlist, playing, or completed');
      const rest = read(KEYS.collections).filter((c) => !(c.userId === user.id && c.gameId === game.id));
      write(KEYS.collections, [...rest, { userId: user.id, gameId: game.id, status, updatedAt: now() }]);
    },

    clearCollection(gameId) {
      const user = requireUser();
      write(KEYS.collections, read(KEYS.collections).filter((c) => !(c.userId === user.id && c.gameId === String(gameId))));
    },

    myCollection() {
      const user = requireUser();
      const grouped = { wishlist: [], playing: [], completed: [] };
      const rows = read(KEYS.collections).filter((c) => c.userId === user.id).sort((a, b) => cmp(b.updatedAt, a.updatedAt));
      for (const c of rows) {
        const g = gameById.get(c.gameId);
        if (g) grouped[c.status].push({ id: g.id, title: g.title, cover: g.cover, year: g.year });
      }
      return grouped;
    },

    myReviews() {
      const user = requireUser();
      const votes = read(KEYS.votes);
      return read(KEYS.reviews)
        .filter((r) => r.userId === user.id && gameById.has(r.gameId))
        .sort((a, b) => cmp(b.createdAt, a.createdAt))
        .map((r) => ({
          id: r.id,
          rating: r.rating,
          body: r.body,
          createdAt: r.createdAt,
          gameId: r.gameId,
          title: gameById.get(r.gameId).title,
          votes: votes.filter((v) => v.reviewId === r.id).length,
        }));
    },

    // Top games, optionally per genre. Games below the review threshold are not ranked.
    top({ genre = '', min = minReviewsForTop, limit = 10 } = {}) {
      const stats = statsByGame();
      const items = games
        .map((g) => withStats(g, stats))
        .filter((g) => g.reviewCount >= min && (!genre || g.genres.includes(genre)))
        .sort(SORTS.top)
        .slice(0, limit)
        .map((g, i) => ({ rank: i + 1, ...g }));
      return { genre: genre || null, minReviews: min, items };
    },

    // Demo data and reset
    isSeeded: () => storage.getItem(KEYS.seeded) === '1',
    importData({ users, reviews, votes, collections }) {
      write(KEYS.users, users);
      write(KEYS.reviews, reviews);
      write(KEYS.votes, votes);
      write(KEYS.collections, collections);
      storage.setItem(KEYS.seeded, '1');
    },
    reset() {
      Object.values(KEYS).forEach((key) => storage.removeItem(key));
    },
  };
}
