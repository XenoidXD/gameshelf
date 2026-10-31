import { h, param, coverEl, initPage, notify, loginUrl, stars, fmtDate } from './common.js';

const { store, user } = await initPage('catalog');
const root = document.getElementById('game');
const gameId = param('id') || '';

// Run an action and show its error message instead of crashing.
function attempt(fn, successMessage) {
  try {
    fn();
    if (successMessage) notify(successMessage, 'success');
    return true;
  } catch (err) {
    notify(err.message, 'error');
    return false;
  }
}

function load() {
  let game;
  try {
    game = store.getGame(gameId);
  } catch (err) {
    root.replaceChildren(h('p', { class: 'empty error' }, err.message));
    return;
  }
  document.title = `${game.title} | PustakaGame`;
  root.replaceChildren(
    headerSection(game),
    h('section', { class: 'panel' }, h('h2', {}, 'About'), h('p', { class: 'description' }, game.description || 'No description yet.')),
    reviewsSection(store.listReviews(gameId)));
}

function headerSection(game) {
  const total = game.reviewCount;
  const bars = [5, 4, 3, 2, 1].map((n) => {
    const count = game.distribution[n] || 0;
    const fill = h('div', { class: 'bar-fill' });
    fill.style.width = `${total ? Math.round((count / total) * 100) : 0}%`;
    return h('div', { class: 'bar-row' }, h('span', {}, `${n}★`), h('div', { class: 'bar' }, fill), h('span', { class: 'muted' }, count));
  });

  return h('section', { class: 'game-header' },
    coverEl(game, 'cover cover-large'),
    h('div', { class: 'game-info' },
      h('h1', {}, game.title),
      h('p', { class: 'muted' }, [game.year, game.genres.join(', ')].filter(Boolean).join(' · ')),
      h('div', { class: 'tags' },
        game.isLocal ? h('span', { class: 'badge' }, 'Local/Indie') : null,
        game.platforms.slice(0, 8).map((p) => h('span', { class: 'tag' }, p))),
      h('div', { class: 'score' },
        game.avgRating != null
          ? [h('span', { class: 'score-num' }, game.avgRating.toFixed(1)), h('span', { class: 'stars' }, stars(game.avgRating)),
             h('span', { class: 'muted' }, `${total} review${total === 1 ? '' : 's'}`)]
          : h('span', { class: 'muted' }, 'No ratings yet')),
      h('div', { class: 'bars' }, bars),
      collectionControl(game)));
}

function collectionControl(game) {
  const options = [['', 'Add to collection'], ['wishlist', 'Wishlist'], ['playing', 'Playing'], ['completed', 'Completed']];
  const select = h('select', { id: 'collection' }, options.map(([value, label]) => h('option', { value }, label)));
  select.value = game.myStatus || '';
  select.addEventListener('change', () => {
    if (!user) { location.href = loginUrl(); return; }
    if (select.value === '') attempt(() => store.clearCollection(gameId), 'Removed from your collection');
    else attempt(() => store.setCollection(gameId, select.value), 'Collection updated');
  });
  return h('div', { class: 'collection' }, h('label', { for: 'collection' }, 'My collection'), select);
}

function reviewForm(mine) {
  if (!user) {
    return h('p', { class: 'muted' }, h('a', { class: 'link', href: loginUrl() }, 'Log in'), ' to write a review.');
  }
  const rating = h('select', { id: 'rating' }, [5, 4, 3, 2, 1].map((n) => h('option', { value: n }, `${n} - ${'★'.repeat(n)}`)));
  const body = h('textarea', { id: 'body', rows: '4', maxlength: '2000', placeholder: 'What did you think? (at least 10 characters)' });
  if (mine) { rating.value = String(mine.rating); body.value = mine.body; }

  const removeReview = () => {
    if (confirm('Delete your review?') && attempt(() => store.deleteReview(mine.id), 'Review deleted')) load();
  };
  const form = h('form', { class: 'review-form' },
    h('label', { for: 'rating' }, 'Your rating'), rating,
    h('label', { for: 'body' }, 'Your review'), body,
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-primary', type: 'submit' }, mine ? 'Update review' : 'Post review'),
      mine ? h('button', { class: 'btn btn-danger', type: 'button', onclick: removeReview }, 'Delete my review') : null));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const payload = { rating: Number(rating.value), body: body.value };
    const done = mine
      ? attempt(() => store.updateReview(mine.id, payload), 'Review updated')
      : attempt(() => store.addReview(gameId, payload), 'Review posted');
    if (done) load();
  });
  return form;
}

function reviewItem(r) {
  const vote = () => {
    if (!user) { location.href = loginUrl(); return; }
    if (attempt(() => store.toggleVote(r.id))) load();
  };
  return h('article', { class: 'review' },
    h('header', {},
      h('strong', {}, r.author),
      r.mine ? h('span', { class: 'tag' }, 'You') : null,
      h('span', { class: 'stars', 'aria-label': `${r.rating} out of 5` }, stars(r.rating)),
      h('span', { class: 'muted' }, fmtDate(r.createdAt))),
    h('p', {}, r.body),
    h('button', {
      class: `btn btn-small ${r.voted ? 'btn-primary' : ''}`, type: 'button', disabled: r.mine,
      title: r.mine ? 'You cannot vote on your own review' : 'Mark as helpful', onclick: vote,
    }, `Helpful (${r.votes})`));
}

function reviewsSection(items) {
  return h('section', { class: 'panel' },
    h('h2', {}, 'Reviews'),
    reviewForm(items.find((r) => r.mine)),
    items.length ? items.map(reviewItem) : h('p', { class: 'empty' }, 'No reviews yet. Be the first!'));
}

load();
