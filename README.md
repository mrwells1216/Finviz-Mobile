# Finviz-Mobile

Tools for using [finviz.com](https://finviz.com) comfortably on a phone.

## [`app/`](app/) — Finviz Mobile Dashboard (current approach)

A real app: a Render-hosted backend scrapes Finviz server-side via
[`finvizfinance`](https://github.com/lit26/finvizfinance) and a custom
mobile-first frontend renders it — your own site, so "Add to Home Screen"
works normally, no extension or sandboxing issues. Compact home dashboard
(5 gainers / 5 losers / 5 most active) plus a ticker detail page (key
fundamentals + insider trades). See [`app/README.md`](app/README.md) for
the full architecture and a "needs verification on first deploy" note.

## Earlier approach: Finviz Snap-Nav (v2) — superseded

A self-contained userscript that ran on top of the live Finviz page in
Safari (Zoom mode: snap-zoom between saved views; Read mode: pick page
elements into custom sections). Kept here for reference — superseded by
the `app/` approach above, which doesn't need a Safari extension at all.

- Install page: [`index.html`](index.html) (Stay for Safari or a bookmarklet)
  — live at `https://mrwells1216.github.io/finviz-mobile/`
- Source: [`finviz-snap-nav.user.js`](finviz-snap-nav.user.js)
