import os, json, urllib.request, urllib.parse, subprocess, sys, re
sys.stdout.reconfigure(encoding="utf-8")
tok = os.environ["GH_TOKEN"]
FF = r"C:\dev\downloads\ffmpeg\ffmpeg-master-latest-win64-gpl\bin\ffmpeg.exe"
REPO = "Gatsby666-jay/CET-Practice"
WEB = r"C:\Users\24678\Documents\Default Project\cet4_web"
SRC = r"C:\dev\downloads\papers_src"
os.makedirs(SRC, exist_ok=True)
os.makedirs(os.path.join(WEB, "papers"), exist_ok=True)
os.makedirs(os.path.join(WEB, "paudio"), exist_ok=True)


def api(p):
    r = urllib.request.Request("https://api.github.com" + p, headers={"User-Agent": "x", "Authorization": "Bearer " + tok})
    return json.load(urllib.request.urlopen(r, timeout=30))


def enc(p):
    return "/".join(urllib.parse.quote(s) for s in p.split("/"))


def ls(path):
    return api("/repos/%s/contents/%s" % (REPO, enc(path)))


def dl(url, name):
    fp = os.path.join(SRC, name)
    if os.path.exists(fp) and os.path.getsize(fp) > 1000:
        return fp
    u = urllib.parse.quote(url, safe=":/")
    data = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "x"}), timeout=600).read()
    open(fp, "wb").write(data)
    return fp


CN = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6}
papers = []

# --- 押题卷 6 套 ---
d1 = "12月四六级绝密押题卷（6套）/大学英语四级考试押题卷及解析（含6套）"
files = ls(d1)
pdf = [f for f in files if f["name"].endswith(".pdf") and "四级绝密押题试卷及解析" in f["name"]][0]
dl(pdf["download_url"], "yati.pdf")
import shutil
shutil.copy2(os.path.join(SRC, "yati.pdf"), os.path.join(WEB, "papers", "yati4.pdf"))
mp3s = [f for f in files if f["name"].lower().endswith(".mp3")]
def cnum(n):
    for k, v in CN.items():
        if k in n:
            return v
    return 99
mp3s.sort(key=lambda f: cnum(f["name"]))
for i, f in enumerate(mp3s, 1):
    src = dl(f["download_url"], "yati-%d.mp3" % i)
    subprocess.run([FF, "-y", "-hide_banner", "-loglevel", "error", "-i", src, "-ac", "1", "-ar", "22050", "-b:a", "24k", os.path.join(WEB, "paudio", "yati-%d.mp3" % i)])
    papers.append({"id": "yati-%d" % i, "title": "四级绝密押题卷 第%d套" % i, "pdf": "papers/yati4.pdf", "audio": "paudio/yati-%d.mp3" % i})
print("押题卷 done", len(papers))

# --- 2025 模拟 5 套 ---
d2 = "2025四六级模拟5套卷及解析/CET4模拟卷全5套"
files2 = ls(d2)
pdf2 = [f for f in files2 if f["name"].endswith(".pdf")][0]
dl(pdf2["download_url"], "moni.pdf")
shutil.copy2(os.path.join(SRC, "moni.pdf"), os.path.join(WEB, "papers", "moni4.pdf"))
aud = ls(d2 + "/配套音频")
aud = [f for f in aud if f["name"].lower().endswith(".mp3")]
def onum(n):
    for w, v in [("One", 1), ("Two", 2), ("Three", 3), ("Four", 4), ("Five", 5)]:
        if w in n:
            return v
    return 99
aud.sort(key=lambda f: onum(f["name"]))
for i, f in enumerate(aud, 1):
    src = dl(f["download_url"], "moni-%d.mp3" % i)
    subprocess.run([FF, "-y", "-hide_banner", "-loglevel", "error", "-i", src, "-ac", "1", "-ar", "22050", "-b:a", "24k", os.path.join(WEB, "paudio", "moni-%d.mp3" % i)])
    papers.append({"id": "moni-%d" % i, "title": "2025 四级模拟卷 Model Test %d" % i, "pdf": "papers/moni4.pdf", "audio": "paudio/moni-%d.mp3" % i})
print("模拟 done, total", len(papers))

dst = os.path.join(WEB, "data", "papers.js")
open(dst, "w", encoding="utf-8").write("window.CET4_PAPERS = " + json.dumps(papers, ensure_ascii=False) + ";\n")
tot = sum(os.path.getsize(os.path.join(WEB, "paudio", f)) for f in os.listdir(os.path.join(WEB, "paudio")))
print("paudio MB", round(tot / 1048576, 1))
