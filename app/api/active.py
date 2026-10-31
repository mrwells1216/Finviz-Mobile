import sys
import os
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

sys.path.append(os.path.dirname(__file__))
from _common import json_response, error_response  # noqa: E402
from _screener import run_signal_screener  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            qs = parse_qs(urlparse(self.path).query)
            limit = int(qs.get("limit", ["5"])[0])
            data = run_signal_screener("Most Active", limit=limit)
            json_response(self, 200, {"signal": "Most Active", "items": data})
        except Exception as e:
            error_response(self, 500, "Failed to fetch most active", str(e))

    def do_OPTIONS(self):
        json_response(self, 200, {}, cache_seconds=0)
