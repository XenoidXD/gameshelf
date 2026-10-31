// Shared UI helpers used by every page: DOM builder, navigation, footer, toasts.
import { getStore } from './app.js';

// Build DOM elements safely. Text is always added as a text node, never as HTML,
// so user content cannot inject markup (XSS).
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export const param = (name) => new URLSearchParams(location.search).get(name);

export const gameUrl = (id) => `game.html?id=${encodeURIComponent(id)}`;

export function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function stars(rating) {
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

export function coverEl(game, cls = 'cover') {
  if (game.cover) {
    return h('img', { class: cls, src: game.cover, alt: `${game.title} cover`, loading: 'lazy', referrerpolicy: 'no-referrer' });
  }
  return h('div', { class: `${cls} cover-placeholder`, role: 'img', 'aria-label': `${game.title} (no cover)` }, game.title.charAt(0).toUpperCase());
}

export function notify(message, type = 'info') {
  let box = document.getElementById('toasts');
  if (!box) {
    box = h('div', { id: 'toasts', class: 'toasts', 'aria-live': 'polite' });
    document.body.append(box);
  }
  const toast = h('div', { class: `toast ${type}` }, message);
  box.append(toast);
  setTimeout(() => toast.remove(), 3500);
}

// Links are relative on purpose: GitHub Pages serves project sites from /repo-name/.
export const loginUrl = () => `login.html?next=${encodeURIComponent(location.pathname.split('/').pop() + location.search)}`;

// Only allow redirects to one of our own pages.
export const safeNext = (value) => (value && /^[\w-]+\.html(\?[^\s#]*)?$/.test(value) ? value : 'index.html');

function navContent(user, active) {
  const link = (href, label, key) => h('a', { href, class: active === key ? 'active' : '' }, label);
  const logout = (store) => () => { store.logout(); location.href = 'index.html'; };
  return (store) => h('div', { class: 'nav-inner' },
    h('a', { href: 'index.html', class: 'brand' }, 'Pustaka', h('span', {}, 'Game')),
    h('nav', { class: 'nav-links', 'aria-label': 'Main' },
      link('index.html', 'Catalog', 'catalog'),
      link('top.html', 'Top games', 'top'),
      user ? link('profile.html', 'Profile', 'profile') : null),
    h('div', { class: 'nav-user' },
      user
        ? [h('span', { class: 'muted' }, user.name), h('button', { class: 'btn btn-ghost btn-small', type: 'button', onclick: logout(store) }, 'Log out')]
        : h('a', { class: 'btn btn-primary btn-small', href: loginUrl() }, 'Log in')));
}

// Render the shared navigation and footer. Returns the store and the logged-in user (or null).
export async function initPage(active) {
  let store;
  try {
    store = await getStore();
  } catch (err) {
    document.querySelector('main').replaceChildren(h('p', { class: 'empty error' }, err.message));
    throw err;
  }
  const user = store.currentUser();
  document.getElementById('nav').replaceChildren(navContent(user, active)(store));

  const reset = () => {
    if (confirm('Reset all data in this browser? Your account, reviews, and collection will be removed and the demo data restored.')) {
      store.reset();
      location.href = 'index.html';
    }
  };
  document.getElementById('footer').replaceChildren(
    h('p', {}, 'PustakaGame. Game data powered by ', h('a', { href: 'https://rawg.io', target: '_blank', rel: 'noopener noreferrer' }, 'RAWG'), '.'),
    h('p', {}, 'Everything you do here is saved in this browser only. ', h('button', { class: 'link-button', type: 'button', onclick: reset }, 'Reset demo data')));
  if (!store.persistent) notify('Your browser blocks storage, so changes will be lost when you close this tab.', 'error');
  return { store, user };
}
