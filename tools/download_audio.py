import json, re, os, subprocess, sys, concurrent.futures
sys.stdout.reconfigure(encoding="utf-8")
FF = r"C:\dev\downloads\ffmpeg\ffmpeg-master-latest-win64-gpl\bin\ffmpeg.exe"
meta = open(r"C:\dev\downloads\listeningMeta.js", encoding="utf-8").read()
M = json.loads(re.search(r"var M=(\{.*\});", meta, re.S).group(1))
OUT = r"C:\Users\24678\Documents\Default Project\cet4_web\zaudio"
os.makedirs(OUT, exist_ok=True)
items = [(k, v["src"]) for k, v in M.items() if v.get("src")]
print("to download:", len(items))


def one(item):
    pid, src = item
    out = os.path.join(OUT, pid + ".mp3")
    if os.path.exists(out) and os.path.getsize(out) > 10000:
        return pid, "skip", os.path.getsize(out)
    r = subprocess.run([FF, "-y", "-hide_banner", "-loglevel", "error", "-i", src,
                        "-ac", "1", "-ar", "22050", "-b:a", "24k", out], capture_output=True)
    if r.returncode == 0 and os.path.exists(out):
        return pid, "ok", os.path.getsize(out)
    return pid, "ERR " + r.stderr.decode("utf-8", "replace")[:120], 0


ok = 0
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
    for pid, st, sz in ex.map(one, items):
        print("%-14s %-6s %s KB" % (pid, st, round(sz / 1024, 1)), flush=True)
        if st in ("ok", "skip"):
            ok += 1
tot = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print("done %d/%d, total MB %.1f" % (ok, len(items), tot / 1048576))
