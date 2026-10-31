# Finviz-Mobile

Tools for using [finviz.com](https://finviz.com) comfortably on a phone.

## Finviz Snap-Nav (v2)

A self-contained userscript that runs on top of the live Finviz page in Safari — no iframe, no backend, nothing sent anywhere.

- **Zoom mode** — swipe left/right (or tap `‹ ›`) to snap between saved pan+zoom views of the real page.
- **Read mode** — tap pieces of the real page (a table, the chart, the news feed) and pull them into your own mobile-styled layout, organized into named sections you page between with the same swipe gesture.

**Install:** [`index.html`](index.html) has full copy-paste setup for either the Userscripts app (iOS Safari extension, loads automatically) or a bookmarklet (no install, tap each visit). Once GitHub Pages is turned on for this repo (Settings → Pages → Source: Deploy from branch → `main` / `(root)`), that same page is live at:

`https://mrwells1216.github.io/finviz-mobile/`

**Source:** [`finviz-snap-nav.user.js`](finviz-snap-nav.user.js)

> Works in a normal Safari tab only — a page added to the iOS Home Screen runs sandboxed with no extensions, so this can't reach it there.

## Possible next step: a real data-driven mobile app

[`finvizfinance`](https://github.com/lit26/finvizfinance) is a popular Python library that scrapes Finviz server-side into structured data (quotes, fundamentals, screener results, news, insider trades) rather than reading the live DOM in-browser. That opens a different, more robust architecture than Snap-Nav:

- A small backend (e.g. a Vercel serverless function) pulls data via `finvizfinance` on a schedule or on demand.
- A fully custom mobile-first frontend — **your own site**, so "Add to Home Screen" works perfectly, no sandboxing issue.
- No fragile CSS-selector picking; the data comes in as structured fields you lay out however you want.

Trade-off: more moving parts than a browser script (hosting, a scrape schedule, respecting Finviz's own terms of use for how the data is fetched/displayed), but far more flexible and durable than cloning DOM nodes out of the live page.

Not started yet — flagged here as the fork in the road if Snap-Nav's picker-based approach turns out too fiddly to maintain.
