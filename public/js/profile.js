import { h, initPage, loginUrl, stars, fmtDate, gameUrl } from './common.js';

const { store, user } = await initPage('profile');
const root = document.getElementById('profile');

if (!user) {
  location.href = loginUrl();
} else {
  const collection = store.myCollection();
  const reviews = store.myReviews();

  const column = (title, games) => h('div', { class: 'panel' },
    h('h3', {}, `${title} (${games.length})`),
    games.length
      ? h('ul', { class: 'mini-list' }, games.map((g) => h('li', {}, h('a', { href: gameUrl(g.id) }, g.title))))
      : h('p', { class: 'muted' }, 'Nothing here yet.'));

  const reviewRow = (r) => h('article', { class: 'review' },
    h('header', {},
      h('a', { class: 'link', href: gameUrl(r.gameId) }, r.title),
      h('span', { class: 'stars' }, stars(r.rating)),
      h('span', { class: 'muted' }, `${fmtDate(r.createdAt)} · ${r.votes} helpful`)),
    h('p', {}, r.body));

  root.replaceChildren(
    h('h1', {}, user.name),
    h('p', { class: 'muted' }, user.email),
    h('h2', {}, 'My collection'),
    h('div', { class: 'columns' }, column('Wishlist', collection.wishlist), column('Playing', collection.playing), column('Completed', collection.completed)),
    h('section', { class: 'panel' },
      h('h2', {}, `My reviews (${reviews.length})`),
      reviews.length ? reviews.map(reviewRow) : h('p', { class: 'empty' }, 'You have not written any reviews yet.')));
}
