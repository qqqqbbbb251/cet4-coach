import urllib.request, re, sys, os, json, subprocess
sys.stdout.reconfigure(encoding="utf-8")
VOA = r"C:\Users\24678\Documents\Default Project\cet4_web\voa"
SRC = r"C:\dev\downloads\voa_src"
os.makedirs(VOA, exist_ok=True); os.makedirs(SRC, exist_ok=True)
FF = r"C:\dev\downloads\ffmpeg\ffmpeg-master-latest-win64-gpl\bin\ffmpeg.exe"

def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read().decode("utf-8", "replace")

def strip_tags(s):
    s = re.sub(r"<script[\s\S]*?</script>", " ", s)
    s = re.sub(r"<style[\s\S]*?</style>", " ", s)
    s = re.sub(r"<[^>]+>", " ", s)
    for a, b in [("&amp;", "&"), ("&nbsp;", " "), ("&#39;", "'"), ("&apos;", "'"), ("&quot;", '"'), ("&ldquo;", '"'), ("&rdquo;", '"'), ("&mdash;", "-"), ("&rsquo;", "'"), ("&lsquo;", "'")]:
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", s).strip()

sec = "https://learningenglish.voanews.com/z/1579"
arts = list(dict.fromkeys(re.findall(r'href="(/a/[^"?#]+\.html)"', get(sec))))[:12]
out = []
n = 0
for a in arts:
    try:
        page = get("https://learningenglish.voanews.com" + a)
        mp3s = list(dict.fromkeys(re.findall(r'https://voa-audio[^"\'\\ ]+?\.mp3', page)))
        mp3 = next((m for m in mp3s if "_hq" not in m), (mp3s[0] if mp3s else None))
        t = re.search(r"<title>(.*?)</title>", page); title = strip_tags(t.group(1)).replace(" - VOA - Voice of America English News", "") if t else a
        txt = strip_tags(page)
        i = txt.find("Pop-out player")
        if i < 0: i = txt.rfind("64 kbps")
        body = txt[i + 15:] if i > 0 else ""
        j = body.find("Words in This Story")
        if j > 0: body = body[:j]
        body = body.strip()
        if not mp3 or len(body) < 500:
            print("  skip", len(body), a); continue
        n += 1
        name = "voa-%02d.mp3" % n
        raw = os.path.join(SRC, name)
        urllib.request.urlretrieve(mp3, raw)
        subprocess.run([FF, "-y", "-hide_banner", "-loglevel", "error", "-i", raw, "-ac", "1", "-ar", "22050", "-b:a", "48k", os.path.join(VOA, name)])
        out.append({"id": name, "title": title, "audio": "voa/" + name, "transcript": body})
        print("  ok", name, "|", len(body), "chars |", title[:52])
    except Exception as e:
        print("  ERR", str(e)[:70], a)

json.dump(out, open(r"C:\dev\downloads\voa_raw.json", "w", encoding="utf-8"), ensure_ascii=False)
tot = sum(os.path.getsize(os.path.join(VOA, f)) for f in os.listdir(VOA) if f.endswith(".mp3"))
print("done", len(out), "| MB", round(tot / 1048576, 1))
