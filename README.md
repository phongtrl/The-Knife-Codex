# The Knife Codex

A calm, gamified guide to Japanese kitchen knives. Discover, compare, and master
each blade — then test your instincts in the Dojo and collect them all.

**Live site:** https://phongtrl.github.io/The-Knife-Codex/

## Features

- **The Blade Codex** — inspect each knife; view one to add it to your collection.
- **Side-by-Side** — compare length, edge, best use, and difficulty at a glance.
- **The Dojo** — a quiz that awards XP and ranks as you learn.
- Progress (collection + XP) is saved locally in your browser via `localStorage`.

## Tech

Plain HTML, CSS, and vanilla JavaScript — no build step and no dependencies.

- `index.html` — page structure
- `styles.css` — styling
- `app.js` — game logic (rendering, quiz, XP, persistence)
- `knives.json` — knife data, loaded via `fetch()` when served over http/https
- `knives-data.js` — the same data embedded as a fallback so the page also works
  straight from `file://`

## Running locally

Because `app.js` fetches `knives.json`, use a local server for the full experience:

```powershell
# Python 3
python -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` directly from disk also
works — it falls back to the embedded data in `knives-data.js`.

## Deployment

Pushing to the `main` branch automatically publishes the site to GitHub Pages
via the workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

> First deploy: in the repository, go to **Settings → Pages** and set the
> **Source** to **GitHub Actions** if it isn't already.

