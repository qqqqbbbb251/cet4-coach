import json, csv, re, os, sys
sys.stdout.reconfigure(encoding="utf-8")
WEB = r"C:\Users\24678\Documents\Default Project\cet4_web"
CSV = r"C:\dev\downloads\ecdict.csv"

rank = {}
with open(CSV, encoding="utf-8") as f:
    for row in csv.DictReader(f):
        w = (row.get("word") or "").strip().lower()
        if not w or w in rank:
            continue
        def n(x):
            try:
                return int(x)
            except Exception:
                return 0
        vals = [v for v in (n(row.get("bnc")), n(row.get("frq"))) if v > 0]
        rank[w] = min(vals) if vals else 0


def tier(avg):
    if avg <= 0:
        return "中级"
    if avg <= 2500:
        return "基础"
    if avg <= 6000:
        return "中级"
    if avg <= 12000:
        return "较难"
    return "高阶"


def qdiff(text):
    toks = re.findall(r"[a-z][a-z'-]+", (text or "").lower())
    rs = [rank[t] for t in toks if rank.get(t, 0) > 0]
    if not rs:
        return "中级"
    return tier(sum(rs) / len(rs))


def load(fn):
    s = open(os.path.join(WEB, "data", fn), encoding="utf-8").read()
    return json.loads(s.split("=", 1)[1].rstrip().rstrip(";"))


def save(fn, var, obj):
    open(os.path.join(WEB, "data", fn), "w", encoding="utf-8").write("window.%s = %s;\n" % (var, json.dumps(obj, ensure_ascii=False, separators=(",", ":"))))


# zhenti
zh = load("zhenti.js")
for p in zh:
    for q in p["questions"]:
        parts = [q.get("stem", "")] + (q.get("options") or [])
        t = q.get("type")
        if t == "reading":
            parts.append((p.get("readingPassages") or {}).get(str(q["qno"]), ""))
        elif t == "cloze":
            parts.append(p.get("clozePassage") or "")
        elif t == "match":
            parts.append(" ".join(x.get("text", "") for x in (p.get("matchParagraphs") or [])))
        q["diff"] = qdiff(" ".join(parts))
save("zhenti.js", "CET4_ZHENTI", zh)
print("zhenti diff done")

# eztor
ez = load("eztor.js")
for p in ez:
    for q in p["questions"]:
        parts = [q.get("stem", "")] + (q.get("options") or [])
        t = q.get("type")
        if t == "reading":
            parts.append((p.get("readingPassages") or {}).get(str(q["qno"]), ""))
        elif t == "cloze":
            parts.append(p.get("clozePassage") or "")
        elif t == "match":
            parts.append(" ".join(x.get("text", "") for x in (p.get("matchParagraphs") or [])))
        q["diff"] = qdiff(" ".join(parts))
save("eztor.js", "CET4_EZTOR", ez)
print("eztor diff done")

# main data (reading/listening)
d = load("data.js")
for s in d.get("reading", []):
    for q in s.get("questions", []):
        q["diff"] = qdiff(" ".join([q.get("stem", "")] + (q.get("options") or []) + [s.get("passage", "")]))
for s in d.get("listening", []):
    for q in s.get("questions", []):
        q["diff"] = qdiff(" ".join([q.get("stem", "")] + (q.get("options") or []) + [s.get("transcript", "")]))
save("data.js", "CET4_DATA", d)
print("data diff done")
from collections import Counter
c = Counter(q["diff"] for p in zh for q in p["questions"])
print("zhenti diff dist", dict(c))
