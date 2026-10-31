"""
Flask app for Render: serves the static frontend (public/) and the /api/*
JSON endpoints that scrape Finviz via finvizfinance (see finviz_data.py).

Run locally:   python server.py          (serves on $PORT or 10000)
Production:    gunicorn server:app --bind 0.0.0.0:$PORT
"""
import os

from flask import Flask, jsonify, request, send_from_directory

from finviz_data import run_signal_screener, fetch_quote

app = Flask(__name__, static_folder="public", static_url_path="")


@app.after_request
def add_cache_headers(resp):
    # Light caching on the data endpoints so normal use doesn't hammer
    # Finviz on every page load/refresh.
    if request.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    return resp


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


def _signal_route(signal_name):
    limit = request.args.get("limit", 5, type=int)
    try:
        items = run_signal_screener(signal_name, limit=limit)
        return jsonify({"signal": signal_name, "items": items})
    except Exception as e:
        return jsonify({"error": f"Failed to fetch {signal_name}", "detail": str(e)}), 500


@app.route("/api/gainers")
def gainers():
    return _signal_route("Top Gainers")


@app.route("/api/losers")
def losers():
    return _signal_route("Top Losers")


@app.route("/api/active")
def active():
    return _signal_route("Most Active")


@app.route("/api/quote")
def quote():
    ticker = (request.args.get("t", "") or "").strip().upper()
    if not ticker:
        return jsonify({"error": "Missing required query param: t (ticker)"}), 400
    try:
        fundamentals, insider = fetch_quote(ticker)
    except Exception as e:
        return jsonify({"error": "Failed to fetch quote", "detail": str(e)}), 500
    if not fundamentals:
        return jsonify({"error": f"No data found for ticker '{ticker}'"}), 404
    return jsonify({"ticker": ticker, "fundamentals": fundamentals, "insider": insider})


@app.route("/healthz")
def healthz():
    return jsonify({"ok": True})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
