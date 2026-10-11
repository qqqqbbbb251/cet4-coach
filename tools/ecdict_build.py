import os, csv, json, io, sys, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
CSV = r"C:\dev\downloads\ecdict.csv"
if not os.path.exists(CSV) or os.path.getsize(CSV) < 1000000:
    print("downloading ecdict.csv ...", flush=True)
    url = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
    data = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "x"}), timeout=600).read()
    open(CSV, "wb").write(data)
print("ecdict MB", round(os.path.getsize(CSV) / 1048576, 1))

words = json.load(open(r"C:\Users\24678\Documents\Default Project\cet4_coach\assets\data\words.json", encoding="utf-8"))
freq = json.load(open(r"C:\dev\downloads\corpus_freq.json", encoding="utf-8"))
c5, c10 = freq["c5"], freq["c10"]
want = set(w["w"].lower() for w in words)

meta = {}
with open(CSV, encoding="utf-8") as f:
    for row in csv.DictReader(f):
        w = (row.get("word") or "").strip().lower()
        if not w:
            continue
        # keep first (most common) entry only if not present
        if w in meta:
            continue
        def num(x):
            try:
                return int(x)
            except Exception:
                return 0
        bnc, frq = num(row.get("bnc")), num(row.get("frq"))
        collins = num(row.get("collins"))
        tag = (row.get("tag") or "")
        r = min([x for x in [bnc, frq, 999999] if x > 0] or [999999])
        if r <= 2500 or collins >= 4:
            d = "基础"
        elif r <= 6000:
            d = "中级"
        elif r <= 12000:
            d = "较难"
        else:
            d = "高阶"
        meta[w] = {"d": d, "collins": collins, "rank": r, "tag": tag}

out = {}
for w in words:
    k = w["w"].lower()
    m = meta.get(k, {"d": "高阶", "collins": 0, "rank": 999999, "tag": ""})
    out[w["w"]] = {"f5": c5.get(k, 0), "f10": c10.get(k, 0), "d": m["d"], "r": m["rank"]}

dst = r"C:\Users\24678\Documents\Default Project\cet4_web\data\wordmeta.js"
with open(dst, "w", encoding="utf-8") as f:
    f.write("window.CET4_WORDMETA = ")
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
from collections import Counter
print("words", len(out), "| diff dist", dict(Counter(v["d"] for v in out.values())))
print("matched in ecdict", sum(1 for v in out.values() if v["r"] < 999999))
print("size KB", round(os.path.getsize(dst) / 1024, 1))
