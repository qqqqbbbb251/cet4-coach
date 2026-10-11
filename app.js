(function () {
  "use strict";

  var DATA = window.CET4_DATA || { words: [], vocabulary: [], reading: [], listening: [], translations: [], writing: [], collocations: [], grammar: [], mocks: [] };
  var ZHENTI = window.CET4_ZHENTI || [];
  var main = document.getElementById("main");

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
  function addWrong(q) { var w = store("cet4_wrong", {}); w[q.key] = q; saveStore("cet4_wrong", w); }
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
  function addExam(rec) { var l = examList(); l.push(rec); saveStore("cet4_exam", l); }
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
  }
  function parseScore(md, kind) {
    if (!md) return null;
    var m;
    if (kind === "essay") { m = md.match(/(\d{1,3})\s*\/\s*100/); if (m) return Math.min(100, parseInt(m[1], 10)); }
    if (kind === "translation") { m = md.match(/(\d{1,2}(?:\.\d)?)\s*\/\s*15/); if (m) return Math.min(15, parseFloat(m[1])); }
    m = md.match(/得分[^\d]{0,6}(\d{1,3})/); if (m) return parseInt(m[1], 10);
    return null;
  }

  /* ---------- 词书 / 词频 / 难度 ---------- */
  function wmeta(w) { return (window.CET4_WORDMETA || {})[w] || { f5: 0, f10: 0, d: "" }; }
  function bookWords(key) {
    var meta = window.CET4_WORDMETA || {};
    var ex = window.CET4_EXTRA || {};
    if (key === "fav") { var f = getFav(); return Object.keys(f).map(function (w) { return { w: w, p: "", m: f[w] }; }); }
    if (ex[key]) return ex[key];
    if (key === "f5") return DATA.words.filter(function (w) { return (meta[w.w] || {}).f5 >= 8; });
    if (key === "f10") return DATA.words.filter(function (w) { return (meta[w.w] || {}).f10 >= 15; });
    if (["基础", "中级", "较难", "高阶"].indexOf(key) >= 0) return DATA.words.filter(function (w) { return (meta[w.w] || {}).d === key; });
    var ws = DATA.words.slice();
    if (store("cet4_nosimple", false)) ws = ws.filter(function (w) { return (((meta[w.w] || {}).lv) || []).indexOf("zk") < 0; });
    return ws;
  }
  function getVocabLog() { return store("cet4_vocab", { days: {}, learned: {}, total: 0 }); }
  function saveVocabLog(v) { saveStore("cet4_vocab", v); }
  function exampleOf(word) { var v = (DATA.vocabulary || []).filter(function (x) { return x.word === word; })[0]; return v ? v.example : ""; }  var LISTEN_LABEL = { news: "新闻", conversation: "对话", passage: "短文" };

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
      { role: "user", content: "请批改下面这篇四级作文。\n\n【作文题目】\n" + direction + "\n\n【学生作文】\n" + essay + "\n\n请严格按以下 Markdown 格式输出：\n## 综合得分\nX/100（并给出等级：优秀/良好/及格/不及格）\n\n## 总体评价\n（2-3 句）\n\n## 优点\n- （至少 2 条）\n\n## 主要问题与修改建议\n- 原句：…… 建议：……\n\n## 参考范文（120-180 词）\n" }
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
  function renderHomeOld() {
    var ok = configured();
    var cards = [
      { key: "zhenti", t: "历年真题", d: "76 套真题（2015–2026）· 3325 题 · 含答案解析，自动判分", ic: "卷", c: "#B71C1C" },
      { key: "plan", t: "学习计划", d: "距考试倒计时 · 每周主题 · 每日打卡进度", ic: "计", c: "#C62828" },
      { key: "ocr", t: "拍照批改", d: "拍作文/译文/答题卡 → 识别 → 批改 + 解析 + 建议", ic: "拍", c: "#D81B60" },
      { key: "vocab", t: "单词检测", d: "4537 个四级词汇 · 单词卡 + 词义测验 + 重点词汇", ic: "Aa", c: "#3949AB" },
      { key: "reading", t: "阅读完形", d: "30 篇（选词填空/段落匹配/阅读）共 300 题 · 自动批改", ic: "阅", c: "#00897B" },
      { key: "listening", t: "听力练习", d: "24 套共 384 题 · 音频 + 原文 + 自动批改", ic: "听", c: "#F4511E" },
      { key: "writing", t: "作文批改", d: "12 道题目 · DeepSeek AI 评分与范文", ic: "文", c: "#8E24AA" },
      { key: "translation", t: "翻译练习", d: "12 篇汉译英 · AI 批改与参考译文", ic: "译", c: "#5E35B1" },
      { key: "grammar", t: "语法要点", d: "15 个核心语法专题 · 清单式复习", ic: "法", c: "#2E7D32" },
      { key: "collocations", t: "常用短语", d: "126 个高频搭配 · 例句 + 记忆提示", ic: "搭", c: "#00838F" },
      { key: "mocks", t: "全真模拟", d: "10 套完整模拟卷 · 听力/阅读/翻译/写作", ic: "卷", c: "#C62828" },
      { key: "dash", t: "学习仪表盘", d: "做题统计 · 正确率趋势 · 参考估分", ic: "📊", c: "#0277BD" },
      { key: "wrong", t: "错题本", d: "自动收集错题 · 智能复习 · 连对出库", ic: "错", c: "#C62828" },
      { key: "fav", t: "生词本", d: "收藏的重点词汇", ic: "★", c: "#C8860A" },
      { key: "qfav", t: "收藏题目", d: "收藏的真题题目 · 集中复习", ic: "☆", c: "#6A1B9A" },
      { key: "roots", t: "词根词缀", d: "300 个词根词缀 · 例词 + 小测，科学记词", ic: "根", c: "#00838F" },
      { key: "eztor", t: "原创模拟", d: "2 套原创模拟卷 · 55 题含答案解析", ic: "拟", c: "#6A1B9A" },
      { key: "links", t: "更多资料", d: "GitHub 开源英语学习资源合集", ic: "链", c: "#455A64" },
      { key: "yati", t: "押题卷", d: "11 套押题/模拟卷 · 试卷 PDF + 听力音频", ic: "押", c: "#AD1457" },
      { key: "report", t: "学习报告", d: "专属学习报告 · 可保存为图片", ic: "报", c: "#0277BD" }
    ];
    var html = '<div class="page">';
    html += '<div class="hero"><h1>大学英语四级 · 备考</h1><p>单词 · 阅读 · 听力 · 作文 · 翻译，一站式备考。</p>' +
      '<span class="pill">' + (ok ? "● AI 批改已就绪" : "○ AI 批改未配置") + "</span></div>";
    if (!ok) html += '<div class="info warn">还没有配置 AI 接口。点右上角 ⚙ 填入 DeepSeek API Key 后，即可使用作文/翻译批改。其余功能均可离线使用。</div>';
    html += '<div class="grid">';
    cards.forEach(function (c) {
      html += '<div class="fcard" data-go="' + c.key + '">' +
        '<div class="ic" style="background:' + c.c + '1f;color:' + c.c + '">' + c.ic + "</div>" +
        '<div class="txt"><h3>' + c.t + "</h3><p>" + c.d + "</p></div>" +
        '<div class="arrow">›</div></div>';
    });
    html += "</div>";
    html += '<p class="center muted" style="margin-top:24px">个人专属备考工具 · v2.0 · 数据来源：CET-4 Study Lab (MIT)</p>';
    html += "</div>";
    main.innerHTML = html;
    main.querySelectorAll("[data-go]").forEach(function (el) { el.onclick = function () { openView(el.getAttribute("data-go")); }; });
  }

  var CATS = [
    { k: "words", t: "背单词", d: "背单词 · 词书 · 拼写 · 单词量测试 · 词根 · 生词本", ic: "词", c: "#3949AB", mods: ["vocab", "vtest", "vrecords", "roots", "fav"] },
    { k: "exam", t: "真题模考", d: "历年真题 · 原创模拟 · 押题卷 · 全真模拟", ic: "卷", c: "#B71C1C", mods: ["zhenti", "eztor", "yati", "mocks"] },
    { k: "skill", t: "专项练习", d: "听力 · 阅读 · 翻译 · 写作 · 语法 · 短语", ic: "练", c: "#00897B", mods: ["listening", "reading", "translation", "writing", "grammar", "collocations"] },
    { k: "ai", t: "AI 批改", d: "拍照识别批改 · 作文/翻译评分", ic: "AI", c: "#D81B60", mods: ["ocr"] },
    { k: "me", t: "我的学习", d: "学习计划 · 报告 · 打卡 · 错题本 · 收藏", ic: "我", c: "#C62828", mods: ["plan", "report", "dash", "records", "wrong", "qfav"] },
    { k: "more", t: "更多", d: "GitHub 开源英语学习资源", ic: "…", c: "#455A64", mods: ["links"] }
  ];
  var MODS = {
    vocab: { t: "单词检测", d: "单词卡 · 中译英 · 拼写 · 词书 · 重点词 · 生词本", ic: "Aa", c: "#3949AB" },
    roots: { t: "词根词缀", d: "300 个词根词缀 · 例词 + 小测", ic: "根", c: "#00838F" },
    vtest: { t: "单词量测试", d: "估算你的词汇量", ic: "测", c: "#00838F" },
    vrecords: { t: "背单词记录", d: "每日背词量 · 打卡", ic: "录", c: "#C8860A" },
    fav: { t: "生词本", d: "收藏的重点词汇", ic: "★", c: "#C8860A" },
    zhenti: { t: "历年真题", d: "76 套（2015–2026）· 3325 题 · 含答案解析", ic: "卷", c: "#B71C1C" },
    eztor: { t: "原创模拟", d: "2 套原创模拟卷 · 55 题含答案解析", ic: "拟", c: "#6A1B9A" },
    yati: { t: "押题卷", d: "11 套押题/模拟卷 · 试卷 PDF + 听力音频", ic: "押", c: "#AD1457" },
    mocks: { t: "全真模拟", d: "10 套完整模拟卷 · 听力/阅读/翻译/写作", ic: "模", c: "#C62828" },
    listening: { t: "听力练习", d: "24 套 · 音频 + 原文 + 自动批改", ic: "听", c: "#F4511E" },
    reading: { t: "阅读完形", d: "30 篇 300 题 · 自动批改", ic: "阅", c: "#00897B" },
    translation: { t: "翻译练习", d: "12 篇汉译英 · AI 批改", ic: "译", c: "#5E35B1" },
    writing: { t: "作文批改", d: "12 道题 · AI 评分与范文", ic: "文", c: "#8E24AA" },
    grammar: { t: "语法要点", d: "15 个核心语法专题", ic: "法", c: "#2E7D32" },
    collocations: { t: "常用短语", d: "126 个高频搭配", ic: "搭", c: "#00838F" },
    ocr: { t: "拍照批改", d: "拍作文/译文/答题卡 → 识别 → 批改 + 建议", ic: "拍", c: "#D81B60" },
    plan: { t: "学习计划", d: "分阶段计划 · 每日打卡 · AI 调整", ic: "计", c: "#C62828" },
    report: { t: "学习报告", d: "专属报告 · 可保存为图片", ic: "报", c: "#0277BD" },
    dash: { t: "学习仪表盘", d: "做题统计 · 正确率趋势 · 估分", ic: "📊", c: "#0277BD" },
    records: { t: "作文/翻译记录", d: "历史提交与批改 · 可合成为考试", ic: "档", c: "#8E24AA" },
    wrong: { t: "错题本", d: "自动收集 · 智能复习", ic: "错", c: "#C62828" },
    qfav: { t: "收藏题目", d: "收藏的真题题目", ic: "☆", c: "#6A1B9A" },
    links: { t: "更多资料", d: "GitHub 开源英语学习资源合集", ic: "链", c: "#455A64" }
  };
  function renderHome() {
    var ok = configured();
    var html = '<div class="page">' +
      '<div class="hero"><h1>大学英语四级 · 备考</h1><p>单词 · 真题模考 · 专项练习 · AI 批改，一站式备考。</p><span class="pill">' + (ok ? "● AI 批改已就绪" : "○ AI 批改未配置") + "</span></div>";
    if (!ok) html += '<div class="info warn">点右上角 ⚙ 填入 DeepSeek API Key，即可用作文/翻译批改、拍照识别与 AI 计划；其余功能可离线使用。</div>';
    html += '<div class="grid">';
    CATS.forEach(function (c) {
      html += '<div class="fcard" data-cat="' + c.k + '"><div class="ic" style="background:' + c.c + '1f;color:' + c.c + '">' + c.ic + '</div><div class="txt"><h3>' + c.t + '</h3><p>' + c.d + '</p></div><div class="arrow">›</div></div>';
    });
    html += '</div><p class="center muted" style="margin-top:24px">个人专属备考工具 · 数据来源：GitHub 开源</p></div>';
    main.innerHTML = html;
    main.querySelectorAll("[data-cat]").forEach(function (el) { el.onclick = function () { renderCategory(el.getAttribute("data-cat")); }; });
  }
  function renderCategory(k) {
    var cat = CATS.filter(function (c) { return c.k === k; })[0];
    if (!cat) { renderHome(); return; }
    var html = '<div class="page"><div id="backslot"></div><div class="section-title">' + esc(cat.t) + '</div><div class="grid">';
    cat.mods.forEach(function (m) {
      var x = MODS[m]; if (!x) return;
      html += '<div class="fcard" data-go="' + m + '"><div class="ic" style="background:' + x.c + '1f;color:' + x.c + '">' + x.ic + '</div><div class="txt"><h3>' + x.t + '</h3><p>' + x.d + '</p></div><div class="arrow">›</div></div>';
    });
    html += "</div></div>";
    main.innerHTML = html;
    document.getElementById("backslot").appendChild(backBar("返回", renderHome));
    main.querySelectorAll("[data-go]").forEach(function (el) { el.onclick = function () { openView(el.getAttribute("data-go")); }; });
  }
  function backBar(label, fn) {
    var b = document.createElement("button");
    b.className = "btn ghost small"; b.textContent = "‹ " + (label || "返回");
    b.onclick = fn; return b;
  }
  function listPage(title, items, renderRow, onClick) {
    var html = '<div class="page"><div class="section-title">' + esc(title) + "</div><div id='listbox'>";
    items.forEach(function (it, i) { html += renderRow(it, i); });
    html += "</div></div>";
    main.innerHTML = html;
    main.querySelectorAll("[data-idx]").forEach(function (el) {
      el.onclick = function () { onClick(items[parseInt(el.getAttribute("data-idx"), 10)]); };
    });
  }
  function listPageInto(container, items, renderRow, onClick) {
    container.innerHTML = '<div class="section-title">共 ' + items.length + " 套</div>" + items.map(renderRow).join("");
    container.querySelectorAll("[data-idx]").forEach(function (el) {
      el.onclick = function () { onClick(items[parseInt(el.getAttribute("data-idx"), 10)]); };
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
    main.innerHTML = '<div class="page"><div class="tabs">' +
      '<button id="tab-study" class="active">背单词</button>' +
      '<button id="tab-quiz">词义测验</button>' +
      '<button id="tab-en">中译英</button>' +
      '<button id="tab-spell">拼写</button>' +
      '<button id="tab-book">词书</button>' +
      '<button id="tab-vip">重点词</button></div><div id="vocab-body"></div></div>';
    var body = document.getElementById("vocab-body");
    document.getElementById("tab-study").onclick = function () { setTab(this); renderStudy(body); };
    document.getElementById("tab-quiz").onclick = function () { setTab(this); renderQuiz(body); };
    document.getElementById("tab-en").onclick = function () { setTab(this); renderEnQuiz(body); };
    document.getElementById("tab-spell").onclick = function () { setTab(this); renderSpell(body); };
    document.getElementById("tab-book").onclick = function () { setTab(this); renderVocabBook(body); };
    document.getElementById("tab-vip").onclick = function () { setTab(this); renderVipVocab(body); };
    renderStudy(body);
  }
  function setTab(btn) { btn.parentNode.querySelectorAll("button").forEach(function (b) { b.classList.remove("active"); }); btn.classList.add("active"); }
  function renderFlash(body) {
    var words = bookWords(store("cet4_book", "all"));
    if (!words.length) { body.innerHTML = '<div class="info">当前词书是空的，请到「词书」选择，或先收藏单词。</div>'; return; }
    var bk = store("cet4_book", "all");
    var bookLabel = { all: "四级核心", f5: "近5年高频", f10: "近10年高频", "基础": "难度·基础", "中级": "难度·中级", "较难": "难度·较难", "高阶": "难度·高阶", fav: "我的生词本" };
    var idx = Math.floor(Math.random() * words.length), revealed = false;
    function draw() {
      var w = words[idx]; var mm = wmeta(w.w);
      body.innerHTML =
        '<div class="progress"><i style="width:' + ((idx + 1) / words.length * 100).toFixed(1) + '%"></i></div>' +
        '<div class="between" style="margin:6px 0"><span class="muted">' + (bookLabel[bk] || "") + " · " + (idx + 1) + " / " + words.length + '</span><button class="star' + (getFav()[w.w] != null ? " on" : "") + '" id="fav-btn">★</button></div>' +
        '<div class="flash" id="flash-card"><div class="word">' + esc(w.w) + "</div>" +
        (w.p ? '<div class="phon">/' + esc(w.p) + "/</div>" : "") +
        '<div class="muted" style="font-size:12px;margin-top:8px">近5年×' + mm.f5 + " · 近10年×" + mm.f10 + " · 难度：" + (mm.d || "—") + "</div>" +
        (revealed ? '<div class="mean">' + esc(w.m) + "</div>" : '<div class="hint">点击卡片显示释义</div>') + "</div>" +
        '<div class="row" style="margin-top:16px">' +
        '<button class="btn ghost" id="prev" style="flex:1">上一个</button>' +
        '<button class="btn ghost" id="rnd" style="flex:1">随机</button>' +
        '<button class="btn ghost" id="next" style="flex:1">下一个</button></div>';
      document.getElementById("fav-btn").onclick = function () { var on = toggleFav(w.w, w.m); this.classList.toggle("on", on); toast(on ? "已收藏" : "已取消收藏"); };
      document.getElementById("flash-card").onclick = function () { revealed = !revealed; draw(); };
      document.getElementById("prev").onclick = function () { idx = (idx - 1 + words.length) % words.length; revealed = false; draw(); };
      document.getElementById("next").onclick = function () { idx = (idx + 1) % words.length; revealed = false; draw(); };
      document.getElementById("rnd").onclick = function () { idx = Math.floor(Math.random() * words.length); revealed = false; draw(); };
    }
    draw();
  }
  function renderQuiz(body) {
    var words = bookWords(store("cet4_book", "all"));
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
          draw();
        };
      });
      document.getElementById("qbtn").onclick = function () { if (selected !== null) newQ(); };
    }
    newQ();
  }
  function renderSpell(body) {
    var words = bookWords(store("cet4_book", "all"));
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
    var words = bookWords(store("cet4_book", "all"));
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
        el.onclick = function () { if (selected !== null) return; selected = parseInt(el.getAttribute("data-i"), 10); total++; if (selected === correctK) score++; draw(); };
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
        return '<div class="card"><div class="between"><b style="font-size:18px;color:var(--primary)">' + esc(v.word) + " <span class='muted' style='font-weight:400'>" + esc(v.phonetic || "") + "</span></b>" +
          '<button class="star' + (fav[v.word] != null ? " on" : "") + '" data-fav="' + esc(v.word) + '" data-m="' + esc(v.meaningZh || "") + '">★</button></div>' +
          '<div style="margin-top:6px">' + esc(v.meaningZh || "") + "</div>" +
          (v.example ? '<div class="muted" style="margin-top:8px">例：' + esc(v.example) + "</div>" : "") + "</div>";
      }).join("");
      box.querySelectorAll(".star").forEach(function (b) {
        b.onclick = function () { var on = toggleFav(b.getAttribute("data-fav"), b.getAttribute("data-m")); b.classList.toggle("on", on); toast(on ? "已收藏到生词本" : "已取消收藏"); };
      });
    }
    document.getElementById("vip-search").oninput = function () { draw(this.value); };
    draw("");
  }
  function renderVocabBookOld(body) {
    var books = [
      { k: "f5", t: "近5年真题·高频", d: "近5年出现 ≥ 8 次" },
      { k: "f10", t: "近10年真题·高频", d: "近10年出现 ≥ 15 次" },
      { k: "all", t: "四级核心词汇", d: "全部 4537 词" },
      { k: "基础", t: "难度 · 基础", d: "最常见的基础词" },
      { k: "中级", t: "难度 · 中级", d: "" },
      { k: "较难", t: "难度 · 较难", d: "" },
      { k: "高阶", t: "难度 · 高阶", d: "较生僻词" },
      { k: "fav", t: "我的生词本", d: "已收藏的单词" }
    ];
    var cur = store("cet4_book", "all");
    body.innerHTML = '<p class="muted">选择一本词书，单词卡与词义测验只练这本书。</p>' + books.map(function (b) {
      var n = bookWords(b.k).length;
      return '<div class="list-item" data-book="' + b.k + '"><div class="ic" style="background:#3949AB1f;color:#3949AB">' + esc(b.t.charAt(0)) + '</div>' +
        '<div><h3>' + esc(b.t) + (b.k === cur ? " ✓" : "") + "</h3><p>" + n + " 词" + (b.d ? " · " + b.d : "") + "</p></div>" +
        '<div class="arrow" style="margin-left:auto;color:#c3c6d4">›</div></div>';
    }).join("");
    body.querySelectorAll("[data-book]").forEach(function (el) {
      el.onclick = function () { saveStore("cet4_book", el.getAttribute("data-book")); toast("已选择词书"); document.getElementById("tab-card").click(); };
    });
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
  function renderListeningDetail(s) {
    var html = '<div class="page"><div id="backslot"></div><div class="section-title">' + esc(s.theme) + "（" + (LISTEN_LABEL[s.type] || s.type) + "）</div>" +
      '<div class="card"><audio controls preload="metadata" src="' + esc(s.audio) + '"></audio>' +
      '<div class="center" style="margin-top:10px"><button class="btn ghost small" id="toggle-tr">显示原文</button></div>' +
      '<div id="tr-box" style="display:none" class="transcript">' + esc(s.transcript) + "</div></div>" +
      '<div class="section-title">听力题目</div>' + sectionCard(s.questions) + "</div>";
    main.innerHTML = html;
    document.getElementById("backslot").appendChild(backBar("返回", renderListeningList));
    document.getElementById("toggle-tr").onclick = function () {
      var box = document.getElementById("tr-box"); var show = box.style.display === "none";
      box.style.display = show ? "block" : "none"; this.textContent = show ? "隐藏原文" : "显示原文";
    };
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
      '<div class="center" style="margin-top:10px"><button class="btn ghost small" id="wr-ref">查看参考范文</button></div>' +
      '<div id="wr-refbox" style="display:none;margin-top:10px"></div>' +
      '<div id="wr-result"></div></div>';
    main.innerHTML = html;
    document.getElementById("backslot").appendChild(backBar("返回", renderWritingList));
    var ta = document.getElementById("wr-text");
    ta.oninput = function () { document.getElementById("wr-wc").textContent = "词数：" + (ta.value.trim() ? ta.value.trim().split(/\s+/).filter(Boolean).length : 0); };
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
        .then(function (md) { res.innerHTML = '<div class="ai-result" style="margin-top:16px">' + mdToHtml(md) + "</div>"; saveRecord("essay", s.prompt, ta.value.trim(), md); toast("已保存到作文记录"); })
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
      '<div class="center" style="margin-top:10px"><button class="btn ghost small" id="tr-ref">查看参考译文</button></div>' +
      '<div id="tr-refbox" style="display:none;margin-top:10px"></div>' +
      '<div id="tr-result"></div></div></div>';
    main.innerHTML = html;
    document.getElementById("backslot").appendChild(backBar("返回", renderTranslationList));
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
        .then(function (md) { res.innerHTML = '<div class="ai-result" style="margin-top:16px">' + mdToHtml(md) + "</div>"; saveRecord("translation", s.prompt, input.value.trim(), md); toast("已保存到翻译记录"); })
        .catch(function (e) { res.innerHTML = '<div class="info warn" style="margin-top:16px">批改失败：' + esc(e.message) + "</div>"; })
        .then(function () { btn.disabled = false; btn.textContent = old; });
    };
  }

  /* ---------- grammar ---------- */
  function renderGrammarList() {
    listPage("语法要点（" + DATA.grammar.length + " 个专题）", DATA.grammar, function (s, i) {
      return '<div class="list-item" data-idx="' + i + '"><div class="ic" style="background:#2E7D321f;color:#2E7D32">法</div>' +
        '<div><h3>' + esc(s.title) + "</h3><p>" + esc((s.summary || "").slice(0, 40)) + "…</p></div>" +
        '<div class="arrow" style="margin-left:auto;color:#c3c6d4">›</div></div>';
    }, renderGrammarDetail);
  }
  function renderGrammarDetail(s) {
    var html = '<div class="page"><div id="backslot"></div><div class="section-title">' + esc(s.title) + "</div>" +
      '<div class="card"><div class="passage">' + esc(s.summary) + "</div>" +
      '<div class="stem" style="font-weight:600;margin:6px 0 8px">复习清单</div><ul style="padding-left:20px;line-height:1.9">' +
      (s.checklist || []).map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></div></div>";
    main.innerHTML = html;
    document.getElementById("backslot").appendChild(backBar("返回", renderGrammarList));
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
        if (kind === "listen") renderListeningDetail(byId(DATA.listening, id));
        else if (kind === "read") renderReadingDetail(byId(DATA.reading, id));
        else if (kind === "trans") renderTranslationDetail(byId(DATA.translations, id));
        else if (kind === "write") renderWritingDetail(byId(DATA.writing, id));
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
      var h = '<div class="zq" data-kind="mcq" data-ans="' + l2i(q.answer) + '" data-ansl="' + esc(q.answer) + '" data-qno="' + q.qno + '" data-type="' + esc(q.type) + '" data-stem="' + esc(q.stem || "") + '" data-opts="' + esc(JSON.stringify(opts)) + '" data-exp="' + esc(q.exp || "") + '" data-kw="' + esc(JSON.stringify(q.kw || [])) + '"><div class="stem">' + diffBadge(q.diff) + q.qno + ". " + esc(q.stem) + qfavStar(p.id + "#" + q.qno) + "</div>";
      (q.options || []).forEach(function (o, oi) {
        h += '<div class="opt" data-oi="' + oi + '"><span class="k">' + String.fromCharCode(65 + oi) + '.</span><span>' + esc(strip(o)) + "</span></div>";
      });
      return h + "</div>";
    }
    function selQ(q, opts, isCloze) {
      var stem = isCloze ? ("第 " + q.qno + " 空") : q.stem;
      var h = '<div class="zq" data-kind="sel" data-ans="' + esc(q.answer) + '" data-ansl="' + esc(q.answer) + '" data-qno="' + q.qno + '" data-type="' + esc(q.type) + '" data-stem="' + esc(stem || "") + '" data-opts="' + esc(JSON.stringify(opts.map(function (x) { return x.t; }))) + '" data-exp="' + esc(q.exp || "") + '" data-kw="' + esc(JSON.stringify(q.kw || [])) + '"><div class="stem">' + diffBadge(q.diff) + q.qno + ". " + esc(stem) + qfavStar(p.id + "#" + q.qno) + "</div>";
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
        aiRun(this, document.getElementById("z-tr-res"), function () { return gradeTranslation(p.translation.prompt, p.translation.sample, ta.value.trim()); }, "translation", p.translation.prompt, ta.value.trim());
      };
    }
  }

  function aiRun(btn, res, fn, kind, title, input) {
    if (!configured()) { toast("请先在设置中配置 DeepSeek API Key"); return; }
    var old = btn.textContent; btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 批改中…';
    res.innerHTML = "";
    fn().then(function (md) { res.innerHTML = '<div class="ai-result" style="margin-top:12px">' + mdToHtml(md) + "</div>"; if (kind) { saveRecord(kind, title, input, md); toast("已保存到" + (kind === "essay" ? "作文" : "翻译") + "记录"); } })
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
  function renderPlanOld() {
    var exam = new Date(PLAN.exam + "T09:00:00");
    var now = new Date();
    var days = Math.max(0, Math.ceil((exam - now) / 86400000));
    var todayKey = now.getFullYear() + "-" + ("0" + (now.getMonth() + 1)).slice(-2) + "-" + ("0" + now.getDate()).slice(-2);

    function loadAll() { try { return JSON.parse(localStorage.getItem("cet4_plan") || "{}"); } catch (e) { return {}; } }
    function saveAll(o) { localStorage.setItem("cet4_plan", JSON.stringify(o)); }
    function streak(data) {
      var s = 0, d = new Date(now);
      for (; ;) {
        var k = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
        var rec = data[k];
        if (rec && DAILY.filter(function (_, i) { return rec[i]; }).length >= 3) { s++; d.setDate(d.getDate() - 1); }
        else break;
      }
      return s;
    }

    var data = loadAll();
    var done = data[todayKey] || {};
    var doneCount = DAILY.filter(function (_, i) { return done[i]; }).length;
    var pct = Math.round(doneCount / DAILY.length * 100);
    var st = streak(data);

    var html = '<div class="page">' +
      '<div class="hero"><h1>距四级考试还有 ' + days + ' 天</h1><p>考试日期：' + PLAN.exam + '（周六上午）</p><span class="pill">已连续打卡 ' + st + ' 天</span></div>' +
      '<div class="section-title">今日打卡（' + todayKey + '）</div><div class="card">';
    DAILY.forEach(function (t, i) {
      html += '<label style="display:flex;align-items:center;gap:10px;padding:8px 0;font-size:15px"><input type="checkbox" data-day="' + i + '" ' + (done[i] ? "checked" : "") + ' style="width:20px;height:20px">' + esc(t) + "</label>";
    });
    html += '<div class="progress" style="margin-top:8px"><i style="width:' + pct + '%"></i></div><div class="muted">今日完成 ' + doneCount + "/" + DAILY.length + "</div></div>";

    html += '<div class="section-title">9 周冲刺计划</div>';
    PLAN.weeks.forEach(function (w) {
      html += '<div class="card"><div class="between"><b>' + esc(w.t) + '</b><span class="muted">' + esc(w.r) + "</span></div>" +
        '<div style="margin-top:6px" class="muted">' + esc(w.d) + "</div></div>";
    });
    html += '<div class="info" style="margin-top:8px">坚持比计划本身更重要：每天至少完成「背单词 + 听力 + 阅读」，周末加一套真题/作文。</div></div>';
    main.innerHTML = html;

    main.querySelectorAll("[data-day]").forEach(function (cb) {
      cb.onchange = function () {
        var d = loadAll();
        d[todayKey] = d[todayKey] || {};
        d[todayKey][parseInt(cb.getAttribute("data-day"), 10)] = cb.checked;
        saveAll(d);
        renderPlan();
      };
    });
  }

  /* ---------- 仪表盘 ---------- */
  function renderDashboardOld() {
    var p = store("cet4_progress", { a: 0, c: 0, days: {}, types: {} });
    var acc = p.a ? Math.round(p.c / p.a * 100) : 0;
    var est = p.a ? Math.min(710, Math.round(p.c / p.a * 497 + 128)) : 0;
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var k = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
      days.push({ k: k.slice(5), v: p.days[k] || { a: 0, c: 0 } });
    }
    var maxa = Math.max(1, Math.max.apply(null, days.map(function (x) { return x.v.a; })));
    var typeNames = { listening: "听力", cloze: "选词填空", match: "信息匹配", reading: "仔细阅读", review: "错题复习", obj: "练习" };
    var wrongN = Object.keys(store("cet4_wrong", {})).length;
    var favN = Object.keys(getFav()).length;

    var html = '<div class="page"><div class="section-title">学习仪表盘</div>' +
      '<div class="stat-row">' +
      '<div class="stat"><div class="n">' + p.a + '</div><div class="l">已做题数</div></div>' +
      '<div class="stat"><div class="n">' + p.c + '</div><div class="l">答对</div></div>' +
      '<div class="stat"><div class="n">' + acc + '%</div><div class="l">正确率</div></div>' +
      '<div class="stat"><div class="n">' + (est || "—") + '</div><div class="l">参考估分 /710</div></div>' +
      '</div>' +
      '<div class="card"><div class="section-title" style="margin-top:0">近 7 天做题量</div><div class="bars">';
    days.forEach(function (x) {
      var h = Math.round(x.v.a / maxa * 100);
      html += '<div class="bb"><div class="b" style="height:' + h + '%"></div><div class="d">' + x.k + "</div></div>";
    });
    html += "</div></div>";
    var types = p.types || {};
    var tkeys = Object.keys(types).filter(function (k) { return types[k].a > 0; });
    if (tkeys.length) {
      html += '<div class="card"><div class="section-title" style="margin-top:0">分题型正确率</div>';
      tkeys.forEach(function (k) {
        var a = types[k].a, c = types[k].c, r = Math.round(c / a * 100);
        html += '<div class="between" style="margin:6px 0"><span>' + (typeNames[k] || k) + '</span><span class="muted">' + c + "/" + a + " · " + r + '%</span></div><div class="progress"><i style="width:' + r + '%"></i></div>';
      });
      html += "</div>";
    }
    html += '<div class="grid">' +
      '<div class="fcard" data-go="wrong"><div class="ic" style="background:#C628281f;color:#C62828">错</div><div class="txt"><h3>错题本</h3><p>' + wrongN + " 道错题 · 智能复习</p></div><div class=\"arrow\">›</div></div>" +
      '<div class="fcard" data-go="fav"><div class="ic" style="background:#F6B93B1f;color:#C8860A">★</div><div class="txt"><h3>生词本</h3><p>' + favN + ' 个收藏单词</p></div><div class="arrow">›</div></div>' +
      "</div>" +
      '<p class="center muted" style="margin-top:16px">估分按客观题正确率粗略折算，仅供参考。</p></div>';
    main.innerHTML = html;
    main.querySelectorAll("[data-go]").forEach(function (el) { el.onclick = function () { openView(el.getAttribute("data-go")); }; });
  }

  /* ---------- 错题本 ---------- */
  function renderWrongBook() {
    var w = store("cet4_wrong", {});
    var items = Object.keys(w).map(function (k) { return w[k]; });
    var html = '<div class="page"><div class="section-title">错题本（' + items.length + '）</div>';
    if (!items.length) {
      html += '<div class="info">还没有错题。做真题/练习答错时，会自动收进这里。</div>';
    } else {
      html += '<div class="row" style="margin-bottom:12px"><button class="btn" id="wq-review">智能复习（最多20题）</button><button class="btn ghost" id="wq-clear">清空</button></div>';
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
      document.getElementById("wq-review").onclick = renderWrongQuiz;
      document.getElementById("wq-clear").onclick = function () { saveStore("cet4_wrong", {}); renderWrongBook(); };
    }
  }

  function renderWrongQuiz() {
    var w = store("cet4_wrong", {});
    var items = Object.keys(w).map(function (k) { return w[k]; });
    if (!items.length) { toast("错题本是空的"); return; }
    items = shuffle(items).slice(0, 20);
    var html = '<div class="page"><div id="backslot"></div><div class="section-title">智能复习（' + items.length + ' 题）</div><div class="card section-card">';
    items.forEach(function (q, i) {
      html += '<div class="zq" data-kind="mcq" data-ans="' + A2I(q.answer) + '" data-key="' + esc(q.key) + '" data-exp="' + esc(q.exp || "") + '" data-kw="' + esc(JSON.stringify(q.kw || [])) + '"><div class="stem">' + (i + 1) + ". " + esc(q.stem || ("第" + q.qno + "题")) + "</div>";
      (q.options || []).forEach(function (o, oi) {
        html += '<div class="opt" data-oi="' + oi + '"><span class="k">' + String.fromCharCode(65 + oi) + '.</span><span>' + esc(stripA(o)) + "</span></div>";
      });
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
      var c = 0, t = 0;
      main.querySelectorAll(".zq").forEach(function (q) {
        t++;
        var ans = parseInt(q.getAttribute("data-ans"), 10), sel = q.querySelector(".opt.sel"), ok = false;
        q.querySelectorAll(".opt").forEach(function (o) { o.classList.add("locked"); var oi = parseInt(o.getAttribute("data-oi"), 10); if (oi === ans) o.classList.add("correct"); else if (sel && o === sel) o.classList.add("wrong"); });
        ok = sel && parseInt(sel.getAttribute("data-oi"), 10) === ans;
        if (ok) { c++; removeWrong(q.getAttribute("data-key")); }
        recordAnswer("review", ok);
        var exp = q.getAttribute("data-exp");
        if (exp) { var kw = []; try { kw = JSON.parse(q.getAttribute("data-kw") || "[]"); } catch (e) { } var d = document.createElement("div"); d.className = "explain"; d.innerHTML = "<b>解析：</b>" + hiExp(exp, kw); q.appendChild(d); }
      });
      toast("答对 " + c + " / " + t + "，答对的已移出错题本");
      this.textContent = "完成";
      this.disabled = true;
    };
  }

  /* ---------- 生词本 ---------- */
  function renderFavList() {
    var f = getFav();
    var words = Object.keys(f);
    var html = '<div class="page"><div class="section-title">生词本（' + words.length + '）</div>';
    if (!words.length) { html += '<div class="info">还没有收藏单词。在「单词检测 → 重点词汇」或单词卡里点 ★ 收藏。</div>'; }
    words.forEach(function (w) {
      html += '<div class="card"><div class="between"><b style="font-size:17px;color:var(--primary)">' + esc(w) + '</b><button class="star on" data-rm="' + esc(w) + '">★</button></div><div style="margin-top:6px">' + esc(f[w]) + "</div></div>";
    });
    html += "</div>";
    main.innerHTML = html;
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
        el.onclick = function () { var r = roots.find(function (x) { return x.root === el.getAttribute("data-root"); }); if (r) renderRootDetail(r); };
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
      '<p>一站式四级备考工具，包含：</p>' +
      '<ul style="padding-left:20px;line-height:1.9">' +
      '<li><b>历年真题</b>：76 套（2015–2026），含答案解析，在线作答自动判分</li>' +
      '<li><b>单词检测</b>：近5年/近10年频率分级 + 难度分级 + 词书</li>' +
      '<li><b>听力 / 阅读 / 翻译 / 写作 / 词根词缀</b></li>' +
      '<li><b>拍照批改 · 错题本 · 生词本 · 收藏题目 · 学习仪表盘</b></li>' +
      '</ul>' +
      '<div class="info">首次使用请点右上角 ⚙ 填入 DeepSeek API Key，即可使用作文/翻译 AI 批改与拍照识别；其余功能可离线使用。</div>' +
      '<button class="btn block" id="wel-ok">开始使用</button></div>';
    document.body.appendChild(mask);
    document.getElementById("wel-ok").onclick = function () { saveStore("cet4_seen", true); document.body.removeChild(mask); };
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
    var plan = store("cet4_plan", {});
    function doneN(k) { var r = plan[k]; if (!r) return 0; var n = 0; for (var i in r) if (r[i]) n++; return n; }
    var checkin = 0; for (var k in plan) if (doneN(k) >= 3) checkin++;
    var dd = new Date(), streak = 0;
    function key(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
    for (; ;) { if (doneN(key(dd)) >= 3) { streak++; dd.setDate(dd.getDate() - 1); } else break; }
    var days = Math.max(0, Math.ceil((new Date("2026-12-12T09:00:00") - new Date()) / 86400000));
    var typeNames = { listening: "听力", cloze: "选词填空", match: "信息匹配", reading: "仔细阅读", review: "错题复习", obj: "练习" };
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
  var EXAM_DATE = "2026-12-12";
  var DAILY3 = ["背 30 个单词", "听力 1 套 / 精听", "精读 1 篇阅读", "写或译 1 篇", "复习错题本"];
  function planDays() { return Math.max(0, Math.ceil((new Date(EXAM_DATE + "T09:00:00") - new Date()) / 86400000)); }
  function planStreak(data) {
    var s = 0, d = new Date();
    function key(x) { return x.getFullYear() + "-" + ("0" + (x.getMonth() + 1)).slice(-2) + "-" + ("0" + x.getDate()).slice(-2); }
    for (; ;) { var r = data[key(d)]; if (r && DAILY3.filter(function (_, i) { return r[i]; }).length >= 3) { s++; d.setDate(d.getDate() - 1); } else break; }
    return s;
  }
  function renderPlan() {
    var days = planDays();
    var now = new Date();
    var todayKey = now.getFullYear() + "-" + ("0" + (now.getMonth() + 1)).slice(-2) + "-" + ("0" + now.getDate()).slice(-2);
    var data = store("cet4_plan", {});
    var done = data[todayKey] || {};
    var doneCount = DAILY3.filter(function (_, i) { return done[i]; }).length;
    var streak = planStreak(data);
    var mocks = examList();
    var enc = doneCount === DAILY3.length ? "今日任务全部完成，太棒了，保持节奏！" : (doneCount > 0 ? "已完成 " + doneCount + " 项，继续加油！" : "新的一天，先背几个单词热热身吧");
    var phases = [
      { t: "第一阶段 · 打基础", w: "考前约 2 个月～1 个月", d: "每周 1 套真题（限时）；主攻词汇 + 听力精听 + 阅读技巧，穿插词根与短语。" },
      { t: "第二阶段 · 强化", w: "考前约 1 个月～2 周", d: "每周 2 套真题；翻译/写作为专项，穿插语法与搭配攻坚（薄弱项优先）。" },
      { t: "第三阶段 · 冲刺", w: "考前 2 周内", d: "每 2 天 1 套限时真题；背作文模板、狂看错题本，保持手感与节奏。" }
    ];
    var html = '<div class="page">' +
      '<div class="hero"><h1>距四级考试还有 ' + days + ' 天</h1><p>考试日期：2026-12-12（周六上午）· 每天建议学习 3–4 小时</p><span class="pill">连续打卡 ' + streak + ' 天</span></div>' +
      '<div class="section-title">今日打卡（' + todayKey + '）· ' + enc + '</div><div class="card">';
    DAILY3.forEach(function (t, i) {
      html += '<label style="display:flex;align-items:center;gap:10px;padding:7px 0;font-size:15px"><input type="checkbox" data-day="' + i + '" ' + (done[i] ? "checked" : "") + ' style="width:20px;height:20px">' + esc(t) + "</label>";
    });
    html += '<div class="progress" style="margin-top:8px"><i style="width:' + Math.round(doneCount / DAILY3.length * 100) + '%"></i></div>' +
      '<div class="muted">今日完成 ' + doneCount + "/" + DAILY3.length + (doneCount === DAILY3.length ? " · 已打卡 ✓" : "") + "</div></div>";

    html += '<div class="section-title">分阶段计划</div>';
    phases.forEach(function (p) {
      html += '<div class="card"><div class="between"><b>' + esc(p.t) + '</b><span class="muted">' + esc(p.w) + '</span></div><div style="margin-top:6px" class="muted">' + esc(p.d) + "</div></div>";
    });

    html += '<div class="section-title">模考成绩录入</div><div class="card">' +
      '<div class="row"><label class="fld" style="flex:1"><span>日期</span><input type="date" id="mk-date" value="' + todayKey + '"></label>' +
      '<label class="fld" style="flex:1"><span>听力 正确/25</span><input type="number" id="mk-l" min="0" max="25" value="' + (mocks.length ? "" : "") + '" placeholder="如 18"></label></div>' +
      '<div class="row"><label class="fld" style="flex:1"><span>阅读 正确/30</span><input type="number" id="mk-r" min="0" max="30" placeholder="如 24"></label>' +
      '<label class="fld" style="flex:1"><span>写作+翻译 估分/30</span><input type="number" id="mk-w" min="0" max="30" placeholder="如 20"></label></div>' +
      '<button class="btn block" id="mk-save">保存本次模考成绩</button>' +
      (mocks.length ? '<div style="margin-top:10px" class="muted">已记录 ' + mocks.length + ' 次考试：' + mocks.slice(-3).map(function (m) { return m.date + " " + m.est + "/710"; }).join("；") + "</div>" : "") +
      "</div>";

    html += '<div class="section-title">AI 智能计划</div><div class="card">' +
      '<div class="muted" style="margin-bottom:10px">根据你的做题记录与模考成绩，AI 生成/微调专属计划（在 App 内直接读取你的本地数据）。</div>' +
      '<button class="btn block" id="plan-ai">让 AI 制定 / 调整计划</button><div id="plan-ai-res"></div></div>';
    html += "</div>";
    main.innerHTML = html;

    main.querySelectorAll("[data-day]").forEach(function (cb) {
      cb.onchange = function () {
        var d = store("cet4_plan", {});
        d[todayKey] = d[todayKey] || {};
        d[todayKey][parseInt(cb.getAttribute("data-day"), 10)] = cb.checked;
        saveStore("cet4_plan", d);
        renderPlan();
      };
    });
    document.getElementById("mk-save").onclick = function () {
      var l = parseInt(document.getElementById("mk-l").value, 10), r = parseInt(document.getElementById("mk-r").value, 10), w = parseInt(document.getElementById("mk-w").value, 10);
      if (isNaN(l) || isNaN(r)) { toast("请填写听力与阅读正确数"); return; }
      var ww = isNaN(w) ? null : w;
      addExam({ date: document.getElementById("mk-date").value || todayKey, source: "模考录入", h: Math.min(25, l), ht: 25, r: Math.min(30, r), rt: 30, w: ww, wt: 30, est: examEst(Math.min(25, l), 25, Math.min(30, r), 30, ww, 30), writingEstimated: ww == null });
      toast("已保存（710 折算：" + examEst(Math.min(25, l), 25, Math.min(30, r), 30, ww, 30) + "）");
      renderPlan();
    };
    document.getElementById("plan-ai").onclick = function () { aiPlan(this, document.getElementById("plan-ai-res")); };
  }
  function aiPlan(btn, res) {
    if (!configured()) { toast("请先在设置中配置 DeepSeek API Key"); return; }
    var p = store("cet4_progress", { a: 0, c: 0, types: {} });
    var mocks = examList();
    var types = p.types || {};
    var weak = [];
    for (var t in types) { if (types[t].a >= 3) weak.push({ type: t, acc: Math.round(types[t].c / types[t].a * 100) }); }
    weak.sort(function (a, b) { return a.acc - b.acc; });
    var profile = "距离考试还有 " + planDays() + " 天；累计做题 " + p.a + " 道，总正确率 " + (p.a ? Math.round(p.c / p.a * 100) : 0) + "%。" +
      "分题型正确率：" + JSON.stringify(types) + "。考试/模考记录（710）：" + JSON.stringify(mocks) + "。" +
      "作文：" + recStats("essay").n + " 篇·平均 " + recStats("essay").avg + "/100；翻译：" + recStats("translation").n + " 篇·平均 " + recStats("translation").avg + "/15。";
    var prompt = "学生情况：" + profile +
      "\n请制定一份个性化的四级备考计划：前约 1 个月每周 1 套真题，后 1 个月每周 2 套，临近考试每 2 天 1 套，中间穿插薄弱项攻坚；每天可学 3-4 小时。" +
      "请用中文 Markdown 输出，分周列出重点与每日时间分配，语言简洁可执行，并针对其薄弱题型给出具体建议。";
    btn.disabled = true; var old = btn.textContent; btn.innerHTML = '<span class="spin"></span> 生成中…';
    res.innerHTML = "";
    callAI([{ role: "system", content: "你是资深四级备考规划师。" }, { role: "user", content: prompt }])
      .then(function (md) { res.innerHTML = '<div class="ai-result" style="margin-top:12px">' + mdToHtml(md) + "</div>"; saveStore("cet4_ai_plan", md); })
      .catch(function (e) { res.innerHTML = '<div class="info warn" style="margin-top:12px">失败：' + esc(e.message) + "</div>"; })
      .then(function () { btn.disabled = false; btn.textContent = old; });
  }

  /* ---------- 仪表盘（练习/考试分开 · 710 分制） ---------- */
  function renderDashboard() {
    var p = store("cet4_progress", { a: 0, c: 0, days: {}, types: {} });
    var acc = p.a ? Math.round(p.c / p.a * 100) : 0;
    var pest = p.a ? Math.min(710, Math.round(p.c / p.a * 497 + 128)) : 0;
    var exams = examList();
    var examAvgV = examAvg();
    var typeNames = { listening: "听力", cloze: "选词填空", match: "信息匹配", reading: "仔细阅读", review: "错题复习", spell: "拼写", obj: "练习" };
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
      html += '<div class="card"><div class="between"><b style="color:' + color + '">' + kn + " · " + esc(r.date) + "</b>" +
        "<span>" + (sc != null ? '<b style="color:var(--primary)">' + sc + (r.kind === "essay" ? "/100" : "/15") + "</b>" : '<span class="muted">未解析到分数</span>') +
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
    var essays = getRecords("essay"), trans = getRecords("translation");
    var e = essays.length ? essays[essays.length - 1] : null, tr = trans.length ? trans[trans.length - 1] : null;
    var wRaw = 0, hasW = false;
    if (e) { var es = e.score != null ? e.score : parseScore(e.result, "essay"); if (es != null) { wRaw += es / 100 * 15; hasW = true; } }
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
      '<div class="info">导出：点「导出」生成 JSON，复制备份。导入：把 JSON 粘贴进文本框，点「导入并合并」（作文/翻译记录与考试成绩会追加，不影响其它数据）。</div>' +
      '<textarea id="io-text" rows="10" style="font-family:monospace;font-size:12px" placeholder="在此粘贴要导入的 JSON…"></textarea>' +
      '<div class="row" style="margin-top:10px"><button class="btn" id="io-exp" style="flex:1">导出当前</button>' +
      '<button class="btn outline" id="io-imp" style="flex:1">导入并合并</button></div>' +
      '<div id="io-msg"></div>' +
      '<div class="row" style="margin-top:16px"><button class="btn ghost block" id="io-close">关闭</button></div></div>';
    document.body.appendChild(mask);
    var ta = document.getElementById("io-text");
    document.getElementById("io-close").onclick = function () { document.body.removeChild(mask); };
    document.getElementById("io-exp").onclick = function () { ta.value = JSON.stringify({ records: getRecords(), exams: examList() }, null, 1); ta.select(); };
    document.getElementById("io-imp").onclick = function () {
      try {
        var obj = JSON.parse(ta.value);
        if (obj.records) { var l = getRecords(); obj.records.forEach(function (r) { if (!l.some(function (x) { return String(x.id) === String(r.id); })) l.push(r); }); saveStore("cet4_records", l); }
        if (obj.exams) { var e = examList(); obj.exams.forEach(function (x) { e.push(x); }); saveStore("cet4_exam", e); }
        document.getElementById("io-msg").innerHTML = '<div class="info">导入成功：作文/翻译记录 ' + getRecords().length + " 条，考试 " + examList().length + " 条。</div>";
      } catch (err) { document.getElementById("io-msg").innerHTML = '<div class="info warn">导入失败：' + esc(err.message) + "</div>"; }
    };
  }

  /* ---------- 背单词（百词斩式） ---------- */
  function renderStudyOld(body) {
    var words = bookWords(store("cet4_book", "cet4"));
    if (!words.length) { body.innerHTML = '<div class="info">当前词书为空，请到「词书」选择。</div>'; return; }
    var spell = store("cet4_spellmode", false);
    var order = shuffle(words.slice()).slice(0, 20);
    var idx = 0, ok = 0, no = 0, review = [];
    function draw() {
      if (idx >= order.length) {
        body.innerHTML = '<div class="card" style="text-align:center"><h2>本组完成 🎉</h2><p class="muted">认识 ' + ok + " · 不认识 " + no + "</p>" +
          '<div class="row" style="justify-content:center;margin-top:10px">' + (review.length ? '<button class="btn" id="st-review">复习不认识的（' + review.length + '）</button>' : "") +
          '<button class="btn ghost" id="st-next">再来一组</button></div></div>';
        var rv = document.getElementById("st-review");
        if (rv) rv.onclick = function () { order = review.slice(); idx = 0; ok = 0; no = 0; review = []; draw(); };
        document.getElementById("st-next").onclick = function () { renderStudy(body); };
        return;
      }
      var w = order[idx], mm = wmeta(w.w);
      body.innerHTML = '<div class="between"><span class="muted">背单词 · ' + (idx + 1) + " / " + order.length + " · 认识 " + ok + '</span>' +
        '<label class="muted" style="cursor:pointer"><input type="checkbox" id="st-spell" ' + (spell ? "checked" : "") + "> 边背边拼写</label></div>" +
        '<div class="progress"><i style="width:' + (idx / order.length * 100) + '%"></i></div>' +
        '<div class="flash" id="st-card"><div class="word">' + esc(w.w) + "</div>" + (w.p ? '<div class="phon">/' + esc(w.p) + "/</div>" : "") +
        '<div class="muted" style="font-size:12px;margin-top:8px">近5年×' + mm.f5 + " · 难度：" + (mm.d || "—") + "</div></div>" +
        '<div id="st-body"><button class="btn block" id="st-show">显示释义</button></div>';
      document.getElementById("st-spell").onchange = function () { saveStore("cet4_spellmode", this.checked); spell = this.checked; showMeaning(); };
      document.getElementById("st-show").onclick = showMeaning;
      document.getElementById("st-card").onclick = showMeaning;
      function showMeaning() {
        var ex = exampleOf(w.w);
        document.getElementById("st-body").innerHTML =
          '<div class="card"><div style="font-size:18px;line-height:1.6">' + esc(w.m) + "</div>" +
          (ex ? '<div class="muted" style="margin-top:8px">例：' + esc(ex) + "</div>" : "") +
          (spell ? '<input type="text" id="st-in" placeholder="拼写该单词…" autocomplete="off" autocapitalize="off" spellcheck="false" style="margin-top:10px">' : "") +
          '<div class="row" style="margin-top:12px"><button class="btn ghost" id="st-no" style="flex:1">不认识</button><button class="btn" id="st-yes" style="flex:1">认识</button></div></div>';
        document.getElementById("st-no").onclick = function () { assess(false); };
        document.getElementById("st-yes").onclick = function () {
          if (spell && document.getElementById("st-in").value.trim().toLowerCase() !== w.w.toLowerCase()) { toast("拼写不正确"); return; }
          assess(true);
        };
        if (spell) document.getElementById("st-in").focus();
      }
      function assess(known) {
        var log = getVocabLog();
        var d = todayKey(); log.days[d] = (log.days[d] || 0) + 1; log.total = (log.total || 0) + 1;
        log.learned[w.w] = known ? "k" : "u"; saveVocabLog(log);
        recordAnswer("vocab", known);
        if (known) ok++; else { no++; review.push(w); }
        idx++; draw();
      }
    }
    draw();
  }
  function renderVocabBook(body) {
    var cur = store("cet4_book", "cet4");
    var nosimple = store("cet4_nosimple", false);
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
    body.innerHTML = '<label class="info" style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="vt-nosimple" ' + (nosimple ? "checked" : "") + ' style="width:18px;height:18px"> 一键去除简单词（小学/初中词汇，仅对四级词书生效）</label>' +
      books.map(function (b) {
        return '<div class="list-item" data-book="' + b.k + '"><div class="ic" style="background:#3949AB1f;color:#3949AB">' + esc(b.t.charAt(0)) + "</div>" +
          "<div><h3>" + esc(b.t) + (b.k === cur ? " ✓" : "") + "</h3><p>" + bookWords(b.k).length + " 词" + (b.d ? " · " + b.d : "") + "</p></div>" +
          '<div class="arrow" style="margin-left:auto;color:#c3c6d4">›</div></div>';
      }).join("");
    document.getElementById("vt-nosimple").onchange = function () { saveStore("cet4_nosimple", this.checked); renderVocabBook(body); };
    body.querySelectorAll("[data-book]").forEach(function (el) {
      el.onclick = function () { saveStore("cet4_book", el.getAttribute("data-book")); toast("已选择词书，开始背吧"); document.getElementById("tab-study").click(); };
    });
  }
  function renderVocabTest(bodyOld) {
    var t = window.CET4_VTEST || { sizes: [], real: [], fake: [] };
    var items = t.real.map(function (w) { return { w: w.w, b: w.b, fake: false }; }).concat((t.fake || []).map(function (w) { return { w: w, b: -1, fake: true }; }));
    items = shuffle(items.slice());
    var checked = {};
    bodyOld.innerHTML = '<div class="page"><div class="section-title">单词量测试</div>' +
      '<div class="info">勾选你"认识"的单词（＝看到能说出大致中文意思）。**不确定请不要勾**——里面混有干扰项，用于校正虚报。共 ' + items.length + " 词。</div>" +
      items.map(function (it, i) {
        return '<label class="card" style="display:flex;align-items:center;gap:10px;cursor:pointer"><input type="checkbox" data-i="' + i + '" style="width:18px;height:18px"><b style="font-size:17px;color:var(--primary)">' + esc(it.w) + "</b></label>";
      }).join("") +
      '<button class="btn block" id="vt-go" style="margin-top:12px">估算词汇量</button><div id="vt-res"></div></div>';
    bodyOld.querySelectorAll("[data-i]").forEach(function (cb) { cb.onchange = function () { checked[cb.getAttribute("data-i")] = cb.checked; }; });
    document.getElementById("vt-go").onclick = function () {
      var sizes = t.sizes, per = {}, fakeN = 0, fakeK = 0;
      items.forEach(function (it, i) { if (it.fake) { fakeN++; if (checked[i]) fakeK++; } else { per[it.b] = per[it.b] || { k: 0, n: 0 }; per[it.b].n++; if (checked[i]) per[it.b].k++; } });
      var over = fakeN ? fakeK / fakeN : 0;
      var total = 0, detail = [];
      for (var b = 0; b < sizes.length; b++) { var pb = per[b] || { k: 0, n: 1 }; var frac = Math.max(0, pb.k / pb.n - over); total += frac * sizes[b]; detail.push(Math.round(frac * 100) + "%"); }
      total = Math.round(total / 500) * 500;
      var lv = total >= 9500 ? "优秀（可挑战六级/考研）" : total >= 6000 ? "良好（四级较稳）" : total >= 4000 ? "中等（四级需努力）" : "偏少（建议先猛攻词汇）";
      document.getElementById("vt-res").innerHTML = '<div class="card" style="margin-top:12px;text-align:center"><div class="muted">估算词汇量（已按假词误认率 ' + Math.round(over * 100) + "% 校正）</div>" +
        '<div style="font-size:40px;font-weight:800;color:var(--primary)">' + total + '</div><div>' + lv + '</div><div class="muted" style="margin-top:8px">各频段认识率：' + detail.join(" / ") + "</div></div>";
    };
  }

  /* ---------- 背单词（百词斩式：成组·递推·不即时判） ---------- */
  function speak(t) { try { var u = new SpeechSynthesisUtterance(t); u.lang = "en-US"; u.rate = 0.9; window.speechSynthesis.speak(u); } catch (e) { } }
  function distractors(excl, field, n, all) {
    var pool = all.filter(function (w) { return w.w !== excl.w; }), picked = [], used = {}, guard = 0;
    while (picked.length < n && guard++ < 400) { var x = pool[Math.floor(Math.random() * pool.length)]; if (!x) break; var k = field === "m" ? x.m : x.w; if (used[k]) continue; used[k] = 1; picked.push(x[field]); }
    return picked;
  }
  function renderStudy(body, preset) {
    var all = (preset && preset.length) ? preset : bookWords(store("cet4_book", "cet4"));
    if (!all || !all.length) { body.innerHTML = '<div class="info">当前词书为空，请到「词书」选择。</div>'; return; }
    var G = 5, K = Math.min(4, Math.ceil(all.length / G));
    var pool = shuffle(all.slice());
    var groups = []; for (var i = 0; i < K; i++) groups.push(pool.slice(i * G, (i + 1) * G));
    var spell = store("cet4_spellmode", false);
    var pass = {}; groups.forEach(function (g) { g.forEach(function (w) { pass[w.w] = { a: false, b: false, s: !spell }; }); });
    var sched = [];
    for (var i = 0; i < K; i++) { sched.push({ g: i, t: "learn" }); if (i > 0) sched.push({ g: i - 1, t: "zh2en" }); sched.push({ g: i, t: "en2zh" }); }
    if (K) sched.push({ g: K - 1, t: "zh2en" });
    if (spell) for (var i = 0; i < K; i++) sched.push({ g: i, t: "spell" });
    var si = 0;
    var head = '<label class="muted" style="cursor:pointer;display:block;margin-bottom:6px"><input type="checkbox" id="st-spell" ' + (spell ? "checked" : "") + "> 边背边拼写（加一轮拼写考察）</label>";
    function step() { if (si >= sched.length) { summary(); return; } var t = sched[si]; if (t.t === "learn") learn(t.g); else if (t.t === "en2zh") quiz(t.g, "en2zh"); else if (t.t === "zh2en") quiz(t.g, "zh2en"); else spellBatch(t.g); }
    function learn(g) {
      var words = groups[g], h = head + '<div class="between"><span class="muted">背新词 · 第' + (g + 1) + " 组</span></div>" +
        '<div class="info">先记住这 ' + words.length + " 个词，随后以英译汉/汉译英等形式考察。</div>";
      words.forEach(function (w) { var mm = wmeta(w.w), ex = exampleOf(w.w);
        h += '<div class="card"><div class="between"><b style="font-size:20px;color:var(--primary)">' + esc(w.w) + '</b><span class="muted">' + (w.p ? "/" + esc(w.p) + "/" : "") + "</span></div>" +
          '<div style="margin-top:6px;font-size:16px">' + esc(w.m) + "</div>" + (ex ? '<div class="muted" style="margin-top:6px">例：' + esc(ex) + "</div>" : "") + "</div>";
      });
      h += '<button class="btn block" id="learn-next">记住了，开始测验</button>';
      body.innerHTML = h;
      document.getElementById("st-spell").onchange = function () { saveStore("cet4_spellmode", this.checked); renderStudy(body, preset); };
      document.getElementById("learn-next").onclick = function () { si++; step(); };
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
      var allw = [].concat.apply([], groups);
      var mastered = allw.filter(function (w) { var p = pass[w.w]; return p.a && p.b && p.s; });
      var need = allw.filter(function (w) { var p = pass[w.w]; return !(p.a && p.b && p.s); });
      var log = getVocabLog(), d = todayKey();
      log.days[d] = (log.days[d] || 0) + allw.length; log.total = (log.total || 0) + allw.length;
      allw.forEach(function (w) { log.learned[w.w] = (pass[w.w].a && pass[w.w].b && pass[w.w].s) ? "k" : "u"; });
      saveVocabLog(log);
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
    currentView = name; window.scrollTo(0, 0);
    if (name === "home") renderHome();
    else if (name === "zhenti") renderZhentiList();
    else if (name === "plan") renderPlan();
    else if (name === "ocr") renderOcr();
    else if (name === "vocab") renderVocab();
    else if (name === "reading") renderReadingList();
    else if (name === "listening") renderListeningList();
    else if (name === "writing") renderWritingList();
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
    else if (name === "eztor") renderEztorList();
    else if (name === "links") renderLinks();
    else if (name === "yati") renderYatiList();
    else if (name === "report") renderReport();
  }
  document.getElementById("btn-home").onclick = function () { openView("home"); };
  document.getElementById("btn-settings").onclick = openSettings;
  var _dash = document.getElementById("btn-dash"); if (_dash) _dash.onclick = function () { openView("dash"); };
  var _theme = document.getElementById("btn-theme"); if (_theme) _theme.onclick = toggleTheme;
  applyTheme();
  openView("home");
  showWelcome();
})();
