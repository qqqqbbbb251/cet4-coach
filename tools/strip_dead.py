import re, shutil

p = r"C:\Users\24678\Documents\Default Project\cet4_web\app.js"
src = open(p, encoding="utf-8", newline="").read()
orig_len = len(src)

names = ["renderHomeOld", "renderFlash", "renderVocabBookOld", "renderPlanOld",
         "renderDashboardOld", "renderWrongQuizOld", "renderStudyOld"]

for name in names:
    m = re.search(r'^[ \t]*function ' + name + r'\s*\(', src, re.M)
    assert m, "not found: " + name
    start = m.start()
    b = src.index('{', m.end())
    depth = 0
    i = b
    while True:
        c = src[i]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                break
        i += 1
    end = i + 1
    while end < len(src) and src[end] in ' \t':
        end += 1
    if end < len(src) and src[end] == '\r':
        end += 1
    if end < len(src) and src[end] == '\n':
        end += 1
    src = src[:start] + src[end:]

src = re.sub(r'\r?\n{3,}', '\r\n' if '\r\n' in src else '\n', src)
open(p, "w", encoding="utf-8", newline="").write(src)
print("removed", orig_len - len(src), "bytes")
