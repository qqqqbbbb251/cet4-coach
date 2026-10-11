# -*- coding: utf-8 -*-
import os, csv, json, re, sys
sys.stdout.reconfigure(encoding="utf-8")
WEB = r"C:\Users\24678\Documents\Default Project\cet4_web"
CSV = r"C:\dev\downloads\ecdict.csv"

def load_js(path):
    s = open(path, encoding="utf-8").read().split("=", 1)[1].strip().rstrip(";")
    return json.loads(s)

def clean_trans(t):
    if not t:
        return ""
    t = re.split(r"\\n|[\r\n]", t)[0]
    t = re.sub(r"\[[^\]]*\]", "", t)
    return t.strip()

D = load_js(WEB + r"\data\data.js")
V = load_js(WEB + r"\data\words_extra.js")

words = [w["w"] for w in D["words"]]
for k in V:
    words += [x["w"] for x in V[k]]
words += [x["word"] for x in D.get("vocabulary", [])]
uniq, seen = [], set()
for w in words:
    lw = w.lower()
    if lw not in seen:
        seen.add(lw); uniq.append(lw)
print("app unique words:", len(uniq))

E = {}
with open(CSV, encoding="utf-8") as f:
    for row in csv.DictReader(f):
        w = (row.get("word") or "").strip().lower()
        if not w or w in E:
            continue
        E[w] = {"p": (row.get("phonetic") or "").strip(), "m": clean_trans(row.get("translation") or "")}

filled = 0
for w in D["words"]:
    if not (w.get("p") or "").strip():
        e = E.get(w["w"].lower())
        if e and e["p"]:
            w["p"] = e["p"]; filled += 1
print("filled phonetics in DATA.words:", filled)
for k in V:
    for x in V[k]:
        if not (x.get("p") or "").strip():
            e = E.get(x["w"].lower())
            if e and e["p"]:
                x["p"] = e["p"]

open(WEB + r"\data\data.js", "w", encoding="utf-8").write("window.CET4_DATA = " + json.dumps(D, ensure_ascii=False, separators=(",", ":")) + ";\n")
open(WEB + r"\data\words_extra.js", "w", encoding="utf-8").write("window.CET4_EXTRA = " + json.dumps(V, ensure_ascii=False, separators=(",", ":")) + ";\n")

dic = {}
for w in uniq:
    e = E.get(w)
    if e and (e["p"] or e["m"]):
        dic[w] = [e["p"], e["m"]]
open(WEB + r"\data\dict.js", "w", encoding="utf-8").write("window.CET4_DICT = " + json.dumps(dic, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("dict entries:", len(dic), "| size KB:", round(os.path.getsize(WEB + r"\data\dict.js") / 1024, 1))
