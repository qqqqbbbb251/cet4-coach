# -*- coding: utf-8 -*-
"""Build data/wordform.js: for each app word, English definition + inflected forms
(parsed from ECDICT 'exchange'). window.CET4_WORDFORM = { word: {d, f} }"""
import csv, json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
WEB = r"C:\Users\24678\Documents\Default Project\cet4_web"
CSV = r"C:\dev\downloads\ecdict.csv"

s = open(os.path.join(WEB, "data", "dict.js"), encoding="utf-8").read().split("=", 1)[1].strip().rstrip(";")
want = set(json.loads(s).keys())

LAB = [("p", "过去式"), ("d", "过去分词"), ("i", "现在分词"), ("3", "第三人称单数"),
       ("s", "复数"), ("r", "比较级"), ("t", "最高级")]

def clean_def(t):
    if not t:
        return ""
    t = re.split(r"\\n|[\r\n]", t)[0]
    t = t.strip()
    return t[:140]

out = {}
n = 0
with open(CSV, encoding="utf-8") as f:
    for row in csv.DictReader(f):
        w = (row.get("word") or "").strip().lower()
        if w not in want or w in out:
            continue
        n += 1
        ex = (row.get("exchange") or "")
        forms = []
        for part in ex.split("/"):
            if ":" not in part:
                continue
            k, v = part.split(":", 1)
            for code, label in LAB:
                if k == code and v:
                    forms.append("%s %s" % (label, v))
                    break
        entry = {}
        d = clean_def(row.get("definition"))
        if d:
            entry["d"] = d
        if forms:
            entry["f"] = "；".join(forms)
        if entry:
            out[w] = entry

open(os.path.join(WEB, "data", "wordform.js"), "w", encoding="utf-8").write(
    "window.CET4_WORDFORM = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("scanned rows", n, "entries", len(out), "size KB", round(os.path.getsize(os.path.join(WEB, "data", "wordform.js")) / 1024, 1))
print("sample:", json.dumps({k: out[k] for k in list(out)[:3]}, ensure_ascii=False))
