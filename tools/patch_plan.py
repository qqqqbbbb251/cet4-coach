# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding="utf-8")
p = r"C:\Users\24678\Documents\Default Project\cet4_web\app.js"
s = open(p, encoding="utf-8", newline="").read()

start_marker = '  var EXAM_DATE = "2026-12-12";'
end_marker = '  /* ---------- 仪表盘（练习/考试分开 · 710 分制） ---------- */'
i = s.index(start_marker)
j = s.index(end_marker, i)

new = r'''  /* ---------- 学习计划（当日问卷 → AI 贴身计划 → 立即同步云端） ---------- */
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
    var typeNames = { listening: "听力", cloze: "选词填空", match: "信息匹配", reading: "仔细阅读", review: "错题复习", spell: "拼写", obj: "练习" };
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

'''

s2 = s[:i] + new + s[j:]
open(p, "w", encoding="utf-8", newline="").write(s2)
print("plan module replaced; delta", len(s2) - len(s))
