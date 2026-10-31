"""
GET /api/quote?t=AAPL -> { ticker, fundamentals: {...}, insider: [...] }

VERIFY ON FIRST DEPLOY:
- ticker_fundament() is finvizfinance's documented method for the quote-page
  ratio table and is the part of this file we're most confident about: its
  keys mirror Finviz's own on-page labels ("P/E", "Market Cap", etc).
- The per-ticker insider-trades method name is less certain -- finvizfinance
  has changed method names across versions. Rather than hardcode a guess,
  find_method() below scans the finvizfinance(ticker) object at runtime for
  whatever callable has "insider" in its name and calls that, so this keeps
  working even if the exact name differs from what's assumed here.
"""
import sys
import os
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

sys.path.append(os.path.dirname(__file__))
from _common import json_response, error_response, df_records, find_method  # noqa: E402


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


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            from finvizfinance.quote import finvizfinance

            qs = parse_qs(urlparse(self.path).query)
            ticker = (qs.get("t", [""])[0] or "").strip().upper()
            if not ticker:
                error_response(self, 400, "Missing required query param: t (ticker)")
                return

            stock = finvizfinance(ticker)
            fundamentals = _safe_fundamentals(stock)
            insider = _safe_insider(stock)

            if not fundamentals:
                error_response(self, 404, f"No data found for ticker '{ticker}'")
                return

            json_response(
                self,
                200,
                {"ticker": ticker, "fundamentals": fundamentals, "insider": insider},
                cache_seconds=60,
            )
        except Exception as e:
            error_response(self, 500, "Failed to fetch quote", str(e))

    def do_OPTIONS(self):
        json_response(self, 200, {}, cache_seconds=0)
