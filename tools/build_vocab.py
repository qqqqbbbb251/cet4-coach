import csv, json, os, re, random, sys
sys.stdout.reconfigure(encoding="utf-8")
WEB = r"C:\Users\24678\Documents\Default Project\cet4_web"
CSV = r"C:\dev\downloads\ecdict.csv"
random.seed(42)

# load ecdict (first occurrence per word)
E = {}
with open(CSV, encoding="utf-8") as f:
    for row in csv.DictReader(f):
        w = (row.get("word") or "").strip().lower()
        if not w or not re.fullmatch(r"[a-z][a-z'-]+", w):
            continue
        if w in E:
            continue
        def n(x):
            try:
                return int(x)
            except Exception:
                return 0
        vals = [v for v in (n(row.get("bnc")), n(row.get("frq"))) if v > 0]
        E[w] = {
            "phon": (row.get("phonetic") or "").strip(),
            "trans": (row.get("translation") or "").strip(),
            "tag": (row.get("tag") or "").strip(),
            "rank": min(vals) if vals else 999999,
        }
print("ecdict words", len(E))

LEVELS = ["zk", "gk", "cet4", "cet6", "ky", "toefl", "ielts", "gre"]
def lvlist(tag):
    return [x for x in LEVELS if x in tag.split()]

def clean_m(t):
    if not t:
        return ""
    return t.split("\n")[0].strip()[:80]

# 1) update wordmeta with lv
wordmeta = json.loads(open(os.path.join(WEB, "data", "wordmeta.js"), encoding="utf-8").read().split("=", 1)[1].rstrip().rstrip(";"))
for w, v in wordmeta.items():
    e = E.get(w.lower())
    v["lv"] = lvlist(e["tag"]) if e else []
open(os.path.join(WEB, "data", "wordmeta.js"), "w", encoding="utf-8").write("window.CET4_WORDMETA = " + json.dumps(wordmeta, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("wordmeta lv done")

# 2) extra books from tags
def by_level(tagcode, exclude=None, cap=2500):
    out = []
    for w, e in E.items():
        if tagcode in e["tag"].split() and (exclude is None or exclude not in e["tag"].split()):
            if e["trans"]:
                out.append((e["rank"], w, e))
    out.sort()
    res = []
    for r, w, e in out[:cap]:
        res.append({"w": w, "p": e["phon"], "m": clean_m(e["trans"])})
    return res

extra = {
    "cet6": by_level("cet6", exclude="cet4"),
    "ky": by_level("ky", exclude="cet4"),
    "gk": by_level("gk"),
    "zk": by_level("zk"),
    "toefl": by_level("toefl", exclude="cet6", cap=1500),
}
for k in extra:
    print("book", k, len(extra[k]))
open(os.path.join(WEB, "data", "words_extra.js"), "w", encoding="utf-8").write("window.CET4_EXTRA = " + json.dumps(extra, ensure_ascii=False, separators=(",", ":")) + ";\n")

# 3) vocabulary-size test set: sample across rank bands
bands = [(1, 1000), (1001, 2000), (2001, 4000), (4001, 8000), (8001, 15000), (15001, 40000)]
test = []
for bi, (lo, hi) in enumerate(bands):
    pool = [w for w, e in E.items() if lo <= e["rank"] <= hi and e["trans"] and len(w) >= 3]
    random.shuffle(pool)
    picked = 0
    for w in pool:
        test.append({"w": w, "m": clean_m(E[w]["trans"]), "b": bi})
        picked += 1
        if picked >= 16:
            break
print("vocabtest words", len(test))
open(os.path.join(WEB, "data", "vocabtest.js"), "w", encoding="utf-8").write("window.CET4_VTEST = " + json.dumps({"bands": [1000, 1000, 2000, 4000, 7000, 25000], "words": test}, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("done")
