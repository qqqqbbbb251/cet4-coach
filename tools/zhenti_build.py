import os, re, json, io, sys, urllib.request, urllib.parse
sys.stdout.reconfigure(encoding="utf-8")
tok = os.environ["GH_TOKEN"]
REPO = "0609x/CET46-Resources"


def api(p):
    r = urllib.request.Request("https://api.github.com" + p, headers={"User-Agent": "x", "Authorization": "Bearer " + tok})
    return json.load(urllib.request.urlopen(r, timeout=30))


def enc(p):
    return "/".join(urllib.parse.quote(s) for s in p.split("/"))


def ls(path):
    return api("/repos/%s/contents/%s" % (REPO, enc(path)))


def dl(url):
    url = urllib.parse.quote(url, safe=":/")
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "x"}), timeout=120).read()


from pypdf import PdfReader
def pdf_text(b):
    try:
        return "".join((p.extract_text() or "") for p in PdfReader(io.BytesIO(b)).pages)
    except Exception:
        return ""


def flat(s):
    return re.sub(r"[ \t]+", " ", s)


def parse_answers(a):
    res = {}
    for kw1, kw2 in [("Listening Comprehension", "Reading Comprehension"), ("Reading Comprehension", "Translation")]:
        seg = re.search(re.escape(kw1) + r"(.*?)" + re.escape(kw2), a, re.S)
        if not seg:
            continue
        nums, letters = [], []
        for ln in seg.group(1).splitlines():
            ln = ln.strip()
            if re.fullmatch(r"[\d\s]+", ln):
                nums += [int(x) for x in ln.split()]
            elif re.fullmatch(r"[A-Z\s]+", ln) and len(ln.replace(" ", "")) >= 3:
                letters += ln.split()
        if len(nums) == len(letters):
            res.update(dict(zip(nums, letters)))
    return res


def extract_qs(text, lo, hi, with_stem=True):
    marks = [(m.start(), int(m.group(1))) for m in re.finditer(r"(?<!\d)(\d{1,2})\.\s?", text) if lo <= int(m.group(1)) <= hi]
    marks.append((len(text), None))
    out = []
    for i in range(len(marks) - 1):
        seg = text[marks[i][0]:marks[i + 1][0]]
        n = marks[i][1]
        first = re.search(r"[A-D]\)", seg)
        stem = seg[:first.start()] if (with_stem and first) else ""
        stem = re.sub(r"^\s*\d{1,2}\.\s?", "", stem).strip(" .;")
        opts = re.findall(r"([A-D])\)\s*(.*?)(?=\s*[A-D]\)|$)", seg)
        d = {k: v.strip(" .;") for k, v in opts}
        if len(d) == 4:
            out.append({"n": n, "stem": stem, "options": [d["A"], d["B"], d["C"], d["D"]]})
    return out


def parse_paper(t, a):
    ans = parse_answers(a)
    p = {"answers": ans}
    mw = re.search(r"Part\s*I\b.*?Writing.*?Directions:\s*(.*?)\s*Part\s*II", t, re.S)
    p["writing"] = flat(mw.group(1)).strip() if mw else ""
    mr = re.search(r"Writing\s*参考[^：:]*[：:]\s*(.*?)\s*Part\s*(?:Ⅱ|II)\s*Listening", a, re.S)
    p["writing_ref"] = flat(mr.group(1)).strip() if mr else ""
    mt = re.search(r"Part\s*IV\b.*?Translation.*?\n(.*)$", t, re.S)
    src = flat(mt.group(1)).strip() if mt else ""
    src = re.sub(r"^Directions:.*?Sheet\s*2\.\s*", "", src, flags=re.S)
    p["translation"] = src
    mtr = re.search(r"Translation\s*参考译文[^：:]*[：:]\s*(.*)$", a, re.S)
    p["translation_ref"] = flat(mtr.group(1)).strip() if mtr else ""
    ml = re.search(r"Part\s*II\b.*?Listening Comprehension(.*?)\s*Part\s*III", t, re.S)
    if ml:
        lt = " ".join(l for l in ml.group(1).splitlines() if not l.strip().startswith("Directions") and not re.match(r"\s*(Section [ABC]|Questions? )", l))
        for q in extract_qs(flat(lt), 1, 25, with_stem=False):
            q["answer"] = ans.get(q["n"])
            p.setdefault("listening", []).append(q)
    mr = re.search(r"Part\s*III\b.*?Reading Comprehension(.*?)Part\s*IV", t, re.S)
    if mr:
        r = mr.group(1)
        secC = re.search(r"Section C(.*)$", r, re.S)
        if secC:
            for q in extract_qs(flat(secC.group(1)), 46, 55):
                q["answer"] = ans.get(q["n"])
                p.setdefault("reading_qs", []).append(q)
        secB = re.search(r"Section B(.*?)Section C", r, re.S)
        if secB:
            sb = flat(secB.group(1))
            st = []
            for m in re.finditer(r"(3[6-9]|4[0-5])\.\s*(.*?)(?=(?:3[6-9]|4[0-5])\.|$)", sb):
                n = int(m.group(1))
                st.append({"n": n, "stem": m.group(2).strip(" .;"), "answer": ans.get(n)})
            p["matching"] = st
    return p


def main():
    years = sorted([x["name"] for x in ls("四级真题") if x["type"] == "dir"])
    result = []
    for y in years:
        try:
            pdfs = ls("四级真题/%s/真题PDF" % y)
        except Exception:
            continue
        for f in pdfs:
            mm = re.match(r"cet4_(\d{4})_(\d{2})_(\d)\.pdf$", f["name"])
            if not mm:
                continue
            key = "%s.%s-%s" % (mm.group(1), mm.group(2), mm.group(3))
            ansname = "cet4_%s_%s_%s_ans.pdf" % (mm.group(1), mm.group(2), mm.group(3))
            try:
                t = pdf_text(dl(f["download_url"]))
                if len(t) < 2000:
                    print("%-12s SKIP(scan/empty %d)" % (key, len(t)))
                    continue
                ab = dl(ls("四级真题/%s/答案解析" % y).__class__ and [x for x in ls("四级真题/%s/答案解析" % y) if x["name"] == ansname][0]["download_url"])
                a = pdf_text(ab)
                p = parse_paper(t, a)
                p["id"] = key
                p["year"] = y
                result.append(p)
                print("%-12s OK listen=%d read=%d match=%d ans=%d" % (
                    key, len(p.get("listening", [])), len(p.get("reading_qs", [])),
                    len(p.get("matching", [])), len(p.get("answers", {}))))
            except Exception as e:
                print("%-12s ERR %s" % (key, e))
    with open(r"C:\dev\downloads\zhenti_raw.json", "w", encoding="utf-8") as fp:
        json.dump(result, fp, ensure_ascii=False)
    print("\nTOTAL parsed papers:", len(result))


main()
