import re, json, sys
sys.stdout.reconfigure(encoding="utf-8")

t = open(r"C:\dev\downloads\q2024.txt", encoding="utf-8").read()
a = open(r"C:\dev\downloads\a2024.txt", encoding="utf-8").read()


def flat(s):
    return re.sub(r"[ \t]+", " ", s)


# ---------- answers ----------
def parse_answer_block(text, start_kw, end_kw):
    seg = re.search(re.escape(start_kw) + r"(.*?)" + re.escape(end_kw), text, re.S)
    if not seg:
        return {}
    lines = [l.strip() for l in seg.group(1).splitlines() if l.strip()]
    nums, letters, res = [], [], {}
    for ln in lines:
        if re.fullmatch(r"[\d\s]+", ln):
            nums += [int(x) for x in ln.split()]
        elif re.fullmatch(r"[A-Z\s]+", ln) and len(ln.replace(" ", "")) >= 3:
            letters += ln.split()
    if len(nums) == len(letters):
        for n, l in zip(nums, letters):
            res[n] = l
    return res


ans = {}
ans.update(parse_answer_block(a, "Listening Comprehension", "Reading Comprehension"))
ans_r = parse_answer_block(a, "Reading Comprehension", "Translation")
ans.update(ans_r)
print("answers:", len(ans), sorted(ans.items())[:5], "...")

# ---------- writing ----------
mw = re.search(r"Part\s*I\b.*?Writing.*?Directions:\s*(.*?)\s*Part\s*II", t, re.S)
writing = flat(mw.group(1)).strip() if mw else ""
print("\nWRITING:", writing[:200])

# ---------- translation ----------
mt = re.search(r"Part\s*IV\b.*?Translation.*?\n(.*)$", t, re.S)
trans_src = flat(mt.group(1)).strip() if mt else ""
print("\nTRANSLATION SRC:", trans_src[:160])

# reference translation from answers
mr = re.search(r"Translation\s*参考译文[：:]\s*(.*)$", a, re.S)
trans_ref = flat(mr.group(1)).strip() if mr else ""

# ---------- listening questions ----------
ml = re.search(r"Part\s*II\b.*?Listening Comprehension.*?(Section A.*?)\s*Part\s*III", t, re.S)
listen_txt = ml.group(1) if ml else ""
lines = [l for l in listen_txt.splitlines() if not l.strip().startswith("Directions")]
lines = [l for l in lines if not re.match(r"\s*(Section [ABC]|Questions? .*based on)", l)]
joined = flat(" ".join(lines))
marks = [(m.start(), int(m.group(1))) for m in re.finditer(r"(?<!\d)(\d{1,2})\.\s", joined)]
marks.append((len(joined), None))
lq = []
for i in range(len(marks) - 1):
    seg = joined[marks[i][0]:marks[i + 1][0]]
    n = marks[i][1]
    opts = re.findall(r"([A-D])\)\s*(.*?)(?=\s*[A-D]\)|$)", seg)
    d = {}
    for k, v in opts:
        d[k] = v.strip(" .;")
    if len(d) == 4:
        lq.append({"n": n, "options": [d["A"], d["B"], d["C"], d["D"]], "answer": ans.get(n)})
print("\nLISTENING qs:", len(lq))
for q in lq[:3]:
    print("  Q%s ans=%s" % (q["n"], q["answer"]), q["options"][0][:40], "|", q["options"][1][:40])

# ---------- reading ----------
mr = re.search(r"Part\s*III\b.*?Reading Comprehension(.*?)Part\s*IV", t, re.S)
read_txt = mr.group(1) if mr else ""
secB = re.search(r"Section B(.*?)Section C", read_txt, re.S)
statements = []
if secB:
    sb = flat(secB.group(1))
    for m in re.finditer(r"(?<!\d)(3[6-9]|4[0-5])\.\s*(.*?)(?=\s*(?:3[6-9]|4[0-5])\.\s|$)", sb):
        statements.append({"n": int(m.group(1)), "stem": m.group(2).strip(" .;"), "answer": ans.get(int(m.group(1)))})
print("\nMATCHING statements:", len(statements))
for s in statements[:2]:
    print("  %s) %s -> %s" % (s["n"], s["stem"][:60], s["answer"]))
