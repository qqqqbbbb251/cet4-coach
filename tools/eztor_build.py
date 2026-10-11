import json, re, urllib.request, urllib.parse, os, sys
sys.stdout.reconfigure(encoding="utf-8")
def enc(p):
    return "/".join(urllib.parse.quote(s) for s in p.split("/"))
def raw(repo, path, br="main"):
    for b in (br, "master"):
        try:
            u = "https://raw.githubusercontent.com/%s/%s/%s" % (repo, b, enc(path))
            return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "x"}), timeout=60).read().decode("utf-8", "replace")
        except Exception:
            continue

def L(i):
    return chr(65 + i)

def build(sid):
    p = json.loads(raw("Bailipa/eztor-cet-content", "content/%s/paper.json" % sid))
    c = p["content"]
    pas = {x["id"]: x["text"] for x in c["READING"]["passages"]}
    bank_txt = ""
    paras = []
    detail = {}
    for x in c["READING"]["passages"]:
        if x["id"].endswith("-bank"):
            bank_txt = x["text"]
        elif x["id"].endswith("-matching"):
            parts = re.split(r"(?=(?:[A-O])\))", x["text"])
            for pt in parts[1:]:
                m = re.match(r"([A-O])\)\s*(.*)", pt, re.S)
                if m:
                    paras.append({"label": m.group(1), "text": m.group(2).strip()})
        else:
            detail[x["id"]] = x["text"]
    questions = []
    bank = None
    for q in c["READING"]["questions"]:
        t = q["type"]
        ans = L(q.get("answerIndex", 0))
        if t == "WORD_BANK":
            if bank is None:
                bank = [(L(i) + ") " + w) for i, w in enumerate(q["choices"])]
            questions.append({"type": "cloze", "qno": int(re.sub(r"\D", "", q["id"].split("-")[-1])), "stem": "", "options": bank, "answer": ans, "exp": q.get("explanation", ""), "kw": []})
        elif t == "MATCHING":
            questions.append({"type": "match", "qno": int(re.sub(r"\D", "", q["id"].split("-")[-1])), "stem": q["prompt"], "options": none_or(q["choices"]), "answer": ans, "exp": q.get("explanation", ""), "kw": []})
        else:
            qn = int(re.sub(r"\D", "", q["id"].split("-")[-1]))
            questions.append({"type": "reading", "qno": qn, "stem": q["prompt"], "options": [L(i) + ") " + o for i, o in enumerate(q["choices"])], "answer": ans, "exp": q.get("explanation", ""), "kw": []})
    for q in c["LISTENING"]["questions"]:
        qn = int(re.sub(r"\D", "", q["id"].split("-")[-1]))
        questions.append({"type": "listening", "qno": qn, "stem": "", "options": [L(i) + ") " + o for i, o in enumerate(q["choices"])], "answer": L(q.get("answerIndex", 0)), "exp": q.get("explanation", ""), "kw": []})
    # readingPassages map qno->text
    rp = {}
    for q in c["READING"]["questions"]:
        if q["type"] == "DETAIL":
            qn = int(re.sub(r"\D", "", q["id"].split("-")[-1]))
            rp[str(qn)] = detail.get(q.get("passageId"), "")
    title = c.get("matchIntro") or ""
    return {
        "id": sid, "source": p["title"], "questions": questions,
        "writing": {"prompt": c["WRITING"].get("prompt", ""), "sample": c["WRITING"].get("reference", "")},
        "translation": {"prompt": c["TRANSLATION"].get("prompt", ""), "sample": c["TRANSLATION"].get("reference", "")},
        "clozePassage": bank_txt, "matchIntro": paras[0]["text"][:40] if paras else "", "matchParagraphs": paras,
        "readingPassages": rp,
    }

def none_or(x):
    return x if x else []

out = []
for sid in ["cet4-original-001", "cet4-original-002"]:
    try:
        out.append(build(sid))
        print(sid, "ok q=", len(out[-1]["questions"]))
    except Exception as e:
        print(sid, "ERR", e)

dst = r"C:\Users\24678\Documents\Default Project\cet4_web\data\eztor.js"
open(dst, "w", encoding="utf-8").write("window.CET4_EZTOR = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("eztor.js KB", round(os.path.getsize(dst) / 1024, 1))
