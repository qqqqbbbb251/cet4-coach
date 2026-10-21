# -*- coding: utf-8 -*-
"""Fill missing reading passages from cached question PDFs (text layer).
Currently handles text-based PDFs: 2018-06-1/2/3, 2018-12-1.
Writes data/zhenti.js (backup -> data/zhenti.js.bak_passages)."""
import sys, re, json, os, shutil
sys.stdout.reconfigure(encoding="utf-8")
import pymupdf

WEB = r"C:\Users\24678\Documents\Default Project\cet4_web"
ZJ = os.path.join(WEB, "data", "zhenti.js")
CACHE = r"C:\dev\downloads\zhenti_cache"
TARGETS = ["2018-06-1", "2018-06-2", "2018-06-3", "2018-12-1"]


def cache_pid(pid):
    return pid[:7].replace("-", ".") + pid[7:]


def text_of(pid):
    b = open(os.path.join(CACHE, cache_pid(pid) + "_q.pdf"), "rb").read()
    doc = pymupdf.open(stream=b, filetype="pdf")
    return "".join(p.get_text() for p in doc)


def passage_between(seg, qn):
    qm = re.search(r"(?<![\d])" + str(qn) + r"\.\s*[A-Z(\"\u201c]", seg)
    if not qm:
        return ""
    before = seg[:qm.start()]
    idx = before.rfind("following passage.")
    if idx < 0:
        return ""
    p = before[idx + len("following passage."):]
    return re.sub(r"\s+", " ", p).strip()


s = open(ZJ, encoding="utf-8").read()
head, tail = s.split("=", 1)
Z = json.loads(tail.strip().rstrip(";"))
byid = {p.get("id"): p for p in Z}
shutil.copy2(ZJ, ZJ + ".bak_passages")

for pid in TARGETS:
    p = byid.get(pid)
    if not p:
        print("missing paper", pid); continue
    t = text_of(pid)
    ri = t.find("Reading Comprehension")
    sec = t.find("Section C", ri)
    seg = t[sec:] if sec >= 0 else t
    p46 = passage_between(seg, 46)
    p51 = passage_between(seg, 51)
    rp = p.setdefault("readingPassages", {})
    n = 0
    for qno in range(46, 51):
        if p46:
            rp[str(qno)] = p46; n += 1
    for qno in range(51, 56):
        if p51:
            rp[str(qno)] = p51; n += 1
    print("%s: passage46 len=%d, passage51 len=%d, filled %d" % (pid, len(p46), len(p51), n))

open(ZJ, "w", encoding="utf-8").write(head + "= " + json.dumps(Z, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("written", ZJ)
