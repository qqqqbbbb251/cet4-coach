import json, re, os, sys, collections
sys.stdout.reconfigure(encoding="utf-8")
WEB = r"C:\Users\24678\Documents\Default Project\cet4_web"
papers = json.load(open(r"C:\dev\downloads\zhenti_gy.json", encoding="utf-8"))
words = set()
wm = json.loads(open(os.path.join(WEB, "data", "wordmeta.js"), encoding="utf-8").read().split("=", 1)[1].rstrip().rstrip(";"))
for w in wm: words.add(w.lower())

STOP = set("a an the of to in on at for and or but with by from as is are was were be been being it its this that these those he she they we you i his her their our your my me him them us do does did not no so if then than into out up down over under about after before during while when where which who whom whose what how can could will would shall should may might must have has had more most very also such other another any some each both few many much own same too only just".split())

bigram = collections.Counter()
trigram = collections.Counter()
def toks(t):
    return re.findall(r"[a-z][a-z'-]+", (t or "").lower())

for p in papers:
    if not p.get("questions"): continue
    text = []
    for q in p["questions"]:
        text.append(q.get("stem") or ""); text += (q.get("options") or [])
    text.append(p.get("clozePassage") or "")
    for x in p.get("matchParagraphs") or []: text.append(x.get("text", ""))
    for k, v in (p.get("readingPassages") or {}).items(): text.append(v or "")
    if p.get("writing"): text.append((p["writing"] or {}).get("sample") or "")
    if p.get("translation"): text.append((p["translation"] or {}).get("sample") or "")
    ts = toks(" ".join(text))
    for i in range(len(ts) - 1):
        bigram[(ts[i], ts[i+1])] += 1
    for i in range(len(ts) - 2):
        trigram[(ts[i], ts[i+1], ts[i+2])] += 1

# for each target word, pick top phrases containing it
out = {}
for w in words:
    cand = []
    for (a, b), c in bigram.items():
        if c < 3: continue
        if a == w and b not in STOP: cand.append((c, a + " " + b))
        elif b == w and a not in STOP: cand.append((c, a + " " + b))
    for (a, b, cc), c in trigram.items():
        if c < 3: continue
        if w in (a, b, cc): cand.append((c + 1, a + " " + b + " " + cc))
    cand.sort(reverse=True)
    picked = []
    for c, ph in cand:
        if any(ph in x or x in ph for x in picked): continue
        picked.append(ph)
        if len(picked) >= 3: break
    if picked:
        out[w] = picked

dst = os.path.join(WEB, "data", "wordcolloc.js")
open(dst, "w", encoding="utf-8").write("window.CET4_COLLOC = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("words with collocations", len(out), "| size KB", round(os.path.getsize(dst)/1024, 1))
for w in ["take", "make", "play", "pay", "have"]:
    print(w, "->", out.get(w))
