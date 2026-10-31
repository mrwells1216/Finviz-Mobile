"""
Shared scraping/business logic, used by server.py's Flask routes.

VERIFY ON FIRST DEPLOY (same caveats as before, just relocated from the old
Vercel api/_screener.py and api/quote.py):
- run_signal_screener(): Overview().set_filter(filters_dict={"Signal": ...})
  is finvizfinance's documented pattern; "Signal" values are assumed to
  match Finviz's own screener dropdown labels ("Top Gainers", "Top Losers",
  "Most Active") exactly.
- fetch_quote()'s insider-trade method name is uncertain across
  finvizfinance versions, so find_method() scans the finvizfinance(ticker)
  object at runtime for any callable with "insider" in its name rather than
  hardcoding a single guess.
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
    overview.set_filter(filters_dict={"Signal": signal})
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
