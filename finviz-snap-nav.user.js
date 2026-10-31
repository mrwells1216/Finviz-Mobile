// ==UserScript==
// @name         Finviz Snap-Nav
// @namespace    finviz-snap-nav
// @version      2.0
// @description  Swipe between saved zoom views OR your own custom mobile-friendly sections pulled from Finviz
// @match        https://finviz.com/*
// @match        https://*.finviz.com/*
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";
  if (window.__snapNavInstalled) return;
  window.__snapNavInstalled = true;

  var PKEY = "snapNav:zones:" + location.pathname;
  var IKEY = "snapNav:idx:" + location.pathname;
  var SKEY = "snapNav:sections:" + location.pathname;
  var SIKEY = "snapNav:sidx:" + location.pathname;
  var HKEY = "snapNav:hidden";
  var MKEY = "snapNav:mode";

  var zones = [];
  try { zones = JSON.parse(localStorage.getItem(PKEY) || "[]"); } catch (e) { zones = []; }
  var idx = parseInt(localStorage.getItem(IKEY) || "0", 10) || 0;

  var sections = [];
  try { sections = JSON.parse(localStorage.getItem(SKEY) || "[]"); } catch (e) { sections = []; }
  var sidx = parseInt(localStorage.getItem(SIKEY) || "0", 10) || 0;

  var mode = localStorage.getItem(MKEY) || "zoom"; // 'zoom' | 'read'
  var scale = 1;
  var wrap, spacer, bar, moreRow, label;
  var overlay, tabsEl, bodyEl;
  var pickBanner, pickEl = null, pickHistory = [];
  var picking = false;
  var moreOpen = false;

  /* ---------- styles ---------- */
  function injectStyle() {
    var css =
      "#snap-nav-wrap{transform-origin:0 0;will-change:transform;}" +
      "#snap-nav-bar,#snap-nav-more,#snap-pick-banner,#snap-manage{-webkit-user-select:none;user-select:none;font:12px -apple-system,sans-serif;}" +
      ".sn-btn{appearance:none;border:none;background:rgba(255,255,255,.12);color:#fff;min-width:28px;height:28px;border-radius:14px;font:600 14px/28px -apple-system,sans-serif;padding:0 8px;}" +
      ".sn-btn.sn-accent{color:#8CFFA6;} .sn-btn.sn-danger{color:#FF9D9D;}" +
      "#snap-reader-overlay{position:fixed;inset:0;background:#0b0d10;z-index:2147483000;display:none;flex-direction:column;}" +
      "#snap-reader-tabs{display:flex;gap:6px;overflow-x:auto;padding:14px 12px 10px;-webkit-overflow-scrolling:touch;}" +
      ".sn-tab{flex:0 0 auto;padding:7px 14px;border-radius:16px;background:#1b1f26;color:#9aa4b2;font:13px -apple-system,sans-serif;white-space:nowrap;}" +
      ".sn-tab.sn-active{background:#4fd1a5;color:#06231a;font-weight:700;}" +
      "#snap-reader-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 14px 90px;color:#e8ebef;}" +
      ".snap-reader-card{background:#14171c;border-radius:16px;padding:14px;margin-bottom:14px;}" +
      ".snap-reader-card-title{font-size:15px;font-weight:700;color:#e8ebef;margin-bottom:10px;letter-spacing:.01em;}" +
      ".snap-reader-card table{width:100%!important;font-size:15px!important;border-collapse:collapse;color:#e8ebef;}" +
      ".snap-reader-card table td,.snap-reader-card table th{padding:7px 6px!important;border-bottom:1px solid #22262d;white-space:normal!important;}" +
      ".snap-reader-card a{color:#6ea8fe;}" +
      ".snap-reader-tablewrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}" +
      ".snap-reader-missing{color:#777;font-size:13px;font-style:italic;padding:6px 0;}" +
      ".snap-reader-empty{color:#9aa4b2;font-size:14px;line-height:1.6;padding:30px 6px;}" +
      ".snap-reader-empty button{margin-top:14px;appearance:none;border:none;background:#4fd1a5;color:#06231a;font-weight:700;font-size:14px;padding:10px 18px;border-radius:12px;}" +
      "#snap-pick-banner{position:fixed;top:0;left:0;right:0;z-index:2147483647;background:rgba(10,12,15,.95);color:#fff;padding:10px 12px 12px;box-shadow:0 4px 16px rgba(0,0,0,.4);}" +
      "#snap-pick-info{font:12px ui-monospace,Menlo,monospace;color:#8CFFA6;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      "#snap-pick-row1,#snap-pick-row2{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}" +
      "#snap-pick-row2{margin-top:8px;}" +
      ".sn-pick-highlight{outline:3px solid #4fd1a5!important;outline-offset:1px;background:rgba(79,209,165,.12)!important;}" +
      "#snap-manage{position:fixed;inset:0;background:#0b0d10;z-index:2147483100;display:none;flex-direction:column;color:#e8ebef;padding:16px;}" +
      "#snap-manage h3{margin:4px 0 14px;font-size:17px;}" +
      ".sn-row{display:flex;align-items:center;gap:8px;background:#14171c;border-radius:12px;padding:10px 12px;margin-bottom:8px;}" +
      ".sn-row .sn-name{flex:1;font-size:14px;}" +
      ".sn-row button{appearance:none;border:none;background:#1b1f26;color:#fff;border-radius:9px;padding:6px 9px;font-size:12px;}" +
      "#snap-manage-done{margin-top:10px;appearance:none;border:none;background:#4fd1a5;color:#06231a;font-weight:700;font-size:14px;padding:12px;border-radius:12px;}";
    var style = document.createElement("style");
    style.id = "snap-nav-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ---------- zoom-zone engine (unchanged behavior) ---------- */
  function initZoomEngine() {
    wrap = document.createElement("div");
    wrap.id = "snap-nav-wrap";

    var kids = [];
    for (var i = 0; i < document.body.childNodes.length; i++) kids.push(document.body.childNodes[i]);
    kids.forEach(function (n) { wrap.appendChild(n); });

    spacer = document.createElement("div");
    spacer.id = "snap-nav-spacer";
    spacer.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:-1;";

    if (!document.body.style.position) document.body.style.position = "relative";
    document.body.appendChild(spacer);
    document.body.appendChild(wrap);

    if (zones.length === 0) {
      zones.push({ scale: 1, x: window.scrollX, y: window.scrollY });
      persistZones();
    }
    applyScale(scale, false);
    goToZone(idx, false);
  }

  function naturalSize() {
    var r = wrap.getBoundingClientRect();
    return { w: r.width / scale, h: r.height / scale };
  }
  function applyScale(s, animate) {
    var nat = naturalSize();
    wrap.style.transition = animate ? "transform .35s ease" : "none";
    wrap.style.transform = "scale(" + s + ")";
    scale = s;
    spacer.style.width = (nat.w * s) + "px";
    spacer.style.height = (nat.h * s) + "px";
  }
  function remeasure() {
    wrap.style.transition = "none";
    wrap.style.transform = "scale(1)";
    scale = 1;
    spacer.style.width = wrap.scrollWidth + "px";
    spacer.style.height = wrap.scrollHeight + "px";
    var z = zones[idx];
    if (z) applyScale(z.scale, false);
  }
  function persistZones() {
    localStorage.setItem(PKEY, JSON.stringify(zones));
    localStorage.setItem(IKEY, String(idx));
  }
  function goToZone(i, animate) {
    if (!zones.length) return;
    i = ((i % zones.length) + zones.length) % zones.length;
    idx = i;
    var z = zones[i];
    applyScale(z.scale, animate);
    if (animate) { try { window.scrollTo({ top: z.y, left: z.x, behavior: "smooth" }); } catch (e) { window.scrollTo(z.x, z.y); } }
    else window.scrollTo(z.x, z.y);
    persistZones();
    refreshBar();
  }
  function saveZone() {
    zones.splice(idx + 1, 0, { scale: scale, x: window.scrollX, y: window.scrollY });
    idx++;
    persistZones();
    refreshBar();
    flash("Saved zone " + (idx + 1));
  }
  function deleteZone() {
    if (!zones.length) return;
    zones.splice(idx, 1);
    if (!zones.length) zones.push({ scale: 1, x: 0, y: 0 });
    idx = Math.max(0, idx - 1);
    persistZones();
    goToZone(idx, false);
    flash("Deleted");
  }
  function zoomBy(delta) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var cx = window.scrollX + vw / 2, cy = window.scrollY + vh / 2;
    var cX = cx / scale, cY = cy / scale;
    var ns = Math.max(0.3, Math.min(3, Math.round((scale + delta) * 100) / 100));
    applyScale(ns, false);
    window.scrollTo(Math.max(0, cX * ns - vw / 2), Math.max(0, cY * ns - vh / 2));
  }

  /* ---------- sections / read engine ---------- */
  function persistSections() {
    localStorage.setItem(SKEY, JSON.stringify(sections));
    localStorage.setItem(SIKEY, String(sidx));
  }
  function gotoSection(i) {
    if (!sections.length) { sidx = 0; renderReader(); refreshBar(); return; }
    sidx = ((i % sections.length) + sections.length) % sections.length;
    persistSections();
    renderReader();
    refreshBar();
  }
  function stripScriptsAndIds(node) {
    if (node.nodeType !== 1) return;
    if (node.hasAttribute && node.hasAttribute("id")) node.removeAttribute("id");
    var scripts = node.querySelectorAll ? node.querySelectorAll("script") : [];
    for (var i = 0; i < scripts.length; i++) scripts[i].remove();
    var withId = node.querySelectorAll ? node.querySelectorAll("[id]") : [];
    for (var j = 0; j < withId.length; j++) withId[j].removeAttribute("id");
  }
  function buildOverlay() {
    overlay = document.createElement("div");
    overlay.id = "snap-reader-overlay";
    tabsEl = document.createElement("div");
    tabsEl.id = "snap-reader-tabs";
    bodyEl = document.createElement("div");
    bodyEl.id = "snap-reader-body";
    overlay.appendChild(tabsEl);
    overlay.appendChild(bodyEl);
    document.body.appendChild(overlay);
  }
  function renderTabs() {
    tabsEl.innerHTML = "";
    sections.forEach(function (sec, i) {
      var t = document.createElement("div");
      t.className = "sn-tab" + (i === sidx ? " sn-active" : "");
      t.textContent = sec.name;
      t.addEventListener("click", function () { gotoSection(i); });
      tabsEl.appendChild(t);
    });
  }
  function renderReader() {
    if (!overlay) return;
    renderTabs();
    bodyEl.innerHTML = "";
    if (!sections.length) {
      var empty = document.createElement("div");
      empty.className = "snap-reader-empty";
      empty.innerHTML = "No sections yet.<br>Tap a part of the real Finviz page (chart, table, news feed) and add it here — build whatever layout you want.";
      var b = document.createElement("button");
      b.textContent = "+ Pick a section";
      b.addEventListener("click", startPicking);
      empty.appendChild(b);
      bodyEl.appendChild(empty);
      return;
    }
    var sec = sections[((sidx % sections.length) + sections.length) % sections.length];
    var card = document.createElement("div");
    card.className = "snap-reader-card";
    var h = document.createElement("div");
    h.className = "snap-reader-card-title";
    h.textContent = sec.name;
    card.appendChild(h);
    sec.selectors.forEach(function (sel) {
      try {
        var el = document.querySelector(sel);
        if (el) {
          var clone = el.cloneNode(true);
          stripScriptsAndIds(clone);
          var hasTable = clone.tagName === "TABLE" || (clone.querySelectorAll && clone.querySelectorAll("table").length);
          if (hasTable) {
            var tw = document.createElement("div");
            tw.className = "snap-reader-tablewrap";
            tw.appendChild(clone);
            card.appendChild(tw);
          } else {
            card.appendChild(clone);
          }
        } else {
          var miss = document.createElement("div");
          miss.className = "snap-reader-missing";
          miss.textContent = "(not found on this page)";
          card.appendChild(miss);
        }
      } catch (e) {}
    });
    bodyEl.appendChild(card);
  }

  /* ---------- element picker ---------- */
  function cssPath(el) {
    if (el.id) return "#" + CSS.escape(el.id);
    var path = [];
    var depth = 0;
    while (el && el.nodeType === 1 && el !== document.body && depth < 10) {
      var sel = el.tagName.toLowerCase();
      if (typeof el.className === "string" && el.className.trim()) {
        var cls = el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2);
        if (cls.length) sel += "." + cls.map(function (c) { return CSS.escape(c); }).join(".");
      }
      var sib = el, nth = 1;
      while ((sib = sib.previousElementSibling)) { if (sib.tagName === el.tagName) nth++; }
      sel += ":nth-of-type(" + nth + ")";
      path.unshift(sel);
      el = el.parentElement;
      depth++;
    }
    return "body " + path.join(" > ");
  }

  function setPick(el) {
    if (pickEl) pickEl.classList.remove("sn-pick-highlight");
    pickEl = el;
    if (el) el.classList.add("sn-pick-highlight");
    updatePickBanner();
  }
  function pickExpand() {
    if (pickEl && pickEl.parentElement && pickEl.parentElement !== document.documentElement) {
      pickHistory.push(pickEl);
      setPick(pickEl.parentElement);
    }
  }
  function pickShrink() {
    if (pickHistory.length) setPick(pickHistory.pop());
  }
  function describeEl(el) {
    if (!el) return "";
    var d = el.tagName.toLowerCase();
    if (el.id) d += "#" + el.id;
    else if (typeof el.className === "string" && el.className.trim()) d += "." + el.className.trim().split(/\s+/).slice(0, 2).join(".");
    return d;
  }

  function buildPickBanner() {
    pickBanner = document.createElement("div");
    pickBanner.id = "snap-pick-banner";
    pickBanner.innerHTML =
      '<div id="snap-pick-info">Tap anything on the page</div>' +
      '<div id="snap-pick-row1">' +
      '<button class="sn-btn" data-act="expand">⬆ Expand</button>' +
      '<button class="sn-btn" data-act="shrink">⬇ Shrink</button>' +
      '<button class="sn-btn sn-danger" data-act="cancel">✕ Cancel</button>' +
      "</div>" +
      '<div id="snap-pick-row2"></div>';
    document.body.appendChild(pickBanner);
    pickBanner.addEventListener("click", function (e) {
      var t = e.target.closest("button");
      if (!t) return;
      var act = t.getAttribute("data-act");
      if (act === "expand") pickExpand();
      else if (act === "shrink") pickShrink();
      else if (act === "cancel") stopPicking();
      else if (act === "new") confirmPick(null);
      else if (act === "sec") confirmPick(t.getAttribute("data-id"));
    });
  }
  function updatePickBanner() {
    var info = pickBanner.querySelector("#snap-pick-info");
    info.textContent = pickEl ? describeEl(pickEl) : "Tap anything on the page";
    var row2 = pickBanner.querySelector("#snap-pick-row2");
    row2.innerHTML = "";
    if (!pickEl) return;
    sections.forEach(function (s) {
      var b = document.createElement("button");
      b.className = "sn-btn sn-accent";
      b.textContent = "→ " + s.name;
      b.setAttribute("data-act", "sec");
      b.setAttribute("data-id", s.id);
      row2.appendChild(b);
    });
    var nb = document.createElement("button");
    nb.className = "sn-btn sn-accent";
    nb.textContent = "+ New section";
    nb.setAttribute("data-act", "new");
    row2.appendChild(nb);
  }
  function onPickClickCapture(e) {
    if (!picking) return;
    if (pickBanner && pickBanner.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    setPick(e.target);
  }
  function startPicking() {
    if (overlay) overlay.style.display = "none";
    if (bar) bar.style.display = "none";
    if (moreRow) moreRow.style.display = "none";
    picking = true;
    pickHistory = [];
    if (!pickBanner) buildPickBanner();
    pickBanner.style.display = "block";
    document.addEventListener("click", onPickClickCapture, true);
    setPick(null);
  }
  function stopPicking() {
    picking = false;
    if (pickEl) pickEl.classList.remove("sn-pick-highlight");
    pickEl = null;
    if (pickBanner) pickBanner.style.display = "none";
    document.removeEventListener("click", onPickClickCapture, true);
    if (bar) bar.style.display = "flex";
    if (mode === "read" && overlay) overlay.style.display = "flex";
  }
  function confirmPick(sectionId) {
    if (!pickEl) return;
    var selector = cssPath(pickEl);
    var sec;
    if (sectionId) {
      sec = sections.filter(function (s) { return s.id === sectionId; })[0];
    } else {
      var name = prompt("Name this section:", "");
      if (!name) return;
      sec = { id: "s" + Date.now(), name: name, selectors: [] };
      sections.push(sec);
      sidx = sections.length - 1;
    }
    sec.selectors.push(selector);
    persistSections();
    stopPicking();
    if (mode !== "read") { mode = "read"; localStorage.setItem(MKEY, mode); }
    if (overlay) overlay.style.display = "flex";
    renderReader();
    refreshBar();
    flash("Added to " + sec.name);
  }

  /* ---------- manage sections ---------- */
  var manageEl;
  function openManage() {
    if (!manageEl) {
      manageEl = document.createElement("div");
      manageEl.id = "snap-manage";
      document.body.appendChild(manageEl);
    }
    renderManage();
    manageEl.style.display = "flex";
    if (bar) bar.style.display = "none";
  }
  function closeManage() {
    manageEl.style.display = "none";
    if (bar) bar.style.display = "flex";
  }
  function renderManage() {
    var html = "<h3>Manage sections</h3>";
    sections.forEach(function (s, i) {
      html += '<div class="sn-row">' +
        '<div class="sn-name">' + escapeHtml(s.name) + " (" + s.selectors.length + ")</div>" +
        '<button data-act="up" data-i="' + i + '">↑</button>' +
        '<button data-act="down" data-i="' + i + '">↓</button>' +
        '<button data-act="rename" data-i="' + i + '">Rename</button>' +
        '<button data-act="del" data-i="' + i + '">Delete</button>' +
        "</div>";
    });
    if (!sections.length) html += '<div style="color:#9aa4b2;font-size:14px;">No sections yet. Use Pick on the main bar.</div>';
    html += '<button id="snap-manage-done">Done</button>';
    manageEl.innerHTML = html;
    manageEl.addEventListener("click", manageClick);
  }
  function manageClick(e) {
    var t = e.target;
    if (t.id === "snap-manage-done") { closeManage(); return; }
    var act = t.getAttribute("data-act");
    if (!act) return;
    var i = parseInt(t.getAttribute("data-i"), 10);
    if (act === "up" && i > 0) { var a = sections.splice(i, 1)[0]; sections.splice(i - 1, 0, a); }
    else if (act === "down" && i < sections.length - 1) { var b = sections.splice(i, 1)[0]; sections.splice(i + 1, 0, b); }
    else if (act === "rename") { var nn = prompt("New name:", sections[i].name); if (nn) sections[i].name = nn; }
    else if (act === "del") { if (confirm("Delete section “" + sections[i].name + "”?")) sections.splice(i, 1); }
    sidx = Math.min(sidx, Math.max(0, sections.length - 1));
    persistSections();
    renderManage();
    renderReader();
    refreshBar();
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }

  /* ---------- bar ---------- */
  function buildBar() {
    bar = document.createElement("div");
    bar.id = "snap-nav-bar";
    bar.style.cssText = "position:fixed;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:5px;align-items:center;background:rgba(15,15,15,.88);padding:6px 8px;border-radius:20px;z-index:2147483647;color:#fff;box-shadow:0 2px 14px rgba(0,0,0,.45);touch-action:none;";
    bar.innerHTML =
      '<button class="sn-btn" data-act="prev">‹</button>' +
      '<span id="snap-nav-label" style="min-width:60px;max-width:120px;overflow:hidden;text-overflow:ellipsis;text-align:center;opacity:.8;font-size:11px;white-space:nowrap;"></span>' +
      '<button class="sn-btn" data-act="next">›</button>' +
      '<button class="sn-btn" data-act="mode">🔄</button>' +
      '<button class="sn-btn" data-act="more">⋯</button>';
    moreRow = document.createElement("div");
    moreRow.id = "snap-nav-more";
    moreRow.style.cssText = "position:fixed;left:50%;bottom:54px;transform:translateX(-50%);display:none;gap:5px;align-items:center;background:rgba(15,15,15,.88);padding:6px 8px;border-radius:20px;z-index:2147483647;color:#fff;box-shadow:0 2px 14px rgba(0,0,0,.45);";
    document.body.appendChild(bar);
    document.body.appendChild(moreRow);

    bar.addEventListener("click", function (e) {
      var t = e.target.closest("button");
      if (!t) return;
      var act = t.getAttribute("data-act");
      if (act === "prev") next(-1);
      else if (act === "next") next(1);
      else if (act === "mode") toggleMode();
      else if (act === "more") toggleMore();
    });
    moreRow.addEventListener("click", function (e) {
      var t = e.target.closest("button");
      if (!t) return;
      var act = t.getAttribute("data-act");
      if (act === "zoomin") zoomBy(0.1);
      else if (act === "zoomout") zoomBy(-0.1);
      else if (act === "save") saveZone();
      else if (act === "del") deleteZone();
      else if (act === "remeasure") remeasure();
      else if (act === "pick") startPicking();
      else if (act === "manage") openManage();
      else if (act === "hide") toggleHidden();
    });

    if (localStorage.getItem(HKEY) === "1") setHidden(true);
    renderMoreRow();
  }
  function renderMoreRow() {
    if (mode === "zoom") {
      moreRow.innerHTML =
        '<button class="sn-btn" data-act="zoomout">−</button>' +
        '<button class="sn-btn" data-act="zoomin">+</button>' +
        '<button class="sn-btn sn-accent" data-act="save">Save</button>' +
        '<button class="sn-btn sn-danger" data-act="del">Del</button>' +
        '<button class="sn-btn" data-act="remeasure">↻</button>' +
        '<button class="sn-btn" data-act="hide">⌄</button>';
    } else {
      moreRow.innerHTML =
        '<button class="sn-btn sn-accent" data-act="pick">+ Pick</button>' +
        '<button class="sn-btn" data-act="manage">Manage</button>' +
        '<button class="sn-btn" data-act="hide">⌄</button>';
    }
  }
  function toggleMore() {
    moreOpen = !moreOpen;
    moreRow.style.display = moreOpen ? "flex" : "none";
  }
  function toggleMode() {
    mode = mode === "zoom" ? "read" : "zoom";
    localStorage.setItem(MKEY, mode);
    if (mode === "read") {
      if (!overlay) buildOverlay();
      overlay.style.display = "flex";
      renderReader();
    } else if (overlay) {
      overlay.style.display = "none";
    }
    renderMoreRow();
    refreshBar();
  }
  function setHidden(h) {
    bar.style.opacity = h ? "0.25" : "1";
    bar.style.transform = h ? "translateX(-50%) translateY(46px)" : "translateX(-50%)";
    localStorage.setItem(HKEY, h ? "1" : "0");
  }
  function toggleHidden() { setHidden(localStorage.getItem(HKEY) !== "1"); }

  function refreshBar() {
    label = document.getElementById("snap-nav-label");
    if (!label) return;
    if (mode === "zoom") {
      label.textContent = "Zoom " + (idx + 1) + "/" + zones.length;
    } else {
      label.textContent = sections.length ? sections[sidx % sections.length].name : "Read: empty";
    }
  }

  function next(dir) {
    if (mode === "zoom") goToZone(idx + dir, true);
    else gotoSection(sidx + dir);
  }

  var toast;
  function flash(msg) {
    if (!toast) {
      toast = document.createElement("div");
      toast.style.cssText = "position:fixed;left:50%;bottom:96px;transform:translateX(-50%);background:rgba(15,15,15,.9);color:#fff;padding:6px 12px;border-radius:12px;font:12px -apple-system,sans-serif;z-index:2147483647;transition:opacity .4s;";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = "1";
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toast.style.opacity = "0"; }, 1000);
  }

  /* ---------- swipe ---------- */
  function bindSwipe() {
    var sx = 0, sy = 0, tracking = false;
    document.addEventListener("touchstart", function (e) {
      if (picking) { tracking = false; return; }
      if (e.target.closest && (e.target.closest("#snap-nav-bar") || e.target.closest("#snap-nav-more") || e.target.closest("#snap-reader-tabs") || e.target.closest("#snap-manage"))) { tracking = false; return; }
      if (e.touches.length !== 1) { tracking = false; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
      tracking = true;
    }, { passive: true });
    document.addEventListener("touchend", function (e) {
      if (!tracking) return;
      tracking = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) {
        next(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
  }

  /* ---------- boot ---------- */
  function init() {
    injectStyle();
    initZoomEngine();
    buildOverlay();
    buildBar();
    bindSwipe();
    if (mode === "read") { overlay.style.display = "flex"; renderReader(); }
    refreshBar();
  }
  function start() {
    if (document.body) init();
    else document.addEventListener("DOMContentLoaded", init);
  }
  if (document.readyState === "complete" || document.readyState === "interactive") setTimeout(start, 600);
  else window.addEventListener("load", function () { setTimeout(start, 600); });
})();
