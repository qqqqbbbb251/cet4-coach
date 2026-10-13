# -*- coding: utf-8 -*-
"""Rebuild DATA.listening questions into proper CET-4 style using DeepSeek.
Audio/transcript/segments unchanged; only 'questions' regenerated.
Counts: news=3, conversation=4, passage=4.
Usage:  set DEEPSEEK_API_KEY=sk-...  ;  python tools/rebuild_listening.py
Writes back data/data.js (backup -> data/data.js.bak_listening).
"""
import json, os, sys, time, urllib.request, re, shutil
sys.stdout.reconfigure(encoding="utf-8")
WEB = r"C:\Users\24678\Documents\Default Project\cet4_web"
DATA = os.path.join(WEB, "data", "data.js")
KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()
BASE = os.environ.get("DEEPSEEK_BASE", "https://api.deepseek.com")
MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-flash")
COUNT = {"news": 3, "conversation": 4, "passage": 4}

if not KEY:
    print("请先设置环境变量 DEEPSEEK_API_KEY=sk-..."); sys.exit(1)


def call(prompt):
    body = json.dumps({"model": MODEL, "messages": [
        {"role": "system", "content": "你是大学英语四级(CET-4)听力命题专家，只输出 JSON。"},
        {"role": "user", "content": prompt}], "temperature": 0.4, "stream": False}).encode("utf-8")
    req = urllib.request.Request(BASE.rstrip("/") + "/chat/completions", data=body,
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer " + KEY})
    with urllib.request.urlopen(req, timeout=120) as r:
        txt = json.loads(r.read().decode("utf-8"))
    return txt["choices"][0]["message"]["content"]


def make_prompt(it):
    typ = it.get("type", "passage")
    n = COUNT.get(typ, 4)
    tname = {"news": "短篇新闻", "conversation": "长对话", "passage": "听力短文"}.get(typ, "听力")
    return (
        "请严格依据下面这段四级听力原文，命制 %d 道四级风格的单项选择题（%s）。\n" % (n, tname) +
        "要求：\n"
        "- 题型合理分布：主旨大意、具体细节、数字/时间、推理判断、说话人目的或态度。\n"
        "- 每题 4 个选项，只有 1 个正确答案；干扰项要合理、有区分度，且不得整句照抄原文。\n"
        "- 题干用自然、简洁的英文，不要夹带原文引语。\n"
        "- 正确答案在 ABCD 上尽量均匀分布，不要总在 A。\n"
        "- 只输出 JSON：{\"questions\":[{\"stem\":\"英文题干\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"answer\":索引0到3,\"explanation\":\"中文解析，点出依据的原文句子\"}]}\n\n"
        "【听力原文】\n" + (it.get("transcript") or "")
    )


def parse_q(txt):
    m = re.search(r"\{[\s\S]*\}", txt)
    if not m:
        return None
    try:
        obj = json.loads(m.group(0))
    except Exception:
        return None
    qs = obj.get("questions")
    if not isinstance(qs, list) or not qs:
        return None
    out = []
    for q in qs:
        opts = q.get("options") or []
        if len(opts) != 4:
            continue
        a = q.get("answer", 0)
        if isinstance(a, str) and a[:1].upper() in "ABCD":
            a = "ABCD".index(a[:1].upper())
        try:
            a = int(a)
        except Exception:
            a = 0
        if a < 0 or a > 3:
            a = 0
        out.append({"stem": str(q.get("stem", "")).strip(), "options": [str(o).strip() for o in opts], "answer": a, "explanation": str(q.get("explanation", "")).strip()})
    return out or None


def main():
    s = open(DATA, encoding="utf-8").read()
    head, tail = s.split("=", 1)
    D = json.loads(tail.strip().rstrip(";"))
    shutil.copy2(DATA, DATA + ".bak_listening")
    lis = D["listening"]
    print("listening sets:", len(lis))
    okc = 0
    for i, it in enumerate(lis):
        typ = it.get("type", "passage"); want = COUNT.get(typ, 4)
        got = None
        for attempt in range(3):
            try:
                got = parse_q(call(make_prompt(it)))
                if got and len(got) >= 2:
                    break
            except Exception as e:
                print("  retry", it.get("id"), e)
                time.sleep(2)
        if not got:
            print("  FAIL", it.get("id"), "- keep original"); continue
        got = got[:want]
        for qi, q in enumerate(got):
            q["qno"] = qi + 1
            q["type"] = typ
            q["diff"] = it.get("diff", "")
        it["questions"] = got
        okc += 1
        print("  %s (%s) -> %d questions" % (it.get("id"), typ, len(got)))
        # 每套落盘，避免中断丢进度
        open(DATA, "w", encoding="utf-8").write(head + "= " + json.dumps(D, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print("done. rebuilt", okc, "/", len(lis))


main()
