"""
Shared helpers for the Vercel Python functions in this /api folder.
Filename starts with "_" so Vercel does NOT treat it as its own route --
it's imported by the sibling function files (gainers.py, losers.py, etc).
"""
import json
import math


def json_response(handler, status, payload, cache_seconds=60):
    """Write a JSON response with CORS + short edge caching."""
    body = json.dumps(payload, default=_json_default).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
    # Edge/CDN cache for cache_seconds, serve stale while refetching for 5x that --
    # keeps us from hammering Finviz on every page load. Vercel respects s-maxage.
    handler.send_header(
        "Cache-Control",
        f"s-maxage={cache_seconds}, stale-while-revalidate={cache_seconds * 5}",
    )
    handler.end_headers()
    handler.wfile.write(body)


def error_response(handler, status, message, detail=None):
    json_response(handler, status, {"error": message, "detail": detail}, cache_seconds=0)


def _json_default(o):
    # pandas/numpy scalars -> plain python, NaN -> None
    try:
        if o is None:
            return None
        f = float(o)
        if math.isnan(f):
            return None
        return f
    except (TypeError, ValueError):
        return str(o)


def df_records(df, limit=None):
    """Convert a pandas DataFrame to a list of plain dicts, NaN -> None."""
    if df is None:
        return []
    d = df.head(limit) if limit else df
    records = d.to_dict(orient="records")
    clean = []
    for row in records:
        clean.append({k: (None if _is_nan(v) else v) for k, v in row.items()})
    return clean


def _is_nan(v):
    try:
        return isinstance(v, float) and math.isnan(v)
    except Exception:
        return False


def find_method(obj, *name_candidates, contains=None):
    """
    Defensive lookup: try exact method names in order first (fast path, and
    the names we're fairly confident about from finvizfinance's docs). If
    none exist on the installed version, fall back to scanning for any
    callable attribute whose name contains `contains` (e.g. "insider") --
    guards against the library having renamed something since this was written.
    Returns a bound callable, or None if nothing matched.
    """
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
