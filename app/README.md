# Finviz Mobile Dashboard

A real mobile-first app: a Vercel-hosted backend scrapes Finviz server-side (via
[`finvizfinance`](https://github.com/lit26/finvizfinance)) and a small frontend
renders the data in its own compact layout. No browser extension, no iframe,
no sandboxing issues — this is just your own website, so "Add to Home Screen"
works normally.

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
  api/                  Vercel Python serverless functions (the "backend")
    _common.py          shared response/JSON helpers
    _screener.py         shared "Signal" screener fetch (gainers/losers/active)
    gainers.py            GET /api/gainers?limit=5
    losers.py              GET /api/losers?limit=5
    active.py                GET /api/active?limit=5
    quote.py                  GET /api/quote?t=AAPL -> fundamentals + insider
  public/               Static frontend (plain HTML/CSS/JS, no build step)
    index.html
    style.css
    app.js               hash-based routing, fetch()es the /api endpoints
    manifest.json         installability metadata
  requirements.txt       Python deps (finvizfinance)
  vercel.json             pins the Python runtime
```

The frontend **never talks to Finviz directly** — it only calls our own
`/api/*` endpoints, which do the actual scraping via `finvizfinance` and
return clean JSON. Responses are cached at Vercel's edge for 60 seconds
(`Cache-Control: s-maxage=60`) so normal use doesn't hammer Finviz.

## ⚠️ Needs verification on first deploy

This was written from `finvizfinance`'s documented API and general knowledge
of the library, **not a live install** — this environment couldn't reach
PyPI or GitHub to confirm exact method/field names before writing the code.
Two spots are most likely to need a small fix once deployed:

1. **`api/_screener.py`** — `Overview().set_filter(filters_dict={"Signal": "Top Gainers"})`
   is the documented pattern; `"Signal"` values are assumed to match Finviz's
   own screener dropdown labels exactly ("Top Gainers", "Top Losers", "Most
   Active"). If an endpoint 500s, check the Vercel function logs — the
   traceback will show the real error.
2. **`api/quote.py`** — the per-ticker insider-trades method name is uncertain
   (finvizfinance has renamed things across versions). `find_method()` in
   `_common.py` defensively scans the installed object for any method with
   "insider" in its name at runtime, so this should keep working even if the
   guessed name (`ticker_inside_trader`) is wrong — but worth confirming the
   `insider` array in `/api/quote?t=AAPL` actually has real data, not just an
   empty list silently swallowing an error.

Fastest way to check both: after deploying, hit `/api/gainers`, `/api/losers`,
`/api/active`, and `/api/quote?t=AAPL` directly in a browser. Real JSON data
means it's working; an `{"error": ...}` body or empty `items`/`insider`
array points at exactly which call needs adjusting.
