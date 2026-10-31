// Storage backends. The browser uses localStorage; tests (and private mode
// fallback) use an in-memory object with the same small interface.

export function memoryStorage() {
  const map = new Map();
  return {
    persistent: false,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

export function browserStorage() {
  try {
    const s = window.localStorage;
    s.setItem('__gs_probe', '1');
    s.removeItem('__gs_probe');
    return s;
  } catch {
    return memoryStorage(); // storage blocked (private mode or browser settings)
  }
}
