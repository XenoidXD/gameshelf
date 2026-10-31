// Sample accounts, reviews, votes, and collections. Loaded once on the first visit
// so the site does not look empty. All content here is fictional demo data.

export const DEMO_PASSWORD = 'password123';

export const DEMO_USERS = [
  { name: 'Demo User', email: 'demo@gameshelf.test' },
  { name: 'Rina', email: 'rina@gameshelf.test' },
  { name: 'Budi', email: 'budi@gameshelf.test' },
  { name: 'Sari', email: 'sari@gameshelf.test' },
];

// [game id, user index, rating, review text]
const REVIEWS = [
  ['hades', 1, 5, 'Tight combat and a story that rewards every failed run. Easy to pick up, hard to put down.'],
  ['hades', 2, 5, 'Best roguelike I have played. The weapon variety keeps each attempt fresh.'],
  ['hades', 3, 4, 'Great pacing and music. A few late-game grinds feel repetitive.'],
  ['celeste', 0, 5, 'Precise platforming with a surprisingly personal story. The assist options are a nice touch.'],
  ['celeste', 1, 4, 'Challenging but fair. The soundtrack is excellent.'],
  ['stardew-valley', 2, 5, 'A cozy farming sim with a lot of depth. Easily hundreds of hours.'],
  ['stardew-valley', 3, 4, 'Relaxing and charming. The early game is slow but worth sticking with.'],
  ['the-witcher-3-wild-hunt', 0, 5, 'Side quests here are better than the main stories of many other games.'],
  ['the-witcher-3-wild-hunt', 1, 5, 'Huge world with great writing. Combat is simple but the quests carry it.'],
  ['hollow-knight', 2, 5, 'Atmospheric, deep, and generous with content for the price.'],
  ['hollow-knight', 3, 5, 'Beautiful art and tough bosses. Exploring the map never gets old.'],
  ['outer-wilds', 0, 5, 'A mystery best played knowing as little as possible. Unforgettable.'],
  ['outer-wilds', 2, 4, 'Brilliant design, though the piloting can be frustrating at first.'],
  ['elden-ring', 1, 5, 'Open world done right, with freedom to approach every fight your own way.'],
  ['elden-ring', 3, 4, 'Stunning world, but some bosses spike in difficulty very suddenly.'],
  ['dreadout', 0, 3, 'Interesting local horror setting. The controls feel dated but the atmosphere works.'],
  ['dreadout', 2, 4, 'Great to see Indonesian folklore in a horror game. Scary in the right ways.'],
  ['dreadout-2', 1, 4, 'A big step up in visuals and gameplay while keeping the local flavor.'],
  ['dreadout-2', 3, 3, 'Good atmosphere, but the pacing drags in a few chapters.'],
  ['coffee-talk', 0, 5, 'Warm, cozy, and thoughtful. The conversations stay with you.'],
  ['coffee-talk', 1, 5, 'A perfect late-night game. The writing and music fit together beautifully.'],
  ['coffee-talk', 2, 4, 'Short and sweet, with characters you genuinely care about.'],
  ['a-space-for-the-unbound', 3, 5, 'An emotional story with a strong sense of place. I finished it in one sitting.'],
  ['a-space-for-the-unbound', 1, 5, 'Beautiful pixel art and a story about growing up that really hits.'],
];

// [review index, voter user index]. A voter is never the review author.
const VOTES = [[0, 2], [0, 3], [1, 0], [3, 1], [5, 0], [7, 2], [7, 3], [9, 0], [11, 1], [11, 3], [19, 2], [19, 3], [20, 0], [22, 0], [22, 2], [16, 1]];

// [user index, game id, status]
const COLLECTIONS = [
  [0, 'hades', 'playing'], [0, 'elden-ring', 'wishlist'], [0, 'hollow-knight', 'completed'],
  [0, 'celeste', 'completed'], [0, 'dreadout-2', 'wishlist'], [1, 'outer-wilds', 'wishlist'],
  [2, 'stardew-valley', 'playing'],
];

// Fill an empty browser with demo data. Returns true if data was added.
export async function seedIfEmpty(store) {
  if (store.isSeeded()) return false;

  const users = [];
  for (const [i, u] of DEMO_USERS.entries()) {
    users.push({ id: i + 1, name: u.name, email: u.email, createdAt: new Date().toISOString(), ...(await store.makeCredentials(DEMO_PASSWORD)) });
  }

  // Skip entries for games that are not in the catalog (for example if games.json was edited).
  const hour = 3600 * 1000;
  const kept = REVIEWS.map((r, index) => ({ r, index })).filter(({ r }) => store.hasGame(r[0]));
  const idByOldIndex = new Map();
  const reviews = kept.map(({ r, index }, n) => {
    const createdAt = new Date(Date.now() - (REVIEWS.length - index) * 5 * hour).toISOString();
    idByOldIndex.set(index, n + 1);
    return { id: n + 1, gameId: r[0], userId: r[1] + 1, rating: r[2], body: r[3], createdAt, updatedAt: createdAt };
  });

  const votes = VOTES.filter(([reviewIdx]) => idByOldIndex.has(reviewIdx)).map(([reviewIdx, voter]) => ({ reviewId: idByOldIndex.get(reviewIdx), userId: voter + 1 }));
  const collections = COLLECTIONS.filter(([, gameId]) => store.hasGame(gameId)).map(([u, gameId, status]) => ({ userId: u + 1, gameId, status, updatedAt: new Date().toISOString() }));

  store.importData({ users, reviews, votes, collections });
  return true;
}
