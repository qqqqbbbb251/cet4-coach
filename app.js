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
  function applyTheme() { document.body.classList.toggle("dark", store("cet4_theme", "light") === "dark"); }
  function toggleTheme() { var t = store("cet4_theme", "light"); saveStore("cet4_theme", t === "dark" ? "light" : "dark"); applyTheme(); }
  function A2I(a) { return a ? String(a).toUpperCase().charCodeAt(0) - 65 : -1; }
  function stripA(o) { return String(o).replace(/^[A-Za-z]\)\s*/, ""); }  var LISTEN_LABEL = { news: "新闻", conversation: "对话", passage: "短文" };

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
      '<div class="stem">' + (qi + 1) + ". " + esc(q.stem) + "</div>";
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
  function renderHome() {
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
      { key: "fav", t: "生词本", d: "收藏的重点词汇", ic: "★", c: "#C8860A" }
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
      '<button id="tab-card" class="active">单词卡</button>' +
      '<button id="tab-quiz">词义测验</button>' +
      '<button id="tab-vip">重点词汇</button></div><div id="vocab-body"></div></div>';
    var body = document.getElementById("vocab-body");
    document.getElementById("tab-card").onclick = function () { setTab(this); renderFlash(body); };
    document.getElementById("tab-quiz").onclick = function () { setTab(this); renderQuiz(body); };
    document.getElementById("tab-vip").onclick = function () { setTab(this); renderVipVocab(body); };
    renderFlash(body);
  }
  function setTab(btn) { btn.parentNode.querySelectorAll("button").forEach(function (b) { b.classList.remove("active"); }); btn.classList.add("active"); }
  function renderFlash(body) {
    var words = DATA.words, idx = Math.floor(Math.random() * words.length), revealed = false;
    function draw() {
      var w = words[idx];
      body.innerHTML =
        '<div class="progress"><i style="width:' + ((idx + 1) / words.length * 100).toFixed(1) + '%"></i></div>' +
        '<div class="between" style="margin:6px 0"><span class="muted">' + (idx + 1) + " / " + words.length + '</span><button class="star' + (getFav()[w.w] != null ? " on" : "") + '" id="fav-btn">★</button></div>' +
        '<div class="flash" id="flash-card"><div class="word">' + esc(w.w) + "</div>" +
        (w.p ? '<div class="phon">/' + esc(w.p) + "/</div>" : "") +
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
    var words = DATA.words, target, options, selected = null, score = 0, total = 0;
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
        .then(function (md) { res.innerHTML = '<div class="ai-result" style="margin-top:16px">' + mdToHtml(md) + "</div>"; })
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
        .then(function (md) { res.innerHTML = '<div class="ai-result" style="margin-top:16px">' + mdToHtml(md) + "</div>"; })
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

  function renderZhentiDetail(p, focus) {
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
      var h = '<div class="zq" data-kind="mcq" data-ans="' + l2i(q.answer) + '" data-ansl="' + esc(q.answer) + '" data-qno="' + q.qno + '" data-type="' + esc(q.type) + '" data-stem="' + esc(q.stem || "") + '" data-opts="' + esc(JSON.stringify(opts)) + '" data-exp="' + esc(q.exp || "") + '" data-kw="' + esc(JSON.stringify(q.kw || [])) + '"><div class="stem">' + q.qno + ". " + esc(q.stem) + "</div>";
      (q.options || []).forEach(function (o, oi) {
        h += '<div class="opt" data-oi="' + oi + '"><span class="k">' + String.fromCharCode(65 + oi) + '.</span><span>' + esc(strip(o)) + "</span></div>";
      });
      return h + "</div>";
    }
    function selQ(q, opts, isCloze) {
      var stem = isCloze ? ("第 " + q.qno + " 空") : q.stem;
      var h = '<div class="zq" data-kind="sel" data-ans="' + esc(q.answer) + '" data-ansl="' + esc(q.answer) + '" data-qno="' + q.qno + '" data-type="' + esc(q.type) + '" data-stem="' + esc(stem || "") + '" data-opts="' + esc(JSON.stringify(opts.map(function (x) { return x.t; }))) + '" data-exp="' + esc(q.exp || "") + '" data-kw="' + esc(JSON.stringify(q.kw || [])) + '"><div class="stem">' + q.qno + ". " + esc(stem) + "</div>";
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
      html += '<div class="card section-card"><h2>Part II　听力（' + listening.length + ' 题）</h2>';
      if (p.listeningUrl) html += '<div class="info">🎧 在线收听本套听力（含时间轴）：<a href="' + esc(p.listeningUrl) + '" target="_blank" rel="noopener">点击打开</a></div>';
      listening.forEach(function (q) { html += mcq(q); });
      html += "</div>";
    }
    if (showReading && cloze.length) {
      html += '<div class="card section-card"><h2>Part III-A　选词填空</h2><div class="passage">' + esc(p.clozePassage) + "</div>" +
        '<div class="info">词库：' + bank.map(function (o) { return esc(o); }).join("　") + "</div>";
      var bankOpts = bank.map(function (o) { return { v: o.charAt(0).toUpperCase(), t: o }; });
      cloze.forEach(function (q) { html += selQ(q, bankOpts, true); });
      html += "</div>";
    }
    if (showReading && match.length) {
      html += '<div class="card section-card"><h2>Part III-B　信息匹配</h2><div class="stem" style="font-weight:600;margin-bottom:6px">' + esc(p.matchIntro || "") + "</div>";
      (p.matchParagraphs || []).forEach(function (x) { html += '<div class="passage" style="margin:8px 0"><b>' + esc(x.label) + ") </b>" + esc(x.text) + "</div>"; });
      var labelOpts = labels.map(function (l) { return { v: l, t: l }; });
      match.forEach(function (q) { html += selQ(q, labelOpts, false); });
      html += "</div>";
    }
    if (showReading && reading.length) {
      html += '<div class="card section-card"><h2>Part III-C　仔细阅读</h2>';
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
    var backTarget = focus === "listening" ? renderListeningList : focus === "reading" ? renderReadingList : focus === "translation" ? renderTranslationList : focus === "writing" ? renderWritingList : renderZhentiList;
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
      var c = 0, t = 0;
      main.querySelectorAll(".section-card").forEach(function (card) {
        var r = gradeCard(card);
        c += r[0]; t += r[1];
        var bar = document.createElement("div");
        bar.className = "score-bar";
        bar.textContent = "本部分得分：" + r[0] + " / " + r[1];
        card.insertBefore(bar, card.firstChild);
      });
      document.getElementById("z-score").innerHTML = '<div class="info" style="margin-top:10px">客观题总计：<b>' + c + " / " + t + "</b>（每题下方已给出答案与解析）</div>";
      main.dataset.zgraded = "1";
      submit.textContent = "重做";
    };

    if (showWriting && p.writing) {
      document.getElementById("z-wr-sample").onclick = function () {
        var b = document.getElementById("z-wr-samplebox"); var show = b.style.display === "none";
        b.style.display = show ? "block" : "none"; b.innerHTML = '<div class="ai-result">' + esc(p.writing.sample || "").replace(/\n/g, "<br>") + "</div>";
      };
      document.getElementById("z-wr-grade").onclick = function () {
        var ta = document.getElementById("z-wr");
        if (ta.value.trim().length < 20) { toast("作文太短"); return; }
        aiRun(this, document.getElementById("z-wr-res"), function () { return gradeEssay(p.writing.prompt, ta.value.trim()); });
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
        aiRun(this, document.getElementById("z-tr-res"), function () { return gradeTranslation(p.translation.prompt, p.translation.sample, ta.value.trim()); });
      };
    }
  }

  function aiRun(btn, res, fn) {
    if (!configured()) { toast("请先在设置中配置 DeepSeek API Key"); return; }
    var old = btn.textContent; btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 批改中…';
    res.innerHTML = "";
    fn().then(function (md) { res.innerHTML = '<div class="ai-result" style="margin-top:12px">' + mdToHtml(md) + "</div>"; })
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
  function renderPlan() {
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
  function renderDashboard() {
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
      '<div class="row" style="margin-top:16px"><button class="btn ghost block" id="set-close">关闭</button></div></div>';
    document.body.appendChild(mask);
    function close() { document.body.removeChild(mask); }
    mask.onclick = function (e) { if (e.target === mask) close(); };
    document.getElementById("set-close").onclick = close;
    document.getElementById("set-save").onclick = function () {
      setSettings({ apiKey: document.getElementById("set-key").value.trim(), baseUrl: document.getElementById("set-base").value.trim() || DEFAULTS.baseUrl, model: document.getElementById("set-model").value.trim() || DEFAULTS.model });
      toast("已保存"); close(); openView(currentView);
    };
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
    else if (name === "wrong") renderWrongBook();
    else if (name === "fav") renderFavList();
  }
  document.getElementById("btn-home").onclick = function () { openView("home"); };
  document.getElementById("btn-settings").onclick = openSettings;
  var _dash = document.getElementById("btn-dash"); if (_dash) _dash.onclick = function () { openView("dash"); };
  var _theme = document.getElementById("btn-theme"); if (_theme) _theme.onclick = toggleTheme;
  applyTheme();
  openView("home");
})();
