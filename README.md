# GameShelf (static edition)

> **📌 Disclaimer (Academic Capstone Project):**  
> This project is **AI-generated** using **IBM Bob** and was created specifically to fulfill the Capstone Project requirements for the **IBM SkillsBuild - AI Agent for Programming** course.

A game review website that runs entirely in the browser, so it can be hosted for free on **GitHub Pages**.
Browse a catalog, write reviews and ratings, mark reviews as "Helpful", track games in a personal
collection, and see the top games per genre.

Node.js is used for development only: a dev server, automated tests, and a script that pulls game data
from the [RAWG API](https://rawg.io/apidocs) at build time. There are **no runtime dependencies**.

## Quick start

Requirements: Node.js 20 or newer.

```bash
npm start
```

Open http://localhost:3000. There is nothing to install because the project has no dependencies.

Demo account: `demo@gameshelf.test` / `password123` (also `rina@`, `budi@`, `sari@gameshelf.test`).
You can also register your own account.

## How it works

| Part | Where it lives |
|------|----------------|
| Game catalog (read-only data) | `public/data/games.json` |
| Users, reviews, votes, collections, session | the visitor's browser (`localStorage`) |
| All business rules | `public/js/core/store.js` (no DOM code, so it is unit tested in Node) |
| Password hashing | `public/js/core/crypto.js` (Web Crypto, PBKDF2 + salt) |
| Pages and UI | `public/*.html`, `public/js/*.js`, `public/css/style.css` |
| RAWG data | fetched by `npm run sync` at build time, written into `games.json` |

Because the data lives in each visitor's browser, **reviews are not shared between visitors or devices**.
See "Limitations" below.

## Deploy to GitHub Pages

1. Create a new **public** repository on GitHub and push this project:
   ```bash
   git init
   git add .
   git commit -m "GameShelf"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
   git push -u origin main
   ```
2. In the repository go to **Settings, Pages, Build and deployment** and set **Source** to **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` runs on every push to `main`: it runs the tests and
   publishes the `public/` folder. Your site appears at `https://YOUR-USERNAME.github.io/YOUR-REPO/`.

All links in the site are relative, so it works under the `/YOUR-REPO/` sub-path that GitHub Pages uses.

Prefer not to use Actions? Rename `public/` to `docs/` and set Pages to deploy from the `main` branch and the `/docs` folder.

## Real game data and covers from RAWG (optional)

The site works out of the box with 11 sample games (no covers). To load real data:

1. Get a free API key at https://rawg.io/apidocs.
2. Copy `.env.example` to `.env` (Windows: `copy .env.example .env`) and put your key in `RAWG_API_KEY`.
3. Run `npm run sync` (or `npm run sync 40`, maximum 40 games). This updates `public/data/games.json`.
4. Commit the updated `games.json` and push.

Or let GitHub do it on every deploy: add a repository secret named `RAWG_API_KEY`
(**Settings, Secrets and variables, Actions**). The workflow then runs the sync before publishing.

The key is only used by Node.js on your machine or in GitHub Actions. It is never included in the website.
Sync keeps existing game ids (so saved reviews still match) and the "Local/Indie" flag, and it is safe to run repeatedly.
The RAWG free plan requires attribution, which is shown in the footer of every page.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm start` | Static dev server on http://localhost:3000 (`PORT` can be changed) |
| `npm test` | Run the automated tests (Node's built-in test runner) |
| `npm run sync [count]` | Fetch popular games from RAWG into `games.json` |

To reset the demo data in your browser, use the "Reset demo data" button in the footer.

## Features

- Catalog with cover, genre, platform, year, average rating, and a "Local/Indie" badge; search,
  filters (genre, platform, local), sorting (top rated, newest, most reviewed, title), and pagination.
- Game page with description, average rating, rating distribution, reviews, and review form.
- One review per user per game (1 to 5 stars plus text); edit and delete your own review.
- "Helpful" votes: one per user per review, toggleable, not allowed on your own review.
  Reviews are sorted by helpful votes, then newest.
- Collection status per game: wishlist, playing, completed.
- Top games per genre, ranked by average rating; games need at least 2 reviews to be ranked.
- Profile page with your reviews and collection.
- Register, login, logout with salted and hashed passwords.
- Dark, responsive (mobile-first) interface.

## Project structure

```
gameshelf/
├── package.json
├── .env.example
├── README.md
├── .github/workflows/deploy.yml
├── scripts/
│   ├── dev-server.js         static dev server
│   ├── sync-rawg.js          RAWG to games.json
│   └── lib/rawg.js           mapping and merge logic (tested)
├── tests/
│   ├── store.test.js         business rules
│   └── rawg-merge.test.js    RAWG mapping and merge
└── public/                   everything that gets published
    ├── index.html  game.html  top.html  profile.html  login.html
    ├── css/style.css
    ├── data/games.json
    └── js/
        ├── app.js            creates the store, loads games and demo data
        ├── common.js         DOM helper, navigation, footer, toasts
        ├── catalog.js  game.js  top.js  profile.js  login.js
        └── core/
            ├── store.js      all rules: auth, reviews, votes, collections, top
            ├── crypto.js     password hashing
            ├── storage.js    localStorage with in-memory fallback
            └── demo.js       sample users, reviews, votes
```

## Architecture decisions

- **Logic separated from the DOM.** `store.js` has no browser code, so the same rules run in the browser
  and in Node tests. The pages are thin and only render what the store returns.
- **Games are data, not state.** The catalog comes from `games.json` and is never copied into
  localStorage, so refreshing the data (for example with a RAWG sync) updates every visitor.
- **Average rating is never stored.** It is calculated from reviews, so it cannot go out of sync.
- **Stable string ids** (for example `hades`) are used for games, so links and saved reviews survive data updates.
- **No dependencies.** Fewer things to install, update, or break.

## Security notes

- Passwords are salted and hashed (PBKDF2, SHA-256, 100,000 iterations), never stored as plain text.
- The DOM is built with text nodes only, so review text cannot inject HTML (XSS). This is covered by a UI test.
- Every page has a strict Content Security Policy (scripts and styles only from the site itself).
- The RAWG key never reaches the browser.
- Redirects after login are limited to the site's own pages.

## Limitations

- **Data is per browser.** Reviews and accounts are saved in `localStorage`, so they are not shared between
  visitors or devices, and clearing site data removes them. This is inherent to a static site.
- **Login is not real security.** There is no server, so anyone can edit their own browser's storage.
  Accounts here only separate users on the same browser. For real shared accounts and reviews you would add
  a backend such as Firebase or Supabase, and `store.js` is the only file that would need to change.
- Sample reviews and descriptions are fictional demo content.
- Covers only appear after a RAWG sync.

end
