import json, re, os

src = r"C:\dev\downloads\CET4_raw.txt"
dst = r"C:\Users\24678\Documents\Default Project\cet4_coach\assets\data\words.json"

with open(src, "r", encoding="utf-8") as f:
    lines = f.read().splitlines()

words = []
pat = re.compile(r"^([A-Za-z][A-Za-z\-'\. ]*?)\s*(?:\[([^\]]*)\])?\s+(.+)$")
for ln in lines:
    ln = ln.strip()
    if not ln:
        continue
    if len(ln) <= 2 and ln.isalpha():
        continue
    if "\u4e2d" in ln and len(ln) < 8:
        continue
    m = pat.match(ln)
    if not m:
        continue
    word = m.group(1).strip()
    phon = (m.group(2) or "").strip()
    mean = m.group(3).strip()
    if not word or not mean:
        continue
    if not re.search(r"[\u4e00-\u9fff]", mean):
        continue
    words.append({"w": word, "p": phon, "m": mean})

seen = set()
uniq = []
for w in words:
    k = w["w"].lower()
    if k in seen:
        continue
    seen.add(k)
    uniq.append(w)

with open(dst, "w", encoding="utf-8") as f:
    json.dump(uniq, f, ensure_ascii=False, separators=(",", ":"))

print("parsed words:", len(words), "unique:", len(uniq))
print("sample:", json.dumps(uniq[:3], ensure_ascii=False))
print("size KB:", round(os.path.getsize(dst) / 1024, 1))
