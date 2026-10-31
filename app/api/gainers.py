import sys
import os
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Vercel's Python functions aren't reliably invoked as part of a package, so
# relative imports (from ._common import ...) can fail at runtime. Add this
# file's directory to sys.path and import as top-level modules instead.
sys.path.append(os.path.dirname(__file__))
from _common import json_response, error_response  # noqa: E402
from _screener import run_signal_screener  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            qs = parse_qs(urlparse(self.path).query)
            limit = int(qs.get("limit", ["5"])[0])
            data = run_signal_screener("Top Gainers", limit=limit)
            json_response(self, 200, {"signal": "Top Gainers", "items": data})
        except Exception as e:
            error_response(self, 500, "Failed to fetch gainers", str(e))

    def do_OPTIONS(self):
        json_response(self, 200, {}, cache_seconds=0)
