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

## ⚠️ Needs verification on first deploy

This was written from `finvizfinance`'s documented API and general knowledge
of the library, **not a live install** — the sandbox this was built in
couldn't reach PyPI or GitHub to confirm exact method/field names before
writing the code. Two spots are most likely to need a small fix:

1. **`finviz_data.run_signal_screener()`** — `Overview().set_filter(filters_dict={"Signal": "Top Gainers"})`
   is the documented pattern; `"Signal"` values are assumed to match Finviz's
   own screener dropdown labels exactly ("Top Gainers", "Top Losers", "Most
   Active"). If an endpoint 500s, Render's service logs will show the real
   traceback.
2. **`finviz_data.fetch_quote()`** — the per-ticker insider-trades method
   name is uncertain (finvizfinance has renamed things across versions).
   `find_method()` defensively scans the installed object for any method
   with "insider" in its name at runtime, so this should keep working even
   if the guessed name (`ticker_inside_trader`) is wrong — but worth
   confirming the `insider` array in `/api/quote?t=AAPL` actually has real
   data, not just an empty list silently swallowing an error.

Fastest way to check both: after deploying, hit `/api/gainers`, `/api/losers`,
`/api/active`, and `/api/quote?t=AAPL` directly in a browser. Real JSON data
means it's working; an `{"error": ...}` body or empty `items`/`insider`
array points at exactly which call needs adjusting.

The Flask app itself (routing, static serving, error handling, JSON shape)
**was tested end-to-end locally** with `finvizfinance` stubbed out, so any
remaining issue should be isolated to the scraper calls above, not the
app's plumbing.
