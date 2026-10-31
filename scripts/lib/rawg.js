// Pure helpers for turning RAWG responses into our games.json format.
// Kept free of network code so they can be unit tested.

const normalize = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');

function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function mapRawgGame(raw) {
  return {
    id: raw.slug || `game-${raw.id}`,
    rawgId: raw.id,
    title: raw.name,
    description: stripHtml(raw.description_raw || raw.description),
    cover: raw.background_image || null,
    year: raw.released ? Number(String(raw.released).slice(0, 4)) || null : null,
    genres: (raw.genres || []).map((g) => g.name),
    platforms: (raw.platforms || []).map((p) => p.platform && p.platform.name).filter(Boolean),
    isLocal: false,
  };
}

// Merge RAWG games into the existing list. A RAWG game that matches an existing
// one (same RAWG id or same title) enriches it; the id and the "Local/Indie" flag
// are kept so saved reviews and links keep working. Everything else is appended.
export function mergeGames(existing, incoming) {
  const result = existing.map((g) => ({ ...g }));
  const usedIds = new Set(result.map((g) => g.id));

  for (const inc of incoming) {
    const index = result.findIndex((g) => (g.rawgId && g.rawgId === inc.rawgId) || normalize(g.title) === normalize(inc.title));
    if (index >= 0) {
      const old = result[index];
      result[index] = {
        ...old,
        rawgId: inc.rawgId,
        title: old.isLocal ? old.title : inc.title,
        description: inc.description || old.description,
        cover: inc.cover || old.cover,
        year: inc.year ?? old.year,
        genres: inc.genres.length ? inc.genres : old.genres,
        platforms: inc.platforms.length ? inc.platforms : old.platforms,
      };
    } else {
      const id = usedIds.has(inc.id) ? `${inc.id}-${inc.rawgId}` : inc.id;
      usedIds.add(id);
      result.push({ ...inc, id });
    }
  }
  return result;
}
