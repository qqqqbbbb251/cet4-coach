# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding="utf-8")
p = r"C:\Users\24678\Documents\Default Project\cet4_web\app.js"
s = open(p, encoding="utf-8").read()

new = r'''    function run(mode) {
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
        var say = document.getElementById("vt-say"); if (say) say.onclick = function () { speak(x.w); };
        if (it.type === "listening") speak(x.w);
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
'''

start = s.index("    function run(mode) {")
end = s.index("    home();", start)
s2 = s[:start] + new + "\n" + s[end:]
open(p, "w", encoding="utf-8", newline="").write(s2)
print("spliced ok; delta bytes", len(s2) - len(s))
