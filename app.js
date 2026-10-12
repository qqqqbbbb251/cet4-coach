(function () {
  "use strict";

  var DATA = window.CET4_DATA || { words: [], vocabulary: [], reading: [], listening: [], translations: [], writing: [], collocations: [], grammar: [], mocks: [] };
  var ZHENTI = window.CET4_ZHENTI || [];
  var main = document.getElementById("main");

  /* ---------- 视图导航栈（顶部返回键 + 手机系统返回） ---------- */
  var VIEWS = [];
  function updateBackBtn() { var b = document.getElementById("btn-back"); if (b) b.style.display = (VIEWS.length > 1) ? "" : "none"; }
  function go(fn) { VIEWS.push(fn); try { history.pushState({ v: VIEWS.length }, ""); } catch (e) { } fn(); window.scrollTo(0, 0); updateBackBtn(); }
  function goBack() { if (VIEWS.length > 1) { try { history.back(); return; } catch (e) { } VIEWS.pop(); var fn = VIEWS[VIEWS.length - 1]; try { fn(); } catch (e) { } updateBackBtn(); } }
  window.addEventListener("popstate", function () { if (VIEWS.length > 1) { VIEWS.pop(); var fn = VIEWS[VIEWS.length - 1]; try { fn(); } catch (e) { } } updateBackBtn(); });

  /* ---------- 按需加载重资源（首屏只加载 data.js + wordmeta.js + app.js） ---------- */
  var ASSET_V = "18";
  var NEED = {
    zhenti: ["data/zhenti.js", "data/zaudio.js"],
    eztor: ["data/eztor.js", "data/zhenti.js", "data/zaudio.js"],
    yati: ["data/papers.js"],
    reading: ["data/zhenti.js", "data/zaudio.js"],
    listening: ["data/zhenti.js", "data/zaudio.js"],
    writing: ["data/zhenti.js", "data/zaudio.js"],
    translation: ["data/zhenti.js", "data/zaudio.js"],
    vocab: ["data/words_extra.js", "data/wordform.js", "data/dict.js", "data/wordcolloc.js", "data/waudio.js"],
    vtest: ["data/vocabtest.js", "data/waudio.js"],
    roots: ["data/roots.js"],
    grammar: ["data/grammar.js"],
    voa: ["data/voa.js"],
    fav: ["data/dict.js"],
    guide: ["data/guide.js"]
  };
  var _loadedScripts = {};
  function refreshGlobals() { if (window.CET4_DATA) DATA = window.CET4_DATA; if (window.CET4_ZHENTI) ZHENTI = window.CET4_ZHENTI; }
  function loadScript(src) {
    if (window.CET4_ALL_INLINE || _loadedScripts[src]) return Promise.resolve();
    return new Promise(function (res) {
      var s = document.createElement("script");
      s.src = src + (src.indexOf("?") < 0 ? ("?v=" + ASSET_V) : "");
      s.onload = function () { _loadedScripts[src] = 1; res(); };
      s.onerror = function () { res(); };
      document.head.appendChild(s);
    });
  }
  function ensureView(name) {
    if (window.CET4_ALL_INLINE) return Promise.resolve();
    var list = NEED[name] || [];
    var missing = list.filter(function (s) { return !_loadedScripts[s]; });
    if (!missing.length) return Promise.resolve();
    main.innerHTML = '<div class="page"><div class="info">加载中…（首次进入需联网）</div></div>';
    return Promise.all(missing.map(loadScript)).then(function () { refreshGlobals(); });
  }


  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }
  function mdToHtml(md) {
    var lines = esc(md).split("\n"), html = "", inList = false;
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      if (/^\s*#{1,6}\s+/.test(ln)) {
        if (inList) { html += "</ul>"; inList = false; }
        html += "<h2>" + ln.replace(/^\s*#{1,6}\s+/, "") + "</h2>";
      } else if (/^\s*[-*]\s+/.test(ln)) {
        if (!inList) { html += "<ul>"; inList = true; }
        html += "<li>" + ln.replace(/^\s*[-*]\s+/, "") + "</li>";
      } else if (ln.trim() === "") {
        if (inList) { html += "</ul>"; inList = false; }
      } else {
        if (inList) { html += "</ul>"; inList = false; }
        html += "<p>" + ln + "</p>";
      }
    }
    if (inList) html += "</ul>";
    return html;
  }
  function hiExp(exp, kw) {
    var e = esc(exp || "");
    (kw || []).forEach(function (k) {
      if (!k) return;
      var ek = esc(k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      try { e = e.replace(new RegExp(ek, "gi"), function (m) { return "<mark>" + m + "</mark>"; }); } catch (err) { }
    });
    return e;
  }
  var READ_LABEL = { cloze: "选词填空", matching: "段落匹配", reading: "阅读理解" };

  /* ---------- store / progress / wrong / fav / theme ---------- */
  function store(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function saveStore(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function todayKey() { var n = new Date(); return n.getFullYear() + "-" + ("0" + (n.getMonth() + 1)).slice(-2) + "-" + ("0" + n.getDate()).slice(-2); }
  function recordAnswer(type, correct) {
    var p = store("cet4_progress", { a: 0, c: 0, days: {}, types: {} });
    p.a++; if (correct) p.c++;
    var d = todayKey(); p.days[d] = p.days[d] || { a: 0, c: 0 }; p.days[d].a++; if (correct) p.days[d].c++;
    p.types[type] = p.types[type] || { a: 0, c: 0 }; p.types[type].a++; if (correct) p.types[type].c++;
    saveStore("cet4_progress", p);
  }
  function addWrong(q) { var w = store("cet4_wrong", {}); var prev = w[q.key]; q.box = (prev && prev.box) || 0; q.due = (prev && prev.due) || dstr(0); w[q.key] = q; saveStore("cet4_wrong", w); }
  function removeWrong(k) { var w = store("cet4_wrong", {}); delete w[k]; saveStore("cet4_wrong", w); }
  function getFav() { return store("cet4_fav", {}); }
  function toggleFav(word, meaning) { var f = getFav(); if (f[word] != null) { delete f[word]; saveStore("cet4_fav", f); return false; } f[word] = meaning; saveStore("cet4_fav", f); return true; }
  function getQFav() { return store("cet4_qfav", {}); }
  function toggleQFav(rec) { var f = getQFav(); if (f[rec.key]) { delete f[rec.key]; saveStore("cet4_qfav", f); return false; } f[rec.key] = rec; saveStore("cet4_qfav", f); return true; }
  function qfavStar(id) { var on = getQFav()[id]; return '<button class="star qfav' + (on ? " on" : "") + '" data-qk="' + esc(id) + '" title="收藏题目">' + (on ? "★" : "☆") + "</button>"; }
  function diffBadge(d) { if (!d) return ""; var c = { "基础": "#2E7D32", "中级": "#0277BD", "较难": "#EF6C00", "高阶": "#C62828" }[d] || "#607D8B"; return '<span style="font-size:11px;color:#fff;background:' + c + ';border-radius:8px;padding:1px 7px;margin-right:6px">' + d + "</span>"; }
  function applyTheme() { document.body.classList.toggle("dark", store("cet4_theme", "light") === "dark"); }
  function toggleTheme() { var t = store("cet4_theme", "light"); saveStore("cet4_theme", t === "dark" ? "light" : "dark"); applyTheme(); }
  function A2I(a) { return a ? String(a).toUpperCase().charCodeAt(0) - 65 : -1; }
  function stripA(o) { return String(o).replace(/^[A-Za-z]\)\s*/, ""); }
  function examEst(h, ht, r, rt, w, wt) {
    ht = ht || 25; rt = rt || 30; wt = wt || 30;
    var wr = (w == null ? 0.6 * wt : w);
    var e = Math.round(h / ht * 248.5 + r / rt * 248.5 + wr / wt * 212.5);
    return Math.min(710, Math.max(0, e));
  }
  function examList() { return store("cet4_exam", []); }
  function addExam(rec) { var l = examList(); if (l.some(function (x) { return x.date === rec.date && x.source === rec.source && x.est === rec.est; })) return; l.push(rec); saveStore("cet4_exam", l); autoSync(); }
  function examAvg() { var l = examList(); if (!l.length) return 0; var s = 0; l.forEach(function (x) { s += x.est; }); return Math.round(s / l.length); }
  function getRecords(kind) { var l = store("cet4_records", []); return kind ? l.filter(function (x) { return x.kind === kind; }) : l; }
  function recStats(kind) {
    var l = getRecords(kind);
    var ss = l.map(function (x) { return x.score != null ? x.score : parseScore(x.result, kind); }).filter(function (x) { return x != null; });
    var avg = ss.length ? Math.round(ss.reduce(function (a, b) { return a + b; }, 0) / ss.length * 10) / 10 : 0;
    return { n: l.length, avg: avg };
  }
  function saveRecord(kind, title, input, result) {
    var l = store("cet4_records", []);
    var sc = parseScore(result, kind);
    l.push({ id: Date.now(), date: todayKey(), kind: kind, title: title || "", input: input || "", result: result || "", score: sc });
    saveStore("cet4_records", l);
    autoSync();
  }
  function parseScore(md, kind) {
    if (!md) return null;
    var m;
    if (kind === "essay") { m = md.match(/(\d{1,2}(?:\.\d)?)\s*\/\s*15/); if (m) return Math.min(15, parseFloat(m[1])); m = md.match(/(\d{1,3})\s*\/\s*100/); if (m) return Math.round(parseInt(m[1], 10) * 0.15 * 10) / 10; }
    if (kind === "translation") { m = md.match(/(\d{1,2}(?:\.\d)?)\s*\/\s*15/); if (m) return Math.min(15, parseFloat(m[1])); }
    m = md.match(/得分[^\d]{0,6}(\d{1,3})/); if (m) return parseInt(m[1], 10);
    return null;
  }

  /* ---------- 词书 / 词频 / 难度 ---------- */
  function wmeta(w) { return (window.CET4_WORDMETA || {})[w] || { f5: 0, f10: 0, d: "" }; }
  function isSimpleWord(w, meta) {
    meta = meta || (window.CET4_WORDMETA || {});
    var m = meta[w] || {}, lv = m.lv || [];
    if (lv.indexOf("zk") >= 0) return true;
    if (lv.length === 0 && (m.r || 999999) <= 2500) return true;
    return false;
  }
  function bookWords(key) {
    var meta = window.CET4_WORDMETA || {};
    var ex = window.CET4_EXTRA || {};
    if (key === "fav") { var f = getFav(); return Object.keys(f).map(function (w) { return { w: w, p: "", m: f[w] }; }); }
    if (ex[key]) return ex[key];
    if (key === "f5") return DATA.words.filter(function (w) { return (meta[w.w] || {}).f5 >= 8; });
    if (key === "f10") return DATA.words.filter(function (w) { return (meta[w.w] || {}).f10 >= 15; });
    if (["基础", "中级", "较难", "高阶"].indexOf(key) >= 0) return DATA.words.filter(function (w) { return (meta[w.w] || {}).d === key; });
    var ws = DATA.words.slice();
    if (store("cet4_nosimple", true)) ws = ws.filter(function (w) { return !isSimpleWord(w.w, meta); });
    return ws;
  }
  function getVocabLog() { return store("cet4_vocab", { days: {}, learned: {}, total: 0 }); }
  function saveVocabLog(v) { saveStore("cet4_vocab", v); }
  function recordVocabSeen(words) {
    var log = getVocabLog(), d = todayKey(), added = 0;
    log.days = log.days || {}; log.learned = log.learned || {};
    (words || []).forEach(function (w) { if (!(w.w in log.learned)) { log.learned[w.w] = "learning"; added++; } });
    if (added) { log.days[d] = (log.days[d] || 0) + added; log.total = (log.total || 0) + added; saveVocabLog(log); autoSync(); }
    return added;
  }
  function exampleOf(word) { var v = (DATA.vocabulary || []).filter(function (x) { return x.word === word; })[0]; return v ? v.example : ""; }

  /* ---------- SRS 记忆曲线 ---------- */
  var SRS_INT = [0, 1, 2, 4, 7, 15, 30];
  function getSrs() { return store("cet4_srs", {}); }
  function saveSrs(s) { saveStore("cet4_srs", s); }
  function dstr(off) { var d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function srsUpdate(word, meaning, known) {
    var s = getSrs(); var r = s[word] || { b: 0 };
    r.b = known ? Math.min(6, (r.b || 0) + 1) : 0;
    r.d = dstr(SRS_INT[r.b]); r.m = meaning || r.m || "";
    s[word] = r; saveSrs(s);
  }
  function srsDue() { var s = getSrs(), t = todayKey(); return Object.keys(s).filter(function (w) { return s[w].d <= t; }); }

  /* ---------- 折线图 ---------- */
  function svgLine(points, maxV, unit) {
    maxV = maxV || 100; var W = Math.max(300, points.length * 46), H = 150, pad = 24;
    function x(i) { return pad + i * ((W - 2 * pad) / Math.max(1, points.length - 1)); }
    function y(v) { return H - pad - (Math.min(v, maxV) / maxV) * (H - 2 * pad); }
    var line = points.map(function (p, i) { return x(i) + "," + y(p.v); }).join(" ");
    var dots = points.map(function (p, i) { return '<circle cx="' + x(i) + '" cy="' + y(p.v) + '" r="3.5" fill="#3949AB"/>'; }).join("");
    var labels = points.map(function (p, i) { return '<text x="' + x(i) + '" y="' + (H - 6) + '" font-size="10" fill="#9aa0b4" text-anchor="middle">' + p.label + "</text>"; }).join("");
    var vals = points.map(function (p, i) { return '<text x="' + x(i) + '" y="' + (y(p.v) - 8) + '" font-size="10" fill="#3949AB" text-anchor="middle">' + p.v + "</text>"; }).join("");
    return '<div style="overflow-x:auto"><svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" style="min-width:100%">' +
      '<line x1="' + pad + '" y1="' + (H - pad) + '" x2="' + (W - pad) + '" y2="' + (H - pad) + '" stroke="#e3e5ef"/>' +
      '<polyline points="' + line + '" fill="none" stroke="#3949AB" stroke-width="2"/>' + dots + labels + vals + "</svg></div>";
  }

  /* ---------- 云同步（Supabase REST，兼容通用 JSON 端点） ---------- */
  function buildSnapshot() {
    var p = store("cet4_progress", { a: 0, c: 0, days: {}, types: {} });
    var days = p.days || {}, keys = Object.keys(days).sort().slice(-30);
    return {
      name: store("cet4_syncname", "学生"), updated: new Date().toISOString(),
      total: p.a, correct: p.c, acc: p.a ? Math.round(p.c / p.a * 100) : 0,
      types: p.types || {},
      days: keys.map(function (k) { return { d: k, a: days[k].a, c: days[k].c }; }),
      exams: examList(), essayN: recStats("essay").n, essayAvg: recStats("essay").avg,
      transN: recStats("translation").n, transAvg: recStats("translation").avg,
      vocab: (function () { var v = getVocabLog(); return { total: v.total || 0, days: Object.keys(v.days || {}).length }; })(),
      wrongN: Object.keys(store("cet4_wrong", {})).length
    };
  }
  var SYNC_SKIP = { cet4_settings: 1, cet4_synckey: 1 };
  function snapshotAll() {
    var out = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k || k.indexOf("cet4_") !== 0 || SYNC_SKIP[k]) continue;
      try { out[k] = JSON.parse(localStorage.getItem(k)); } catch (e) { }
    }
    return out;
  }
  function restoreAll(obj) {
    if (!obj) return 0;
    var n = 0;
    Object.keys(obj).forEach(function (k) {
      if (k.indexOf("cet4_") !== 0 || SYNC_SKIP[k]) return;
      try { localStorage.setItem(k, JSON.stringify(obj[k])); n++; } catch (e) { }
    });
    return n;
  }
  function fullSnapshot() { var s = buildSnapshot(); s.backup = snapshotAll(); return s; }
  function syncCfg() { return { url: store("cet4_syncurl", ""), key: store("cet4_synckey", ""), name: store("cet4_syncname", "学生") }; }
  function pushSync(tries) {
    tries = tries || 0;
    var c = syncCfg();
    if (!c.url) return Promise.reject(new Error("未配置同步地址"));
    var base = c.url.replace(/\/+$/, "");
    var headers = { "Content-Type": "application/json", "Accept": "application/json" };
    if (c.key) { headers["apikey"] = c.key; headers["Authorization"] = "Bearer " + c.key; }
    headers["Prefer"] = "resolution=merge-duplicates";
    return fetch(base + "/rest/v1/sync", { method: "POST", headers: headers, body: JSON.stringify([{ id: c.name, data: fullSnapshot() }]) })
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error("同步失败 " + r.status + " " + t.slice(0, 120)); }); return true; })
      .catch(function (err) {
        if (tries < 3) return new Promise(function (res) { setTimeout(res, 1500 * (tries + 1)); }).then(function () { return pushSync(tries + 1); });
        throw err;
      });
  }
  function pullSync() {
    var c = syncCfg();
    if (!c.url) return Promise.reject(new Error("未配置同步地址"));
    var base = c.url.replace(/\/+$/, "");
    var headers = { "Accept": "application/json" };
    if (c.key) { headers["apikey"] = c.key; headers["Authorization"] = "Bearer " + c.key; }
    return fetch(base + "/rest/v1/sync?select=*", { headers: headers })
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error("读取失败 " + r.status + " " + t.slice(0, 120)); }); return r.json(); });
  }
  function restoreSync() {
    var c = syncCfg();
    if (!c.url) return Promise.reject(new Error("未配置同步地址"));
    return pullSync().then(function (rows) {
      if (!rows || !rows.length) throw new Error("云端暂无数据");
      var row = findRow(rows, c.name);
      var backup = row.data && row.data.backup;
      if (!backup) throw new Error("云端备份是旧格式（只有统计，没有完整数据）。请让本机先「保存并立即同步」一次。");
      return restoreAll(backup);
    });
  }
  var _lastAutoSync = 0;
  var _lastBak = 0;
  function autoBackup() { var n = Date.now(); if (n - _lastBak < 60000) return; _lastBak = n; try { localStorage.setItem("cet4_backup", JSON.stringify({ ts: n, data: snapshotAll() })); } catch (e) { } }
  function hasLocalData() {
    var p = store("cet4_progress", { a: 0, c: 0 });
    var v = getVocabLog();
    if ((p && p.a > 0) || (v && v.total > 0)) return true;
    if (Object.keys(store("cet4_wrong", {})).length) return true;
    if (Object.keys(store("cet4_fav", {})).length) return true;
    if (Object.keys(store("cet4_srs", {})).length) return true;
    if (Object.keys(store("cet4_qfav", {})).length) return true;
    if (Object.keys(store("cet4_plan", {})).length) return true;
    if (Object.keys(store("cet4_daily", {})).length) return true;
    if ((store("cet4_records", []) || []).length) return true;
    if ((examList() || []).length) return true;
    return false;
  }
  function findRow(rows, name) { if (!rows || !rows.length) return null; for (var i = 0; i < rows.length; i++) { if (rows[i].id === name || rows[i].name === name) return rows[i]; } return rows[rows.length - 1]; }
  function autoSync() { autoBackup(); var c = syncCfg(); if (!c.url) return; if (!hasLocalData()) return; var n = Date.now(); if (n - _lastAutoSync < 120000) return; _lastAutoSync = n; pushSync().catch(function () { }); }
  function syncOnLoad() {
    var c = syncCfg();
    if (!c.url) { autoBackup(); return; }
    if (hasLocalData()) { autoSync(); return; }
    try { if (sessionStorage.getItem("cet4_restore_done")) return; } catch (e) { }
    pullSync().then(function (rows) {
      var row = findRow(rows, c.name);
      if (row && row.data && row.data.backup) {
        var n = restoreAll(row.data.backup);
        if (n > 0) {
          try { sessionStorage.setItem("cet4_restore_done", "1"); } catch (e) { }
          toast("已从云端恢复数据");
          setTimeout(function () { location.reload(); }, 900);
        }
      }
    }).catch(function () { });
  }  var LISTEN_LABEL = { news: "新闻", conversation: "对话", passage: "短文" };

  /* ---------- settings ---------- */
  var DEFAULTS = { apiKey: "", baseUrl: "https://api.deepseek.com", model: "deepseek-flash" };
  function getSettings() {
    try {
      var s = JSON.parse(localStorage.getItem("cet4_settings") || "{}");
      return { apiKey: s.apiKey || "", baseUrl: s.baseUrl || DEFAULTS.baseUrl, model: s.model || DEFAULTS.model };
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function setSettings(s) { localStorage.setItem("cet4_settings", JSON.stringify(s)); }
  function configured() { return getSettings().apiKey.trim().length > 0; }

  function callAI(messages) {
    var s = getSettings();
    if (!s.apiKey.trim()) return Promise.reject(new Error("请先在设置中填写 DeepSeek API Key"));
    var base = s.baseUrl.replace(/\/+$/, "");
    return fetch(base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + s.apiKey.trim() },
      body: JSON.stringify({ model: s.model, messages: messages, temperature: 0.3, stream: false })
    }).then(function (res) {
      return res.text().then(function (txt) {
        if (!res.ok) throw new Error("接口返回 " + res.status + "：" + txt.slice(0, 300));
        var data = JSON.parse(txt);
        if (!data.choices || !data.choices.length) throw new Error("接口未返回结果");
        return (data.choices[0].message.content || "").trim();
      });
    });
  }
  function gradeEssay(direction, essay) {
    return callAI([
      { role: "system", content: "你是一位经验丰富的大学英语四级（CET-4）作文阅卷老师。请用简体中文批改学生的英语作文，语气专业、友善、具体。" },
      { role: "user", content: "请批改下面这篇四级作文。\n\n【作文题目】\n" + direction + "\n\n【学生作文】\n" + essay + "\n\n请严格按以下 Markdown 格式输出：\n## 综合得分\nX/15（四级作文满分 15 分；等级：优秀 13-15 / 良好 10-12 / 及格 7-9 / 不及格 ≤6）\n\n## 总体评价\n（2-3 句）\n\n## 优点\n- （至少 2 条）\n\n## 主要问题与修改建议\n- 原句：…… 建议：……\n\n## 参考范文（120-180 词）\n" }
    ]);
  }
  function gradeTranslation(source, reference, user) {
    return callAI([
      { role: "system", content: "你是一位大学英语四级（CET-4）翻译阅卷老师。请用简体中文批改学生的汉译英，语气专业、友善、具体。" },
      { role: "user", content: "请批改下面这篇汉译英。\n\n【中文原文】\n" + source + "\n\n【参考答案】\n" + reference + "\n\n【学生译文】\n" + user + "\n\n请严格按以下 Markdown 格式输出：\n## 得分\nX/15（四级翻译满分 15 分）\n\n## 总体评价\n（2-3 句）\n\n## 问题与修改\n- 原文片段 → 学生译文 → 建议译文\n\n## 参考译文\n" }
    ]);
  }

  function gradeImages(dataUrls, instruction, kind) {
    var sys, ask;
    if (kind === "essay") {
      sys = "你是一位经验丰富的大学英语四级（CET-4）作文阅卷老师，能准确识别学生手写或拍摄的英文作文图片。请用简体中文批改。";
      ask = "下面是我拍摄的英语作文。请先识别图片中的英文原文（用引用格式列出原文），然后批改。\n" + (instruction ? "【作文题目/要求】\n" + instruction + "\n" : "") +
        "\n请严格按以下 Markdown 格式输出：\n## 识别到的原文\n（尽量准确转录）\n\n## 综合得分\nX/100（等级：优秀/良好/及格/不及格）\n\n## 总体评价\n\n## 优点\n- \n\n## 主要问题与修改建议\n- 原句：…… 建议：……\n\n## 参考范文（120-180 词）";
    } else if (kind === "translation") {
      sys = "你是一位大学英语四级（CET-4）翻译阅卷老师，能准确识别学生手写或拍摄的译文图片。请用简体中文批改。";
      ask = "下面是我拍摄的汉译英译文。请先识别图片中的英文原文，再批改。\n" + (instruction ? "【中文原文/要求】\n" + instruction + "\n" : "") +
        "\n请严格按以下 Markdown 格式输出：\n## 识别到的译文\n\n## 得分\nX/15\n\n## 总体评价\n\n## 问题与修改\n- 原文片段 → 你的译文 → 建议译文\n\n## 参考译文";
    } else {
      sys = "你是一位大学英语四级（CET-4）阅卷老师，能识别学生拍摄的答题卡/试卷图片。请用简体中文给出批改、评分与提升建议。";
      ask = "下面是我拍摄的答题卡/试卷。请识别其中的作答内容，逐题判断对错，给出各部分得分与总分。" + (instruction ? "（参考答案/标准：" + instruction + "）" : "") +
        "\n\n请按以下 Markdown 格式输出：\n## 识别到的作答\n\n## 各部分得分\n- 听力：\n- 阅读：\n- 翻译：\n- 写作：\n\n## 错因分析\n- \n\n## 提升建议\n- ";
    }
    var content = [{ type: "text", text: ask }];
    dataUrls.forEach(function (u) { content.push({ type: "image_url", image_url: { url: u } }); });
    return callAI([{ role: "system", content: sys }, { role: "user", content: content }]);
  }

  /* ---------- objective questions ---------- */
  function questionHTML(q, qi) {
    var h = '<div class="q" data-qi="' + qi + '" data-answer="' + q.answer + '" data-explain="' + esc(q.explanation || "") + '">' +
      '<div class="stem">' + diffBadge(q.diff) + (qi + 1) + ". " + esc(q.stem) + "</div>";
    q.options.forEach(function (o, oi) {
      h += '<div class="opt" data-oi="' + oi + '"><span class="k">' + String.fromCharCode(65 + oi) + ".</span><span>" + esc(o) + "</span></div>";
    });
    h += "</div>";
    return h;
  }
  function bindSection(card) {
    var submitted = false;
    card.querySelectorAll(".opt").forEach(function (el) {
      el.onclick = function () {
        if (submitted) return;
        var q = el.closest(".q");
        q.querySelectorAll(".opt").forEach(function (o) { o.classList.remove("sel"); });
        el.classList.add("sel");
      };
    });
    var submit = card.querySelector(".submit-btn");
    if (!submit) return;
    submit.onclick = function () {
      if (submitted) {
        submitted = false;
        card.querySelectorAll(".opt").forEach(function (o) { o.className = "opt"; });
        card.querySelectorAll(".explain,.score-bar").forEach(function (e) { e.remove(); });
        submit.textContent = "提交批改";
        return;
      }
      var qs = card.querySelectorAll(".q"), correct = 0, answered = 0;
      qs.forEach(function (q) {
        var ans = parseInt(q.getAttribute("data-answer"), 10);
        var sel = q.querySelector(".opt.sel");
        if (sel) answered++;
        q.querySelectorAll(".opt").forEach(function (o) {
          o.classList.add("locked");
          var oi = parseInt(o.getAttribute("data-oi"), 10);
          if (oi === ans) o.classList.add("correct");
          else if (sel && o === sel) o.classList.add("wrong");
        });
        if (sel && parseInt(sel.getAttribute("data-oi"), 10) === ans) correct++;
        var ex = q.getAttribute("data-explain");
        if (ex) { var d = document.createElement("div"); d.className = "explain"; d.textContent = "解析：" + ex; q.appendChild(d); }
      });
      submitted = true;
      submit.textContent = "重做";
      var bar = document.createElement("div");
      bar.className = "score-bar";
      bar.textContent = "本部分得分：" + correct + " / " + qs.length + "（已作答 " + answered + " 题）";
      card.insertBefore(bar, submit);
    };
  }
  function sectionCard(questions, passage) {
    var html = '<div class="card section-card">';
    if (passage) html += '<div class="passage">' + esc(passage) + "</div>";
    questions.forEach(function (q, qi) { html += questionHTML(q, qi); });
    html += '<button class="btn block submit-btn">提交批改</button></div>';
    return html;
  }

  /* ---------- home ---------- */

  var CATS = [
    { k: "words", t: "背单词", d: "背单词 · 复习 · 词书 · 单词量测试 · 词根 · 生词本", ic: "词", c: "#3949AB", mods: ["vocab", "review", "vtest", "vrecords", "roots", "fav"] },
    { k: "exam", t: "真题模考", d: "历年真题 · 原创模拟 · 押题卷 · 全真模拟", ic: "卷", c: "#B71C1C", mods: ["zhenti", "eztor", "yati", "mocks"] },
    { k: "skill", t: "专项练习", d: "听力 · VOA · 阅读 · 翻译 · 写作 · 错词本 · 搭配本 · 语法 · 短语", ic: "练", c: "#00897B", mods: ["listening", "voa", "reading", "translation", "writing", "writinglib", "errbook", "collocbook", "grammar", "collocations"] },
    { k: "ai", t: "AI 批改", d: "拍照识别批改 · 作文/翻译评分", ic: "AI", c: "#D81B60", mods: ["ocr"] },
    { k: "me", t: "我的学习", d: "计划 · 报告 · 打卡 · 错题本 · 收藏", ic: "我", c: "#C62828", mods: ["plan", "report", "dash", "records", "wrong", "qfav", "monitor"] },
    { k: "more", t: "更多", d: "使用指南 · GitHub 开源英语学习资源", ic: "…", c: "#455A64", mods: ["guide", "links"] }
  ];
  var MODS = {
    vocab: { t: "单词检测", d: "单词卡 · 中译英 · 拼写 · 词书 · 重点词 · 生词本", ic: "Aa", c: "#3949AB" },
    roots: { t: "词根词缀", d: "300 个词根词缀 · 例词 + 小测", ic: "根", c: "#00838F" },
    vtest: { t: "单词量测试", d: "英译汉/汉译英/拼写 · 测阅读/听力/写作词汇量", ic: "测", c: "#00838F" },
    vrecords: { t: "背单词记录", d: "每日背词量 · 打卡", ic: "录", c: "#C8860A" },
    review: { t: "记忆曲线复习", d: "按遗忘曲线到期复习", ic: "复", c: "#00695C" },
    monitor: { t: "监督看板", d: "远程查看她的学习数据与曲线", ic: "监", c: "#3730A3" },
    fav: { t: "生词本", d: "收藏的重点词汇", ic: "★", c: "#C8860A" },
    zhenti: { t: "历年真题", d: "76 套（2015–2026）· 3325 题 · 含答案解析", ic: "卷", c: "#B71C1C" },
    eztor: { t: "原创模拟", d: "2 套原创模拟卷 · 55 题含答案解析", ic: "拟", c: "#6A1B9A" },
    yati: { t: "押题卷", d: "11 套押题/模拟卷 · 试卷 PDF + 听力音频", ic: "押", c: "#AD1457" },
    mocks: { t: "全真模拟", d: "10 套完整模拟卷 · 听力/阅读/翻译/写作", ic: "模", c: "#C62828" },
    listening: { t: "听力练习", d: "24 套 · 音频 + 原文 + 自动批改", ic: "听", c: "#F4511E" },
    voa: { t: "VOA 听力", d: "12 篇科学新闻 · 慢速美音 + 原文 + 题目", ic: "VOA", c: "#1565C0" },
    reading: { t: "阅读完形", d: "30 篇 300 题 · 自动批改", ic: "阅", c: "#00897B" },
    translation: { t: "翻译练习", d: "12 篇汉译英 · AI 批改", ic: "译", c: "#5E35B1" },
    writing: { t: "作文批改", d: "12 道题 · AI 评分与范文", ic: "文", c: "#8E24AA" },
    writinglib: { t: "写作素材库", d: "高分句型 · 万能表达 · 我的好句", ic: "素", c: "#7B1FA2" },
    errbook: { t: "错词本", d: "批改提取的错词/错搭配 · 记忆曲线复习", ic: "错", c: "#C62828" },
    collocbook: { t: "搭配本", d: "写作高频搭配 + 你的错搭配", ic: "搭", c: "#00695C" },
    grammar: { t: "语法教程", d: "33 个专题 · 讲解 + 例句 + 易错 + 小测", ic: "法", c: "#2E7D32" },
    collocations: { t: "常用短语", d: "126 个高频搭配", ic: "搭", c: "#00838F" },
    ocr: { t: "拍照批改", d: "拍作文/译文/答题卡 → 识别 → 批改 + 建议", ic: "拍", c: "#D81B60" },
    plan: { t: "学习计划", d: "每日问卷 + AI 贴身计划 · 打卡倒计时", ic: "计", c: "#C62828" },
    report: { t: "学习报告", d: "专属报告 · 可保存为图片", ic: "报", c: "#0277BD" },
    dash: { t: "学习仪表盘", d: "做题统计 · 正确率趋势 · 估分", ic: "📊", c: "#0277BD" },
    records: { t: "作文/翻译记录", d: "历史提交与批改 · 可合成为考试", ic: "档", c: "#8E24AA" },
    wrong: { t: "错题本", d: "自动收集 · 智能复习", ic: "错", c: "#C62828" },
    qfav: { t: "收藏题目", d: "收藏的真题题目", ic: "☆", c: "#6A1B9A" },
    links: { t: "更多资料", d: "GitHub 开源英语学习资源合集", ic: "链", c: "#455A64" },
    guide: { t: "使用指南", d: "3 分钟上手 · 各模块说明 · 常见问题", ic: "📖", c: "#546E7A" }
  };
  function renderHome() {
    var ok = configured();
    var html = '<div class="page">' +
      '<div class="hero"><h1>大学英语四级 · 备考</h1><p>单词 · 真题模考 · 专项练习 · AI 批改，一站式备考。</p><span class="pill">' + (ok ? "● AI 批改已就绪" : "○ AI 批改未配置") + "</span></div>";
    if (!ok) html += '<div class="info warn">点右上角 ⚙ 填入 DeepSeek API Key，即可用作文/翻译批改、拍照识别与 AI 计划；其余功能可离线使用。</div>';
    html += '<div class="center" style="margin:2px 0 14px"><button class="btn ghost" id="home-guide">📖 使用指南 · 快速上手</button></div>';
    html += '<div class="grid">';
    CATS.forEach(function (c) {
      html += '<div class="fcard" data-cat="' + c.k + '"><div class="ic" style="background:' + c.c + '1f;color:' + c.c + '">' + c.ic + '</div><div class="txt"><h3>' + c.t + '</h3><p>' + c.d + '</p></div><div class="arrow">›</div></div>';
    });
    html += '</div><p class="center muted" style="margin-top:24px">个人专属备考工具 · 数据来源：GitHub 开源</p></div>';
    main.innerHTML = html;
    main.querySelectorAll("[data-cat]").forEach(function (el) { el.onclick = function () { renderCategory(el.getAttribute("data-cat")); }; });
    var hg = document.getElementById("home-guide"); if (hg) hg.onclick = function () { openView("guide"); };
  }
  function renderCategory(k) { go(function () { _renderCategory(k); }); }
  function _renderCategory(k) {
    var cat = CATS.filter(function (c) { return c.k === k; })[0];
    if (!cat) { renderHome(); return; }
    var html = '<div class="page"><div class="section-title">' + esc(cat.t) + '</div><div class="grid">';
    cat.mods.forEach(function (m) {
      var x = MODS[m]; if (!x) return;
      html += '<div class="fcard" data-go="' + m + '"><div class="ic" style="background:' + x.c + '1f;color:' + x.c + '">' + x.ic + '</div><div class="txt"><h3>' + x.t + '</h3><p>' + x.d + '</p></div><div class="arrow">›</div></div>';
    });
    html += "</div></div>";
    main.innerHTML = html;
    main.querySelectorAll("[data-go]").forEach(function (el) { el.onclick = function () { openView(el.getAttribute("data-go")); }; });
  }
  function backBar(label, fn) {
    var b = document.createElement("button");
    b.className = "btn ghost small"; b.textContent = "‹ " + (label || "返回");
    b.onclick = function () { goBack(); }; return b;
  }
  function listPage(title, items, renderRow, onClick) {
    var html = '<div class="page"><div class="section-title">' + esc(title) + "</div><div id='listbox'>";
    items.forEach(function (it, i) { html += renderRow(it, i); });
    html += "</div></div>";
    main.innerHTML = html;
    main.querySelectorAll("[data-idx]").forEach(function (el) {
      el.onclick = function () { var it = items[parseInt(el.getAttribute("data-idx"), 10)]; go(function () { onClick(it); }); };
    });
  }
  function listPageInto(container, items, renderRow, onClick) {
    container.innerHTML = '<div class="section-title">共 ' + items.length + " 套</div>" + items.map(renderRow).join("");
    container.querySelectorAll("[data-idx]").forEach(function (el) {
      el.onclick = function () { var it = items[parseInt(el.getAttribute("data-idx"), 10)]; go(function () { onClick(it); }); };
    });
  }
  function moduleView(o) {
    var z = ZHENTI.filter(function (p) {
      if (o.zType === "listening") return p.questions.some(function (q) { return q.type === "listening"; });
      if (o.zType === "reading") return p.questions.some(function (q) { return q.type === "reading"; });
      if (o.zType === "writing") return !!p.writing;
      if (o.zType === "translation") return !!p.translation;
      return false;
    }).sort(function (a, b) { return b.id.localeCompare(a.id); });
    main.innerHTML = '<div class="page"><div class="tabs" id="mTabs"><button data-v="sim" class="active">模拟练习（' + o.simItems.length + '）</button><button data-v="real">历年真题（' + z.length + '）</button></div><div id="mBody"></div></div>';
    var body = document.getElementById("mBody");
    function zRow(p, i) {
      return '<div class="list-item" data-idx="' + i + '"><div class="ic" style="background:#B71C1C1f;color:#B71C1C">卷</div>' +
        '<div><h3>' + esc(p.source) + "</h3><p>含" + o.zLabel + " · 点击作答</p></div>" +
        '<div class="arrow" style="margin-left:auto;color:#c3c6d4">›</div></div>';
    }
    function drawSim() { listPageInto(body, o.simItems, o.simRow, o.simOpen); }
    function drawReal() { listPageInto(body, z, zRow, function (p) { renderZhentiDetail(p, o.zFocus); }); }
    document.getElementById("mTabs").querySelectorAll("button").forEach(function (b) {
      b.onclick = function () { setTab(b); (b.getAttribute("data-v") === "sim" ? drawSim : drawReal)(); };
    });
    drawSim();
  }

  /* ---------- vocab ---------- */
  function renderVocab() {
    main.innerHTML = '<div class="page">' +
      '<label class="info" style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:10px"><input type="checkbox" id="vt-nosimple2" ' + (store("cet4_nosimple", true) ? "checked" : "") + ' style="width:18px;height:18px"> 去除简单词（中考及以内，推荐）' +
      '<span class="muted" style="margin-left:auto">四级词书剩 ' + bookWords("cet4").length + ' 词</span></label>' +
      '<div class="tabs">' +
      '<button id="tab-study" class="active">背单词</button>' +
      '<button id="tab-quiz">词义测验</button>' +
      '<button id="tab-en">中译英</button>' +
      '<button id="tab-spell">拼写</button>' +
      '<button id="tab-book">词书</button>' +
      '<button id="tab-vip">重点词</button></div><div id="vocab-body"></div></div>';
    var body = document.getElementById("vocab-body");
    document.getElementById("vt-nosimple2").onchange = function () { saveStore("cet4_nosimple", this.checked); renderVocab(); };
    document.getElementById("tab-study").onclick = function () { setTab(this); renderStudy(body); };
    document.getElementById("tab-quiz").onclick = function () { setTab(this); renderQuiz(body); };
    document.getElementById("tab-en").onclick = function () { setTab(this); renderEnQuiz(body); };
    document.getElementById("tab-spell").onclick = function () { setTab(this); renderSpell(body); };
    document.getElementById("tab-book").onclick = function () { setTab(this); renderVocabBook(body); };
    document.getElementById("tab-vip").onclick = function () { setTab(this); renderVipVocab(body); };
    body.addEventListener("change", function (e) { if (e.target && e.target.id === "st-spell") { saveStore("cet4_spellmode", e.target.checked); renderStudy(body); } });
    renderStudy(body);
  }
  function setTab(btn) { btn.parentNode.querySelectorAll("button").forEach(function (b) { b.classList.remove("active"); }); btn.classList.add("active"); }
  function renderQuiz(body) {
    var words = bookWords(store("cet4_book", "cet4"));
    if (words.length < 4) { body.innerHTML = '<div class="info">当前词书单词太少（不足 4 个），无法测验，请换一本词书。</div>'; return; }
    var target, options, selected = null, score = 0, total = 0;
    function newQ() {
      target = words[Math.floor(Math.random() * words.length)];
      var set = {}; set[target.w] = target; var guard = 0;
      while (Object.keys(set).length < 4 && guard++ < 300) { var w = words[Math.floor(Math.random() * words.length)]; set[w.w] = w; }
      options = shuffle(Object.keys(set).map(function (k) { return set[k]; }));
      selected = null; draw();
    }
    function draw() {
      var correctK = options.findIndex(function (o) { return o.w === target.w; });
      var html = '<div class="between"><span class="muted">得分 ' + score + " / " + total + '</span><span class="muted">看单词，选正确释义</span></div>' +
        '<div class="card" style="text-align:center;margin-top:12px"><p class="muted">下列单词的中文意思是？</p>' +
        '<div style="font-size:36px;font-weight:800;color:var(--primary)">' + esc(target.w) + "</div></div>";
      options.forEach(function (o, i) {
        var cls = "opt";
        if (selected !== null) { cls += " locked"; if (i === correctK) cls += " correct"; else if (i === selected) cls += " wrong"; }
        html += '<div class="' + cls + '" data-i="' + i + '"><span class="k">' + String.fromCharCode(65 + i) + ".</span><span>" + esc(o.m) + "</span></div>";
      });
      if (selected !== null) html += '<p style="font-weight:600;color:' + (selected === correctK ? "var(--green)" : "var(--red)") + '">' + (selected === correctK ? "回答正确！" : "回答错误，正确答案已标绿。") + "</p>";
      html += '<button class="btn block" id="qbtn" ' + (selected === null ? "disabled" : "") + ">" + (selected === null ? "请选择答案" : "下一题") + "</button>";
      body.innerHTML = html;
      body.querySelectorAll(".opt").forEach(function (el) {
        el.onclick = function () {
          if (selected !== null) return;
          selected = parseInt(el.getAttribute("data-i"), 10); total++;
          if (selected === correctK) score++;
          recordAnswer("vocab", selected === correctK);
          draw();
        };
      });
      document.getElementById("qbtn").onclick = function () { if (selected !== null) newQ(); };
    }
    newQ();
  }
  function renderSpell(body) {
    var words = bookWords(store("cet4_book", "cet4"));
    if (!words.length) { body.innerHTML = '<div class="info">当前词书为空，请到「词书」选择。</div>'; return; }
    var idx = Math.floor(Math.random() * words.length), done = null;
    function draw() {
      var w = words[idx], mm = wmeta(w.w);
      body.innerHTML = '<div class="between"><span class="muted">拼写 · ' + (idx + 1) + " / " + words.length + '</span><button class="star' + (getFav()[w.w] != null ? " on" : "") + '" id="fav-btn">★</button></div>' +
        '<div class="card" style="text-align:center"><div class="muted">根据释义拼写单词</div><div style="font-size:20px;margin:12px 0;line-height:1.6">' + esc(w.m) + "</div>" +
        (w.p ? '<div class="muted">/' + esc(w.p) + "/</div>" : "") + '<div class="muted" style="font-size:12px;margin-top:6px">近5年×' + mm.f5 + " · 难度：" + (mm.d || "—") + "</div></div>" +
        '<input type="text" id="sp-in" placeholder="输入英文单词…" autocomplete="off" autocapitalize="off" spellcheck="false">' +
        '<button class="btn block" id="sp-check" style="margin-top:12px">检查</button><div id="sp-res"></div>';
      var inp = document.getElementById("sp-in"); inp.focus();
      function check() {
        if (done !== null) return;
        var v = inp.value.trim(); if (!v) return;
        var ok = v.toLowerCase() === w.w.toLowerCase(); done = ok;
        recordAnswer("spell", ok);
        document.getElementById("sp-res").innerHTML = '<div class="info ' + (ok ? "" : "warn") + '" style="margin-top:12px">' + (ok ? "✓ 正确！" : "✗ 正确答案：<b>" + esc(w.w) + "</b>") + '</div><button class="btn block" id="sp-next" style="margin-top:8px">下一题</button>';
        document.getElementById("sp-next").onclick = function () { idx = Math.floor(Math.random() * words.length); done = null; draw(); };
      }
      document.getElementById("sp-check").onclick = check;
      inp.onkeydown = function (e) { if (e.key === "Enter") check(); };
      document.getElementById("fav-btn").onclick = function () { var on = toggleFav(w.w, w.m); this.classList.toggle("on", on); toast(on ? "已收藏" : "已取消"); };
    }
    draw();
  }
  function renderEnQuiz(body) {
    var words = bookWords(store("cet4_book", "cet4"));
    if (words.length < 4) { body.innerHTML = '<div class="info">当前词书单词太少，无法测验。</div>'; return; }
    var target, options, selected = null, score = 0, total = 0;
    function newQ() {
      target = words[Math.floor(Math.random() * words.length)];
      var set = {}; set[target.w] = target; var g = 0;
      while (Object.keys(set).length < 4 && g++ < 300) { var w = words[Math.floor(Math.random() * words.length)]; set[w.w] = w; }
      options = shuffle(Object.keys(set).map(function (k) { return set[k]; }));
      selected = null; draw();
    }
    function draw() {
      var correctK = options.findIndex(function (o) { return o.w === target.w; });
      var html = '<div class="between"><span class="muted">得分 ' + score + " / " + total + '</span><span class="muted">看释义，选单词</span></div>' +
        '<div class="card" style="text-align:center;margin-top:12px"><p class="muted">下列释义对应的单词是？</p><div style="font-size:18px;line-height:1.6">' + esc(target.m) + "</div></div>";
      options.forEach(function (o, i) {
        var cls = "opt";
        if (selected !== null) { cls += " locked"; if (i === correctK) cls += " correct"; else if (i === selected) cls += " wrong"; }
        html += '<div class="' + cls + '" data-i="' + i + '"><span class="k">' + String.fromCharCode(65 + i) + ".</span><span>" + esc(o.w) + "</span></div>";
      });
      if (selected !== null) html += '<p style="font-weight:600;color:' + (selected === correctK ? "var(--green)" : "var(--red)") + '">' + (selected === correctK ? "回答正确！" : "回答错误，正确答案已标绿。") + "</p>";
      html += '<button class="btn block" id="enq-btn" ' + (selected === null ? "disabled" : "") + ">" + (selected === null ? "请选择答案" : "下一题") + "</button>";
      body.innerHTML = html;
      body.querySelectorAll(".opt").forEach(function (el) {
        el.onclick = function () { if (selected !== null) return; selected = parseInt(el.getAttribute("data-i"), 10); total++; if (selected === correctK) score++; recordAnswer("vocab", selected === correctK); draw(); };
      });
      document.getElementById("enq-btn").onclick = function () { if (selected !== null) newQ(); };
    }
    newQ();
  }
  function renderVipVocab(body) {
    var list = DATA.vocabulary;
    body.innerHTML = '<input type="text" id="vip-search" placeholder="搜索单词或中文…"><div id="vip-list"></div>';
    var box = document.getElementById("vip-list");
    function draw(q) {
      q = (q || "").trim().toLowerCase();
      var items = q ? list.filter(function (v) { return v.word.toLowerCase().indexOf(q) >= 0 || (v.meaningZh || "").indexOf(q) >= 0; }) : list;
      var fav = getFav();
      box.innerHTML = '<p class="muted" style="margin:10px 0">共 ' + items.length + " 个</p>" + items.map(function (v) {
        var coll = collocOf(v.word);
        return '<div class="card"><div class="between"><b style="font-size:18px;color:var(--primary)">' + esc(v.word) + " <span class='muted' style='font-weight:400'>" + esc(v.phonetic || "") + "</span></b>" +
          '<span><button class="star" data-say="' + esc(v.word) + '">🔊</button><button class="star' + (fav[v.word] != null ? " on" : "") + '" data-fav="' + esc(v.word) + '" data-m="' + esc(v.meaningZh || "") + '">★</button></span></div>' +
          '<div style="margin-top:6px">' + esc(v.meaningZh || "") + "</div>" +
          (coll.length ? '<div class="muted" style="margin-top:6px">搭配：' + coll.map(esc).join("；") + "</div>" : "") +
          (v.example ? '<div class="muted" style="margin-top:6px">例：' + esc(v.example) + "</div>" : "") + "</div>";
      }).join("");
      box.querySelectorAll(".star").forEach(function (b) {
        if (b.getAttribute("data-say")) b.onclick = function () { playWord(b.getAttribute("data-say")); };
        else b.onclick = function () { var on = toggleFav(b.getAttribute("data-fav"), b.getAttribute("data-m")); b.classList.toggle("on", on); toast(on ? "已收藏到生词本" : "已取消收藏"); };
      });
    }
    document.getElementById("vip-search").oninput = function () { draw(this.value); };
    draw("");
  }

  function renderVoaList() {
    var list = window.CET4_VOA || [];
    listPage("VOA 科学新闻听力（" + list.length + " 篇）", list, function (s, i) {
      return '<div class="list-item" data-idx="' + i + '"><div class="ic" style="background:#1565C01f;color:#1565C0">VOA</div>' +
        '<div><h3>' + esc(s.theme) + "</h3><p>" + s.questions.length + " 题 · 含原文 · 可精听</p></div>" +
        '<div class="arrow" style="margin-left:auto;color:#c3c6d4">›</div></div>';
    }, function (s) { renderListeningDetail(s, renderVoaList); });
  }

  /* ---------- reading ---------- */
  function renderReadingList() {
    moduleView({
      simItems: DATA.reading,
      simRow: function (s, i) {
        return '<div class="list-item" data-idx="' + i + '"><div class="ic" style="background:#00897B1f;color:#00897B">阅</div>' +
          '<div><h3>' + esc(s.theme) + '</h3><p>' + (READ_LABEL[s.type] || s.type) + " · " + s.questions.length + " 题</p></div>" +
          '<div class="arrow" style="margin-left:auto;color:#c3c6d4">›</div></div>';
      },
      simOpen: renderReadingDetail, zType: "reading", zFocus: "reading", zLabel: "选词/匹配/阅读"
    });
  }
  function renderReadingDetail(s) {
    var html = '<div class="page"><div id="backslot"></div><div class="section-title">' + esc(s.theme) + "（" + (READ_LABEL[s.type] || s.type) + "）</div>" +
      sectionCard(s.questions, s.passage) + "</div>";
    main.innerHTML = html;
    document.getElementById("backslot").appendChild(backBar("返回", renderReadingList));
    bindSection(main.querySelector(".section-card"));
  }

  /* ---------- listening ---------- */
  function renderListeningList() {
    moduleView({
      simItems: DATA.listening,
      simRow: function (s, i) {
        return '<div class="list-item" data-idx="' + i + '"><div class="ic" style="background:#F4511E1f;color:#F4511E">听</div>' +
          '<div><h3>' + esc(s.theme) + '</h3><p>' + (LISTEN_LABEL[s.type] || s.type) + " · " + s.questions.length + " 题</p></div>" +
          '<div class="arrow" style="margin-left:auto;color:#c3c6d4">›</div></div>';
      },
      simOpen: renderListeningDetail, zType: "listening", zFocus: "listening", zLabel: "听力"
    });
  }
  function renderListeningDetail(s, backFn) {
    var segs = s.segments || [];
    var html = '<div class="page"><div id="backslot"></div><div class="section-title">' + esc(s.theme) + "（" + (LISTEN_LABEL[s.type] || s.type) + "）</div>" +
      '<div class="card"><audio controls preload="metadata" id="la" style="width:100%" src="' + esc(s.audio) + '"></audio>' +
      '<div class="row" style="margin-top:8px;justify-content:center">' +
      '<button class="btn ghost small" data-sp="0.75">0.75×</button>' +
      '<button class="btn ghost small" data-sp="1">1.0×</button>' +
      '<button class="btn ghost small" data-sp="1.25">1.25×</button>' +
      '<button class="btn ghost small" id="toggle-tr">显示原文</button></div>' +
      '<div id="tr-box" style="display:none" class="transcript">' + esc(s.transcript) + "</div></div>";
    if (segs.length) {
      html += '<div class="section-title">精听 · 单句（▶ 播放一句，🔁 循环）</div><div class="card">';
      segs.forEach(function (seg, i) {
        html += '<div class="between" style="gap:8px;padding:7px 0;border-bottom:1px solid var(--line)"><span style="flex:1;font-size:14px;line-height:1.5">' + esc(seg.text) + "</span>" +
          '<button class="btn ghost small" data-seg="' + i + '">▶</button><button class="btn ghost small" data-loop="' + i + '">🔁</button></div>';
      });
      html += "</div>";
      html += '<div class="section-title">听写练习（听一句，写一句）</div><div class="card">' +
        '<div class="muted" style="margin-bottom:6px">点 ▶ 播放该句，输入你听到的英文，点「核对」比对原文。</div>';
      segs.forEach(function (seg, i) {
        html += '<div style="padding:8px 0;border-bottom:1px solid var(--line)">' +
          '<div class="row" style="gap:8px"><button class="btn ghost small" data-dplay="' + i + '">▶</button>' +
          '<input type="text" data-din="' + i + '" placeholder="听写…" style="flex:1" autocomplete="off" autocapitalize="off" spellcheck="false">' +
          '<button class="btn ghost small" data-dchk="' + i + '">核对</button></div>' +
          '<div data-dres="' + i + '" style="margin-top:6px"></div></div>';
      });
      html += "</div>";
    }
    html += '<div class="section-title">听力题目</div>' + sectionCard(s.questions) + "</div>";
    main.innerHTML = html;
    document.getElementById("backslot").appendChild(backBar("返回", backFn || renderListeningList));
    var au = document.getElementById("la");
    main.querySelectorAll("[data-sp]").forEach(function (b) { b.onclick = function () { au.playbackRate = parseFloat(b.getAttribute("data-sp")); toast("语速 " + b.getAttribute("data-sp") + "×"); }; });
    document.getElementById("toggle-tr").onclick = function () {
      var box = document.getElementById("tr-box"); var show = box.style.display === "none";
      box.style.display = show ? "block" : "none"; this.textContent = show ? "隐藏原文" : "显示原文";
    };
    var segMode = null;
    if (segs.length) {
      au.addEventListener("timeupdate", function () {
        if (segMode && au.currentTime >= segMode.end) { if (segMode.loop) { au.currentTime = segMode.start; } else { au.pause(); } }
      });
      main.querySelectorAll("[data-seg]").forEach(function (b) { b.onclick = function () { var g = segs[parseInt(b.getAttribute("data-seg"), 10)]; segMode = { start: g.start, end: g.end, loop: false }; au.currentTime = g.start; au.play(); }; });
      main.querySelectorAll("[data-loop]").forEach(function (b) { b.onclick = function () { var g = segs[parseInt(b.getAttribute("data-loop"), 10)]; segMode = { start: g.start, end: g.end, loop: true }; au.currentTime = g.start; au.play(); }; });
      main.querySelectorAll("[data-dplay]").forEach(function (b) { b.onclick = function () { var g = segs[parseInt(b.getAttribute("data-dplay"), 10)]; segMode = { start: g.start, end: g.end, loop: false }; au.currentTime = g.start; au.play(); }; });
      main.querySelectorAll("[data-dchk]").forEach(function (b) {
        b.onclick = function () {
          var i = parseInt(b.getAttribute("data-dchk"), 10), seg = segs[i];
          var inp = main.querySelector('[data-din="' + i + '"]'), box = main.querySelector('[data-dres="' + i + '"]');
          var ok = normWords(inp.value).join(" ") === normWords(seg.text).join(" ");
          box.innerHTML = '<div style="font-weight:600;color:' + (ok ? "var(--green)" : "#c62828") + '">' + (ok ? "✓ 完全正确" : "✗ 有出入") + "</div>" +
            '<div class="muted" style="margin-top:2px">原文：' + esc(seg.text) + "</div>" + compareWords(seg.text, inp.value);
        };
      });
    }
    bindSection(main.querySelector(".section-card"));
  }

  /* ---------- writing ---------- */
  function renderWritingList() {
    moduleView({
      simItems: DATA.writing,
      simRow: function (s, i) {
        return '<div class="list-item" data-idx="' + i + '"><div class="ic" style="background:#8E24AA1f;color:#8E24AA">文</div>' +
          '<div><h3>' + esc(s.topic) + "</h3><p>" + esc((s.prompt || "").slice(0, 46)) + "…</p></div>" +
          '<div class="arrow" style="margin-left:auto;color:#c3c6d4">›</div></div>';
      },
      simOpen: renderWritingDetail, zType: "writing", zFocus: "writing", zLabel: "写作"
    });
  }
  function renderWritingDetail(s) {
    var html = '<div class="page"><div id="backslot"></div><div class="section-title">' + esc(s.topic) + "</div>" +
      '<div class="card"><div class="stem" style="font-weight:600">Directions</div><div class="passage">' + esc(s.prompt) + "</div>" +
      (s.outline && s.outline.length ? '<div class="info">写作提纲：<ul style="margin:6px 0 0;padding-left:20px">' + s.outline.map(function (o) { return "<li>" + esc(o) + "</li>"; }).join("") + "</ul></div>" : "") + "</div>" +
      '<textarea id="wr-text" rows="10" placeholder="在此输入你的英文作文…"></textarea>' +
      '<div class="between" style="margin-top:8px"><span id="wr-wc" class="muted">词数：0</span><span class="muted">建议 120–180 词</span></div>' +
      '<button class="btn block" id="wr-grade" style="margin-top:14px">AI 智能批改</button>' +
      '<button class="btn outline block" id="wr-img" style="margin-top:8px">📷 拍照/上传图片批改</button>' +
      '<div class="center" style="margin-top:10px"><button class="btn ghost small" id="wr-ref">查看参考范文</button></div>' +
      '<div id="wr-refbox" style="display:none;margin-top:10px"></div>' +
      '<div id="wr-result"></div></div>';
    main.innerHTML = html;
    document.getElementById("backslot").appendChild(backBar("返回", renderWritingList));
    var ta = document.getElementById("wr-text");
    ta.oninput = function () { document.getElementById("wr-wc").textContent = "词数：" + (ta.value.trim() ? ta.value.trim().split(/\s+/).filter(Boolean).length : 0); };
    document.getElementById("wr-img").onclick = function () { imageGrade("essay", s.prompt, document.getElementById("wr-result")); };
    document.getElementById("wr-ref").onclick = function () {
      var b = document.getElementById("wr-refbox"); var show = b.style.display === "none";
      b.style.display = show ? "block" : "none"; b.innerHTML = '<div class="ai-result">' + esc(s.reference || "（暂无）").replace(/\n/g, "<br>") + "</div>";
      this.textContent = show ? "隐藏参考范文" : "查看参考范文";
    };
    document.getElementById("wr-grade").onclick = function () {
      if (!configured()) { toast("请先在设置中配置 DeepSeek API Key"); return; }
      if (ta.value.trim().length < 20) { toast("作文内容太短，请至少写几句"); return; }
      var btn = this, old = btn.textContent;
      btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 批改中…';
      var res = document.getElementById("wr-result"); res.innerHTML = "";
      gradeEssay(s.prompt, ta.value.trim())
        .then(function (md) { res.innerHTML = '<div class="ai-result" style="margin-top:16px">' + mdToHtml(md) + '</div><div class="row" style="margin-top:10px"><button class="btn" id="aiCompose" style="flex:1">记为一次考试</button><button class="btn outline" id="aiExtract" style="flex:1">一键加入错词本</button></div>'; saveRecord("essay", s.prompt, ta.value.trim(), md); toast("已保存到作文记录"); var cb = document.getElementById("aiCompose"); if (cb) cb.onclick = composeFirstExam; var eb = document.getElementById("aiExtract"); if (eb) eb.onclick = function () { extractErrors(md, eb); }; })
        .catch(function (e) { res.innerHTML = '<div class="info warn" style="margin-top:16px">批改失败：' + esc(e.message) + "</div>"; })
        .then(function () { btn.disabled = false; btn.textContent = old; });
    };
  }

  /* ---------- translation ---------- */
  function renderTranslationList() {
    moduleView({
      simItems: DATA.translations,
      simRow: function (s, i) {
        return '<div class="list-item" data-idx="' + i + '"><div class="ic" style="background:#5E35B11f;color:#5E35B1">译</div>' +
          '<div><h3>' + esc(s.theme) + "</h3><p>" + esc((s.prompt || "").slice(0, 46)) + "…</p></div>" +
          '<div class="arrow" style="margin-left:auto;color:#c3c6d4">›</div></div>';
      },
      simOpen: renderTranslationDetail, zType: "translation", zFocus: "translation", zLabel: "翻译"
    });
  }
  function renderTranslationDetail(s) {
    var html = '<div class="page"><div id="backslot"></div><div class="section-title">翻译 · ' + esc(s.theme) + "</div>" +
      '<div class="card"><div class="passage">' + esc(s.prompt) + "</div>" +
      '<textarea id="tr-input" rows="5" placeholder="输入你的英文译文…"></textarea>' +
      '<button class="btn block" id="tr-grade" style="margin-top:12px">AI 批改译文</button>' +
      '<button class="btn outline block" id="tr-img" style="margin-top:8px">📷 拍照/上传译文批改</button>' +
      '<div class="center" style="margin-top:10px"><button class="btn ghost small" id="tr-ref">查看参考译文</button></div>' +
      '<div id="tr-refbox" style="display:none;margin-top:10px"></div>' +
      '<div id="tr-result"></div></div></div>';
    main.innerHTML = html;
    document.getElementById("backslot").appendChild(backBar("返回", renderTranslationList));
    document.getElementById("tr-img").onclick = function () { imageGrade("translation", s.prompt, document.getElementById("tr-result")); };
    document.getElementById("tr-ref").onclick = function () {
      var b = document.getElementById("tr-refbox"); var show = b.style.display === "none";
      b.style.display = show ? "block" : "none"; b.innerHTML = '<div class="info">' + esc(s.reference || "（暂无）") + "</div>";
      this.textContent = show ? "隐藏参考译文" : "查看参考译文";
    };
    document.getElementById("tr-grade").onclick = function () {
      if (!configured()) { toast("请先在设置中配置 DeepSeek API Key"); return; }
      var input = document.getElementById("tr-input");
      if (input.value.trim().length < 2) { toast("请先输入你的译文"); return; }
      var btn = this, old = btn.textContent; btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 批改中…';
      var res = document.getElementById("tr-result"); res.innerHTML = "";
      gradeTranslation(s.prompt, s.reference, input.value.trim())
        .then(function (md) { res.innerHTML = '<div class="ai-result" style="margin-top:16px">' + mdToHtml(md) + '</div><div class="row" style="margin-top:10px"><button class="btn" id="aiCompose" style="flex:1">记为一次考试</button><button class="btn outline" id="aiExtract" style="flex:1">一键加入错词本</button></div>'; saveRecord("translation", s.prompt, input.value.trim(), md); toast("已保存到翻译记录"); var cb = document.getElementById("aiCompose"); if (cb) cb.onclick = composeFirstExam; var eb = document.getElementById("aiExtract"); if (eb) eb.onclick = function () { extractErrors(md, eb); }; attachDeepTranslate(res, s.prompt, s.reference, input.value.trim()); })
        .catch(function (e) { res.innerHTML = '<div class="info warn" style="margin-top:16px">批改失败：' + esc(e.message) + "</div>"; })
        .then(function () { btn.disabled = false; btn.textContent = old; });
    };
  }

  /* ---------- grammar ---------- */
  function grammarData() { return (window.CET4_GRAMMAR && window.CET4_GRAMMAR.length) ? window.CET4_GRAMMAR : (DATA.grammar || []); }
  function renderGrammarList() {
    var g = grammarData();
    var cats = []; g.forEach(function (t) { var c = t.cat || "语法"; if (cats.indexOf(c) < 0) cats.push(c); });
    main.innerHTML = '<div class="page"><div class="section-title">语法教程（' + g.length + " 个专题）</div>" +
      '<input type="text" id="gr-search" placeholder="搜索语法点，如 从句 / 时态 / 虚拟 / 非谓语…"><div id="gr-list"></div></div>';
    var box = document.getElementById("gr-list");
    function draw(q) {
      q = (q || "").trim().toLowerCase();
      var items = q ? g.filter(function (t) { return (t.title + (t.summary || "") + (t.cat || "")).toLowerCase().indexOf(q) >= 0; }) : g;
      var h = "";
      cats.forEach(function (c) {
        var sub = items.filter(function (t) { return (t.cat || "语法") === c; });
        if (!sub.length) return;
        h += '<div class="section-title">' + esc(c) + "</div>";
        sub.forEach(function (t) {
          h += '<div class="list-item" data-gid="' + esc(t.id) + '"><div class="ic" style="background:#2E7D321f;color:#2E7D32">法</div>' +
            '<div><h3>' + esc(t.title) + '</h3><p>' + esc((t.summary || "").slice(0, 46)) + "…</p></div>" +
            '<div class="arrow" style="margin-left:auto;color:#c3c6d4">›</div></div>';
        });
      });
      box.innerHTML = h || '<div class="info">没有匹配的语法点。</div>';
      box.querySelectorAll("[data-gid]").forEach(function (el) {
        el.onclick = function () { var id = el.getAttribute("data-gid"); var t = g.filter(function (x) { return x.id === id; })[0]; if (t) renderGrammarDetail(t); };
      });
    }
    document.getElementById("gr-search").oninput = function () { draw(this.value); };
    draw("");
  }
  function renderGrammarDetail(t) {
    var html = '<div class="page"><div id="backslot"></div><div class="section-title">' + esc(t.title) + "</div>" +
      '<div class="card"><div class="passage">' + esc(t.summary || "") + "</div></div>";
    if (t.sections && t.sections.length) {
      t.sections.forEach(function (sec) {
        html += '<div class="section-title">' + esc(sec.h) + "</div>";
        if (sec.body || (sec.bullets && sec.bullets.length)) {
          html += '<div class="card"><div style="line-height:1.75">' + esc(sec.body || "") + "</div>" +
            (sec.bullets && sec.bullets.length ? '<ul style="padding-left:20px;line-height:1.9;margin-top:8px">' + sec.bullets.map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul>" : "") + "</div>";
        }
        (sec.examples || []).forEach(function (ex) {
          var spk = String(ex.en || "").replace(/\s*→.*$/, "");
          html += '<div class="card" style="border-left:3px solid #2E7D32"><div style="font-size:15px;line-height:1.6"><b>' + esc(ex.en || "") + "</b>" +
            (spk ? ' <button class="star" data-say="' + esc(spk) + '">🔊</button>' : "") + "</div>" +
            (ex.zh ? '<div class="muted" style="margin-top:4px">' + esc(ex.zh) + "</div>" : "") +
            (ex.note ? '<div class="muted" style="margin-top:4px">💡 ' + esc(ex.note) + "</div>" : "") + "</div>";
        });
      });
    } else {
      html += '<div class="card"><div class="stem" style="font-weight:600;margin:6px 0 8px">复习清单</div><ul style="padding-left:20px;line-height:1.9">' +
        (t.checklist || []).map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></div>";
    }
    if (t.mistakes && t.mistakes.length) {
      html += '<div class="section-title">易错提示</div><div class="card">';
      t.mistakes.forEach(function (m) {
        html += '<div style="margin:6px 0;line-height:1.6"><span style="color:#c62828">✗ ' + esc(m.wrong) + '</span><br>' +
          '<span style="color:#2e7d32">✓ ' + esc(m.right) + "</span>" + (m.why ? '<div class="muted" style="margin-top:2px">' + esc(m.why) + "</div>" : "") + "</div>";
      });
      html += "</div>";
    }
    if (t.quiz && t.quiz.length) {
      html += '<div class="section-title">随堂小测</div>';
      t.quiz.forEach(function (qz, qi) {
        html += '<div class="card grammar-quiz" data-qi="' + qi + '"><div class="stem">' + esc(qz.q) + "</div>";
        (qz.options || []).forEach(function (o, oi) { html += '<div class="opt" data-oi="' + oi + '"><span class="k">' + String.fromCharCode(65 + oi) + ".</span><span>" + esc(o) + "</span></div>"; });
        html += "</div>";
      });
    }
    html += "</div>";
    main.innerHTML = html;
    document.getElementById("backslot").appendChild(backBar("返回", renderGrammarList));
    main.querySelectorAll("[data-say]").forEach(function (b) { b.onclick = function () { speak(b.getAttribute("data-say")); }; });
    var done = {};
    main.querySelectorAll(".grammar-quiz").forEach(function (card, qi) {
      var qz = t.quiz[qi];
      card.querySelectorAll(".opt").forEach(function (el) {
        el.onclick = function () {
          if (done[qi]) return; done[qi] = true;
          card.querySelectorAll(".opt").forEach(function (o) {
            o.classList.add("locked");
            var oi = parseInt(o.getAttribute("data-oi"), 10);
            if (oi === qz.answer) o.classList.add("correct"); else if (o === el) o.classList.add("wrong");
          });
          var d = document.createElement("div"); d.className = "explain"; d.textContent = "解析：" + (qz.explain || "");
          card.appendChild(d);
        };
      });
    });
  }

  /* ---------- collocations ---------- */
  function renderCollocations() {
    main.innerHTML = '<div class="page"><div class="section-title">常用短语（' + DATA.collocations.length + ' 个）</div>' +
      '<input type="text" id="co-search" placeholder="搜索短语或中文…"><div id="co-list"></div></div>';
    var box = document.getElementById("co-list");
    function draw(q) {
      q = (q || "").trim().toLowerCase();
      var items = q ? DATA.collocations.filter(function (c) { return c.phrase.toLowerCase().indexOf(q) >= 0 || (c.meaningZh || "").indexOf(q) >= 0; }) : DATA.collocations;
      box.innerHTML = '<p class="muted" style="margin:10px 0">共 ' + items.length + " 个</p>" + items.map(function (c) {
        return '<div class="card"><div class="between"><b style="font-size:17px;color:var(--primary)">' + esc(c.phrase) + "</b>" +
          '<span class="muted">' + esc(c.meaningZh || "") + "</span></div>" +
          (c.example ? '<div style="margin-top:8px">' + esc(c.example) + "</div>" : "") + "</div>";
      }).join("");
    }
    document.getElementById("co-search").oninput = function () { draw(this.value); };
    draw("");
  }

  /* ---------- mocks ---------- */
  function renderMockList() {
    listPage("全真模拟（" + DATA.mocks.length + " 套）", DATA.mocks, function (m, i) {
      return '<div class="list-item" data-idx="' + i + '"><div class="ic" style="background:#C628281f;color:#C62828">卷</div>' +
        '<div><h3>' + esc(m.title) + "</h3><p>听力 " + m.listeningSetIds.length + " 篇 · 阅读 " + m.readingSetIds.length + " 篇 · 翻译 + 写作 · " + (m.timingMinutes || 125) + " 分钟</p></div>" +
        '<div class="arrow" style="margin-left:auto;color:#c3c6d4">›</div></div>';
    }, renderMockDetail);
  }
  function byId(arr, id) { return arr.find(function (x) { return x.id === id; }); }
  function renderMockDetail(m) {
    var html = '<div class="page"><div id="backslot"></div><div class="section-title">' + esc(m.title) + '</div>' +
      '<div class="info">建议用时约 ' + (m.timingMinutes || 125) + " 分钟。点击各部分进入作答（听力/阅读自动批改，翻译/写作 AI 批改）。</div>";
    function group(title, arr, ids, label, openFn) {
      html += '<div class="section-title">' + esc(title) + "</div>";
      ids.forEach(function (id) {
        var it = byId(arr, id); if (!it) return;
        html += '<div class="list-item" data-open="' + esc(id) + '" data-kind="' + openFn + '">' +
          '<div class="ic" style="background:#eef0f8;color:#3949AB">' + label + "</div>" +
          '<div><h3>' + esc(it.theme) + "</h3><p>" + (it.questions ? it.questions.length + " 题" : "") + "</p></div>" +
          '<div class="arrow" style="margin-left:auto;color:#c3c6d4">›</div></div>';
      });
    }
    group("听力", DATA.listening, m.listeningSetIds, "听", "listen");
    group("阅读", DATA.reading, m.readingSetIds, "阅", "read");
    if (m.translationId) { html += '<div class="section-title">翻译</div>' + '<div class="list-item" data-open="' + esc(m.translationId) + '" data-kind="trans"><div class="ic">译</div><div><h3>汉译英</h3></div><div class="arrow" style="margin-left:auto">›</div></div>'; }
    if (m.writingId) { html += '<div class="section-title">写作</div>' + '<div class="list-item" data-open="' + esc(m.writingId) + '" data-kind="write"><div class="ic">文</div><div><h3>作文</h3></div><div class="arrow" style="margin-left:auto">›</div></div>'; }
    html += "</div>";
    main.innerHTML = html;
    document.getElementById("backslot").appendChild(backBar("返回", renderMockList));
    main.querySelectorAll("[data-open]").forEach(function (el) {
      el.onclick = function () {
        var id = el.getAttribute("data-open"), kind = el.getAttribute("data-kind");
        go(function () {
          if (kind === "listen") renderListeningDetail(byId(DATA.listening, id));
          else if (kind === "read") renderReadingDetail(byId(DATA.reading, id));
          else if (kind === "trans") renderTranslationDetail(byId(DATA.translations, id));
          else if (kind === "write") renderWritingDetail(byId(DATA.writing, id));
        });
      };
    });
  }

  /* ---------- 历年真题 ---------- */
  function renderZhentiList() {
    var list = (ZHENTI || []).slice().sort(function (a, b) { return b.id.localeCompare(a.id); });
    listPage("历年真题（" + list.length + " 套 · 2015–2026）", list, function (p, i) {
      return '<div class="list-item" data-idx="' + i + '"><div class="ic" style="background:#B71C1C1f;color:#B71C1C">卷</div>' +
        '<div><h3>' + esc(p.source) + '</h3><p>' + p.questions.length + ' 题 · 含答案与详细解析</p></div>' +
        '<div class="arrow" style="margin-left:auto;color:#c3c6d4">›</div></div>';
    }, renderZhentiDetail);
  }

  function renderZhentiDetail(p, focus, backFn) {
    focus = focus || "";
    var showWriting = !focus || focus === "writing";
    var showListening = !focus || focus === "listening";
    var showReading = !focus || focus === "reading";
    var showTranslation = !focus || focus === "translation";
    function l2i(a) { return a ? a.toUpperCase().charCodeAt(0) - 65 : -1; }
    function strip(o) { return String(o).replace(/^[A-Za-z]\)\s*/, ""); }
    var listening = p.questions.filter(function (q) { return q.type === "listening"; });
    var cloze = p.questions.filter(function (q) { return q.type === "cloze"; });
    var match = p.questions.filter(function (q) { return q.type === "match"; });
    var reading = p.questions.filter(function (q) { return q.type === "reading"; });
    var bank = (cloze[0] && cloze[0].options) || [];
    var labels = (p.matchParagraphs || []).map(function (x) { return x.label; });

    function mcq(q) {
      var opts = (q.options || []).map(strip);
      var h = '<div class="zq" data-kind="mcq" data-ans="' + l2i(q.answer) + '" data-ansl="' + esc(q.answer) + '" data-qno="' + q.qno + '" data-type="' + esc(q.type) + '" data-diff="' + esc(q.diff || "") + '" data-stem="' + esc(q.stem || "") + '" data-opts="' + esc(JSON.stringify(opts)) + '" data-exp="' + esc(q.exp || "") + '" data-kw="' + esc(JSON.stringify(q.kw || [])) + '"><div class="stem">' + diffBadge(q.diff) + q.qno + ". " + esc(q.stem) + qfavStar(p.id + "#" + q.qno) + "</div>";
      (q.options || []).forEach(function (o, oi) {
        h += '<div class="opt" data-oi="' + oi + '"><span class="k">' + String.fromCharCode(65 + oi) + '.</span><span>' + esc(strip(o)) + "</span></div>";
      });
      return h + "</div>";
    }
    function selQ(q, opts, isCloze) {
      var stem = isCloze ? ("第 " + q.qno + " 空") : q.stem;
      var h = '<div class="zq" data-kind="sel" data-ans="' + esc(q.answer) + '" data-ansl="' + esc(q.answer) + '" data-qno="' + q.qno + '" data-type="' + esc(q.type) + '" data-diff="' + esc(q.diff || "") + '" data-stem="' + esc(stem || "") + '" data-opts="' + esc(JSON.stringify(opts.map(function (x) { return x.t; }))) + '" data-exp="' + esc(q.exp || "") + '" data-kw="' + esc(JSON.stringify(q.kw || [])) + '"><div class="stem">' + diffBadge(q.diff) + q.qno + ". " + esc(stem) + qfavStar(p.id + "#" + q.qno) + "</div>";
      h += '<select class="z-sel"><option value="">— 选择 —</option>';
      opts.forEach(function (o) { h += '<option value="' + esc(o.v) + '">' + esc(o.t) + "</option>"; });
      return h + "</select></div>";
    }

    var html = '<div class="page"><div id="backslot"></div><div class="section-title">' + esc(p.source) + "</div>";

    if (showWriting && p.writing) {
      html += '<div class="card"><h2>Part I　写作</h2><div class="passage">' + esc(p.writing.prompt) + "</div>" +
        '<textarea id="z-wr" rows="6" placeholder="在此写作文（至少 120 词）…"></textarea>' +
        '<div class="row" style="margin-top:10px"><button class="btn" id="z-wr-grade">AI 批改作文</button><button class="btn ghost" id="z-wr-sample">参考范文</button></div>' +
        '<div id="z-wr-samplebox" style="display:none;margin-top:10px"></div><div id="z-wr-res"></div></div>';
    }
    if (showListening && listening.length) {
      var zaudio = (window.CET4_ZAUDIO || {})[p.id];
      html += '<div class="card section-card" data-ztype="listening"><h2>Part II　听力（' + listening.length + ' 题）</h2>';
      if (zaudio) {
        html += '<audio controls preload="none" id="za" style="width:100%" src="' + esc(zaudio) + '"></audio>' +
          (p.listeningUrl ? '<div class="muted" style="margin:6px 0">音频加载不出时：<a href="' + esc(p.listeningUrl) + '" target="_blank" rel="noopener">在线收听</a></div>' : "");
      } else if (p.listeningUrl) {
        html += '<div class="info">🎧 本套听力音频：<a href="' + esc(p.listeningUrl) + '" target="_blank" rel="noopener">点击在线收听</a></div>';
      }
      listening.forEach(function (q) { html += mcq(q); });
      html += "</div>";
    }
    if (showReading && cloze.length) {
      html += '<div class="card section-card" data-ztype="cloze"><h2>Part III-A　选词填空</h2><div class="passage">' + esc(p.clozePassage) + "</div>" +
        '<div class="info">词库：' + bank.map(function (o) { return esc(o); }).join("　") + "</div>";
      var bankOpts = bank.map(function (o) { return { v: o.charAt(0).toUpperCase(), t: o }; });
      cloze.forEach(function (q) { html += selQ(q, bankOpts, true); });
      html += "</div>";
    }
    if (showReading && match.length) {
      html += '<div class="card section-card" data-ztype="match"><h2>Part III-B　信息匹配</h2><div class="stem" style="font-weight:600;margin-bottom:6px">' + esc(p.matchIntro || "") + "</div>";
      (p.matchParagraphs || []).forEach(function (x) { html += '<div class="passage" style="margin:8px 0"><b>' + esc(x.label) + ") </b>" + esc(x.text) + "</div>"; });
      var labelOpts = labels.map(function (l) { return { v: l, t: l }; });
      match.forEach(function (q) { html += selQ(q, labelOpts, false); });
      html += "</div>";
    }
    if (showReading && reading.length) {
      html += '<div class="card section-card" data-ztype="reading"><h2>Part III-C　仔细阅读</h2>';
      reading.forEach(function (q) {
        var pas = (p.readingPassages || {})[String(q.qno)];
        if (pas) html += '<div class="passage">' + esc(pas) + "</div>";
        html += mcq(q);
      });
      html += "</div>";
    }
    if (showTranslation && p.translation) {
      html += '<div class="card"><h2>Part IV　翻译</h2><div class="passage">' + esc(p.translation.prompt) + "</div>" +
        '<textarea id="z-tr" rows="4" placeholder="在此写译文…"></textarea>' +
        '<div class="row" style="margin-top:10px"><button class="btn" id="z-tr-grade">AI 批改翻译</button><button class="btn ghost" id="z-tr-sample">参考译文</button></div>' +
        '<div id="z-tr-samplebox" style="display:none;margin-top:10px"></div><div id="z-tr-res"></div></div>';
    }
    if ((showListening && listening.length) || (showReading && (cloze.length || match.length || reading.length))) {
      html += '<div class="card"><button class="btn block submit-btn">提交客观题批改</button><div id="z-score"></div></div>';
    }
    html += "</div>";
    main.innerHTML = html;
    var backTarget = focus === "listening" ? renderListeningList : focus === "reading" ? renderReadingList : focus === "translation" ? renderTranslationList : focus === "writing" ? renderWritingList : (backFn || renderZhentiList);
    document.getElementById("backslot").appendChild(backBar("返回", backTarget));

    main.querySelectorAll(".zq[data-kind=mcq] .opt").forEach(function (el) {
      el.onclick = function () {
        var card = el.closest(".section-card");
        if (card && card.dataset.graded) return;
        var q = el.closest(".zq");
        q.querySelectorAll(".opt").forEach(function (o) { o.classList.remove("sel"); });
        el.classList.add("sel");
      };
    });
    main.querySelectorAll(".qfav").forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var q = b.closest(".zq");
        var rec = {
          key: b.getAttribute("data-qk"), paper: p.source, qno: q.getAttribute("data-qno"), type: q.getAttribute("data-type"),
          stem: q.getAttribute("data-stem"), options: JSON.parse(q.getAttribute("data-opts") || "[]"),
          answer: q.getAttribute("data-ansl") || q.getAttribute("data-ans"), exp: q.getAttribute("data-exp"), kw: JSON.parse(q.getAttribute("data-kw") || "[]")
        };
        var on = toggleQFav(rec); b.classList.toggle("on", on); b.textContent = on ? "★" : "☆"; toast(on ? "已收藏题目" : "已取消收藏");
      };
    });

    function gradeCard(card) {
      var correct = 0, total = 0;
      card.querySelectorAll(".zq").forEach(function (q) {
        total++;
        var ans = q.getAttribute("data-ans"), ok = false;
        if (q.getAttribute("data-kind") === "mcq") {
          var sel = q.querySelector(".opt.sel");
          q.querySelectorAll(".opt").forEach(function (o) {
            o.classList.add("locked");
            var oi = parseInt(o.getAttribute("data-oi"), 10);
            if (oi === parseInt(ans, 10)) o.classList.add("correct");
            else if (sel && o === sel) o.classList.add("wrong");
          });
          ok = sel && parseInt(sel.getAttribute("data-oi"), 10) === parseInt(ans, 10);
        } else {
          var s = q.querySelector(".z-sel");
          if (s.value === ans) { ok = true; s.classList.add("correct"); }
          else if (s.value) s.classList.add("wrong");
          s.classList.add("locked");
        }
        if (ok) correct++;
        var answered = q.querySelector(".opt.sel") || (q.querySelector(".z-sel") && q.querySelector(".z-sel").value);
        if (answered) {
          recordAnswer(q.getAttribute("data-type") || "obj", ok);
          if (!ok) {
            addWrong({
              key: (p.id || "") + "#" + q.getAttribute("data-qno"),
              paper: p.source, qno: q.getAttribute("data-qno"), type: q.getAttribute("data-type"),
              stem: q.getAttribute("data-stem"), options: JSON.parse(q.getAttribute("data-opts") || "[]"),
              answer: q.getAttribute("data-ansl") || q.getAttribute("data-ans"),
              exp: q.getAttribute("data-exp"), kw: JSON.parse(q.getAttribute("data-kw") || "[]")
            });
          }
        }
        var exp = q.getAttribute("data-exp");
        if (exp) {
          var kw = [];
          try { kw = JSON.parse(q.getAttribute("data-kw") || "[]"); } catch (e) { kw = []; }
          var d = document.createElement("div");
          d.className = "explain";
          d.innerHTML = "<b>解析：</b>" + hiExp(exp, kw);
          q.appendChild(d);
          var df = q.getAttribute("data-diff");
          if (df === "较难" || df === "高阶") {
            var mb = document.createElement("button");
            mb.className = "btn ghost small"; mb.style.marginTop = "6px"; mb.textContent = "AI 更详细解析";
            mb.onclick = function () { aiQDetail(q, p, mb); };
            q.appendChild(mb);
          }
        }
      });
      card.dataset.graded = "1";
      return [correct, total];
    }

    var submit = main.querySelector(".submit-btn");
    if (submit) submit.onclick = function () {
      if (main.dataset.zgraded) {
        main.querySelectorAll(".section-card").forEach(function (c) {
          delete c.dataset.graded;
          c.querySelectorAll(".explain,.score-bar").forEach(function (e) { e.remove(); });
          c.querySelectorAll(".opt").forEach(function (o) { o.className = "opt"; });
          c.querySelectorAll(".z-sel").forEach(function (s) { s.value = ""; s.className = "z-sel"; });
        });
        document.getElementById("z-score").innerHTML = "";
        main.dataset.zgraded = "";
        submit.textContent = "提交客观题批改";
        return;
      }
      var c = 0, t = 0, sums = { listening: [0, 0], cloze: [0, 0], match: [0, 0], reading: [0, 0] };
      main.querySelectorAll(".section-card").forEach(function (card) {
        var r = gradeCard(card);
        c += r[0]; t += r[1];
        var z = card.getAttribute("data-ztype"); if (sums[z]) { sums[z][0] += r[0]; sums[z][1] += r[1]; }
        var bar = document.createElement("div");
        bar.className = "score-bar";
        bar.textContent = "本部分得分：" + r[0] + " / " + r[1];
        card.insertBefore(bar, card.firstChild);
      });
      document.getElementById("z-score").innerHTML = '<div class="info" style="margin-top:10px">客观题总计：<b>' + c + " / " + t + "</b>（每题下方已给出答案与解析）</div>";
      main.dataset.zgraded = "1";
      submit.textContent = "重做";
      if (!focus) {
        var h = sums.listening[0], ht = sums.listening[1];
        var rc = sums.cloze[0] + sums.match[0] + sums.reading[0];
        var rt = sums.cloze[1] + sums.match[1] + sums.reading[1];
        if (t > 0) {
          var est = examEst(h, ht || 25, rc, rt || 30, null, 30);
          addExam({ date: todayKey(), source: (p.source || p.id) + " 套卷作答", h: h, ht: ht || 25, r: rc, rt: rt || 30, w: null, wt: 30, est: est, writingEstimated: true });
          document.getElementById("z-score").innerHTML += '<div class="info" style="margin-top:8px">已记为一次<b>套卷考试</b>：估算 <b>' + est + " / 710</b>（写作翻译按 60% 估算，可在计划页录入精确分）。</div>";
        }
      }
    };

    if (showWriting && p.writing) {
      document.getElementById("z-wr-sample").onclick = function () {
        var b = document.getElementById("z-wr-samplebox"); var show = b.style.display === "none";
        b.style.display = show ? "block" : "none"; b.innerHTML = '<div class="ai-result">' + esc(p.writing.sample || "").replace(/\n/g, "<br>") + "</div>";
      };
      document.getElementById("z-wr-grade").onclick = function () {
        var ta = document.getElementById("z-wr");
        if (ta.value.trim().length < 20) { toast("作文太短"); return; }
        aiRun(this, document.getElementById("z-wr-res"), function () { return gradeEssay(p.writing.prompt, ta.value.trim()); }, "essay", p.writing.prompt, ta.value.trim());
      };
    }
    if (showTranslation && p.translation) {
      document.getElementById("z-tr-sample").onclick = function () {
        var b = document.getElementById("z-tr-samplebox"); var show = b.style.display === "none";
        b.style.display = show ? "block" : "none"; b.innerHTML = '<div class="info">' + esc(p.translation.sample || "") + "</div>";
      };
      document.getElementById("z-tr-grade").onclick = function () {
        var ta = document.getElementById("z-tr");
        if (ta.value.trim().length < 2) { toast("请先写译文"); return; }
        aiRun(this, document.getElementById("z-tr-res"), function () { return gradeTranslation(p.translation.prompt, p.translation.sample, ta.value.trim()); }, "translation", p.translation.prompt, ta.value.trim(), p.translation.sample);
      };
    }
  }

  function aiRun(btn, res, fn, kind, title, input, reference) {
    if (!configured()) { toast("请先在设置中配置 DeepSeek API Key"); return; }
    var old = btn.textContent; btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 批改中…';
    res.innerHTML = "";
    fn().then(function (md) {
      res.innerHTML = '<div class="ai-result" style="margin-top:12px">' + mdToHtml(md) + "</div>" + (kind ? '<div class="row" style="margin-top:10px"><button class="btn" id="aiCompose" style="flex:1">记为一次考试</button><button class="btn outline" id="aiExtract" style="flex:1">一键加入错词本</button></div>' : "");
      if (kind) { saveRecord(kind, title, input, md); toast("已保存到" + (kind === "essay" ? "作文" : "翻译") + "记录"); var cb = document.getElementById("aiCompose"); if (cb) cb.onclick = composeFirstExam; var eb = document.getElementById("aiExtract"); if (eb) eb.onclick = function () { extractErrors(md, eb); }; if (kind === "translation" && reference) attachDeepTranslate(res, title, reference, input); }
    })
      .catch(function (e) { res.innerHTML = '<div class="info warn" style="margin-top:12px">失败：' + esc(e.message) + "</div>"; })
      .then(function () { btn.disabled = false; btn.textContent = old; });
  }

  /* ---------- 拍照批改 ---------- */
  function renderOcr() {
    var kind = "essay";
    var imgs = [];
    var askLabel = { essay: "作文题目/要求（可留空）", translation: "中文原文/要求（可留空）", paper: "参考答案/标准（可留空）" };
    var askPh = { essay: "粘贴作文题目或要求，帮助 AI 更准确批改", translation: "粘贴中文原文，帮助批改得更准确", paper: "粘贴选择题答案等标准，便于判分" };
    main.innerHTML = '<div class="page"><div class="section-title">拍照批改</div>' +
      '<div class="info">拍照或选择图片，上传<b>作文 / 译文 / 答题卡</b>，AI 会识别图中内容并给出批改、评分与提升建议。请先在设置里填好 DeepSeek API Key。</div>' +
      '<div class="tabs" id="ocr-tabs"><button data-k="essay" class="active">作文</button><button data-k="translation">翻译</button><button data-k="paper">答题卡/试卷</button></div>' +
      '<label class="fld"><span id="ocr-ask-label">' + askLabel[kind] + '</span><textarea id="ocr-instruction" rows="2" placeholder="' + askPh[kind] + '"></textarea></label>' +
      '<div class="row"><label class="btn ghost" style="cursor:pointer">＋ 选择/拍摄图片<input type="file" id="ocr-file" accept="image/*" multiple capture="environment" style="display:none"></label><span class="muted" id="ocr-count">未选择图片</span></div>' +
      '<div id="ocr-thumbs" class="row" style="margin-top:10px;flex-wrap:wrap"></div>' +
      '<button class="btn block" id="ocr-go" style="margin-top:14px">开始识别并批改</button>' +
      '<div id="ocr-result"></div></div>';

    document.querySelectorAll("#ocr-tabs button").forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll("#ocr-tabs button").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        kind = b.getAttribute("data-k");
        document.getElementById("ocr-ask-label").textContent = askLabel[kind];
        document.getElementById("ocr-instruction").setAttribute("placeholder", askPh[kind]);
      };
    });

    function drawThumbs() {
      document.getElementById("ocr-count").textContent = imgs.length ? ("已选择 " + imgs.length + " 张") : "未选择图片";
      document.getElementById("ocr-thumbs").innerHTML = imgs.map(function (u, i) {
        return '<div style="position:relative"><img src="' + u + '" style="width:78px;height:78px;object-fit:cover;border-radius:10px;border:1px solid var(--line)"><button data-rm="' + i + '" style="position:absolute;top:-6px;right:-6px;background:#c62828;color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer">×</button></div>';
      }).join("");
      document.querySelectorAll("#ocr-thumbs [data-rm]").forEach(function (x) {
        x.onclick = function () { imgs.splice(parseInt(x.getAttribute("data-rm"), 10), 1); drawThumbs(); };
      });
    }
    document.getElementById("ocr-file").onchange = function (e) {
      var files = Array.prototype.slice.call(e.target.files || []);
      var pending = files.length;
      if (!pending) return;
      files.forEach(function (f) {
        var fr = new FileReader();
        fr.onload = function () { imgs.push(fr.result); if (--pending === 0) drawThumbs(); };
        fr.onerror = function () { if (--pending === 0) drawThumbs(); };
        fr.readAsDataURL(f);
      });
    };
    document.getElementById("ocr-go").onclick = function () {
      if (!configured()) { toast("请先在设置中配置 DeepSeek API Key"); return; }
      if (!imgs.length) { toast("请先选择或拍摄图片"); return; }
      var btn = this, old = btn.textContent;
      btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 识别批改中…（较慢，请稍候）';
      var res = document.getElementById("ocr-result"); res.innerHTML = "";
      gradeImages(imgs.slice(), document.getElementById("ocr-instruction").value.trim(), kind)
        .then(function (md) { res.innerHTML = '<div class="ai-result" style="margin-top:16px">' + mdToHtml(md) + "</div>"; })
        .catch(function (e) { res.innerHTML = '<div class="info warn" style="margin-top:16px">失败：' + esc(e.message) + "</div>"; })
        .then(function () { btn.disabled = false; btn.textContent = old; });
    };
  }

  /* ---------- 学习计划 ---------- */
  var PLAN = {
    exam: "2026-12-12",
    weeks: [
      { r: "10.12–10.18", t: "第1周 · 打基础", d: "词汇 + 听力语感；每天背 30 词、做 1 套听力。" },
      { r: "10.19–10.25", t: "第2周 · 词汇巩固", d: "继续背词；选词填空 + 段落匹配各 1 篇/天，弄懂空格填法。" },
      { r: "10.26–11.01", t: "第3周 · 阅读提速", d: "长篇阅读 2 篇/天；语法专题过一遍（15 个专题）。" },
      { r: "11.02–11.08", t: "第4周 · 听力攻坚", d: "听力精听 + 跟读；开始翻译练习，每天 1 篇。" },
      { r: "11.09–11.15", t: "第5周 · 写作翻译", d: "作文 1 篇/天 + 积累句型；翻译对照参考译文修改。" },
      { r: "11.16–11.22", t: "第6周 · 真题套卷①", d: "每 2 天 1 套真题（2015–2017），限时 + 订正错题。" },
      { r: "11.23–11.29", t: "第7周 · 真题套卷②", d: "每 2 天 1 套真题（2018–2020），重点补弱项。" },
      { r: "11.30–12.06", t: "第8周 · 真题套卷③", d: "每 2 天 1 套真题（2021–2024）；整理错题本。" },
      { r: "12.07–12.12", t: "第9周 · 冲刺", d: "全真模拟（闭卷限时）；背作文模板；看错题本，保持手感。" }
    ]
  };
  var DAILY = ["背 30 个单词", "做 1 套听力", "精读 1 篇阅读", "写/译 1 篇"];

  /* ---------- 仪表盘 ---------- */

  /* ---------- 错题本 ---------- */
  function renderWrongBook() {
    var w = store("cet4_wrong", {});
    var items = Object.keys(w).map(function (k) { return w[k]; });
    var html = '<div class="page"><div class="section-title">错题本（' + items.length + '）</div>';
    if (!items.length) {
      html += '<div class="info">还没有错题。做真题/练习答错时，会自动收进这里。</div>';
    } else {
      var _due = items.filter(function (x) { return (x.due || "") <= todayKey(); }).length;
      html += '<div class="row" style="margin-bottom:12px"><button class="btn" id="wq-due">记忆曲线复习（到期 ' + _due + '）</button><button class="btn ghost" id="wq-review">全部复习</button><button class="btn ghost" id="wq-clear">清空</button></div>';
      items.forEach(function (q) {
        html += '<div class="wrong-item"><div class="stem">' + esc(q.paper || "") + " · 第" + esc(q.qno) + '题</div>' +
          '<div style="margin:6px 0">' + esc(q.stem || "") + "</div>" +
          (q.options || []).map(function (o) { return '<div class="muted">' + esc(o) + "</div>"; }).join("") +
          '<div style="margin-top:6px">正确答案：<b>' + esc(q.answer) + "</b></div>" +
          (q.exp ? '<div class="explain">解析：' + hiExp(q.exp, q.kw || []) + "</div>" : "") + "</div>";
      });
    }
    html += "</div>";
    main.innerHTML = html;
    if (items.length) {
    document.getElementById("wq-due").onclick = function () { go(function () { renderWrongQuiz(true); }); };
    document.getElementById("wq-review").onclick = function () { go(function () { renderWrongQuiz(false); }); };
      document.getElementById("wq-clear").onclick = function () { saveStore("cet4_wrong", {}); renderWrongBook(); };
    }
  }


  /* ---------- 生词本 ---------- */
  function renderFavList() {
    var f = getFav();
    var words = Object.keys(f);
    var dic = window.CET4_DICT || {};
    var html = '<div class="page"><div class="section-title">生词本（' + words.length + '）</div>';
    if (!words.length) { html += '<div class="info">还没有收藏单词。在「单词检测 → 重点词汇」或单词卡里点 ★ 收藏。</div>'; }
    words.forEach(function (w) {
      var ph = (dic[String(w).toLowerCase()] || [])[0] || "";
      html += '<div class="card"><div class="between"><b style="font-size:17px;color:var(--primary)">' + esc(w) + (ph ? ' <span class="muted" style="font-weight:400">/' + esc(ph) + "/</span>" : "") + '</b><span><button class="star" data-say="' + esc(w) + '">🔊</button><button class="star on" data-rm="' + esc(w) + '">★</button></span></div><div style="margin-top:6px">' + esc(f[w]) + "</div></div>";
    });
    html += "</div>";
    main.innerHTML = html;
    main.querySelectorAll("[data-say]").forEach(function (b) { b.onclick = function () { playWord(b.getAttribute("data-say")); }; });
    main.querySelectorAll("[data-rm]").forEach(function (b) { b.onclick = function () { toggleFav(b.getAttribute("data-rm")); renderFavList(); }; });
  }

  /* ---------- 词根词缀 ---------- */
  function renderRootsList() {
    var roots = window.CET4_ROOTS || [];
    main.innerHTML = '<div class="page"><div class="section-title">词根词缀（' + roots.length + ' 个）</div>' +
      '<input type="text" id="rt-search" placeholder="搜索词根或含义…"><div id="rt-list"></div></div>';
    var box = document.getElementById("rt-list");
    function draw(q) {
      q = (q || "").trim().toLowerCase();
      var items = q ? roots.filter(function (r) { return r.root.toLowerCase().indexOf(q) >= 0 || (r.meaning || "").indexOf(q) >= 0; }) : roots;
      box.innerHTML = '<p class="muted" style="margin:10px 0">共 ' + items.length + ' 个</p>' + items.map(function (r) {
        return '<div class="list-item" data-root="' + esc(r.root) + '"><div class="ic" style="background:#00838F1f;color:#00838F">根</div>' +
          '<div><h3>' + esc(r.root) + " · " + esc(r.meaning) + '</h3><p>' + esc(r.origin || "") + " · " + ((r.examples || []).length) + " 个例词</p></div>" +
          '<div class="arrow" style="margin-left:auto;color:#c3c6d4">›</div></div>';
      }).join("");
      box.querySelectorAll("[data-root]").forEach(function (el) {
        el.onclick = function () { var r = roots.find(function (x) { return x.root === el.getAttribute("data-root"); }); if (r) go(function () { renderRootDetail(r); }); };
      });
    }
    document.getElementById("rt-search").oninput = function () { draw(this.value); };
    draw("");
  }
  function renderRootDetail(r) {
    var html = '<div class="page"><div id="backslot"></div><div class="section-title">' + esc(r.root) + " · " + esc(r.meaning) + "</div>" +
      '<div class="card"><div class="muted">来源：' + esc(r.origin || "") + '</div><div class="passage" style="margin-top:10px">' + esc(r.description || "") + "</div></div>" +
      '<div class="section-title">例词（' + ((r.examples || []).length) + "）</div>";
    (r.examples || []).forEach(function (e) {
      var bd = e.breakdown || {};
      var parts = (bd.prefix ? bd.prefix + "-" : "") + (bd.root || "") + (bd.suffix ? "-" + bd.suffix : "");
      html += '<div class="card"><div class="between"><b style="font-size:17px;color:var(--primary)">' + esc(e.word) + '</b><span class="muted">' + esc(parts) + "</span></div>" +
        '<div style="margin-top:6px">' + esc(e.meaning || "") + "</div>" +
        (e.explanation ? '<div class="muted" style="margin-top:6px">' + esc(e.explanation) + "</div>" : "") + "</div>";
    });
    if (r.quiz) {
      html += '<div class="card"><div class="stem">' + esc(r.quiz.question) + "</div>" +
        (r.quiz.options || []).map(function (o, i) { return '<div class="opt" data-qi="' + i + '"><span class="k">' + String.fromCharCode(65 + i) + ".</span><span>" + esc(o) + "</span></div>"; }).join("") + "</div>";
    }
    html += "</div>";
    main.innerHTML = html;
    document.getElementById("backslot").appendChild(backBar("返回", renderRootsList));
    var answered = false;
    main.querySelectorAll(".opt").forEach(function (el) {
      el.onclick = function () {
        if (answered) return; answered = true;
        var i = parseInt(el.getAttribute("data-qi"), 10);
        var ok = i === r.quiz.correctAnswer;
        el.classList.add(ok ? "correct" : "wrong");
        if (!ok) { var c = main.querySelector('.opt[data-qi="' + r.quiz.correctAnswer + '"]'); if (c) c.classList.add("correct"); }
      };
    });
  }

  /* ---------- 收藏题目 ---------- */
  function renderQFav() {
    var f = getQFav();
    var items = Object.keys(f).map(function (k) { return f[k]; });
    var html = '<div class="page"><div class="section-title">收藏题目（' + items.length + '）</div>';
    if (!items.length) { html += '<div class="info">还没有收藏题目。做真题时点题干右侧的 ☆ 即可收藏。</div>'; }
    items.forEach(function (q) {
      html += '<div class="wrong-item"><div class="stem">' + esc(q.paper || "") + " · 第" + esc(q.qno) + '题 <button class="star on" data-rm="' + esc(q.key) + '">★</button></div>' +
        '<div style="margin:6px 0">' + esc(q.stem || "") + "</div>" +
        (q.options || []).map(function (o) { return '<div class="muted">' + esc(o) + "</div>"; }).join("") +
        '<div style="margin-top:6px">答案：<b>' + esc(q.answer) + "</b></div>" +
        (q.exp ? '<div class="explain">解析：' + hiExp(q.exp, q.kw || []) + "</div>" : "") + "</div>";
    });
    html += "</div>";
    main.innerHTML = html;
    main.querySelectorAll("[data-rm]").forEach(function (b) {
      b.onclick = function () { var g = getQFav(); delete g[b.getAttribute("data-rm")]; saveStore("cet4_qfav", g); renderQFav(); };
    });
  }

  /* ---------- 首屏引导 ---------- */
  function showWelcome() {
    if (store("cet4_seen", false)) return;
    var mask = document.createElement("div");
    mask.className = "modal-mask";
    mask.innerHTML = '<div class="modal"><h2>欢迎使用四级备考</h2>' +
      '<p>三步上手：</p>' +
      '<ul style="padding-left:20px;line-height:1.9">' +
      '<li>① ⚙ 设置里填 <b>DeepSeek API Key</b>（用 AI 批改 / AI 计划）</li>' +
      '<li>② 设置里配 <b>云同步</b>（自动备份，换机 / 清缓存可恢复）</li>' +
      '<li>③ 每天先到「学习计划」填问卷，生成今日计划</li>' +
      '</ul>' +
      '<div class="info">其余功能（背单词 / 真题 / 听力 / 阅读 / 语法…）可直接离线使用。</div>' +
      '<button class="btn block" id="wel-guide">📖 查看完整使用指南</button>' +
      '<button class="btn ghost block" id="wel-ok" style="margin-top:8px">开始使用</button></div>';
    document.body.appendChild(mask);
    function closeWel() { saveStore("cet4_seen", true); if (mask.parentNode) document.body.removeChild(mask); }
    document.getElementById("wel-ok").onclick = closeWel;
    document.getElementById("wel-guide").onclick = function () { closeWel(); openView("guide"); };
  }

  /* ---------- 原创模拟卷 ---------- */
  function renderEztorList() {
    var list = window.CET4_EZTOR || [];
    listPage("原创模拟卷（" + list.length + " 套）", list, function (p, i) {
      return '<div class="list-item" data-idx="' + i + '"><div class="ic" style="background:#6A1B9A1f;color:#6A1B9A">拟</div>' +
        '<div><h3>' + esc(p.source) + "</h3><p>听力25 · 选词10 · 匹配10 · 阅读10 · 写作 · 翻译</p></div>" +
        '<div class="arrow" style="margin-left:auto;color:#c3c6d4">›</div></div>';
    }, function (p) { renderZhentiDetail(p, "", renderEztorList); });
  }

  /* ---------- 更多资料 ---------- */
  function renderGuide() {
    var G = window.CET4_GUIDE || {};
    var html = '<div class="page"><div class="section-title">使用指南</div>' +
      '<div class="info">' + esc(G.intro || "") + "</div>" +
      '<div class="section-title">快速上手</div>';
    (G.quick || []).forEach(function (s) { html += '<div class="card"><b>' + esc(s.t) + '</b><div class="muted" style="margin-top:4px">' + esc(s.d) + "</div></div>"; });
    (G.sections || []).forEach(function (sec) {
      html += '<div class="section-title">' + esc(sec.h) + "</div>";
      (sec.items || []).forEach(function (it) { html += '<div class="card"><b>' + esc(it.t) + '</b><div class="muted" style="margin-top:4px">' + esc(it.d) + "</div></div>"; });
    });
    if (G.faq && G.faq.length) {
      html += '<div class="section-title">常见问题</div>';
      G.faq.forEach(function (f) { html += '<details class="card" style="padding:12px 14px"><summary style="cursor:pointer"><b>' + esc(f.q) + '</b></summary><div class="muted" style="margin-top:6px">' + esc(f.a) + "</div></details>"; });
    }
    if (G.tips && G.tips.length) {
      html += '<div class="section-title">小贴士</div><div class="card">' + G.tips.map(function (t) { return '<div style="padding:6px 0;border-bottom:1px solid var(--line)">· ' + esc(t) + "</div>"; }).join("") + "</div>";
    }
    html += "</div>";
    main.innerHTML = html;
  }
  function renderLinks() {
    var groups = [
      { t: "题库 · 真题", items: [
        { t: "gongyining0601/cet4", d: "76 套结构化真题（本站题库来源）", u: "https://github.com/gongyining0601/cet4" },
        { t: "0609x/CET46-Resources", d: "历年真题 PDF + 答案解析 + 听力音频", u: "https://github.com/0609x/CET46-Resources" },
        { t: "DieDiDi/CET4-6-past-exam-paper", d: "四六级历年真题汇总", u: "https://github.com/DieDiDi/CET4-6-past-exam-paper" }
      ] },
      { t: "词库 · 词根", items: [
        { t: "ECDICT", d: "词频/难度词典（柯林斯/BNC/COCA）", u: "https://github.com/skywind3000/ECDICT" },
        { t: "KyleBing/english-vocabulary", d: "英文词汇表大全", u: "https://github.com/KyleBing/english-vocabulary" },
        { t: "word-root-workshop", d: "词根词缀记忆（本站词根来源）", u: "https://github.com/joeseesun/word-root-workshop" },
        { t: "2ndLA/english-phrases", d: "英语常用短语", u: "https://github.com/2ndLA/english-phrases" }
      ] },
      { t: "模拟 · 备考", items: [
        { t: "Bailipa/eztor-cet-content", d: "原创四级模拟卷（本站原创模拟来源）", u: "https://github.com/Bailipa/eztor-cet-content" },
        { t: "Gatsby666-jay/CET-Practice", d: "押题卷 6 套 + 模拟卷（PDF+音频）", u: "https://github.com/Gatsby666-jay/CET-Practice" },
        { t: "Liuxiangjian-ai/cet-skill", d: "四六级备考策略与评分标准", u: "https://github.com/Liuxiangjian-ai/cet-skill" },
        { t: "ChuangLee/blind_english", d: "NPR 盲听练习（Flutter App）", u: "https://github.com/ChuangLee/blind_english" }
      ] },
      { t: "英语学习 · 综合", items: [
        { t: "knowledgefxg/learning-english", d: "英语学习资源大全", u: "https://github.com/knowledgefxg/learning-english" },
        { t: "mengxi-ream/read-frog", d: "沉浸式阅读学习工具", u: "https://github.com/mengxi-ream/read-frog" },
        { t: "Wei-Xia/most-frequent-technology-english-words", d: "最常见的科技英语词", u: "https://github.com/Wei-Xia/most-frequent-technology-english-words" }
      ] }
    ];
    var html = '<div class="page"><div class="section-title">更多英语学习资源</div><div class="info">以下为 GitHub 上的开源学习资源，点击在新标签页打开。</div>';
    groups.forEach(function (g) {
      html += '<div class="section-title">' + esc(g.t) + "</div>";
      g.items.forEach(function (it) {
        html += '<div class="card"><a href="' + esc(it.u) + '" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><b style="color:var(--primary)">' + esc(it.t) + '</b><div class="muted" style="margin-top:4px">' + esc(it.d) + "</div></a></div>";
      });
    });
    html += "</div>";
    main.innerHTML = html;
  }

  /* ---------- 押题卷 / 模拟卷 ---------- */
  function renderYatiList() {
    var list = window.CET4_PAPERS || [];
    listPage("押题卷 / 模拟卷（" + list.length + " 套）", list, function (p, i) {
      return '<div class="list-item" data-idx="' + i + '"><div class="ic" style="background:#AD14571f;color:#AD1457">押</div>' +
        '<div><h3>' + esc(p.title) + "</h3><p>试卷 PDF + 听力音频</p></div>" +
        '<div class="arrow" style="margin-left:auto;color:#c3c6d4">›</div></div>';
    }, renderYatiDetail);
  }
  function renderYatiDetail(p) {
    main.innerHTML = '<div class="page"><div id="backslot"></div><div class="section-title">' + esc(p.title) + "</div>" +
      '<div class="card"><div class="info">📄 试卷与答案解析都在 PDF 里：<a href="' + esc(p.pdf) + '" target="_blank" rel="noopener">打开 / 下载试卷 PDF</a></div>' +
      '<div style="margin-top:12px"><audio controls preload="none" style="width:100%" src="' + esc(p.audio) + '"></audio></div>' +
      '<div class="muted" style="margin-top:8px">听力音频已压缩，便于在线播放；完整试卷（即答案）见上方 PDF。</div></div></div>';
    document.getElementById("backslot").appendChild(backBar("返回", renderYatiList));
  }

  /* ---------- 专属学习报告 ---------- */
  function reportData() {
    var p = store("cet4_progress", { a: 0, c: 0, days: {}, types: {} });
    var acc = p.a ? Math.round(p.c / p.a * 100) : 0;
    var est = p.a ? Math.min(710, Math.round(p.c / p.a * 497 + 128)) : 0;
    var wrong = Object.keys(store("cet4_wrong", {})).length;
    var qfav = Object.keys(store("cet4_qfav", {})).length;
    var fav = Object.keys(getFav()).length;
    var daily = store("cet4_daily", {});
    var checkin = 0; for (var k in daily) if (daily[k] && daily[k].answers) checkin++;
    var dd = new Date(), streak = 0;
    function key(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
    if (!daily[key(dd)]) dd.setDate(dd.getDate() - 1);
    for (; ;) { var dr = daily[key(dd)]; if (dr && dr.answers) { streak++; dd.setDate(dd.getDate() - 1); } else break; }
    var days = Math.max(0, Math.ceil((new Date("2026-12-12T09:00:00") - new Date()) / 86400000));
    var typeNames = { listening: "听力", cloze: "选词填空", match: "信息匹配", reading: "仔细阅读", review: "错题复习", obj: "练习", vocab: "词汇" };
    var types = p.types || {}, weak = null, weakR = 101;
    for (var t in types) { var x = types[t]; if (x.a >= 3) { var rr = x.c / x.a * 100; if (rr < weakR) { weakR = rr; weak = typeNames[t] || t; } } }
    return { a: p.a, c: p.c, acc: acc, est: est, wrong: wrong, qfav: qfav, fav: fav, checkin: checkin, streak: streak, days: days, types: types, typeNames: typeNames, weak: weak, weakR: Math.round(weakR < 101 ? weakR : 0), exams: examList(), examAvg: examAvg() };
  }
  function renderReport() {
    var r = reportData();
    var html = '<div class="page"><div class="hero"><h1>学习报告</h1><p>距四级考试还有 ' + r.days + " 天 · 已打卡 " + r.checkin + " 天 · 连续 " + r.streak + " 天</p></div>" +
      '<div class="stat-row">' +
      '<div class="stat"><div class="n">' + r.a + '</div><div class="l">已做题</div></div>' +
      '<div class="stat"><div class="n">' + r.c + '</div><div class="l">答对</div></div>' +
      '<div class="stat"><div class="n">' + r.acc + '%</div><div class="l">正确率</div></div>' +
      '<div class="stat"><div class="n">' + (r.est || "—") + '</div><div class="l">参考估分</div></div>' +
      '</div>' +
      '<div class="card"><div class="section-title" style="margin-top:0">分题型正确率</div>';
    var keys = Object.keys(r.types).filter(function (k) { return r.types[k].a > 0; });
    if (!keys.length) html += '<div class="muted">还没有做题数据，快去真题 / 练习刷几题吧。</div>';
    keys.forEach(function (k) { var x = r.types[k], rr = Math.round(x.c / x.a * 100); html += '<div class="between" style="margin:6px 0"><span>' + (r.typeNames[k] || k) + '</span><span class="muted">' + x.c + "/" + x.a + " · " + rr + '%</span></div><div class="progress"><i style="width:' + rr + '%"></i></div>'; });
    html += "</div>";
    var _es = recStats("essay"), _ts = recStats("translation");
    if (_es.n || _ts.n) {
      html += '<div class="card"><div class="section-title" style="margin-top:0">主观题（作文 / 翻译）</div>' +
        (_es.n ? '<div class="between" style="margin:6px 0"><span>作文</span><span class="muted">' + _es.n + " 篇 · 平均 " + _es.avg + '/100</span></div>' : "") +
        (_ts.n ? '<div class="between" style="margin:6px 0"><span>翻译</span><span class="muted">' + _ts.n + " 篇 · 平均 " + _ts.avg + '/15</span></div>' : "") +
        "</div>";
    }
    var _ex = r.exams || [];
    if (_ex.length) { html += '<div class="section-title">考试 / 模考（满分 710）</div><div class="card"><div class="between" style="margin:6px 0"><span>最近一次</span><b style="color:var(--primary)">' + _ex[_ex.length - 1].est + ' / 710</b></div><div class="between" style="margin:6px 0"><span>平均</span><b>' + r.examAvg + ' / 710</b></div><div class="between" style="margin:6px 0"><span>次数</span><b>' + _ex.length + '</b></div></div>'; }
    html += '<div class="stat-row">' +
      '<div class="stat"><div class="n">' + r.wrong + '</div><div class="l">错题</div></div>' +
      '<div class="stat"><div class="n">' + r.qfav + '</div><div class="l">收藏题</div></div>' +
      '<div class="stat"><div class="n">' + r.fav + '</div><div class="l">生词</div></div></div>';
    html += '<div class="info">' + (r.a ? ("提升建议：" + (r.weak ? ("你的弱项是「" + r.weak + "」（正确率 " + r.weakR + "%），建议专项突破，并复习错题本。") : "各方面都不错，继续保持，多刷真题套卷。")) : "开始做题后，这里会给出针对性建议。") + "</div>";
    html += '<button class="btn block" id="rep-save">保存报告为图片</button></div>';
    main.innerHTML = html;
    document.getElementById("rep-save").onclick = function () { exportReportImage(r); };
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function exportReportImage(r) {
    var W = 900, H = 1200, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var g = cv.getContext("2d");
    var F = '"Microsoft YaHei", "PingFang SC", sans-serif';
    g.fillStyle = "#F4F5FA"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#3949AB"; g.fillRect(0, 0, W, 220);
    g.fillStyle = "#fff"; g.font = "bold 52px " + F; g.fillText("四级备考 · 学习报告", 60, 110);
    g.font = "28px " + F; g.fillText(new Date().toLocaleDateString() + " · 距考试 " + r.days + " 天 · 连续打卡 " + r.streak + " 天", 60, 170);
    var stats = [["已做题", r.a], ["答对", r.c], ["正确率", r.acc + "%"], ["参考估分", (r.est || "—")]];
    var x0 = 60, y0 = 280, bw = (W - 120 - 3 * 24) / 4, bh = 150;
    stats.forEach(function (s, i) { var x = x0 + i * (bw + 24);
      g.fillStyle = "#fff"; roundRect(g, x, y0, bw, bh, 16); g.fill();
      g.fillStyle = "#3949AB"; g.font = "bold 52px " + F; g.textAlign = "center"; g.fillText(String(s[1]), x + bw / 2, y0 + 80);
      g.fillStyle = "#6b7280"; g.font = "24px " + F; g.fillText(s[0], x + bw / 2, y0 + 122); g.textAlign = "left"; });
    var y = y0 + bh + 70;
    g.fillStyle = "#1c1c22"; g.font = "bold 34px " + F; g.fillText("分题型正确率", 60, y); y += 52;
    var keys = Object.keys(r.types).filter(function (k) { return r.types[k].a > 0; });
    if (!keys.length) { g.fillStyle = "#6b7280"; g.font = "28px " + F; g.fillText("暂无数据", 60, y); y += 50; }
    keys.forEach(function (k) { var x = r.types[k], rr = Math.round(x.c / x.a * 100);
      g.fillStyle = "#1c1c22"; g.font = "28px " + F; g.fillText(r.typeNames[k] || k, 60, y);
      g.fillStyle = "#6b7280"; g.textAlign = "right"; g.fillText(x.c + "/" + x.a + "  " + rr + "%", W - 60, y); g.textAlign = "left";
      g.fillStyle = "#e5e7f2"; roundRect(g, 60, y + 14, W - 120, 14, 7); g.fill();
      g.fillStyle = "#3949AB"; roundRect(g, 60, y + 14, (W - 120) * rr / 100, 14, 7); g.fill(); y += 74; });
    if (r.exams && r.exams.length) { g.fillStyle = "#3949AB"; g.font = "bold 30px " + F; g.fillText("最近模考 " + r.exams[r.exams.length - 1].est + " / 710 · 平均 " + r.examAvg + " / 710", 60, y); y += 56; }
    y += 10; g.fillStyle = "#1c1c22"; g.font = "bold 30px " + F;
    g.fillText("错题 " + r.wrong + " · 收藏题 " + r.qfav + " · 生词 " + r.fav + " · 打卡 " + r.checkin + " 天", 60, y); y += 60;
    if (r.weak) { g.fillStyle = "#37474f"; g.font = "28px " + F; g.fillText("提升建议：弱项「" + r.weak + "」正确率 " + r.weakR + "%，建议专项突破并复习错题本。", 60, y); }
    g.fillStyle = "#9aa0b4"; g.font = "22px " + F; g.fillText("四级备考 · CET-4 Coach", 60, H - 40);
    var a = document.createElement("a"); a.download = "四级学习报告.png"; a.href = cv.toDataURL("image/png"); a.click();
  }

  /* ---------- 学习计划（新版：分阶段 + AI + 模考 + 打卡） ---------- */
  /* ---------- 学习计划（当日问卷 → AI 贴身计划 → 立即同步云端） ---------- */
  var EXAM_DATE = "2026-12-12";
  function planDays() { return Math.max(0, Math.ceil((new Date(EXAM_DATE + "T09:00:00") - new Date()) / 86400000)); }
  var MODMAP = {
    vocab: { t: "背单词", v: "vocab" }, review: { t: "记忆曲线复习", v: "review" },
    listening: { t: "听力练习", v: "listening" }, voa: { t: "VOA 听力", v: "voa" },
    reading: { t: "阅读完形", v: "reading" }, translation: { t: "翻译", v: "translation" },
    writing: { t: "写作", v: "writing" }, wrong: { t: "错题本", v: "wrong" },
    errbook: { t: "错词本", v: "errbook" }, collocbook: { t: "搭配本", v: "collocbook" },
    grammar: { t: "语法教程", v: "grammar" }, collocations: { t: "常用短语", v: "collocations" },
    zhenti: { t: "历年真题", v: "zhenti" }, mock: { t: "整卷模考", v: "zhenti" },
    roots: { t: "词根词缀", v: "roots" }, vtest: { t: "单词量测试", v: "vtest" }
  };
  function syncNow() { autoBackup(); if (!syncCfg().url) return; pushSync().catch(function () { }); }
  function chkGroup(name, labels, checked) {
    return labels.map(function (l) { return '<label style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:1px solid var(--line);border-radius:20px;font-size:13px;cursor:pointer"><input type="checkbox" data-grp="' + name + '" value="' + esc(l) + '" ' + (checked && checked.indexOf(l) >= 0 ? "checked" : "") + ">" + esc(l) + "</label>"; }).join("");
  }
  function readChkGroup(name) { return Array.prototype.slice.call(main.querySelectorAll('[data-grp="' + name + '"]')).filter(function (x) { return x.checked; }).map(function (x) { return x.value; }); }
  function dailyStreak(daily) {
    var s = 0, d = new Date();
    function K(x) { return x.getFullYear() + "-" + ("0" + (x.getMonth() + 1)).slice(-2) + "-" + ("0" + x.getDate()).slice(-2); }
    if (!(daily[K(d)] && daily[K(d)].answers)) d.setDate(d.getDate() - 1);
    for (; ;) { var r = daily[K(d)]; if (r && r.answers) { s++; d.setDate(d.getDate() - 1); } else break; }
    return s;
  }
  function learnerContext() {
    var p = store("cet4_progress", { a: 0, c: 0, types: {} });
    var typeNames = { listening: "听力", cloze: "选词填空", match: "信息匹配", reading: "仔细阅读", review: "错题复习", spell: "拼写", obj: "练习", vocab: "词汇" };
    var types = p.types || {}, rows = [];
    Object.keys(types).forEach(function (k) { if (types[k].a > 0) rows.push((typeNames[k] || k) + " " + types[k].c + "/" + types[k].a + "(" + Math.round(types[k].c / types[k].a * 100) + "%)"); });
    var v = getVocabLog(), ex = examList();
    return "累计练习 " + p.a + " 题，正确率 " + (p.a ? Math.round(p.c / p.a * 100) : 0) + "%。分题型：" + (rows.join("；") || "暂无") + "。" +
      "背单词累计 " + (v.total || 0) + " 词；错题 " + Object.keys(store("cet4_wrong", {})).length + "；生词 " + Object.keys(getFav()).length + "。" +
      "作文 " + recStats("essay").n + " 篇(均 " + recStats("essay").avg + "/15)，翻译 " + recStats("translation").n + " 篇(均 " + recStats("translation").avg + "/15)。" +
      "模考：" + (ex.length ? ex.slice(-5).map(function (x) { return x.date + " " + x.est + "/710"; }).join("；") : "暂无") + "。";
  }
  function fallbackPlan(profile, ans) {
    var min = ans.minutes || profile.dailyMinutes || 60, focus = (ans.focus && ans.focus.length) ? ans.focus : [];
    var tasks = [], left = min;
    function add(module, title, detail, m) { if (left <= 0) return; m = Math.min(m, left); tasks.push({ module: module, title: title, detail: detail, minutes: m, done: false }); left -= m; }
    add("vocab", "背单词 " + (min >= 60 ? 30 : 20) + " 个", "用「背单词」成组学，先学后测。", 20);
    if (focus.indexOf("听力") >= 0 || left > 0) add("listening", "听力精听 1 段", "单句精听 + 听写核对。", 20);
    if (left > 0) add("reading", "阅读 1 篇", "做完提交批改并看解析。", 15);
    if (left > 0) add("wrong", "复习错题", "错题本按记忆曲线复习。", 10);
    if (left > 0 && (focus.indexOf("写作翻译") >= 0 || focus.indexOf("翻译") >= 0)) add("translation", "翻译 / 写作 1 篇", "写后用 AI 批改 + 深度分析。", 15);
    return { summary: "今天约 " + min + " 分钟：先词汇热身，再按偏好安排听力/阅读/写译，最后复习错题。", tasks: tasks, tips: ["先难后易、限时完成，完成一项勾一项。"] };
  }
  function generateDailyPlan(profile, ans) {
    var prompt = "你是大学英语四级(CET-4)一对一备考规划师。根据学生的长期档案、历史数据和今天的实际情况，制定【今日】学习计划。\n" +
      "【考试】" + EXAM_DATE + "，距今 " + planDays() + " 天。\n" +
      "【长期档案】目标：" + (profile.goal || "未填") + "；自评：" + (profile.level || "未填") + "；日常可用：" + (profile.dailyMinutes || 60) + " 分钟；偏好：" + ((profile.preferences || []).join("、") || "无") + "；时段：" + (profile.schedule || "未填") + "；薄弱/要求：" + (profile.weak || "") + "\n" +
      "【历史数据】" + learnerContext() + "\n" +
      "【今天】可用 " + ans.minutes + " 分钟；精力：" + ans.energy + "；想重点练：" + ((ans.focus || []).join("、") || "无") + "；有整块时间做套题：" + ans.blocks + "；补充：" + (ans.note || "无") + "\n" +
      "要求：任务具体、可勾选、可执行；总时长不超过今天可用时间；结合薄弱项与偏好；今天时间少就安排高频/碎片任务；临近考试加大真题/模考比重。\n" +
      "只输出 JSON（不要代码块）：{\"summary\":\"一句话今日目标\",\"tasks\":[{\"module\":\"vocab\",\"title\":\"背单词 30 个\",\"detail\":\"具体做法\",\"minutes\":20}],\"tips\":[\"一条执行建议\"]}\n" +
      "module 只能取：" + Object.keys(MODMAP).join(",") + "。tasks 数量 3-6 个。";
    return callAI([{ role: "system", content: "你是资深四级备考规划师，只输出 JSON。" }, { role: "user", content: prompt }])
      .then(function (txt) {
        var m = txt.match(/\{[\s\S]*\}/); var obj = m ? JSON.parse(m[0]) : null;
        if (!obj || !obj.tasks || !obj.tasks.length) throw new Error("no plan");
        obj.tasks.forEach(function (t) { t.done = false; if (!MODMAP[t.module]) t.module = "vocab"; });
        return obj;
      });
  }
  function renderPlan() {
    var days = planDays(), tk = todayKey();
    var daily = store("cet4_daily", {});
    var profile = store("cet4_profile", null);
    var today = daily[tk];
    var streak = dailyStreak(daily);
    var html = '<div class="page"><div class="hero"><h1>距四级考试还有 ' + days + ' 天</h1><p>考试日期：' + EXAM_DATE + '（周六上午）</p><span class="pill">连续打卡 ' + streak + ' 天</span></div>';
    if (!profile) html += profileFormHTML();
    else if (!today || !today.answers) html += questionnaireHTML(profile, tk);
    else html += planViewHTML(today, tk);
    html += examEntryHTML();
    html += "</div>";
    main.innerHTML = html;
    bindProfile();
    bindQuestionnaire(tk);
    bindPlan(tk);
    bindExamEntry(tk);
  }
  function profileFormHTML() {
    return '<div class="section-title">先填一份长期档案（只填一次）</div><div class="card">' +
      '<label class="fld"><span>目标分数</span><select id="pf-goal"><option>425</option><option>500</option><option>550</option><option selected>600</option></select></label>' +
      '<label class="fld"><span>当前水平自评</span><select id="pf-level"><option>基础薄弱</option><option selected>一般</option><option>较好</option></select></label>' +
      '<label class="fld"><span>平时每天能学多久</span><select id="pf-min"><option value="30">约 30 分钟</option><option value="60" selected>约 1 小时</option><option value="90">约 1.5 小时</option><option value="120">约 2 小时</option><option value="180">2 小时以上</option></select></label>' +
      '<label class="fld"><span>偏好练什么（可多选）</span><div class="row" style="flex-wrap:wrap;gap:6px">' + chkGroup("pf-pref", ["背单词", "听力", "阅读", "写作翻译", "刷真题"]) + "</div></label>" +
      '<label class="fld"><span>作息 / 可学习时段</span><input type="text" id="pf-schedule" placeholder="如：早上通勤、午休、晚上 8-10 点"></label>' +
      '<label class="fld"><span>薄弱项与特殊要求</span><textarea id="pf-weak" rows="2" placeholder="如：听力差、作文没思路；在职只能碎片时间"></textarea></label>' +
      '<button class="btn block" id="pf-save">保存档案，开始今日计划</button></div>';
  }
  function questionnaireHTML(profile, tk) {
    return '<div class="section-title">今日问卷 · ' + esc(tk) + '</div><div class="card">' +
      '<div class="muted" style="margin-bottom:8px">每天第一次进来花 20 秒填一下，AI 据此生成今天的专属计划。</div>' +
      '<label class="fld"><span>今天大概能学多久？</span><select id="q-min">' + [15, 30, 45, 60, 90, 120].map(function (m) { return '<option value="' + m + '"' + (m === (profile.dailyMinutes || 60) ? " selected" : "") + ">约 " + m + " 分钟</option>"; }).join("") + "</select></label>" +
      '<label class="fld"><span>今天精力如何？</span><select id="q-energy"><option>精力不错</option><option selected>一般</option><option>比较累</option></select></label>' +
      '<label class="fld"><span>今天想重点练（可多选）</span><div class="row" style="flex-wrap:wrap;gap:6px">' + chkGroup("q-focus", ["背单词", "听力", "阅读", "写作翻译", "错题复习"]) + "</div></label>" +
      '<label class="fld"><span>今天有整块时间做套题吗？</span><select id="q-blocks"><option>没有（只有碎片时间）</option><option>有（可做一整套真题）</option></select></label>' +
      '<label class="fld"><span>补充（心情 / 特殊情况，可空）</span><textarea id="q-note" rows="2"></textarea></label>' +
      '<button class="btn block" id="q-go">生成今日专属计划</button><div id="q-msg"></div>' +
      '<div class="center" style="margin-top:8px"><button class="btn ghost small" id="q-edit-profile">修改长期档案</button></div></div>';
  }
  function planViewHTML(today, tk) {
    var plan = today.plan || {}, tasks = plan.tasks || [], doneN = tasks.filter(function (t) { return t.done; }).length;
    var list = tasks.map(function (t, i) {
      var mm = MODMAP[t.module] || { t: t.module, v: "home" };
      return '<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--line)">' +
        '<input type="checkbox" data-task="' + i + '" ' + (t.done ? "checked" : "") + ' style="width:20px;height:20px;margin-top:3px">' +
        '<div style="flex:1"><b>' + esc(t.title || "") + '</b> <span class="muted">· ' + esc(mm.t) + " · 约" + (t.minutes || 10) + "分钟</span>" +
        (t.detail ? '<div class="muted" style="margin-top:2px">' + esc(t.detail) + "</div>" : "") + "</div>" +
        '<button class="btn ghost small" data-goto="' + esc(mm.v) + '">去练</button></div>';
    }).join("");
    return '<div class="section-title">今日计划 · ' + esc(tk) + '</div>' +
      (plan.summary ? '<div class="info">' + esc(plan.summary) + "</div>" : "") +
      '<div class="card">' + (list || '<div class="muted">暂无任务</div>') +
      '<div class="progress" style="margin-top:8px"><i style="width:' + Math.round(doneN / Math.max(1, tasks.length) * 100) + '%"></i></div>' +
      '<div class="muted">完成 ' + doneN + " / " + tasks.length + "</div>" +
      (plan.tips && plan.tips.length ? '<div class="muted" style="margin-top:6px">💡 ' + plan.tips.map(esc).join("；") + "</div>" : "") + "</div>" +
      '<div class="row"><button class="btn ghost" id="pl-regen" style="flex:1">重新生成计划</button><button class="btn ghost" id="pl-reedit" style="flex:1">改今日问卷</button></div>' +
      '<div class="center"><button class="btn ghost small" id="q-edit-profile">修改长期档案</button></div>';
  }
  function examEntryHTML() {
    var mocks = examList();
    return '<div class="section-title">模考成绩录入</div><div class="card">' +
      '<div class="row"><label class="fld" style="flex:1"><span>日期</span><input type="date" id="mk-date" value="' + todayKey() + '"></label>' +
      '<label class="fld" style="flex:1"><span>听力 正确/25</span><input type="number" id="mk-l" min="0" max="25" placeholder="如 18"></label></div>' +
      '<div class="row"><label class="fld" style="flex:1"><span>阅读 正确/30</span><input type="number" id="mk-r" min="0" max="30" placeholder="如 24"></label>' +
      '<label class="fld" style="flex:1"><span>写作+翻译 估分/30</span><input type="number" id="mk-w" min="0" max="30" placeholder="如 20"></label></div>' +
      '<button class="btn block" id="mk-save">保存本次模考成绩</button>' +
      (mocks.length ? '<div style="margin-top:10px" class="muted">已记录 ' + mocks.length + " 次：" + mocks.slice(-3).map(function (m) { return m.date + " " + m.est + "/710"; }).join("；") + "</div>" : "") + "</div>";
  }
  function bindProfile() {
    var pf = main.querySelector("#pf-save");
    if (pf) pf.onclick = function () {
      saveStore("cet4_profile", { goal: document.getElementById("pf-goal").value, level: document.getElementById("pf-level").value, dailyMinutes: parseInt(document.getElementById("pf-min").value, 10), preferences: readChkGroup("pf-pref"), schedule: document.getElementById("pf-schedule").value.trim(), weak: document.getElementById("pf-weak").value.trim() });
      syncNow(); toast("档案已保存并同步"); renderPlan();
    };
    var ep = main.querySelector("#q-edit-profile");
    if (ep) ep.onclick = function () { saveStore("cet4_profile", null); renderPlan(); };
  }
  function bindQuestionnaire(tk) {
    var go = main.querySelector("#q-go");
    if (!go) return;
    go.onclick = function () {
      var ans = { minutes: parseInt(document.getElementById("q-min").value, 10), energy: document.getElementById("q-energy").value, focus: readChkGroup("q-focus"), blocks: document.getElementById("q-blocks").value, note: document.getElementById("q-note").value.trim() };
      var daily = store("cet4_daily", {});
      daily[tk] = daily[tk] || {}; daily[tk].answers = ans; daily[tk].ts = Date.now();
      saveStore("cet4_daily", daily); syncNow();
      go.disabled = true; go.innerHTML = '<span class="spin"></span> 生成中…';
      var profile = store("cet4_profile", {});
      function done(plan) { var d = store("cet4_daily", {}); d[tk] = d[tk] || {}; d[tk].plan = plan; saveStore("cet4_daily", d); syncNow(); renderPlan(); }
      if (!configured()) { toast("未配置 AI，先用默认计划"); done(fallbackPlan(profile, ans)); return; }
      generateDailyPlan(profile, ans).then(done).catch(function () { toast("AI 生成失败，已用默认计划"); done(fallbackPlan(profile, ans)); });
    };
  }
  function rebuildPlan(tk, ans, btn) {
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 生成中…';
    var profile = store("cet4_profile", {});
    function done(plan) { var d = store("cet4_daily", {}); d[tk] = d[tk] || {}; d[tk].plan = plan; saveStore("cet4_daily", d); syncNow(); renderPlan(); }
    if (!configured()) { done(fallbackPlan(profile, ans)); return; }
    generateDailyPlan(profile, ans).then(done).catch(function () { done(fallbackPlan(profile, ans)); });
  }
  function bindPlan(tk) {
    main.querySelectorAll("[data-task]").forEach(function (cb) {
      cb.onchange = function () { var d = store("cet4_daily", {}); var pl = d[tk] && d[tk].plan; if (pl && pl.tasks[cb.getAttribute("data-task")]) { pl.tasks[cb.getAttribute("data-task")].done = cb.checked; saveStore("cet4_daily", d); syncNow(); renderPlan(); } };
    });
    main.querySelectorAll("[data-goto]").forEach(function (b) { b.onclick = function () { openView(b.getAttribute("data-goto")); }; });
    var rg = main.querySelector("#pl-regen"), re = main.querySelector("#pl-reedit");
    if (rg) rg.onclick = function () { var d = store("cet4_daily", {}); if (d[tk] && d[tk].answers) rebuildPlan(tk, d[tk].answers, this); };
    if (re) re.onclick = function () { var d = store("cet4_daily", {}); if (d[tk]) { delete d[tk].answers; delete d[tk].plan; saveStore("cet4_daily", d); syncNow(); } renderPlan(); };
  }
  function bindExamEntry(tk) {
    var sv = main.querySelector("#mk-save");
    if (!sv) return;
    sv.onclick = function () {
      var l = parseInt(document.getElementById("mk-l").value, 10), r = parseInt(document.getElementById("mk-r").value, 10), w = parseInt(document.getElementById("mk-w").value, 10);
      if (isNaN(l) || isNaN(r)) { toast("请填写听力与阅读正确数"); return; }
      var ww = isNaN(w) ? null : w;
      addExam({ date: document.getElementById("mk-date").value || tk, source: "模考录入", h: Math.min(25, l), ht: 25, r: Math.min(30, r), rt: 30, w: ww, wt: 30, est: examEst(Math.min(25, l), 25, Math.min(30, r), 30, ww, 30), writingEstimated: ww == null });
      toast("已保存（710 折算：" + examEst(Math.min(25, l), 25, Math.min(30, r), 30, ww, 30) + "）");
      renderPlan();
    };
  }

  /* ---------- 仪表盘（练习/考试分开 · 710 分制） ---------- */
  function renderDashboard() {
    var p = store("cet4_progress", { a: 0, c: 0, days: {}, types: {} });
    var acc = p.a ? Math.round(p.c / p.a * 100) : 0;
    var pest = p.a ? Math.min(710, Math.round(p.c / p.a * 497 + 128)) : 0;
    var exams = examList();
    var examAvgV = examAvg();
    var typeNames = { listening: "听力", cloze: "选词填空", match: "信息匹配", reading: "仔细阅读", review: "错题复习", spell: "拼写", obj: "练习", vocab: "词汇" };
    var wrongN = Object.keys(store("cet4_wrong", {})).length;
    var favN = Object.keys(getFav()).length;

    var html = '<div class="page"><div class="section-title">学习仪表盘</div>' +
      '<div class="stat-row">' +
      '<div class="stat"><div class="n">' + p.a + '</div><div class="l">练习·已做</div></div>' +
      '<div class="stat"><div class="n">' + p.c + '</div><div class="l">练习·答对</div></div>' +
      '<div class="stat"><div class="n">' + acc + '%</div><div class="l">练习·正确率</div></div>' +
      '<div class="stat"><div class="n">' + (pest || "—") + '</div><div class="l">练习估分/710</div></div>' +
      '</div>';

    html += '<div class="section-title">考试 / 模考成绩（满分 710）</div>';
    if (!exams.length) {
      html += '<div class="info">还没有考试记录。做完整套真题并点「提交客观题批改」会<b>自动记一次</b>；也可在「学习计划」页录入模考成绩。</div>';
    } else {
      html += '<div class="stat-row">' +
        '<div class="stat"><div class="n">' + exams[exams.length - 1].est + '</div><div class="l">最近一次</div></div>' +
        '<div class="stat"><div class="n">' + examAvgV + '</div><div class="l">平均</div></div>' +
        '<div class="stat"><div class="n">' + Math.max.apply(null, exams.map(function (x) { return x.est; })) + '</div><div class="l">最高</div></div>' +
        '<div class="stat"><div class="n">' + exams.length + '</div><div class="l">次数</div></div></div>';
      html += '<div class="card">' + exams.slice().reverse().slice(0, 12).map(function (x) {
        return '<div class="between" style="margin:6px 0"><span>' + esc(x.date) + " · " + esc(x.source || "") + '</span><span><b style="color:var(--primary)">' + x.est + "</b> /710 <span class=\"muted\">(听" + x.h + "/阅" + x.r + (x.w == null ? "/写译估" : "/写译" + x.w) + ")</span></span></div>";
      }).join("") + "</div>";
    }

    var types = p.types || {};
    var tkeys = Object.keys(types).filter(function (k) { return types[k].a > 0; });
    if (tkeys.length) {
      html += '<div class="card"><div class="section-title" style="margin-top:0">练习·分题型正确率</div>';
      tkeys.forEach(function (k) {
        var a = types[k].a, c = types[k].c, r = Math.round(c / a * 100);
        html += '<div class="between" style="margin:6px 0"><span>' + (typeNames[k] || k) + '</span><span class="muted">' + c + "/" + a + " · " + r + '%</span></div><div class="progress"><i style="width:' + r + '%"></i></div>';
      });
      html += "</div>";
    }
    var es = recStats("essay"), ts = recStats("translation");
    if (es.n || ts.n) {
      html += '<div class="card"><div class="section-title" style="margin-top:0">主观题（作文 / 翻译）</div>';
      if (es.n) html += '<div class="between" style="margin:6px 0"><span>作文</span><span class="muted">' + es.n + " 篇 · 平均 " + es.avg + "/100</span></div>";
      if (ts.n) html += '<div class="between" style="margin:6px 0"><span>翻译</span><span class="muted">' + ts.n + " 篇 · 平均 " + ts.avg + "/15</span></div>";
      html += "</div>";
    }
    var _days = p.days || {}, _dk = Object.keys(_days).sort().slice(-14);
    if (_dk.length) html += '<div class="card"><div class="section-title" style="margin-top:0">练习正确率趋势</div>' + svgLine(_dk.map(function (k) { return { label: k.slice(5), v: _days[k].a ? Math.round(_days[k].c / _days[k].a * 100) : 0 }; }), 100) + "</div>";
    var _exs = examList();
    if (_exs.length) html += '<div class="card"><div class="section-title" style="margin-top:0">模考成绩走势（/710）</div>' + svgLine(_exs.map(function (x) { return { label: x.date.slice(5), v: x.est }; }), 710) + "</div>";
    var _dueN = srsDue().length;
    html += '<div class="fcard" data-go="review" style="margin-bottom:12px"><div class="ic" style="background:#00695C1f;color:#00695C">复</div><div class="txt"><h3>记忆曲线复习</h3><p>' + (_dueN ? ("今日待复习 " + _dueN + " 词") : "今日无到期复习") + '</p></div><div class="arrow">›</div></div>';
    html += '<div class="grid">' +
      '<div class="fcard" data-go="wrong"><div class="ic" style="background:#C628281f;color:#C62828">错</div><div class="txt"><h3>错题本</h3><p>' + wrongN + ' 道错题</p></div><div class="arrow">›</div></div>' +
      '<div class="fcard" data-go="fav"><div class="ic" style="background:#F6B93B1f;color:#C8860A">★</div><div class="txt"><h3>生词本</h3><p>' + favN + ' 个单词</p></div><div class="arrow">›</div></div>' +
      "</div>" +
      '<p class="center muted" style="margin-top:16px">练习分来自日常刷题；考试分为整卷/模考的 710 折算。</p></div>';
    main.innerHTML = html;
    main.querySelectorAll("[data-go]").forEach(function (el) { el.onclick = function () { openView(el.getAttribute("data-go")); }; });
  }

  /* ---------- 作文 / 翻译记录 ---------- */
  function renderRecords() {
    var recs = getRecords();
    var essays = recs.filter(function (r) { return r.kind === "essay"; });
    var trans = recs.filter(function (r) { return r.kind === "translation"; });
    var html = '<div class="page"><div class="section-title">作文 / 翻译记录（' + essays.length + " 篇作文 · " + trans.length + " 篇翻译）</div>" +
      '<div class="info">每次在「作文批改 / 翻译练习」或真题写作/翻译提交后，都会自动保存在这里。</div>' +
      '<button class="btn block" id="rec-compose" style="margin-bottom:12px">把「客观题 + 最近作文/翻译」记为一次考试</button>';
    if (!recs.length) html += '<div class="info">还没有记录。</div>';
    recs.slice().reverse().forEach(function (r) {
      var kn = r.kind === "essay" ? "作文" : (r.kind === "translation" ? "翻译" : "其他");
      var color = r.kind === "essay" ? "#8E24AA" : "#5E35B1";
      var sc = r.score != null ? r.score : parseScore(r.result, r.kind);
      if (r.kind === "essay" && sc != null && sc > 15) sc = Math.round(sc * 0.15 * 10) / 10;
      html += '<div class="card"><div class="between"><b style="color:' + color + '">' + kn + " · " + esc(r.date) + "</b>" +
        "<span>" + (sc != null ? '<b style="color:var(--primary)">' + sc + "/15</b>" : '<span class="muted">未解析到分数</span>') +
        ' <button class="star" data-del="' + r.id + '" style="color:#c62828">×</button></span></div>' +
        '<div class="muted" style="margin-top:6px">' + esc((r.title || "").slice(0, 70)) + "</div>" +
        '<details style="margin-top:8px"><summary class="muted" style="cursor:pointer">查看原文与批改</summary>' +
        '<div class="passage" style="margin-top:8px;white-space:pre-wrap">' + esc(r.input) + "</div>" +
        '<div class="ai-result" style="margin-top:8px">' + mdToHtml(r.result) + "</div></details></div>";
    });
    html += "</div>";
    main.innerHTML = html;
    main.querySelectorAll("[data-del]").forEach(function (b) {
      b.onclick = function () { saveStore("cet4_records", getRecords().filter(function (x) { return String(x.id) !== b.getAttribute("data-del"); })); renderRecords(); };
    });
    document.getElementById("rec-compose").onclick = composeFirstExam;
  }
  function composeFirstExam() {
    var p = store("cet4_progress", { a: 0, c: 0, types: {} }), t = p.types || {};
    var h = (t.listening && t.listening.c) || 0, ht = (t.listening && t.listening.a) || 0;
    var rc = ((t.cloze && t.cloze.c) || 0) + ((t.match && t.match.c) || 0) + ((t.reading && t.reading.c) || 0);
    var rt = ((t.cloze && t.cloze.a) || 0) + ((t.match && t.match.a) || 0) + ((t.reading && t.reading.a) || 0);
    if (!h && !rc) { toast("还没有练习记录，先去做几道题吧"); return; }
    var essays = getRecords("essay"), trans = getRecords("translation");
    var e = essays.length ? essays[essays.length - 1] : null, tr = trans.length ? trans[trans.length - 1] : null;
    var wRaw = 0, hasW = false;
    if (e) { var es = e.score != null ? e.score : parseScore(e.result, "essay"); if (es != null) { if (es > 15) es = es * 0.15; wRaw += es; hasW = true; } }
    if (tr) { var ts = tr.score != null ? tr.score : parseScore(tr.result, "translation"); if (ts != null) { wRaw += ts; hasW = true; } }
    var w = hasW ? Math.round(wRaw * 10) / 10 : null;
    addExam({ date: todayKey(), source: "考试（客观题+作文/翻译）", h: h, ht: ht || 25, r: rc, rt: rt || 30, w: w, wt: 30, est: examEst(h, ht || 25, rc, rt || 30, w, 30), writingEstimated: !hasW });
    toast("已记为一次考试：" + examEst(h, ht || 25, rc, rt || 30, w, 30) + " / 710");
    openView("dash");
  }

  /* ---------- 数据导入 / 导出 ---------- */
  function openDataIO() {
    var mask = document.createElement("div");
    mask.className = "modal-mask";
    mask.innerHTML = '<div class="modal"><h2>数据导入 / 导出</h2>' +
      '<div class="info">「导出全部数据」生成完整 JSON（背单词记录、进度、错题、生词、计划、作文/翻译记录…），请复制收藏好。换设备或数据丢失时，把 JSON 粘回来点「导入并恢复」即可。</div>' +
      '<textarea id="io-text" rows="10" style="font-family:monospace;font-size:12px" placeholder="在此粘贴要导入的 JSON…"></textarea>' +
      '<div class="row" style="margin-top:10px"><button class="btn" id="io-exp" style="flex:1">导出全部数据</button>' +
      '<button class="btn outline" id="io-imp" style="flex:1">导入并恢复</button></div>' +
      '<div id="io-msg"></div>' +
      '<div id="io-bakmsg" class="muted" style="margin-top:8px"></div>' +
      '<button class="btn ghost block" id="io-bakrestore" style="margin-top:6px">从本机自动备份恢复</button>' +
      '<div class="row" style="margin-top:16px"><button class="btn ghost block" id="io-close">关闭</button></div></div>';
    document.body.appendChild(mask);
    var ta = document.getElementById("io-text");
    document.getElementById("io-close").onclick = function () { document.body.removeChild(mask); };
    document.getElementById("io-exp").onclick = function () { ta.value = JSON.stringify({ app: "cet4-coach", version: 1, exportedAt: new Date().toISOString(), backup: snapshotAll() }); ta.select(); };
    document.getElementById("io-imp").onclick = function () {
      try {
        var obj = JSON.parse(ta.value);
        var n = 0;
        if (obj.backup) { n = restoreAll(obj.backup); }
        else {
          if (obj.records) { var l = getRecords(); obj.records.forEach(function (r) { if (!l.some(function (x) { return String(x.id) === String(r.id); })) l.push(r); }); saveStore("cet4_records", l); }
          if (obj.exams) { obj.exams.forEach(function (x) { addExam(x); }); }
        }
        document.getElementById("io-msg").innerHTML = '<div class="info">导入成功（' + (n ? ("完整恢复 " + n + " 项") : "合并记录") + '），刷新后生效。</div>';
      } catch (err) { document.getElementById("io-msg").innerHTML = '<div class="info warn">导入失败：' + esc(err.message) + "</div>"; }
    };
    var bak = store("cet4_backup", null);
    document.getElementById("io-bakmsg").textContent = (bak && bak.data) ? ("本机自动备份：" + new Date(bak.ts).toLocaleString() + "（" + Object.keys(bak.data).length + " 项）") : "尚无本机自动备份";
    document.getElementById("io-bakrestore").onclick = function () {
      var b = store("cet4_backup", null);
      if (!b || !b.data) { toast("没有可用的本机备份"); return; }
      if (!window.confirm("确定用本机自动备份覆盖当前数据吗？")) return;
      var n = restoreAll(b.data);
      document.getElementById("io-msg").innerHTML = '<div class="info">已从本机自动备份恢复 ' + n + ' 项，刷新后生效。</div>';
    };
  }

  /* ---------- 背单词（百词斩式） ---------- */
  function renderVocabBook(body) {
    var cur = store("cet4_book", "cet4");
    var nosimple = store("cet4_nosimple", true);
    var books = [
      { k: "cet4", t: "四级核心词汇", d: "全部 4537 词 · 推荐" },
      { k: "f5", t: "四级 · 近5年真题高频", d: "近5年出现 ≥ 8 次" },
      { k: "f10", t: "四级 · 近10年真题高频", d: "近10年出现 ≥ 15 次" },
      { k: "基础", t: "四级 · 难度基础", d: "" },
      { k: "中级", t: "四级 · 难度中级", d: "" },
      { k: "较难", t: "四级 · 难度较难", d: "" },
      { k: "高阶", t: "四级 · 难度高阶", d: "" },
      { k: "cet6", t: "六级核心", d: "进阶词汇" },
      { k: "ky", t: "考研核心", d: "" },
      { k: "gk", t: "高中词汇", d: "" },
      { k: "zk", t: "初中词汇（简单）", d: "" },
      { k: "toefl", t: "托福核心", d: "" },
      { k: "fav", t: "我的生词本", d: "收藏的单词" }
    ];
    body.innerHTML = (nosimple ? '<div class="info">已去除简单词（中考及以内）· 四级词书剩 ' + bookWords("cet4").length + ' 词。如需包含，去「背单词」顶部取消勾选。</div>' : '<div class="info">当前包含简单词。可在「背单词」顶部勾选「去除简单词」。</div>') +
      books.map(function (b) {
        return '<div class="list-item" data-book="' + b.k + '"><div class="ic" style="background:#3949AB1f;color:#3949AB">' + esc(b.t.charAt(0)) + "</div>" +
          "<div><h3>" + esc(b.t) + (b.k === cur ? " ✓" : "") + "</h3><p>" + bookWords(b.k).length + " 词" + (b.d ? " · " + b.d : "") + "</p></div>" +
          '<div class="arrow" style="margin-left:auto;color:#c3c6d4">›</div></div>';
      }).join("");
    body.querySelectorAll("[data-book]").forEach(function (el) {
      el.onclick = function () { saveStore("cet4_book", el.getAttribute("data-book")); toast("已选择词书，开始背吧"); document.getElementById("tab-study").click(); };
    });
  }
  /* ---------- 单词量测试：英译汉/汉译英/拼写 → 阅读/听力/写作三维估算 ---------- */
  function lev(a, b) {
    a = String(a); b = String(b);
    var m = a.length, n = b.length, i, j, cost, prev = [], cur = [];
    if (!m) return n; if (!n) return m;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      prev = cur.slice();
    }
    return prev[n];
  }
  function dashes(n) { var s = ""; for (var i = 0; i < n; i++) s += "_"; return s; }
  function vtLabel(kind, v) {
    if (kind === "reading") return v >= 8000 ? "优秀（可挑战六级/考研）" : v >= 5500 ? "良好（四级阅读较稳）" : v >= 3500 ? "中等（四级需加强）" : "起步（先扩大基础词量）";
    if (kind === "listening") return v >= 7000 ? "优秀" : v >= 4500 ? "良好" : v >= 2500 ? "中等" : "起步（多做精听）";
    return v >= 6000 ? "优秀" : v >= 3500 ? "良好" : v >= 2000 ? "中等" : "起步（多拼多写）";
  }
  function renderVocabTest() {
    var VT = window.CET4_VTEST || { bands: [], pool: [] };
    var bands = VT.bands || [], pool = VT.pool || [];
    if (!pool.length || !bands.length) { main.innerHTML = '<div class="page"><div class="info">测试数据缺失，请检查 data/vocabtest.js。</div></div>'; return; }
    var TOTAL_WORDS = bands.reduce(function (a, b) { return a + b.size; }, 0);

    function statBox(n, l) { return '<div class="stat"><div class="n">' + n + '</div><div class="l">' + l + "</div></div>"; }
    function pickDistractors(correct, field, band) {
      var out = [], used = {}; used[correct] = 1;
      var same = shuffle(pool.filter(function (x) { return x.b === band && x[field] !== correct; }));
      same.forEach(function (x) { if (out.length < 3 && !used[x[field]]) { used[x[field]] = 1; out.push(x[field]); } });
      if (out.length < 3) {
        shuffle(pool.filter(function (x) { return x[field] !== correct; })).forEach(function (x) {
          if (out.length < 3 && !used[x[field]]) { used[x[field]] = 1; out.push(x[field]); }
        });
      }
      return out;
    }
    function mkChoice(type, x) {
      var field = type === "c2e" ? "w" : "m", correct = x[field];
      var opts = shuffle([correct].concat(pickDistractors(correct, field, x.b)));
      return { type: type, x: x, opts: opts, ansIdx: opts.indexOf(correct) };
    }
    function buildItems(mode) {
      var perBand = mode === "all" ? 4 : 5, chosen = [], b;
      for (b = 0; b < bands.length; b++) {
        shuffle(pool.filter(function (x) { return x.b === b; })).slice(0, perBand).forEach(function (x) { chosen.push(x); });
      }
      var items = [];
      if (mode === "reading" || mode === "all") chosen.forEach(function (x) { items.push(mkChoice("reading", x)); });
      if (mode === "listening" || mode === "all") chosen.forEach(function (x) { items.push(mkChoice("listening", x)); });
      if (mode === "writing" || mode === "all") {
        chosen.forEach(function (x) { items.push(mkChoice("c2e", x)); });
        chosen.forEach(function (x) { items.push({ type: "spell", x: x }); });
      }
      return items;
    }

    function home() {
      var mode = store("cet4_vt_mode", "all"), last = store("cet4_vt_history", []);
      var modes = [["all", "综合（三项）"], ["reading", "阅读 · 英译汉"], ["listening", "听力 · 听音辨义"], ["writing", "写作 · 汉译英+拼写"]];
      var html = '<div class="page"><div class="section-title">单词量测试</div>' +
        '<div class="info">按<b>词频分段抽样</b>，用不同任务分别估算词汇量：<br>' +
        '· <b>阅读词汇</b>＝英译汉（看单词选中文）<br>' +
        '· <b>听力词汇</b>＝听音辨义（听发音选中文）<br>' +
        '· <b>写作词汇</b>＝汉译英＋拼写（据中文写英文）<br>' +
        '各频段掌握率 × 该段词数求和即得估算值。<br>不认识的词请直接点<b>「不认识」</b>：系统会用「不认识」推断你的猜对比例并予以扣除，避免偏高。</div>' +
        '<div class="card"><div class="section-title" style="margin-top:0">抽样频段（共约 ' + TOTAL_WORDS + ' 词）</div>' +
        bands.map(function (b, i) { return '<div class="between" style="margin:4px 0"><span>第 ' + (i + 1) + ' 段</span><span class="muted">' + b.lo + "–" + b.hi + " 词 · 约 " + b.size + " 个</span></div>"; }).join("") +
        "</div>" +
        '<div class="section-title">测评方式</div><div class="row" style="flex-wrap:wrap;gap:8px">' +
        modes.map(function (m) { return '<button class="btn ' + (mode === m[0] ? "" : "ghost") + '" data-mode="' + m[0] + '">' + m[1] + "</button>"; }).join("") + "</div>" +
        '<button class="btn block" id="vt-start" style="margin-top:14px">开始测试</button>';
      if (last.length) {
        var r = last[last.length - 1];
        html += '<div class="section-title" style="margin-top:16px">上次结果（' + esc(r.date) + '）</div><div class="card"><div class="stat-row">' +
          (r.read != null ? statBox(r.read, "阅读词汇") : "") + (r.listen != null ? statBox(r.listen, "听力词汇") : "") + (r.write != null ? statBox(r.write, "写作词汇") : "") +
          "</div></div>";
      }
      html += "</div>";
      main.innerHTML = html;
      main.querySelectorAll("[data-mode]").forEach(function (btn) {
        btn.onclick = function () { saveStore("cet4_vt_mode", btn.getAttribute("data-mode")); home(); };
      });
      document.getElementById("vt-start").onclick = function () { run(store("cet4_vt_mode", "all")); };
    }

    function run(mode) {
      var items = buildItems(mode), answers = {}, i = 0;
      function phaseOf(type) { return type === "reading" ? "阅读 · 英译汉" : type === "listening" ? "听力 · 听音辨义" : type === "c2e" ? "写作 · 汉译英" : "写作 · 拼写"; }
      function optList(it) {
        var h = "";
        it.opts.forEach(function (o, oi) { h += '<div class="opt" data-oi="' + oi + '"><span class="k">' + String.fromCharCode(65 + oi) + ".</span><span>" + esc(o) + "</span></div>"; });
        return h;
      }
      function dkBtn() { return '<button class="btn ghost block" id="vt-dk" style="margin-top:8px">不认识</button>'; }
      function advance() { i++; draw(); }
      function draw() {
        if (i >= items.length) { results(mode, items, answers, false); return; }
        var it = items[i], x = it.x;
        var head = '<div class="between"><span class="muted">' + phaseOf(it.type) + " · " + (i + 1) + " / " + items.length + '</span></div><div class="progress"><i style="width:' + Math.round(i / items.length * 100) + '%"></i></div>';
        var b = "";
        if (it.type === "reading") {
          b = '<div class="card" style="text-align:center"><div class="muted">这个单词的中文意思是？</div>' +
            '<div style="font-size:34px;font-weight:800;color:var(--primary);margin:8px 0">' + esc(x.w) + "</div>" +
            '<div class="muted">' + (x.p ? "/" + esc(x.p) + "/ " : "") + '<button class="star" id="vt-say">🔊</button></div></div>' + optList(it) + dkBtn();
        } else if (it.type === "listening") {
          b = '<div class="card" style="text-align:center"><div class="muted">听发音，选出正确的中文含义</div>' +
            '<div style="margin:12px 0"><button class="btn" id="vt-say">🔊 播放 / 重听</button></div></div>' + optList(it) + dkBtn();
        } else if (it.type === "c2e") {
          b = '<div class="card" style="text-align:center"><div class="muted">下列中文含义对应的单词是？</div>' +
            '<div style="font-size:19px;line-height:1.6;margin:10px 0">' + esc(x.m) + '</div><button class="star" id="vt-say">🔊</button></div>' + optList(it) + dkBtn();
        } else {
          b = '<div class="card" style="text-align:center"><div class="muted">根据中文含义拼写单词</div>' +
            '<div style="font-size:20px;line-height:1.6;margin:10px 0">' + esc(x.m) + "</div>" +
            '<div class="muted">提示 <b>' + esc(x.w.charAt(0)) + " " + dashes(Math.max(0, x.w.length - 1)) + "</b>（" + x.w.length + ' 个字母） <button class="star" id="vt-say">🔊</button></div>' +
            '<input type="text" id="vt-in" placeholder="输入英文单词…" autocomplete="off" autocapitalize="off" spellcheck="false" style="margin-top:12px"></div>' +
            '<button class="btn block" id="vt-next" style="margin-top:10px">下一题</button>' + dkBtn();
        }
        main.innerHTML = '<div class="page"><div id="backslot"></div>' + head + b + '<div class="center" style="margin-top:12px"><button class="btn ghost small" id="vt-quit">结束测试</button></div></div>';
        document.getElementById("backslot").appendChild(backBar("返回", home));
        var say = document.getElementById("vt-say"); if (say) say.onclick = function () { playWord(x.w); };
        if (it.type === "listening") playWord(x.w);
        var dk = document.getElementById("vt-dk");
        if (dk) dk.onclick = function () { answers[i] = it.type === "spell" ? "" : -1; advance(); };
        if (it.type === "spell") {
          var inp = document.getElementById("vt-in"); inp.focus();
          function submit() { answers[i] = inp.value.trim(); advance(); }
          document.getElementById("vt-next").onclick = submit;
          inp.onkeydown = function (e) { if (e.key === "Enter") submit(); };
        } else {
          var opts = main.querySelectorAll(".opt");
          opts.forEach(function (el) {
            el.onclick = function () {
              opts.forEach(function (o) { o.classList.remove("sel"); });
              el.classList.add("sel");
              answers[i] = parseInt(el.getAttribute("data-oi"), 10);
              setTimeout(advance, 170);
            };
          });
        }
        document.getElementById("vt-quit").onclick = function () { results(mode, items, answers, true); };
      }
      draw();
    }

    function results(mode, items, answers, aborted) {
      var stat = {};
      function cell(skill, b) { stat[skill] = stat[skill] || {}; stat[skill][b] = stat[skill][b] || { n: 0, c: 0, w: 0, dk: 0 }; return stat[skill][b]; }
      items.forEach(function (it, idx) {
        var a = answers[idx], s;
        if (it.type === "spell") {
          var v = String(a == null ? "" : a).trim().toLowerCase(), credit = 0;
          if (v) credit = v === it.x.w ? 1 : (lev(v, it.x.w) === 1 ? 0.5 : 0);
          s = cell("writing_spell", it.x.b); s.n++; s.c += credit; if (!v) s.dk++;
        } else {
          var skill = it.type === "reading" ? "reading" : it.type === "listening" ? "listening" : "writing_c2e";
          s = cell(skill, it.x.b); s.n++;
          if (a == null || a === -1) s.dk++;
          else if (a === it.ansIdx) s.c++;
          else s.w++;
        }
      });
      /* 掌握率：识别题用「不认识」剔除瞎猜——先由「选错/不认识」比估计瞎猜比例 q，再扣掉猜对 */
      function knowChoice(s) {
        if (!s || !s.n) return { p: 0, v: 0 };
        var n = s.n, c = s.c / n, w = s.w / n, dk = s.dk / n;
        var q = (w === 0) ? 0 : (dk > 0 ? (w / dk) / (0.75 + w / dk) : 1);
        var p = (c - q / 4) / (1 - q / 4);
        p = Math.max(0, Math.min(1, p));
        return { p: p, v: p * (1 - p) / n };
      }
      function knowSpell(s) {
        if (!s || !s.n) return { p: 0, v: 0 };
        var p = Math.max(0, Math.min(1, s.c / s.n));
        return { p: p, v: p * (1 - p) / s.n };
      }
      function combine(parts) {
        var total = 0, va = 0;
        for (var b = 0; b < bands.length; b++) {
          var p = 0, wsum = 0, vv = 0;
          parts.forEach(function (sp) {
            var s = (stat[sp.skill] || {})[b];
            if (!s || !s.n) return;
            var r = sp.prod ? knowSpell(s) : knowChoice(s);
            p += r.p * sp.weight; wsum += sp.weight; vv += sp.weight * sp.weight * r.v;
          });
          if (wsum > 0) p = p / wsum;
          total += p * bands[b].size; va += vv * bands[b].size * bands[b].size;
        }
        return { n: Math.round(total), m: Math.round(1.96 * Math.sqrt(va)) };
      }
      var read = combine([{ skill: "reading", weight: 1 }]);
      var listen = combine([{ skill: "listening", weight: 1 }]);
      var write = combine([{ skill: "writing_c2e", weight: 0.5 }, { skill: "writing_spell", weight: 0.5, prod: true }]);
      var hasRead = mode === "reading" || mode === "all", hasListen = mode === "listening" || mode === "all", hasWrite = mode === "writing" || mode === "all";
      function masteryPct(skill, b) { var s = (stat[skill] || {})[b]; if (!s || !s.n) return "—"; var r = (skill === "writing_spell") ? knowSpell(s) : knowChoice(s); return Math.round(r.p * 100) + "%"; }
      var dkAgg = { n: 0, dk: 0 };
      ["reading", "listening", "writing_c2e"].forEach(function (k) { for (var b = 0; b < bands.length; b++) { var s = (stat[k] || {})[b]; if (s && s.n) { dkAgg.n += s.n; dkAgg.dk += s.dk; } } });
      if (!aborted) {
        var h = store("cet4_vt_history", []);
        h.push({ date: todayKey(), mode: mode, read: hasRead ? read.n : null, listen: hasListen ? listen.n : null, write: hasWrite ? write.n : null });
        saveStore("cet4_vt_history", h);
      }
      var html = '<div class="page"><div class="section-title">测试结果</div><div class="card"><div class="stat-row">' +
        (hasRead ? statBox(read.n, "阅读词汇") : "") + (hasListen ? statBox(listen.n, "听力词汇") : "") + (hasWrite ? statBox(write.n, "写作词汇") : "") +
        '</div><div class="muted" style="margin-top:8px">误差约 ±' + Math.max(read.m, listen.m, write.m) + " 词（95% 置信）。" +
        (dkAgg.n ? "本次选「不认识」占 " + Math.round(dkAgg.dk / dkAgg.n * 100) + "%。" : "") + (aborted ? "（提前结束，未答项按不认识计）" : "") + "</div></div>";
      if (hasRead) html += '<div class="info">阅读词汇 ≈ <b>' + read.n + "</b>（±" + read.m + "）：" + vtLabel("reading", read.n) + "</div>";
      if (hasListen) html += '<div class="info">听力词汇 ≈ <b>' + listen.n + "</b>（±" + listen.m + "）：" + vtLabel("listening", listen.n) + "（基于浏览器语音合成，设备无英文语音时会偏低）</div>";
      if (hasWrite) html += '<div class="info">写作词汇 ≈ <b>' + write.n + "</b>（±" + write.m + "）：" + vtLabel("writing", write.n) + "</div>";
      html += '<div class="card"><div class="section-title" style="margin-top:0">各频段掌握率</div>' +
        '<div class="between muted" style="font-size:12px"><span>频段</span><span>' + (hasRead ? "阅读　" : "") + (hasListen ? "听力　" : "") + (hasWrite ? "汉译/拼写" : "") + "</span></div>";
      for (var bi2 = 0; bi2 < bands.length; bi2++) {
        var wcell = hasWrite ? (masteryPct("writing_c2e", bi2) + "/" + masteryPct("writing_spell", bi2)) : "";
        html += '<div class="between" style="margin:4px 0"><span>' + bands[bi2].lo + "–" + bands[bi2].hi + '</span><span class="muted">' +
          (hasRead ? masteryPct("reading", bi2) + "　" : "") + (hasListen ? masteryPct("listening", bi2) + "　" : "") + wcell + "</span></div>";
      }
      html += "</div>" +
        '<button class="btn block" id="vt-again" style="margin-top:12px">用同样方式重测</button>' +
        '<button class="btn ghost block" id="vt-home2" style="margin-top:8px">返回</button></div>';
      main.innerHTML = html;
      document.getElementById("vt-again").onclick = function () { run(mode); };
      document.getElementById("vt-home2").onclick = home;
    }

    home();
  }

  /* ---------- 背单词（百词斩式：成组·递推·不即时判） ---------- */
  function speak(t) { try { var u = new SpeechSynthesisUtterance(t); u.lang = "en-US"; u.rate = 0.9; window.speechSynthesis.speak(u); } catch (e) { } }
  function wfo(w) { return (window.CET4_WORDFORM || {})[String(w).toLowerCase()] || {}; }
  function playWord(word) { var w = String(word == null ? "" : word).toLowerCase(); var rel = (window.CET4_WAUDIO || {})[w]; if (rel) { try { var a = new Audio(rel); a.play().catch(function () { speak(word); }); return; } catch (e) { } } speak(word); }
  function normWords(t) { return String(t || "").toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean); }
  function compareWords(correct, user) {
    var cw = normWords(correct), uw = normWords(user), bag = {}, hit = 0;
    uw.forEach(function (w) { bag[w] = (bag[w] || 0) + 1; });
    var disp = cw.map(function (w) {
      if (bag[w] > 0) { bag[w]--; hit++; return '<span style="color:#2e7d32">' + esc(w) + '</span>'; }
      return '<span style="color:#c62828;border-bottom:1px dashed #c62828">' + esc(w) + '</span>';
    }).join(" ");
    var acc = cw.length ? Math.round(hit / cw.length * 100) : 0;
    return '<div style="margin-top:4px;line-height:1.9;font-size:15px">' + disp + '</div><div class="muted">词准率 ' + acc + '%（绿=写对，红=漏写/写错）</div>';
  }
  function distractors(excl, field, n, all) {
    var pool = all.filter(function (w) { return w.w !== excl.w; }), picked = [], used = {}, guard = 0;
    while (picked.length < n && guard++ < 400) { var x = pool[Math.floor(Math.random() * pool.length)]; if (!x) break; var k = field === "m" ? x.m : x.w; if (used[k]) continue; used[k] = 1; picked.push(x[field]); }
    return picked;
  }
  function renderStudy(body, preset) {
    var bk = store("cet4_book", "cet4");
    var all = (preset && preset.length) ? preset : bookWords(bk);
    if (!all || !all.length) { body.innerHTML = '<div class="info">当前词书为空，请到「词书」选择。</div>'; return; }
    var G = 5, K, pool, groups, spell, pass, si, resumed = false;
    var sess = store("cet4_study_session", null);
    if (sess && !preset && sess.book === bk && sess.groups && sess.groups.length && (Date.now() - (sess.ts || 0) < 7 * 864e5)) {
      groups = sess.groups; pass = sess.pass || {}; si = sess.si || 0; spell = !!sess.spell; K = groups.length; resumed = true;
    } else {
      K = Math.min(4, Math.ceil(all.length / G));
      pool = shuffle(all.slice());
      groups = []; for (var i = 0; i < K; i++) groups.push(pool.slice(i * G, (i + 1) * G));
      spell = store("cet4_spellmode", false);
      pass = {}; groups.forEach(function (g) { g.forEach(function (w) { pass[w.w] = { a: false, b: false, s: !spell }; }); });
      si = 0;
    }
    var sched = [];
    for (var i2 = 0; i2 < K; i2++) { sched.push({ g: i2, t: "learn" }); if (i2 > 0) sched.push({ g: i2 - 1, t: "zh2en" }); sched.push({ g: i2, t: "en2zh" }); }
    if (K) sched.push({ g: K - 1, t: "zh2en" });
    if (spell) for (var i3 = 0; i3 < K; i3++) sched.push({ g: i3, t: "spell" });
    function persist() { try { saveStore("cet4_study_session", { book: bk, groups: groups, pass: pass, si: si, spell: spell, ts: Date.now() }); } catch (e) { } }
    function clearSession() { try { localStorage.removeItem("cet4_study_session"); } catch (e) { } }
    body.onclick = function (e) { var t = e.target; if (t && t.id === "st-restart") { clearSession(); renderStudy(body); } };
    var head = '<label class="muted" style="cursor:pointer;display:block;margin-bottom:6px"><input type="checkbox" id="st-spell" ' + (spell ? "checked" : "") + "> 边背边拼写（加一轮拼写考察）</label>" +
      (resumed ? '<div class="info">已恢复上次进度（第 ' + (si + 1) + " / " + sched.length + ' 步）· 刷新或退出也不会丢。<button class="btn ghost small" id="st-restart" style="margin-left:6px">重新开始</button></div>' : "");
    function step() { persist(); if (si >= sched.length) { summary(); return; } var t = sched[si]; if (t.t === "learn") learn(t.g); else if (t.t === "en2zh") quiz(t.g, "en2zh"); else if (t.t === "zh2en") quiz(t.g, "zh2en"); else spellBatch(t.g); }
    function learn(g) {
      var words = groups[g], h = head + '<div class="between"><span class="muted">背新词 · 第' + (g + 1) + ' 组</span></div>' +
        '<div class="info">先记住这 ' + words.length + " 个词（含发音、固定搭配），随后以英译汉/汉译英等形式考察。</div>";
      words.forEach(function (w, i) {
        var ex = exampleOf(w.w); var coll = collocOf(w.w); var inf = wfo(w.w);
        h += '<div class="card"><div class="between"><b style="font-size:20px;color:var(--primary)">' + esc(w.w) + '</b><span class="muted">' + (w.p ? "/" + esc(w.p) + "/" : "") + ' <button class="star" data-say="' + i + '">🔊</button></span></div>' +
          '<div style="margin-top:6px;font-size:16px">' + esc(w.m) + "</div>" +
          (inf.f ? '<div class="muted" style="margin-top:4px">词形：' + esc(inf.f) + "</div>" : "") +
          (inf.d ? '<div class="muted" style="margin-top:2px">英文释义：' + esc(inf.d) + "</div>" : "") +
          (coll.length ? '<div class="muted" style="margin-top:6px">搭配：' + coll.map(esc).join("；") + "</div>" : "") +
          (ex ? '<div class="muted" style="margin-top:4px">例：' + esc(ex) + "</div>" : "") +
          '<button class="btn ghost small" data-dic="' + i + '" style="margin-top:6px">查词典</button><div id="dicbox-' + i + '"></div></div>';
      });
      h += '<button class="btn block" id="learn-next">记住了，开始测验</button>';
      body.innerHTML = h;
      body.querySelectorAll("[data-say]").forEach(function (b) { b.onclick = function () { playWord(words[parseInt(b.getAttribute("data-say"), 10)].w); }; });
      body.querySelectorAll("[data-dic]").forEach(function (b) { b.onclick = function () { var i = parseInt(b.getAttribute("data-dic"), 10); lookupWord(words[i].w, document.getElementById("dicbox-" + i)); }; });
      document.getElementById("learn-next").onclick = function () { recordVocabSeen(words); si++; step(); };
    }
    function quiz(g, kind) {
      var words = groups[g], blk = [];
      words.forEach(function (w) { var corr = kind === "en2zh" ? w.m : w.w; var dist = distractors(w, kind === "en2zh" ? "m" : "w", 3, all); var opts = shuffle([corr].concat(dist)); blk.push({ w: w, corr: corr, opts: opts, sel: -1 }); });
      var h = head + '<div class="between"><span class="muted">' + (kind === "en2zh" ? "英译汉" : "汉译英") + " · 第" + (g + 1) + "组（" + words.length + "题）</span></div>" +
        '<div class="info">先全部作答，再点提交（不即时判对错）。</div>';
      blk.forEach(function (b, qi) {
        h += '<div class="card"><div class="stem">' + (qi + 1) + ". " + (kind === "en2zh" ? esc(b.w.w) : esc(b.w.m)) + "</div>";
        b.opts.forEach(function (o, oi) { h += '<div class="opt" data-q="' + qi + '" data-o="' + oi + '"><span class="k">' + String.fromCharCode(65 + oi) + ".</span><span>" + esc(o) + "</span></div>"; });
        h += "</div>";
      });
      h += '<button class="btn block" id="qz-sub">提交</button>';
      body.innerHTML = h;
      var cards = body.querySelectorAll(".card");
      body.querySelectorAll(".opt").forEach(function (el) {
        el.onclick = function () { if (body.dataset.done) return; var qi = parseInt(el.getAttribute("data-q"), 10); blk[qi].sel = parseInt(el.getAttribute("data-o"), 10); cards[qi].querySelectorAll(".opt").forEach(function (x) { x.classList.remove("sel"); }); el.classList.add("sel"); };
      });
      document.getElementById("qz-sub").onclick = function () {
        if (body.dataset.done) { si++; delete body.dataset.done; step(); return; }
        body.dataset.done = "1";
        blk.forEach(function (b, qi) { var ans = b.opts.indexOf(b.corr); cards[qi].querySelectorAll(".opt").forEach(function (o) { o.classList.add("locked"); var oi = parseInt(o.getAttribute("data-o"), 10); if (oi === ans) o.classList.add("correct"); else if (oi === b.sel) o.classList.add("wrong"); }); var ok = b.sel === ans; if (kind === "en2zh") pass[b.w.w].a = ok; else pass[b.w.w].b = ok; });
        this.textContent = "下一步";
      };
    }
    function spellBatch(g) {
      var words = groups[g], h = head + '<div class="between"><span class="muted">拼写 · 第' + (g + 1) + " 组</span></div>";
      words.forEach(function (w, qi) { h += '<div class="card"><div class="muted">' + esc(w.m) + '</div><input type="text" data-s="' + qi + '" placeholder="拼写单词…" autocomplete="off" autocapitalize="off" spellcheck="false" style="margin-top:8px"></div>'; });
      h += '<button class="btn block" id="sp-sub">提交</button><div class="center" style="margin-top:8px"><button class="btn ghost small" id="sp-play">🔊 播放本组发音</button></div>';
      body.innerHTML = h;
      document.getElementById("sp-play").onclick = function () { speak(words.map(function (w) { return w.w; }).join(". ")); };
      document.getElementById("sp-sub").onclick = function () {
        if (body.dataset.done) { si++; delete body.dataset.done; step(); return; }
        body.dataset.done = "1";
        words.forEach(function (w, qi) { var inp = body.querySelector('[data-s="' + qi + '"]'); var ok = inp.value.trim().toLowerCase() === w.w.toLowerCase(); inp.classList.add(ok ? "correct" : "wrong"); if (!ok) inp.value = inp.value + "  →  " + w.w; pass[w.w].s = ok; });
        this.textContent = "下一步";
      };
    }
    function summary() {
      clearSession();
      var allw = [].concat.apply([], groups);
      var mastered = allw.filter(function (w) { var p = pass[w.w]; return p.a && p.b && p.s; });
      var need = allw.filter(function (w) { var p = pass[w.w]; return !(p.a && p.b && p.s); });
      var log = getVocabLog();
      log.learned = log.learned || {}; log.days = log.days || {};
      allw.forEach(function (w) { var ms = pass[w.w].a && pass[w.w].b && pass[w.w].s; log.learned[w.w] = ms ? "k" : "u"; srsUpdate(w.w, w.m, ms); });
      saveVocabLog(log);
      autoSync();
      body.innerHTML = '<div class="card" style="text-align:center"><h2>本组完成 🎉</h2><p>掌握 ' + mastered.length + " / " + allw.length + "</p>" +
        (need.length ? '<div class="muted" style="margin-top:6px">待巩固：' + need.map(function (w) { return esc(w.w); }).join("、") + "</div>" : '<div class="muted">全部通过，太棒了！</div>') +
        '<div class="row" style="justify-content:center;margin-top:12px">' + (need.length ? '<button class="btn" id="st-review">复习待巩固（' + need.length + '）</button>' : "") + '<button class="btn ghost" id="st-next">再来一组</button></div></div>';
      var rv = document.getElementById("st-review"); if (rv) rv.onclick = function () { renderStudy(body, need); };
      document.getElementById("st-next").onclick = function () { renderStudy(body); };
    }
    step();
  }
  function renderVocabRecords() {
    var log = getVocabLog();
    var days = log.days || {};
    var keys = Object.keys(days).sort();
    var html = '<div class="page"><div class="section-title">背单词记录</div><div class="stat-row">' +
      '<div class="stat"><div class="n">' + (log.total || 0) + '</div><div class="l">累计背词</div></div>' +
      '<div class="stat"><div class="n">' + Object.keys(log.learned || {}).length + '</div><div class="l">涉及词数</div></div>' +
      '<div class="stat"><div class="n">' + keys.length + '</div><div class="l">打卡天数</div></div></div>' +
      '<div class="card"><div class="section-title" style="margin-top:0">每日背词量（近 14 天）</div>';
    if (!keys.length) html += '<div class="muted">还没有记录，去「背单词」开始吧。</div>';
    keys.slice(-14).forEach(function (k) { html += '<div class="between" style="margin:4px 0"><span>' + esc(k) + '</span><b>' + days[k] + " 词</b></div>"; });
    html += "</div></div>";
    main.innerHTML = html;
  }

  /* ---------- 记忆曲线复习 ---------- */
  function renderReview() {
    var due = srsDue();
    var srs = getSrs();
    var all = bookWords("cet4");
    var html = '<div class="page"><div class="section-title">记忆曲线复习</div>';
    if (!due.length) {
      html += '<div class="info">今日没有到期的复习。背单词满一天后会按 1/2/4/7/15/30 天的间隔提醒复习。</div>';
      main.innerHTML = html; return;
    }
    due = shuffle(due).slice(0, 20);
    var blk = due.map(function (w) {
      var m = (srs[w] && srs[w].m) || "";
      var dists = [];
      while (dists.length < 3) { var x = all[Math.floor(Math.random() * all.length)]; if (x && x.m && x.m !== m && dists.indexOf(x.m) < 0) dists.push(x.m); if (all.length < 4) break; }
      return { w: w, m: m, opts: shuffle([m].concat(dists)) };
    });
    html += '<div class="info">今日待复习 ' + due.length + " 个词（英译汉，全过后间隔变长）。</div>";
    blk.forEach(function (b, qi) {
      html += '<div class="card"><div class="stem">' + (qi + 1) + ". " + esc(b.w) + "</div>";
      b.opts.forEach(function (o, oi) { html += '<div class="opt" data-q="' + qi + '" data-o="' + oi + '"><span class="k">' + String.fromCharCode(65 + oi) + ".</span><span>" + esc(o) + "</span></div>"; });
      html += "</div>";
    });
    html += '<button class="btn block" id="rv-sub">提交</button></div>';
    main.innerHTML = html;
    var cards = main.querySelectorAll(".card");
    main.querySelectorAll(".opt").forEach(function (el) { el.onclick = function () { if (main.dataset.done) return; var qi = parseInt(el.getAttribute("data-q"), 10); blk[qi].sel = parseInt(el.getAttribute("data-o"), 10); cards[qi].querySelectorAll(".opt").forEach(function (x) { x.classList.remove("sel"); }); el.classList.add("sel"); }; });
    document.getElementById("rv-sub").onclick = function () {
      if (main.dataset.done) { renderReview(); return; }
      main.dataset.done = "1";
      var ok = 0;
      blk.forEach(function (b, qi) { var ans = b.opts.indexOf(b.m); cards[qi].querySelectorAll(".opt").forEach(function (o) { o.classList.add("locked"); var oi = parseInt(o.getAttribute("data-o"), 10); if (oi === ans) o.classList.add("correct"); else if (oi === b.sel) o.classList.add("wrong"); }); var good = b.sel === ans; if (good) ok++; srsUpdate(b.w, b.m, good); });
      this.textContent = "完成（对 " + ok + "/" + blk.length + "）";
      toast("复习完成，答对 " + ok + "/" + blk.length);
    };
  }

  /* ---------- 监督看板（远程查看她的数据） ---------- */
  function renderMonitor() {
    main.innerHTML = '<div class="page"><div class="section-title">监督看板</div>' +
      '<div class="info">配置好云同步后（见「设置 → 云同步」），这里可查看学习数据。也可在 Supabase 后台直接看表。</div>' +
      '<div class="row" style="margin-bottom:8px"><input type="text" id="mon-filter" placeholder="只看某个同步码（留空=全部）" style="flex:1"><label class="muted" style="display:flex;align-items:center;gap:6px;white-space:nowrap"><input type="checkbox" id="mon-mine"> 隐藏我这台</label></div>' +
      '<button class="btn block" id="mon-load">读取云端数据</button><div id="mon-res" style="margin-top:12px"></div></div>';
    document.getElementById("mon-load").onclick = function () {
      var c = syncCfg();
      if (!c.url) { toast("请先在设置里配置云同步地址"); return; }
      var res = document.getElementById("mon-res"); res.innerHTML = '<div class="muted">读取中…</div>';
      var filter = (document.getElementById("mon-filter").value || "").trim().toLowerCase();
      var hideMine = document.getElementById("mon-mine").checked;
      var myname = c.name;
      pullSync().then(function (rows) {
        rows = (rows || []).filter(function (r) { var d = r.data || {}; return !!d.backup || d.total != null || (d.vocab && d.vocab.total) || (d.exams && d.exams.length); });
        if (filter) rows = rows.filter(function (r) { return String(r.id || "").toLowerCase().indexOf(filter) >= 0 || String((r.data || {}).name || "").toLowerCase().indexOf(filter) >= 0; });
        if (hideMine) rows = rows.filter(function (r) { return r.id !== myname; });
        rows.sort(function (a, b) { return String((b.data || {}).updated || "").localeCompare(String((a.data || {}).updated || "")); });
        if (!rows.length) { res.innerHTML = '<div class="info">没有匹配的云端数据（她还需要在设置里配置同步并点「保存并立即同步」）。</div>'; return; }
        var h = "";
        rows.forEach(function (row) {
          var s = row.data || {};
          h += '<div class="card"><div class="between"><b>' + esc(s.name || row.id || "学生") + '</b><span class="muted">' + esc((s.updated || "").slice(0, 10)) + "</span></div>" +
            '<div class="stat-row" style="margin-top:8px"><div class="stat"><div class="n">' + (s.total || 0) + '</div><div class="l">已做题</div></div>' +
            '<div class="stat"><div class="n">' + (s.acc || 0) + '%</div><div class="l">正确率</div></div>' +
            '<div class="stat"><div class="n">' + (s.vocab ? s.vocab.total : 0) + '</div><div class="l">背词</div></div>' +
            '<div class="stat"><div class="n">' + (s.wrongN || 0) + '</div><div class="l">错题</div></div></div>';
          if (s.exams && s.exams.length) h += '<div class="muted" style="margin-top:6px">模考：' + s.exams.map(function (x) { return x.date.slice(5) + " " + x.est; }).join("、") + ' /710</div>';
          if (s.days && s.days.length) h += '<div class="section-title" style="margin-top:10px">近30天正确率</div>' + svgLine(s.days.map(function (d) { return { label: d.d.slice(5), v: d.a ? Math.round(d.c / d.a * 100) : 0 }; }), 100);
          h += "</div>";
        });
        res.innerHTML = h;
      }).catch(function (e) { res.innerHTML = '<div class="info warn">读取失败：' + esc(e.message) + "</div>"; });
    };
  }

  function aiQDetail(qEl, p, btn) {
    if (!configured()) { toast("请先在设置中配置 DeepSeek API Key"); return; }
    var stem = qEl.getAttribute("data-stem"), type = qEl.getAttribute("data-type"), qno = qEl.getAttribute("data-qno"), ans = qEl.getAttribute("data-ansl"), exp = qEl.getAttribute("data-exp");
    var opts = JSON.parse(qEl.getAttribute("data-opts") || "[]");
    var ctx = "";
    if (type === "reading") ctx = (p.readingPassages || {})[qno] || "";
    else if (type === "cloze") ctx = p.clozePassage || "";
    else if (type === "match") ctx = (p.matchParagraphs || []).map(function (x) { return x.label + ") " + x.text; }).join("\n");
    var prompt = "这是一道四级 " + type + " 第" + qno + "题。\n题干：" + (stem || "（略）") + "\n选项：" + opts.join(" | ") + "\n正确答案：" + ans + "\n已有简析：" + exp + "\n" + (ctx ? ("相关原文：" + ctx.slice(0, 1500) + "\n") : "") +
      "请给出更详细的解析：① 定位依据；② 逐项排除（其它选项为何错）；③ 涉及的词汇/语法/同义替换考点。中文作答、条理清晰。";
    var old = btn.textContent; btn.disabled = true; btn.textContent = "生成中…";
    callAI([{ role: "system", content: "你是四级英语老师，讲解要详细、具体、可学会。" }, { role: "user", content: prompt }])
      .then(function (md) { var d = document.createElement("div"); d.className = "explain"; d.style.marginTop = "6px"; d.innerHTML = mdToHtml(md); qEl.appendChild(d); btn.remove(); })
      .catch(function (e) { btn.disabled = false; btn.textContent = old; toast("失败：" + e.message); });
  }

  /* ---------- 写作素材库 ---------- */
  function renderWritingLib() {
    var tpl = [
      { g: "开头句", items: [
        "With the rapid development of society, ... has become a hotly debated topic. 随着社会发展，……已成为热议话题。",
        "Nowadays, more and more people are paying attention to ... 如今，越来越多人开始关注……",
        "When it comes to ..., opinions vary from person to person. 谈到……，人们看法不一。",
        "It is widely acknowledged that ... 人们普遍认为……"
      ] },
      { g: "过渡衔接", items: [
        "To begin with, ... What's more, ... Last but not least, ... 首先……此外……最后但同样重要的是……",
        "On the one hand, ... On the other hand, ... 一方面……另一方面……",
        "In addition / Moreover / Furthermore, ... 此外……",
        "However, every coin has two sides. 然而，凡事都有两面。"
      ] },
      { g: "举例论证", items: [
        "Take ... as an example. 以……为例。",
        "A case in point is that ... 一个恰当的例子是……",
        "As is shown in the survey, ... 正如调查所示……",
        "This can be illustrated by ... 这可以用……来说明。"
      ] },
      { g: "结尾句", items: [
        "In conclusion / To sum up, ... 总之……",
        "Therefore, it is high time that we took measures to ... 因此，我们该采取措施……",
        "Only in this way can we ... 只有这样我们才能……",
        "As far as I am concerned, ... 就我而言……"
      ] },
      { g: "建议信 / 应用文", items: [
        "I am writing to express my views concerning ... 我写信是为了就……表达看法。",
        "It would be appreciated if you could take my suggestions into consideration. 若您能考虑我的建议，我将不胜感激。",
        "I am looking forward to your early reply. 期待您的早日回复。",
        "Please feel free to contact me if you need further information. 如需更多信息，请随时联系我。"
      ] },
      { g: "高分替换词", items: [
        "important → vital / essential / crucial",
        "many → numerous / a great many / a host of",
        "very → extremely / highly / remarkably",
        "think → hold the view that / maintain / argue that",
        "good → beneficial / rewarding / favorable",
        "bad → harmful / adverse / detrimental",
        "get → obtain / acquire / gain",
        "help → assist / facilitate / contribute to"
      ] }
    ];
    var custom = store("cet4_sentences", []);
    var html = '<div class="page"><div class="section-title">写作素材库</div><div class="info">按结构分类的高分句型/表达，考试直接套用；下方可加自己的好句。</div>';
    tpl.forEach(function (grp) {
      html += '<div class="section-title">' + esc(grp.g) + '</div><div class="card">' + grp.items.map(function (s) { return '<div style="padding:6px 0;border-bottom:1px solid var(--line);line-height:1.6">' + esc(s) + "</div>"; }).join("") + "</div>";
    });
    html += '<div class="section-title">我的好句（' + custom.length + '）</div><div class="card"><textarea id="sent-add" rows="2" placeholder="粘贴/输入一句好句…"></textarea>' +
      '<button class="btn block" id="sent-save" style="margin-top:8px">添加</button>' +
      custom.map(function (s, i) { return '<div class="between" style="padding:6px 0;border-bottom:1px solid var(--line)"><span style="flex:1;line-height:1.5">' + esc(s) + '</span><button class="star" data-del="' + i + '" style="color:#c62828">×</button></div>'; }).join("") + "</div></div>";
    main.innerHTML = html;
    document.getElementById("sent-save").onclick = function () { var v = document.getElementById("sent-add").value.trim(); if (!v) return; var c = store("cet4_sentences", []); c.push(v); saveStore("cet4_sentences", c); renderWritingLib(); };
    main.querySelectorAll("[data-del]").forEach(function (b) { b.onclick = function () { var c = store("cet4_sentences", []); c.splice(parseInt(b.getAttribute("data-del"), 10), 1); saveStore("cet4_sentences", c); renderWritingLib(); }; });
  }

  /* ---------- 错题记忆曲线复习 ---------- */
  function renderWrongQuiz(dueOnly) {
    var w = store("cet4_wrong", {});
    var t = todayKey();
    var items = Object.keys(w).map(function (k) { return w[k]; }).filter(function (x) { return !dueOnly || (x.due || "") <= t; });
    if (!items.length) { toast(dueOnly ? "今日没有到期的错题" : "错题本是空的"); return; }
    items = shuffle(items).slice(0, 20);
    var html = '<div class="page"><div id="backslot"></div><div class="section-title">' + (dueOnly ? "记忆曲线复习" : "错题复习") + "（" + items.length + " 题）</div><div class=\"card section-card\">";
    items.forEach(function (q, i) {
      html += '<div class="zq" data-kind="mcq" data-ans="' + A2I(q.answer) + '" data-key="' + esc(q.key) + '" data-exp="' + esc(q.exp || "") + '" data-kw="' + esc(JSON.stringify(q.kw || [])) + '"><div class="stem">' + (i + 1) + ". " + esc(q.stem || ("第" + q.qno + "题")) + "</div>";
      (q.options || []).forEach(function (o, oi) { html += '<div class="opt" data-oi="' + oi + '"><span class="k">' + String.fromCharCode(65 + oi) + ".</span><span>" + esc(stripA(o)) + "</span></div>"; });
      html += "</div>";
    });
    html += '<button class="btn block submit-btn">提交</button></div></div>';
    main.innerHTML = html;
    document.getElementById("backslot").appendChild(backBar("返回", renderWrongBook));
    var submitted = false;
    main.querySelectorAll(".opt").forEach(function (el) {
      el.onclick = function () { if (submitted) return; var q = el.closest(".zq"); q.querySelectorAll(".opt").forEach(function (x) { x.classList.remove("sel"); }); el.classList.add("sel"); };
    });
    main.querySelector(".submit-btn").onclick = function () {
      if (submitted) return;
      submitted = true;
      var c = 0, t2 = 0;
      main.querySelectorAll(".zq").forEach(function (q) {
        t2++;
        var ans = parseInt(q.getAttribute("data-ans"), 10), sel = q.querySelector(".opt.sel"), ok = false;
        q.querySelectorAll(".opt").forEach(function (o) { o.classList.add("locked"); var oi = parseInt(o.getAttribute("data-oi"), 10); if (oi === ans) o.classList.add("correct"); else if (sel && o === sel) o.classList.add("wrong"); });
        ok = sel && parseInt(sel.getAttribute("data-oi"), 10) === ans;
        if (ok) c++;
        recordAnswer("review", ok);
        var key = q.getAttribute("data-key"), ww = store("cet4_wrong", {}), rec = ww[key];
        if (rec) { if (ok) { rec.box = (rec.box || 0) + 1; if (rec.box >= 3) { delete ww[key]; } else { rec.due = dstr(SRS_INT[Math.min(rec.box, 6)]); ww[key] = rec; } } else { rec.box = 0; rec.due = dstr(0); ww[key] = rec; } saveStore("cet4_wrong", ww); }
        var exp = q.getAttribute("data-exp");
        if (exp) { var kw = []; try { kw = JSON.parse(q.getAttribute("data-kw") || "[]"); } catch (e) { } var d = document.createElement("div"); d.className = "explain"; d.innerHTML = "<b>解析：</b>" + hiExp(exp, kw); q.appendChild(d); }
      });
      toast("答对 " + c + " / " + t2 + "（连对 3 次出库）");
      this.textContent = "完成";
      this.disabled = true;
    };
  }

  /* ---------- 错词本 / 搭配本 ---------- */
  var WRITING_COLLOC = [
    ["play an important role in", "在…中起重要作用"],
    ["attach importance to", "重视"],
    ["make a contribution to", "对…做贡献"],
    ["take measures to", "采取措施"],
    ["be essential to", "对…至关重要"],
    ["have a positive effect on", "对…有积极影响"],
    ["be beneficial to", "对…有益"],
    ["be aware of", "意识到"],
    ["take ... into account", "把…考虑在内"],
    ["pay attention to", "注意"],
    ["in terms of", "就…而言"],
    ["as a result of", "由于"],
    ["be responsible for", "对…负责"],
    ["keep pace with", "跟上"],
    ["broaden one's horizons", "开阔视野"],
    ["enrich one's knowledge", "丰富知识"],
    ["raise one's awareness of", "提高…意识"],
    ["lay a solid foundation for", "为…打下坚实基础"],
    ["make full use of", "充分利用"],
    ["adapt to", "适应"],
    ["be committed to", "致力于"],
    ["give priority to", "优先考虑"],
    ["in response to", "作为对…的回应"],
    ["contribute to", "有助于；促成"],
    ["result in", "导致"],
    ["lead to", "导致"],
    ["account for", "解释；占（比例）"],
    ["cope with", "应对"],
    ["be faced with", "面临"],
    ["devote oneself to", "致力于"],
    ["make great progress in", "在…取得巨大进步"],
    ["have access to", "有机会/能使用"],
    ["keep a balance between", "在…之间保持平衡"],
    ["take advantage of", "利用"],
    ["in the long run", "从长远看"],
    ["from my perspective", "在我看来"],
    ["it is universally acknowledged that", "众所周知"],
    ["there is no doubt that", "毫无疑问"],
    ["with the development of", "随着…的发展"],
    ["a growing number of", "越来越多的"],
    ["make efforts to", "努力去做"],
    ["be closely related to", "与…密切相关"],
    ["put emphasis on", "强调"]
  ];
  function getErrBook() { return store("cet4_errbook", []); }
  function saveErrBook(a) { saveStore("cet4_errbook", a); }
  function addErrItems(items) {
    var a = getErrBook(); var seen = {}; a.forEach(function (x) { seen[(x.wrong + "|" + x.correct).toLowerCase()] = 1; });
    var n = 0;
    (items || []).forEach(function (it) {
      if (!it || !it.wrong || !it.correct) return;
      var k = (it.wrong + "|" + it.correct).toLowerCase();
      if (seen[k]) return; seen[k] = 1;
      a.push({ id: String(Date.now()) + Math.floor(Math.random() * 1000), wrong: String(it.wrong).trim(), correct: String(it.correct).trim(), type: it.type || "词汇", note: it.note || "", date: todayKey(), box: 0, due: dstr(0) });
      n++;
    });
    saveErrBook(a); return n;
  }
  function extractErrors(md, btn) {
    if (!configured()) { toast("请先在设置中配置 DeepSeek API Key"); return; }
    var old = btn.textContent; btn.disabled = true; btn.textContent = "提取中…";
    var prompt = "你是英语批改助手。请从下面的作文/翻译批改反馈中，抽取学生所有的错误单词与错误搭配/表达。\n" +
      '只输出 JSON 对象：{"items":[{"wrong":"学生写错的词或短语","correct":"正确写法","type":"拼写|搭配|语法|时态|介词|词汇","note":"一句话说明"}]}\n' +
      "只提取确实存在的错误；correct 为正确表达。\n\n【批改内容】\n" + (md || "").slice(0, 4000);
    callAI([{ role: "system", content: "只输出 JSON。" }, { role: "user", content: prompt }])
      .then(function (txt) { var m = txt.match(/\{[\s\S]*\}/); var obj = m ? JSON.parse(m[0]) : { items: [] }; var n = addErrItems(obj.items || []); toast("已提取 " + n + " 条到错词本"); btn.textContent = "已提取 " + n + " 条"; })
      .catch(function (e) { toast("提取失败：" + e.message); btn.disabled = false; btn.textContent = old; });
  }
  function reviewErrItems(items, title) {
    if (!items.length) { toast("没有需要复习的"); return; }
    items = shuffle(items.slice()).slice(0, 30);
    var i = 0;
    (function draw() {
      if (i >= items.length) { main.innerHTML = '<div class="page"><div class="card" style="text-align:center"><h2>完成 🎉</h2><button class="btn" id="eb-back">返回错词本</button></div></div>'; document.getElementById("eb-back").onclick = renderErrBook; return; }
      var x = items[i];
      main.innerHTML = '<div class="page"><div class="between"><span class="muted">' + esc(title) + " · " + (i + 1) + "/" + items.length + '</span></div>' +
        '<div class="card" style="text-align:center"><div class="muted">错误的写法</div><div style="font-size:22px;color:#c62828;margin:8px 0">' + esc(x.wrong) + '</div>' +
        '<div id="eb-bk" style="display:none;margin-top:12px"><div class="muted">正确</div><div style="font-size:20px;color:#2e7d32;margin:6px 0">' + esc(x.correct) + "</div>" + (x.note ? '<div class="muted">' + esc(x.note) + "</div>" : "") + "</div></div>" +
        '<div id="eb-ctl"><button class="btn block" id="eb-show">显示正确</button></div></div>';
      document.getElementById("eb-show").onclick = function () { document.getElementById("eb-bk").style.display = "block"; document.getElementById("eb-ctl").innerHTML = '<div class="row"><button class="btn ghost" id="eb-no" style="flex:1">还没记住</button><button class="btn" id="eb-yes" style="flex:1">记住了</button></div>'; document.getElementById("eb-no").onclick = function () { upd(false); }; document.getElementById("eb-yes").onclick = function () { upd(true); }; };
      function upd(ok) { var a = getErrBook(); var it = a.filter(function (y) { return String(y.id) === String(x.id); })[0]; if (it) { it.box = ok ? Math.min(6, (it.box || 0) + 1) : 0; it.due = dstr(SRS_INT[it.box]); saveErrBook(a); } i++; draw(); }
    })();
  }
  function renderErrBook() {
    var a = getErrBook(); var t = todayKey();
    var due = a.filter(function (x) { return (x.due || "") <= t; }).length;
    var html = '<div class="page"><div class="section-title">错词本（' + a.length + '）</div>' +
      '<div class="info">从你的作文/翻译批改里提取的错词与错搭配，按记忆曲线复习，改到不再犯。在批改结果处点「一键加入错词本」即可加入。</div>' +
      '<div class="row" style="margin-bottom:12px"><button class="btn" id="eb-due">记忆曲线复习（到期 ' + due + '）</button><button class="btn ghost" id="eb-all">全部复习</button></div>' +
      '<div class="card"><div class="row"><input type="text" id="eb-w" placeholder="错的（词/短语）" style="flex:1"><input type="text" id="eb-c" placeholder="正确的" style="flex:1"><select id="eb-t" style="flex:0 0 96px"><option>拼写</option><option>搭配</option><option>语法</option><option>时态</option><option>介词</option><option>词汇</option></select></div><button class="btn block" id="eb-add" style="margin-top:8px">手动添加</button></div>';
    if (!a.length) html += '<div class="info">还没有条目。</div>';
    a.slice().reverse().forEach(function (x) { html += '<div class="card"><div class="between"><span><b style="color:#c62828">' + esc(x.wrong) + '</b> → <b style="color:#2e7d32">' + esc(x.correct) + '</b></span><span class="muted">' + esc(x.type) + ' <button class="star" data-del="' + esc(x.id) + '" style="color:#c62828">×</button></span></div>' + (x.note ? '<div class="muted" style="margin-top:4px">' + esc(x.note) + "</div>" : "") + "</div>"; });
    html += "</div>";
    main.innerHTML = html;
    document.getElementById("eb-due").onclick = function () { go(function () { reviewErrItems(a.filter(function (x) { return (x.due || "") <= t; }), "到期错词"); }); };
    document.getElementById("eb-all").onclick = function () { go(function () { reviewErrItems(a, "错词复习"); }); };
    document.getElementById("eb-add").onclick = function () { var w = document.getElementById("eb-w").value.trim(), c = document.getElementById("eb-c").value.trim(); if (!w || !c) { toast("请填写错的和对的"); return; } addErrItems([{ wrong: w, correct: c, type: document.getElementById("eb-t").value }]); renderErrBook(); };
    main.querySelectorAll("[data-del]").forEach(function (b) { b.onclick = function () { saveErrBook(getErrBook().filter(function (x) { return String(x.id) !== b.getAttribute("data-del"); })); renderErrBook(); }; });
  }
  function collocList() {
    var custom = store("cet4_colloc_custom", []);
    var builtin = WRITING_COLLOC.map(function (x) { return { en: x[0], zh: x[1], src: "内置" }; });
    var her = getErrBook().filter(function (x) { return x.type === "搭配"; }).map(function (x) { return { en: x.correct, zh: x.note || "", src: "我的", wrong: x.wrong }; });
    return custom.map(function (x) { return { en: x.en, zh: x.zh, src: "我的" }; }).concat(builtin).concat(her);
  }
  function renderCollocBook() {
    var list = collocList();
    var srs = store("cet4_colloc_srs", {}); var t = todayKey();
    var due = list.filter(function (x) { return (srs[x.en] && srs[x.en].d || "") <= t; }).length;
    var html = '<div class="page"><div class="section-title">搭配本（' + list.length + '）</div>' +
      '<div class="info">写作高频搭配（内置）+ 你的错搭配 + 自加，按记忆曲线复习。</div>' +
      '<div class="row" style="margin-bottom:12px"><button class="btn" id="cb-due">记忆曲线复习（到期 ' + due + '）</button><button class="btn ghost" id="cb-all">全部复习</button></div>' +
      '<div class="card"><div class="row"><input type="text" id="cb-en" placeholder="英文搭配" style="flex:2"><input type="text" id="cb-zh" placeholder="中文意思" style="flex:1"></div><button class="btn block" id="cb-add" style="margin-top:8px">添加</button></div>';
    list.forEach(function (x) {
      html += '<div class="card"><div class="between"><b style="color:var(--primary)">' + esc(x.en) + '</b><span class="muted">' + esc(x.src) + (x.src === "内置" ? "" : (x.wrong ? " · 原错：" + esc(x.wrong) : "")) + "</span></div>" + (x.zh ? '<div class="muted" style="margin-top:4px">' + esc(x.zh) + "</div>" : "") + "</div>";
    });
    html += "</div>";
    main.innerHTML = html;
    document.getElementById("cb-due").onclick = function () { go(function () { reviewColloc(list.filter(function (x) { return (srs[x.en] && srs[x.en].d || "") <= t; }), "到期搭配"); }); };
    document.getElementById("cb-all").onclick = function () { go(function () { reviewColloc(list, "搭配复习"); }); };
    document.getElementById("cb-add").onclick = function () { var en = document.getElementById("cb-en").value.trim(), zh = document.getElementById("cb-zh").value.trim(); if (!en) { toast("请填英文搭配"); return; } var c = store("cet4_colloc_custom", []); c.push({ en: en, zh: zh }); saveStore("cet4_colloc_custom", c); renderCollocBook(); };
  }
  function reviewColloc(list, title) {
    if (!list.length) { toast("没有需要复习的"); return; }
    list = shuffle(list.slice()).slice(0, 30);
    var i = 0;
    (function draw() {
      if (i >= list.length) { main.innerHTML = '<div class="page"><div class="card" style="text-align:center"><h2>完成 🎉</h2><button class="btn" id="cb-back">返回搭配本</button></div></div>'; document.getElementById("cb-back").onclick = renderCollocBook; return; }
      var x = list[i];
      main.innerHTML = '<div class="page"><div class="between"><span class="muted">' + esc(title) + " · " + (i + 1) + "/" + list.length + '</span></div>' +
        '<div class="card" style="text-align:center"><div class="muted">中文意思</div><div style="font-size:20px;margin:8px 0">' + esc(x.zh || "（练习记忆）") + '</div>' +
        '<div id="cb-bk" style="display:none;margin-top:12px;font-size:20px;color:var(--primary)">' + esc(x.en) + "</div></div>" +
        '<div id="cb-ctl"><button class="btn block" id="cb-show">显示英文</button></div></div>';
      document.getElementById("cb-show").onclick = function () { document.getElementById("cb-bk").style.display = "block"; document.getElementById("cb-ctl").innerHTML = '<div class="row"><button class="btn ghost" id="cb-no" style="flex:1">还没记住</button><button class="btn" id="cb-yes" style="flex:1">记住了</button></div>'; document.getElementById("cb-no").onclick = function () { upd(false); }; document.getElementById("cb-yes").onclick = function () { upd(true); }; };
      function upd(ok) { var s = store("cet4_colloc_srs", {}); var r = s[x.en] || { b: 0 }; r.b = ok ? Math.min(6, (r.b || 0) + 1) : 0; r.d = dstr(SRS_INT[r.b]); s[x.en] = r; saveStore("cet4_colloc_srs", s); i++; draw(); }
    })();
  }

  /* ---------- 图片批改 / 词典查词 ---------- */
  function pickImage(cb) {
    var inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
    inp.onchange = function () { var f = inp.files && inp.files[0]; if (!f) return; var fr = new FileReader(); fr.onload = function () { cb(fr.result); }; fr.readAsDataURL(f); };
    inp.click();
  }
  function imageGrade(kind, instruction, res) {
    if (!configured()) { toast("请先在设置中配置 DeepSeek API Key"); return; }
    pickImage(function (dataUrl) {
      res.innerHTML = '<div class="muted" style="margin-top:12px">识别批改中…（较慢，请稍候）</div>';
      gradeImages([dataUrl], instruction, kind)
        .then(function (md) {
          res.innerHTML = '<div class="ai-result" style="margin-top:16px">' + mdToHtml(md) + '</div>' +
            '<div class="row" style="margin-top:10px"><button class="btn" id="aiCompose" style="flex:1">记为一次考试</button><button class="btn outline" id="aiExtract" style="flex:1">一键加入错词本</button></div>';
          saveRecord(kind, instruction || "（图片批改）", "（图片识别）", md); toast("已保存到记录");
          var cb = document.getElementById("aiCompose"); if (cb) cb.onclick = composeFirstExam;
          var eb = document.getElementById("aiExtract"); if (eb) eb.onclick = function () { extractErrors(md, eb); };
        })
        .catch(function (e) { res.innerHTML = '<div class="info warn" style="margin-top:16px">失败：' + esc(e.message) + "</div>"; });
    });
  }
  function collocOf(word) { return ((window.CET4_COLLOC || {})[String(word).toLowerCase()]) || []; }
  function lookupWord(word, container) {
    var w = String(word).toLowerCase();
    function render(d) {
      var id = w.replace(/[^a-z]/g, "");
      var inf = wfo(w);
      container.innerHTML = '<div class="info" style="margin-top:8px"><b>' + esc(word) + "</b> " + (d.ph ? esc(d.ph) : "") +
        ' <button class="btn ghost small" id="dic-play-' + id + '">🔊</button>' +
        '<div style="margin-top:6px">' + esc(d.def || "") + "</div>" +
        (inf.f ? '<div class="muted" style="margin-top:4px">词形：' + esc(inf.f) + "</div>" : "") +
        (inf.d ? '<div class="muted" style="margin-top:2px">英文释义：' + esc(inf.d) + "</div>" : "") +
        (d.ex ? '<div class="muted" style="margin-top:4px">例：' + esc(d.ex) + "</div>" : "") + "</div>";
      var pb = document.getElementById("dic-play-" + id);
      if (pb) pb.onclick = function () { if (d.audio) { try { new Audio(d.audio).play(); return; } catch (e) { } } playWord(word); };
    }
    var cache = store("cet4_dict", {});
    if (cache[w]) { render(cache[w]); return; }
    var off = (window.CET4_DICT || {})[w];
    if (off && (off[0] || off[1])) { render({ ph: off[0], def: off[1], ex: "", audio: "" }); return; }
    container.innerHTML = '<div class="muted" style="margin-top:8px">查询中…</div>';
    fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(w))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (arr) {
        if (!arr || !arr[0]) throw new Error("未找到");
        var e = arr[0], ph = e.phonetic || "", def = "", ex = "", audio = "";
        (e.phonetics || []).forEach(function (p) { if (!ph && p.text) ph = p.text; if (!audio && p.audio) audio = p.audio; });
        (e.meanings || []).forEach(function (m) { (m.definitions || []).forEach(function (dd) { if (!def) def = m.partOfSpeech + ". " + dd.definition; if (!ex && dd.example) ex = dd.example; }); });
        var d = { ph: ph, def: def, ex: ex, audio: audio };
        var c = store("cet4_dict", {}); c[w] = d; saveStore("cet4_dict", c); render(d);
      })
      .catch(function () { container.innerHTML = '<div class="muted" style="margin-top:8px">联网词典暂不可用（可先看搭配）。</div>'; });
  }

  /* ---------- 翻译·深度分析（逐句对照 + 高亮 + 精解） ---------- */
  function deepTranslateAnalysis(source, reference, user) {
    var prompt = "你是四级翻译阅卷老师。下面是中文原文、参考答案、学生译文。请把中文原文按句子拆分，逐句对照分析。\n" +
      '只输出 JSON 对象：{"sentences":[{"zh":"中文原句","user":"学生对应的英文(可为空)","reference":"参考译文对应句","improved":"基于学生句子改进后的英文","issues":[{"type":"拼写|漏译|用词|语法|搭配|时态|介词","wrong":"出错或缺失的片段","correct":"正确或补充内容","note":"一句话说明"}]}]}\n' +
      "要求：user 填学生实际写的英文；issues 里拼写/用词/语法/搭配/时态/介词类把 wrong 填学生写错的片段；漏译类把 wrong 填漏掉的中文意项、correct 填空。务必逐句一一对应。\n\n" +
      "【中文原文】\n" + source + "\n【参考答案】\n" + reference + "\n【学生译文】\n" + user;
    return callAI([{ role: "system", content: "只输出 JSON。" }, { role: "user", content: prompt }]).then(function (txt) { var m = txt.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : { sentences: [] }; });
  }
  function renderDeepTranslate(obj) {
    var ss = (obj && obj.sentences) || [];
    if (!ss.length) return '<div class="info">没有解析出句子。</div>';
    var h = '<div class="info">逐句对照：<span class="hl-red" style="background:#ffcdd2;color:#b71c1c;padding:0 4px;border-radius:3px">红色</span> 为错误/缺失项；点每句「精解」看语法·用词·搭配详解。</div>';
    ss.forEach(function (s, i) {
      var usr = esc(s.user || "（未翻译）");
      (s.issues || []).forEach(function (it) {
        if (it.wrong && it.type !== "漏译") { var ew = esc(it.wrong); usr = usr.split(ew).join('<mark class="hl-red">' + ew + "</mark>"); }
      });
      var issues = (s.issues || []).map(function (it) {
        var body = it.type === "漏译" ? ("漏译「" + esc(it.wrong) + "」→ " + esc(it.correct)) : (esc(it.wrong) + ' → <span style="color:#2e7d32">' + esc(it.correct) + "</span>");
        return '<div class="muted" style="margin:2px 0">• <b>' + esc(it.type) + "</b>：" + body + (it.note ? "（" + esc(it.note) + "）" : "") + "</div>";
      }).join("");
      h += '<div class="card"><div class="stem">第 ' + (i + 1) + " 句</div>" +
        '<div class="sent-zh">' + esc(s.zh) + "</div>" +
        '<div style="margin-top:6px"><b>你的译文：</b>' + usr + "</div>" +
        (issues ? '<div style="margin-top:6px">' + issues + "</div>" : "") +
        (s.improved ? '<div style="margin-top:6px"><b>改进版：</b>' + esc(s.improved) + "</div>" : "") +
        (s.reference ? '<div class="muted" style="margin-top:4px"><b>参考：</b>' + esc(s.reference) + "</div>" : "") +
        '<button class="btn ghost small sens-explain" data-i="' + i + '" style="margin-top:8px">精解</button><div data-box="' + i + '"></div></div>';
    });
    return h;
  }
  function bindSentences(box, ss) {
    box.querySelectorAll(".sens-explain").forEach(function (b) {
      b.onclick = function () {
        var i = parseInt(b.getAttribute("data-i"), 10), s = ss[i], cont = box.querySelector('[data-box="' + i + '"]');
        cont.innerHTML = '<div class="muted">精解中…</div>';
        explainSentence(s).then(function (md) { cont.innerHTML = '<div class="ai-result" style="margin-top:8px">' + mdToHtml(md) + "</div>"; b.remove(); })
          .catch(function (e) { cont.innerHTML = '<div class="info warn">失败：' + esc(e.message) + "</div>"; });
      };
    });
  }
  function explainSentence(s) {
    var p = "请详细讲解下面这一句英语翻译（四级水平）：\n中文原句：" + (s.zh || "") + "\n学生的英文：" + (s.user || "（空）") + "\n参考译文：" + (s.reference || "") + "\n改进版：" + (s.improved || "") +
      "\n请从【语法结构】【用词选择】【固定搭配】【翻译技巧】四个角度逐点讲解，指出学生错误并给出更好的表达。中文作答、条理清晰。";
    return callAI([{ role: "system", content: "你是四级英语老师，讲解细致、具体、可学会。" }, { role: "user", content: p }]);
  }
  function attachDeepTranslate(resEl, source, reference, userText) {
    if (!source || !userText) return;
    var wrap = document.createElement("div"); wrap.style.marginTop = "10px";
    var btn = document.createElement("button"); btn.className = "btn block"; btn.textContent = "🔍 深度分析（逐句对照高亮）";
    wrap.appendChild(btn); resEl.appendChild(wrap);
    var box = document.createElement("div"); resEl.appendChild(box);
    btn.onclick = function () {
      if (!configured()) { toast("请先在设置中配置 DeepSeek API Key"); return; }
      box.innerHTML = '<div class="muted" style="margin-top:8px">逐句分析中…（较慢）</div>';
      btn.disabled = true; btn.textContent = "分析中…";
      deepTranslateAnalysis(source, reference, userText).then(function (obj) {
        box.innerHTML = renderDeepTranslate(obj);
        bindSentences(box, (obj && obj.sentences) || []);
        btn.disabled = false; btn.textContent = "🔍 重新深度分析";
      }).catch(function (e) { box.innerHTML = '<div class="info warn" style="margin-top:8px">失败：' + esc(e.message) + "</div>"; btn.disabled = false; btn.textContent = "🔍 深度分析（逐句对照高亮）"; });
    };
  }

  /* ---------- settings ---------- */
  function openSettings() {
    var s = getSettings();
    var mask = document.createElement("div");
    mask.className = "modal-mask";
    mask.innerHTML = '<div class="modal"><h2>设置</h2>' +
      '<div class="info">作文/翻译批改需要联网调用大模型。到 <b>platform.deepseek.com</b> 注册并生成 API Key，填入下方。其它功能可离线使用。</div>' +
      '<label class="fld"><span>API Key</span><input type="password" id="set-key" placeholder="sk-..." value="' + esc(s.apiKey) + '"></label>' +
      '<label class="fld"><span>接口地址 Base URL</span><input type="text" id="set-base" value="' + esc(s.baseUrl) + '"></label>' +
      '<label class="fld"><span>模型名</span><input type="text" id="set-model" value="' + esc(s.model) + '"></label>' +
      '<div class="row"><button class="btn" id="set-save" style="flex:1">保存</button>' +
      '<button class="btn outline" id="set-test" style="flex:1">测试连接</button></div>' +
      '<div id="set-msg"></div>' +
      '<button class="btn outline block" id="set-data" style="margin-top:12px">数据导入 / 导出</button>' +
      '<button class="btn outline block" id="set-guide" style="margin-top:8px">📖 使用指南</button>' +
      '<div class="section-title" style="margin-top:14px">云同步（可选 · 用于远程监督）</div>' +
      '<div class="info">配置后本机<b>全部学习数据</b>（背单词记录、做题进度、错题、生词、计划、作文/翻译记录等）会完整备份到你的 Supabase。地址＝Project URL，Key＝anon key，同步码＝她的名字。<b>不同设备必须用不同的同步码</b>（她一个、你一个），否则会互相覆盖。学习完会自动备份；换设备或误清数据时，点下方「从云端恢复」即可找回。</div>' +
      '<label class="fld"><span>同步地址（Supabase Project URL）</span><input type="text" id="set-syncurl" value="' + esc(store("cet4_syncurl", "")) + '"></label>' +
      '<label class="fld"><span>Key（anon）</span><input type="text" id="set-synckey" value="' + esc(store("cet4_synckey", "")) + '"></label>' +
      '<label class="fld"><span>同步码 / 姓名</span><input type="text" id="set-syncname" value="' + esc(store("cet4_syncname", "学生")) + '"></label>' +
      '<div class="row"><button class="btn" id="set-syncsave" style="flex:1">保存并立即同步</button><button class="btn outline" id="set-dash2" style="flex:1">监督看板</button></div>' +
      '<button class="btn outline block" id="set-restore" style="margin-top:8px">从云端恢复数据（覆盖本机）</button>' +
      '<div class="row" style="margin-top:16px"><button class="btn ghost block" id="set-close">关闭</button></div></div>';
    document.body.appendChild(mask);
    function close() { document.body.removeChild(mask); }
    mask.onclick = function (e) { if (e.target === mask) close(); };
    document.getElementById("set-close").onclick = close;
    document.getElementById("set-save").onclick = function () {
      setSettings({ apiKey: document.getElementById("set-key").value.trim(), baseUrl: document.getElementById("set-base").value.trim() || DEFAULTS.baseUrl, model: document.getElementById("set-model").value.trim() || DEFAULTS.model });
      toast("已保存"); close(); openView(currentView);
    };
    document.getElementById("set-msg").innerHTML = "";
    document.getElementById("set-data").onclick = openDataIO;
    var _sg = document.getElementById("set-guide"); if (_sg) _sg.onclick = function () { close(); openView("guide"); };
    document.getElementById("set-restore").onclick = function () {
      if (!window.confirm("确定用云端备份覆盖本机数据吗？本机现有的学习数据会被云端版本替换。")) return;
      var msg = document.getElementById("set-msg"); msg.innerHTML = '<div class="info">恢复中…</div>';
      restoreSync().then(function (n) { msg.innerHTML = '<div class="info">已恢复 ' + n + ' 项数据，正在刷新…</div>'; setTimeout(function () { location.reload(); }, 900); })
        .catch(function (e) { msg.innerHTML = '<div class="info warn">恢复失败：' + esc(e.message) + "</div>"; });
    };
    document.getElementById("set-syncsave").onclick = function () {
      saveStore("cet4_syncurl", document.getElementById("set-syncurl").value.trim());
      saveStore("cet4_synckey", document.getElementById("set-synckey").value.trim());
      saveStore("cet4_syncname", document.getElementById("set-syncname").value.trim() || "学生");
      var msg = document.getElementById("set-msg");
      msg.innerHTML = '<div class="info">同步中…</div>';
      pushSync().then(function () { msg.innerHTML = '<div class="info">✅ 已同步到云端。</div>'; }).catch(function (e) { msg.innerHTML = '<div class="info warn">同步失败（多为网络问题，会自动重试；本地数据已保存）。<br><span class="muted">' + esc(e.message) + "</span></div>"; toast("同步失败，稍后自动重试"); });
    };
    document.getElementById("set-dash2").onclick = function () { close(); openView("monitor"); };
    document.getElementById("set-test").onclick = function () {
      var key = document.getElementById("set-key").value.trim();
      if (!key) { toast("请先填写 API Key"); return; }
      setSettings({ apiKey: key, baseUrl: document.getElementById("set-base").value.trim() || DEFAULTS.baseUrl, model: document.getElementById("set-model").value.trim() || DEFAULTS.model });
      var msg = document.getElementById("set-msg"), btn = this;
      btn.disabled = true; msg.innerHTML = '<div class="info">测试中…</div>';
      callAI([{ role: "user", content: "请只回复四个字：连接成功" }])
        .then(function (r) { msg.innerHTML = '<div class="info">连接成功，模型回复：' + esc(r) + "</div>"; })
        .catch(function (e) { msg.innerHTML = '<div class="info warn">连接失败：' + esc(e.message) + "</div>"; })
        .then(function () { btn.disabled = false; });
    };
  }

  /* ---------- router ---------- */
  var currentView = "home";
  function openView(name) {
    var finish = function () { if (name === currentView && name !== "home") { _renderView(name); updateBackBtn(); return; } go(function () { _renderView(name); }); };
    if (!NEED[name] || window.CET4_ALL_INLINE) { finish(); return; }
    ensureView(name).then(finish);
  }
  function goHome() { VIEWS = [function () { _renderView("home"); }]; try { history.replaceState({ v: 1 }, ""); } catch (e) { } currentView = "home"; _renderView("home"); window.scrollTo(0, 0); updateBackBtn(); }
  function _renderView(name) {
    currentView = name; window.scrollTo(0, 0);
    if (name === "home") renderHome();
    else if (name === "zhenti") renderZhentiList();
    else if (name === "plan") renderPlan();
    else if (name === "ocr") renderOcr();
    else if (name === "vocab") renderVocab();
    else if (name === "reading") renderReadingList();
    else if (name === "listening") renderListeningList();
    else if (name === "voa") renderVoaList();
    else if (name === "writing") renderWritingList();
    else if (name === "writinglib") renderWritingLib();
    else if (name === "errbook") renderErrBook();
    else if (name === "collocbook") renderCollocBook();
    else if (name === "translation") renderTranslationList();
    else if (name === "grammar") renderGrammarList();
    else if (name === "collocations") renderCollocations();
    else if (name === "mocks") renderMockList();
    else if (name === "dash") renderDashboard();
    else if (name === "records") renderRecords();
    else if (name === "wrong") renderWrongBook();
    else if (name === "fav") renderFavList();
    else if (name === "qfav") renderQFav();
    else if (name === "roots") renderRootsList();
    else if (name === "vtest") renderVocabTest(main);
    else if (name === "vrecords") renderVocabRecords();
    else if (name === "review") renderReview();
    else if (name === "monitor") renderMonitor();
    else if (name === "eztor") renderEztorList();
    else if (name === "links") renderLinks();
    else if (name === "guide") renderGuide();
    else if (name === "yati") renderYatiList();
    else if (name === "report") renderReport();
  }
  document.getElementById("btn-home").onclick = function () { goHome(); };
  document.getElementById("btn-settings").onclick = openSettings;
  var _back = document.getElementById("btn-back"); if (_back) _back.onclick = function () { goBack(); };
  var _dash = document.getElementById("btn-dash"); if (_dash) _dash.onclick = function () { openView("dash"); };
  var _theme = document.getElementById("btn-theme"); if (_theme) _theme.onclick = toggleTheme;
  applyTheme();
  goHome();
  showWelcome();
  syncOnLoad();
})();

