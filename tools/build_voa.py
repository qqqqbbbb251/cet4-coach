import urllib.request, re, sys, os, json, subprocess
sys.stdout.reconfigure(encoding="utf-8")
VOA = r"C:\Users\24678\Documents\Default Project\cet4_web\voa"
os.makedirs(VOA, exist_ok=True)
FF = r"C:\dev\downloads\ffmpeg\ffmpeg-master-latest-win64-gpl\bin\ffmpeg.exe"

def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read().decode("utf-8", "replace")

def strip_tags(s):
    s = re.sub(r"<script[\s\S]*?</script>", " ", s)
    s = re.sub(r"<style[\s\S]*?</style>", " ", s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = s.replace("&amp;", "&").replace("&nbsp;", " ").replace("&#39;", "'").replace("&quot;", '"').replace("&ldquo;", '"').replace("&rdquo;", '"').replace("&mdash;", "-").replace("&rsquo;", "'")
    return re.sub(r"\s+", " ", s).strip()

sec = "https://learningenglish.voanews.com/z/1579"
h = get(sec)
arts = list(dict.fromkeys(re.findall(r'href="(/a/[^"?#]+\.html)"', h)))[:10]
print("articles:", len(arts))
out = []
for i, a in enumerate(arts, 1):
    try:
        u = "https://learningenglish.voanews.com" + a
        page = get(u)
        mp3s = list(dict.fromkeys(re.findall(r'https://voa-audio[^"\'\\ ]+?\.mp3', page)))
        mp3 = next((m for m in mp3s if "_hq" not in m), (mp3s[0] if mp3s else None))
        t = re.search(r"<title>(.*?)</title>", page); title = strip_tags(t.group(1)) if t else a
        idx = page.find('class="wsw"')
        body = strip_tags(page[idx:idx + 14000]) if idx > 0 else ""
        body = re.sub(r"^(Download|Print).*?\b", "", body)[:9000]
        if not mp3 or len(body) < 300:
            print("  skip", a, "mp3?", bool(mp3), "body", len(body)); continue
        outname = "voa-%02d.mp3" % i
        raw = os.path.join(VOA, "src-" + outname)
        urllib.request.urlretrieve(mp3, raw)
        subprocess.run([FF, "-y", "-hide_banner", "-loglevel", "error", "-i", raw, "-ac", "1", "-ar", "22050", "-b:a", "48k", os.path.join(VOA, outname)])
        os.remove(raw)
        out.append({"id": outname, "title": title, "audio": "voa/" + outname, "transcript": body})
        print("  ok", outname, "|", title[:50], "| chars", len(body))
    except Exception as e:
        print("  ERR", str(e)[:70], a)

json.dump(out, open(r"C:\dev\downloads\voa_raw.json", "w", encoding="utf-8"), ensure_ascii=False)
tot = sum(os.path.getsize(os.path.join(VOA, f)) for f in os.listdir(VOA) if f.endswith(".mp3") and f.startswith("voa-"))
print("done", len(out), "clips | MB", round(tot / 1048576, 1))
