import { h, param, coverEl, initPage, gameUrl } from './common.js';

const { store } = await initPage('catalog');

const state = {
  q: param('q') || '',
  genre: param('genre') || '',
  platform: param('platform') || '',
  local: param('local') === '1',
  sort: param('sort') || 'top',
  page: Math.max(1, parseInt(param('page'), 10) || 1),
};

const $ = (id) => document.getElementById(id);

function syncUrl() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.genre) p.set('genre', state.genre);
  if (state.platform) p.set('platform', state.platform);
  if (state.local) p.set('local', '1');
  if (state.sort !== 'top') p.set('sort', state.sort);
  if (state.page > 1) p.set('page', state.page);
  history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname);
}

function gameCard(g) {
  return h('a', { class: 'card', href: gameUrl(g.id) },
    coverEl(g),
    h('div', { class: 'card-body' },
      h('h3', {}, g.title),
      h('p', { class: 'muted' }, [g.year, g.genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ')),
      h('div', { class: 'rating' }, g.avgRating != null ? `★ ${g.avgRating.toFixed(1)} (${g.reviewCount})` : 'No ratings yet'),
      g.isLocal ? h('span', { class: 'badge' }, 'Local/Indie') : null));
}

function renderPager(data) {
  const go = (page) => { state.page = page; load(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  $('pager').replaceChildren(
    ...(data.totalPages > 1
      ? [
          h('button', { class: 'btn', type: 'button', disabled: data.page <= 1, onclick: () => go(data.page - 1) }, 'Previous'),
          h('span', { class: 'muted' }, `Page ${data.page} of ${data.totalPages}`),
          h('button', { class: 'btn', type: 'button', disabled: data.page >= data.totalPages, onclick: () => go(data.page + 1) }, 'Next'),
        ]
      : []));
}

function load() {
  const data = store.listGames(state);
  state.page = data.page; // the store clamps out-of-range pages
  syncUrl();
  $('summary').textContent = `${data.total} game${data.total === 1 ? '' : 's'} found`;
  $('results').replaceChildren(...(data.items.length ? data.items.map(gameCard) : [h('p', { class: 'empty' }, 'No games match your filters.')]));
  renderPager(data);
}

function resetAndLoad() { state.page = 1; load(); }

const { genres, platforms } = store.filters();
for (const g of genres) $('genre').append(h('option', { value: g }, g));
for (const p of platforms) $('platform').append(h('option', { value: p }, p));
$('q').value = state.q;
$('genre').value = state.genre;
$('platform').value = state.platform;
$('sort').value = state.sort;
$('local').checked = state.local;

let timer;
$('q').addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => { state.q = $('q').value.trim(); resetAndLoad(); }, 200);
});
$('genre').addEventListener('change', () => { state.genre = $('genre').value; resetAndLoad(); });
$('platform').addEventListener('change', () => { state.platform = $('platform').value; resetAndLoad(); });
$('sort').addEventListener('change', () => { state.sort = $('sort').value; resetAndLoad(); });
$('local').addEventListener('change', () => { state.local = $('local').checked; resetAndLoad(); });
$('filters').addEventListener('submit', (e) => e.preventDefault());

load();
