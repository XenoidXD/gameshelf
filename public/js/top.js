import { h, coverEl, initPage, gameUrl } from './common.js';

const { store } = await initPage('top');
const select = document.getElementById('genre');
const list = document.getElementById('list');
const note = document.getElementById('note');

function row(g) {
  return h('li', { class: 'rank-item' },
    h('div', { class: 'rank-num' }, g.rank),
    h('a', { href: gameUrl(g.id) }, coverEl(g)),
    h('div', {},
      h('h3', {}, h('a', { href: gameUrl(g.id) }, g.title)),
      h('div', { class: 'rating' }, `★ ${g.avgRating.toFixed(1)} `, h('span', { class: 'muted' }, `from ${g.reviewCount} reviews`)),
      h('p', { class: 'muted' }, [g.year, g.genres.join(', ')].filter(Boolean).join(' · '))));
}

function load() {
  const genre = select.value;
  const data = store.top({ genre });
  note.textContent = `Games are ranked by average rating. Only games with at least ${data.minReviews} reviews are included.`;
  list.replaceChildren(...(data.items.length ? data.items.map(row) : [h('li', { class: 'empty' }, 'No ranked games for this genre yet.')]));
}

for (const g of store.filters().genres) select.append(h('option', { value: g }, g));
select.addEventListener('change', load);
load();
