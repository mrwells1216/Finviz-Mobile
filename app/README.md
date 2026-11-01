# Finviz Mobile Dashboard

A real mobile-first app: a Render-hosted backend scrapes Finviz server-side
(via [`finvizfinance`](https://github.com/lit26/finvizfinance)) and a small
frontend renders the data in its own compact layout. No browser extension,
no iframe, no sandboxing issues — this is just your own website, so "Add to
Home Screen" works normally.

## What it shows

- **Home dashboard** — 5 Top Gainers, 5 Top Losers, 5 Most Active (condensed
  from Finviz's own homepage, which shows ~15-20 per list).
- **Ticker detail** — tap any ticker (or search one directly) to see key
  fundamentals (price, market cap, P/E, dividend, volume, etc.) and recent
  insider trades, plus a collapsible "All stats" section with every other
  field the scraper returned.

## Architecture

```
app/
  server.py             Flask app: serves public/ as static files, and the
                         /api/* JSON routes
  finviz_data.py         scraping logic (shared by every /api/* route) --
                         fetches via finvizfinance, returns plain dicts/lists
  requirements.txt        flask, gunicorn, finvizfinance
  public/                 static frontend, no build step
    index.html
    style.css
    app.js                hash-based routing, fetch()es the /api/* routes
    manifest.json          installability metadata
```

The frontend **never talks to Finviz directly** — it only calls this app's
own `/api/*` routes, which do the actual scraping via `finvizfinance` and
return clean JSON. Responses carry a `Cache-Control` header (60s) so normal
use doesn't hammer Finviz on every page load.

This started as a Vercel deployment (Vercel-style per-file Python serverless
functions under `api/`), then moved to Render. Render runs one long-lived
process rather than Vercel's per-file function convention, so the backend
was consolidated into a single Flask app (`server.py` + `finviz_data.py`)
— the actual scraping logic is unchanged, just repackaged.

**Render service config** (if recreating manually):
- Runtime: Python
- Build command: `pip install -r app/requirements.txt`
- Start command: `cd app && gunicorn server:app --bind 0.0.0.0:$PORT`
- Root stays the repo root (Render's web-service tool here has no separate
  "root directory" setting, so the commands above `cd`/path into `app/`
  themselves instead).

## Status (live-verified 2026-11-01)

- **`/api/quote?t=TICKER` confirmed working end to end** — real fundamentals
  and real insider trades (names, SEC Form 4 links, dollar values) both come
  back correctly. The frontend's curated "Key Stats" field list was fixed to
  match the real key names (`"Change %"` not `"Change"`, separate `"52W High"`
  / `"52W Low"` instead of a combined range, `"Dividend TTM"` not
  `"Dividend %"`).
- **`/api/gainers` / `/api/losers` / `/api/active`** — the `signal=` fix
  (below) is confirmed correct, but Finviz's Cloudflare protection then
  403'd the screener request from Render's IP as rate-limited. The dashboard
  now loads the three sections sequentially instead of firing all three at
  once, since the error explicitly cited rate-limiting — that may or may not
  be enough on its own, **not yet re-verified live**.

  **Unresolved on purpose:** `finvizfinance`'s own error message suggests
  supplying a custom session with spoofed browser headers specifically to
  get past that block. That's bot-check circumvention against a site that's
  actively trying to stop scraping — not something to quietly paper over.
  If sequential loading alone doesn't clear it, the real options are: accept
  that these three sections may just not be reliably available this way, or
  pull gainers/losers/most-active from a different, non-circumvented source
  (e.g. the FMP connector already in use elsewhere in this project) and keep
  `finvizfinance` only for the ticker-detail data that's already working.
  That's a call for whoever owns this app to make, not a default to code
  around.

### Bugs found and fixed along the way

1. `Overview().set_filter(filters_dict={"Signal": ...})` → wrong:
   `filters_dict` is validated against Finviz's real filter list, which has
   no `"Signal"` entry. Fixed to `set_filter(signal=...)` — `signal` is its
   own keyword argument.
2. Render's auto-deploy wasn't actually wired up (no webhook events fired
   on push) — needs a one-time permission grant in Render's dashboard
   (GitHub App repo access) to fix properly; manual `trigger_deploy` calls
   work as a stopgap.
3. The frontend's error cards were showing the generic error label twice
   instead of the actual backend exception — fixed, so any future failure
   shows the real cause in the app itself, not just a generic message.

Fastest way to check current status: hit `/api/gainers`, `/api/losers`,
`/api/active`, and `/api/quote?t=AAPL` directly in a browser. Real JSON data
means it's working; an `{"error": ..., "detail": ...}` body shows the real
cause.
