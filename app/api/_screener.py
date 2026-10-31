"""
Shared screener helper for gainers/losers/active -- these three all come from
Finviz's "Signal" screener presets (the same data that drives finviz.com's
homepage panels), just with a different signal name.

VERIFY ON FIRST DEPLOY: the Overview().set_filter(filters_dict=...) call below
is finvizfinance's documented pattern for filtering the screener, and 'Signal'
is Finviz's own screener dropdown key with values exactly like "Top Gainers" /
"Top Losers" / "Most Active" -- but this wasn't tested against a live install
(this environment couldn't reach PyPI or GitHub to confirm). If an endpoint
errors out, the traceback from Vercel's function logs will show exactly which
call needs adjusting -- most likely either the filters_dict key/value spelling
or the screener_view() argument names.
"""
from finvizfinance.screener.overview import Overview

# Columns we actually want on a phone -- Finviz's Overview view returns more
# than this (Sector, Industry, Country, etc.) but a compact dashboard card
# doesn't need all of it.
_WANTED_COLUMNS = ["Ticker", "Company", "Price", "Change", "Volume", "Market Cap"]


def run_signal_screener(signal, limit=5):
    overview = Overview()
    overview.set_filter(filters_dict={"Signal": signal})
    df = overview.screener_view()

    if df is None or df.empty:
        return []

    cols = [c for c in _WANTED_COLUMNS if c in df.columns]
    df = df[cols] if cols else df
    df = df.head(limit)

    return df.to_dict(orient="records")
