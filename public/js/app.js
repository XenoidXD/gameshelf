// Creates the single store used by every page: loads the game list, connects the
// browser storage, and loads demo data on the first visit.
import { createStore } from './core/store.js';
import { browserStorage } from './core/storage.js';
import { seedIfEmpty } from './core/demo.js';

let pending;

export function getStore() {
  pending ??= (async () => {
    const res = await fetch('data/games.json');
    if (!res.ok) throw new Error('Could not load the game data.');
    const { games } = await res.json();
    const store = createStore({ storage: browserStorage(), games });
    await seedIfEmpty(store);
    return store;
  })();
  return pending;
}
