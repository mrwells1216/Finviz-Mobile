(function () {
  "use strict";

  var dashboardView = document.getElementById("dashboardView");
  var detailView = document.getElementById("detailView");
  var backBtn = document.getElementById("backBtn");
  var refreshBtn = document.getElementById("refreshBtn");
  var headerTitle = document.getElementById("headerTitle");
  var searchForm = document.getElementById("searchForm");
  var searchInput = document.getElementById("searchInput");

  // Curated subset of fundamentals shown up top on a ticker page; anything
  // else returned by the API still shows under "All stats" below.
  // Field names confirmed live against a real /api/quote?t=AAPL response
  // on 2026-11-01 (the original guesses had a few wrong: "Change" is
  // actually "Change %", there's no combined "52W Range" -- it's two
  // separate "52W High"/"52W Low" keys, and dividend is "Dividend TTM").
  var WANTED_STATS = [
    "Price", "Change %", "Market Cap", "P/E", "Forward P/E", "EPS (ttm)",
    "Dividend TTM", "Volume", "Avg Volume", "52W High", "52W Low", "Beta",
    "Short Float", "Insider Own", "Inst Own", "Target Price", "RSI (14)",
  ];

  function fmtChange(v) {
    if (v === null || v === undefined || v === "") return { text: "—", cls: "" };
    var s = String(v);
    var neg = s.indexOf("-") === 0;
    return { text: s, cls: neg ? "down" : "up" };
  }

  function fetchJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          var err = new Error(body.error || ("Request failed: " + r.status));
          err.detail = body.detail;
          throw err;
        });
      }
      return r.json();
    });
  }

  function renderErrorBox(message, detail) {
    var box = document.createElement("div");
    box.className = "error-box";
    box.innerHTML = "<b>" + escapeHtml(message) + "</b>" +
      (detail ? "<br>" + escapeHtml(String(detail)) : "");
    return box;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  /* ---------- dashboard ---------- */
  function sectionBlock(title, id) {
    var wrap = document.createElement("div");
    var h = document.createElement("div");
    h.className = "section-title";
    h.textContent = title;
    var card = document.createElement("div");
    card.className = "card";
    card.id = id;
    card.innerHTML = '<div class="skeleton">Loading…</div>';
    wrap.appendChild(h);
    wrap.appendChild(card);
    return wrap;
  }

  function renderRows(container, items) {
    container.innerHTML = "";
    if (!items.length) {
      container.innerHTML = '<div class="empty">No data</div>';
      return;
    }
    items.forEach(function (item) {
      var row = document.createElement("a");
      row.href = "#/t/" + encodeURIComponent(item.Ticker || "");
      row.className = "row";
      var chg = fmtChange(item.Change);
      row.innerHTML =
        '<span class="ticker">' + escapeHtml(item.Ticker || "") + "</span>" +
        '<span class="company">' + escapeHtml(item.Company || "") + "</span>" +
        '<span class="price">' + escapeHtml(item.Price || "") + "</span>" +
        '<span class="change ' + chg.cls + '">' + escapeHtml(chg.text) + "</span>";
      container.appendChild(row);
    });
  }

  function loadSection(apiPath, containerId) {
    var container = document.getElementById(containerId);
    return fetchJSON(apiPath)
      .then(function (data) { renderRows(container, data.items || []); })
      .catch(function (err) {
        container.innerHTML = "";
        container.appendChild(renderErrorBox(err.message || "Couldn’t load this section", err.detail));
      });
  }

  function renderDashboard() {
    dashboardView.innerHTML = "";
    dashboardView.appendChild(sectionBlock("Top Gainers", "gainersCard"));
    dashboardView.appendChild(sectionBlock("Top Losers", "losersCard"));
    dashboardView.appendChild(sectionBlock("Most Active", "activeCard"));
    // Sequential, not parallel: Finviz's Cloudflare protection flagged our
    // Render IP as rate-limited when the dashboard fired all three screener
    // requests at once, so these are chained one after another instead.
    loadSection("/api/gainers?limit=5", "gainersCard")
      .then(function () { return loadSection("/api/losers?limit=5", "losersCard"); })
      .then(function () { return loadSection("/api/active?limit=5", "activeCard"); });
  }

  /* ---------- ticker detail ---------- */
  function renderDetail(ticker) {
    detailView.innerHTML = '<div class="skeleton">Loading ' + escapeHtml(ticker) + "…</div>";
    fetchJSON("/api/quote?t=" + encodeURIComponent(ticker))
      .then(function (data) { renderDetailData(ticker, data); })
      .catch(function (err) {
        detailView.innerHTML = "";
        detailView.appendChild(renderErrorBox(err.message || ("Couldn’t load " + ticker), err.detail));
      });
  }

  function renderDetailData(ticker, data) {
    var f = data.fundamentals || {};
    var insider = data.insider || [];
    detailView.innerHTML = "";

    var head = document.createElement("div");
    head.className = "ticker-head";
    var chg = fmtChange(f["Change %"]);
    head.innerHTML =
      "<h2>" + escapeHtml(ticker) + "</h2>" +
      '<span class="price">' + escapeHtml(f.Price || "") + "</span>" +
      '<span class="change ' + chg.cls + '">' + escapeHtml(chg.text) + "</span>";
    detailView.appendChild(head);

    if (f.Company || f.Sector) {
      var sub = document.createElement("div");
      sub.className = "company-name";
      sub.textContent = [f.Company, f.Sector, f.Industry].filter(Boolean).join(" · ");
      detailView.appendChild(sub);
    }

    var statTitle = document.createElement("div");
    statTitle.className = "section-title";
    statTitle.textContent = "Key Stats";
    detailView.appendChild(statTitle);

    var grid = document.createElement("div");
    grid.className = "stat-grid";
    var shown = {};
    WANTED_STATS.forEach(function (key) {
      if (!(key in f) || f[key] === undefined || f[key] === "" || f[key] === "-") return;
      shown[key] = true;
      var cell = document.createElement("div");
      cell.className = "stat";
      cell.innerHTML =
        '<div class="label">' + escapeHtml(key) + "</div>" +
        '<div class="value">' + escapeHtml(f[key]) + "</div>";
      grid.appendChild(cell);
    });
    detailView.appendChild(grid);
    if (!grid.children.length) {
      detailView.appendChild((function () {
        var d = document.createElement("div");
        d.className = "empty";
        d.textContent = "No fundamentals returned for this ticker.";
        return d;
      })());
    }

    var insiderTitle = document.createElement("div");
    insiderTitle.className = "section-title";
    insiderTitle.textContent = "Insider Trades";
    detailView.appendChild(insiderTitle);

    var insiderCard = document.createElement("div");
    insiderCard.className = "card";
    if (!insider.length) {
      insiderCard.innerHTML = '<div class="empty">No recent insider trades found</div>';
    } else {
      insider.slice(0, 10).forEach(function (t) {
        var row = document.createElement("div");
        row.className = "insider-row";
        var name = t.Insider || t["Owner"] || t["Insider Trading"] || "";
        var rel = t.Relationship || t["Date"] || "";
        var txn = t.Transaction || t["Transaction Type"] || "";
        var val = t.Value || t["Shares"] || "";
        row.innerHTML =
          '<div class="top-line"><span class="insider-name">' + escapeHtml(name) +
          '</span><span>' + escapeHtml(txn) + "</span></div>" +
          '<div class="meta">' + escapeHtml(rel) + (val ? " · " + escapeHtml(val) : "") + "</div>";
        insiderCard.appendChild(row);
      });
    }
    detailView.appendChild(insiderCard);

    // Fallback: show every other raw field we got back, in case something
    // useful wasn't in the curated WANTED_STATS list above.
    var rest = Object.keys(f).filter(function (k) { return !shown[k]; });
    if (rest.length) {
      var det = document.createElement("details");
      det.className = "all-stats";
      var summary = document.createElement("summary");
      summary.textContent = "All stats (" + rest.length + " more)";
      det.appendChild(summary);
      var allGrid = document.createElement("div");
      allGrid.className = "all-stats-grid";
      rest.forEach(function (k) {
        var kv = document.createElement("div");
        kv.className = "kv";
        kv.innerHTML = '<span class="k">' + escapeHtml(k) + ": </span><span class=\"v\">" + escapeHtml(f[k]) + "</span>";
        allGrid.appendChild(kv);
      });
      det.appendChild(allGrid);
      detailView.appendChild(det);
    }
  }

  /* ---------- routing ---------- */
  function route() {
    var hash = location.hash || "#/";
    var m = hash.match(/^#\/t\/([^/]+)$/);
    if (m) {
      var ticker = decodeURIComponent(m[1]).toUpperCase();
      dashboardView.style.display = "none";
      detailView.style.display = "block";
      backBtn.classList.add("show");
      headerTitle.textContent = ticker;
      renderDetail(ticker);
    } else {
      dashboardView.style.display = "block";
      detailView.style.display = "none";
      backBtn.classList.remove("show");
      headerTitle.textContent = "Finviz";
      if (!dashboardView.childElementCount) renderDashboard();
    }
  }

  window.addEventListener("hashchange", route);
  backBtn.addEventListener("click", function () { location.hash = "#/"; });
  refreshBtn.addEventListener("click", function () {
    refreshBtn.classList.add("spinning");
    var done = function () { refreshBtn.classList.remove("spinning"); };
    if (location.hash.match(/^#\/t\//)) {
      renderDetail(headerTitle.textContent);
      setTimeout(done, 500);
    } else {
      renderDashboard();
      setTimeout(done, 500);
    }
  });
  searchForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = searchInput.value.trim();
    if (!v) return;
    location.hash = "#/t/" + encodeURIComponent(v.toUpperCase());
    searchInput.value = "";
    searchInput.blur();
  });

  route();
})();
