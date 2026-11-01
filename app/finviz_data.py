"""
Shared scraping/business logic, used by server.py's Flask routes.

STATUS (confirmed live against the deployed app on 2026-11-01):
- fetch_quote() CONFIRMED WORKING end to end: real fundamentals (Price,
  Market Cap, P/E, etc.) and real insider trades (names, SEC Form 4 links,
  dollar values) both come back correctly. The insider-method guess that
  find_method() landed on was right.
- run_signal_screener() originally passed {"Signal": signal} inside
  filters_dict -- confirmed wrong and fixed (signal is set_filter()'s own
  keyword argument, not a filters_dict key). That fix is confirmed correct
  too: the error changed from "Invalid filter 'Signal'" to a *different*
  error further along --
- CURRENT BLOCKER, UNRESOLVED: Finviz's Cloudflare protection is rejecting
  the screener.ashx request from Render's IP with a 403 challenge
  ("source IP is being rate-limited"). finvizfinance's own error message
  suggests supplying a custom session/proxy via finvizfinance.util
  specifically to get past that block -- deliberately doing that (spoofing
  a browser User-Agent because the real one just got blocked) is bot-check
  circumvention against a site actively trying to stop scraping, so that
  wasn't implemented here; it needs a real decision from the app's owner
  about whether/how to proceed, not a default "paper over it" fix.
  The one thing that *was* changed: the dashboard now loads its three
  screener sections sequentially instead of firing them in a burst, since
  the error explicitly cited rate-limiting -- that may or may not be
  enough on its own.
"""
import math

_WANTED_COLUMNS = ["Ticker", "Company", "Price", "Change", "Volume", "Market Cap"]


def _is_nan(v):
    try:
        return isinstance(v, float) and math.isnan(v)
    except Exception:
        return False


def _clean(v):
    return None if _is_nan(v) else v


def df_records(df, limit=None):
    if df is None:
        return []
    d = df.head(limit) if limit else df
    return [{k: _clean(v) for k, v in row.items()} for row in d.to_dict(orient="records")]


def find_method(obj, *name_candidates, contains=None):
    for name in name_candidates:
        fn = getattr(obj, name, None)
        if callable(fn):
            return fn
    if contains:
        for name in dir(obj):
            if contains.lower() in name.lower() and not name.startswith("_"):
                fn = getattr(obj, name, None)
                if callable(fn):
                    return fn
    return None


def run_signal_screener(signal, limit=5):
    from finvizfinance.screener.overview import Overview

    overview = Overview()
    overview.set_filter(signal=signal)
    df = overview.screener_view()

    if df is None or df.empty:
        return []

    cols = [c for c in _WANTED_COLUMNS if c in df.columns]
    df = df[cols] if cols else df
    return df_records(df.head(limit))


def _safe_fundamentals(stock):
    fn = find_method(stock, "ticker_fundament", contains="fundament")
    if not fn:
        return {}
    try:
        data = fn()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _safe_insider(stock, limit=10):
    fn = find_method(
        stock,
        "ticker_inside_trader",
        "ticker_insider_trade",
        "ticker_insider",
        contains="insider",
    )
    if not fn:
        return []
    try:
        df = fn()
        return df_records(df, limit=limit)
    except Exception:
        return []


def fetch_quote(ticker):
    from finvizfinance.quote import finvizfinance

    stock = finvizfinance(ticker)
    fundamentals = _safe_fundamentals(stock)
    insider = _safe_insider(stock)
    return fundamentals, insider
