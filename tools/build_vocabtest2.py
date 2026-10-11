# -*- coding: utf-8 -*-
import os, csv, json, re, sys, random
sys.stdout.reconfigure(encoding="utf-8")
WEB = r"C:\Users\24678\Documents\Default Project\cet4_web"
CSV = r"C:\dev\downloads\ecdict.csv"
random.seed(20241212)

def clean_trans(t):
    if not t:
        return ""
    t = re.split(r"\\n|[\r\n]", t)[0]
    t = re.sub(r"\[[^\]]*\]", "", t)
    return t.strip()

E = {}
with open(CSV, encoding="utf-8") as f:
    for row in csv.DictReader(f):
        w = (row.get("word") or "").strip().lower()
        if not w or w in E:
            continue
        def num(x):
            try:
                return int(x)
            except Exception:
                return 0
        vals = [v for v in (num(row.get("bnc")), num(row.get("frq"))) if v > 0]
        E[w] = {"p": (row.get("phonetic") or "").strip(),
                "m": clean_trans(row.get("translation") or ""),
                "r": min(vals) if vals else 0}
print("ecdict words:", len(E))

BANDS = [(1, 1000), (1001, 2000), (2001, 4000), (4001, 8000), (8001, 15000), (15001, 20000)]

bands, pool = [], []
for bi, (lo, hi) in enumerate(BANDS):
    cand = [w for w, e in E.items()
            if lo <= e["r"] <= hi and e["m"] and e["p"] and re.fullmatch(r"[a-z]{3,12}", w)]
    bands.append({"lo": lo, "hi": hi, "size": len(cand)})
    random.shuffle(cand)
    picked, usedm = [], set()
    for w in cand:
        key = E[w]["m"].lower()[:16]
        if key in usedm:
            continue
        usedm.add(key)
        picked.append({"w": w, "m": E[w]["m"], "p": E[w]["p"], "b": bi})
        if len(picked) >= 18:
            break
    pool += picked
    print("band %d [%d-%d] pop=%d sampled=%d" % (bi, lo, hi, bands[-1]["size"], len(picked)))

open(WEB + r"\data\vocabtest.js", "w", encoding="utf-8").write(
    "window.CET4_VTEST = " + json.dumps({"bands": bands, "pool": pool}, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("pool total:", len(pool), "| size KB:", round(os.path.getsize(WEB + r"\data\vocabtest.js") / 1024, 1))
print("example:", json.dumps(pool[0], ensure_ascii=False))
print("band sizes:", [b["size"] for b in bands], "sum=", sum(b["size"] for b in bands))
