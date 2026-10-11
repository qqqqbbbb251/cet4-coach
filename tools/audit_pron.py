# -*- coding: utf-8 -*-
import json, re, sys, csv
sys.stdout.reconfigure(encoding="utf-8")
WEB = r"C:\Users\24678\Documents\Default Project\cet4_web"

def load_js(path, var):
    s = open(path, encoding="utf-8").read()
    s = s.split("=", 1)[1].strip().rstrip(";")
    return json.loads(s)

D = load_js(WEB + r"\data\data.js", "CET4_DATA")
V = load_js(WEB + r"\data\words_extra.js", "CET4_EXTRA")
T = load_js(WEB + r"\data\vocabtest.js", "CET4_VTEST")

def stat(name, objs, wkey, pkey):
    tot = len(objs); miss = [o[wkey] for o in objs if not (o.get(pkey) or "").strip()]
    print("%-14s total=%5d  missing_p=%5d (%.1f%%)" % (name, tot, len(miss), 100.0*len(miss)/max(1,tot)))
    return miss

words = D["words"]
print("DATA keys:", list(D.keys()))
print("vocabulary n:", len(D.get("vocabulary", [])))
if D.get("vocabulary"):
    print("  sample:", json.dumps(D["vocabulary"][0], ensure_ascii=False)[:200])
stat("DATA.words", words, "w", "p")
stat("vocabulary", D.get("vocabulary", []), "word", "phonetic")
for k in V:
    stat("extra:"+k, V[k], "w", "p")

# unique all words
allw = set(w["w"].lower() for w in words)
for k in V:
    allw |= set(x["w"].lower() for x in V[k])
for x in D.get("vocabulary", []):
    allw.add(x["word"].lower())
print("unique words (core+extra+vocab):", len(allw))

# ecdict coverage + phonetic availability
E = {}
with open(r"C:\dev\downloads\ecdict.csv", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        w = (row.get("word") or "").strip().lower()
        if not w or w in E:
            continue
        E[w] = (row.get("phonetic") or "").strip()
cov = sum(1 for w in allw if w in E)
covp = sum(1 for w in allw if E.get(w))
print("of unique words: in ECDICT=%d (%.1f%%), with phonetic=%d (%.1f%%)" % (cov, 100.0*cov/len(allw), covp, 100.0*covp/len(allw)))
