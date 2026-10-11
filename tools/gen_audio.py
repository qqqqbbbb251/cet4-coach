# -*- coding: utf-8 -*-
"""Generate per-word pronunciation mp3 via edge-tts (resumable).
Outputs: waudio/<word>.mp3 and data/waudio.js mapping (window.CET4_WAUDIO)."""
import asyncio, json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
WEB = r"C:\Users\24678\Documents\Default Project\cet4_web"
OUT = os.path.join(WEB, "waudio")
VOICE = "en-US-AriaNeural"
RATE = "-10%"
HERE = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(HERE, "gen_audio.log")
MAP = os.path.join(WEB, "data", "waudio.js")


def load_js(path):
    s = open(path, encoding="utf-8").read().split("=", 1)[1].strip().rstrip(";")
    return json.loads(s)


def load_words():
    core, pool, other = set(), set(), set()

    def walk(o, bucket):
        if isinstance(o, dict):
            if isinstance(o.get("w"), str):
                bucket.add(o["w"].lower())
            else:
                for v in o.values():
                    walk(v, bucket)
        elif isinstance(o, list):
            for v in o:
                walk(v, bucket)

    for name, bucket in (("data.js", core), ("words_extra.js", other), ("vocabtest.js", pool)):
        p = os.path.join(WEB, "data", name)
        if not os.path.exists(p):
            continue
        try:
            walk(load_js(p), bucket)
        except Exception as e:
            print("skip", name, e, flush=True)
    valid = lambda w: re.fullmatch(r"[a-z][a-z'\- ]*", w or "")
    core = {w for w in core if valid(w)}
    pool = {w for w in pool if valid(w)} - core
    other = {w for w in other if valid(w)} - core - pool
    return sorted(core) + sorted(pool) + sorted(other)


def fn(w):
    return re.sub(r"[^a-z0-9]", "_", w) + ".mp3"


async def main():
    os.makedirs(OUT, exist_ok=True)
    words = load_words()
    total = len(words)
    print("words:", total, flush=True)
    mapping = {}
    if os.path.exists(MAP):
        try:
            mapping = load_js(MAP)
        except Exception:
            mapping = {}
    import edge_tts
    sem = asyncio.Semaphore(12)
    lock = asyncio.Lock()
    state = {"done": 0, "failed": []}

    async def one(w):
        path = os.path.join(OUT, fn(w))
        rel = "waudio/" + fn(w)
        if os.path.exists(path) and os.path.getsize(path) > 500:
            mapping[w] = rel
            async with lock:
                state["done"] += 1
            return
        ok = False
        async with sem:
            for attempt in range(4):
                try:
                    c = edge_tts.Communicate(w, VOICE, rate=RATE)
                    await c.save(path)
                    if os.path.exists(path) and os.path.getsize(path) > 300:
                        ok = True
                        break
                except Exception:
                    await asyncio.sleep(1.0 + attempt)
        if ok:
            mapping[w] = rel
        else:
            state["failed"].append(w)
        async with lock:
            state["done"] += 1
            if state["done"] % 100 == 0:
                open(MAP, "w", encoding="utf-8").write("window.CET4_WAUDIO = " + json.dumps(mapping, ensure_ascii=False, separators=(",", ":")) + ";\n")
                open(LOG, "w", encoding="utf-8").write("done %d/%d mapped %d failed %d\n" % (state["done"], total, len(mapping), len(state["failed"])))
                print("progress %d/%d mapped %d failed %d" % (state["done"], total, len(mapping), len(state["failed"])), flush=True)

    await asyncio.gather(*[one(w) for w in words])
    open(MAP, "w", encoding="utf-8").write("window.CET4_WAUDIO = " + json.dumps(mapping, ensure_ascii=False, separators=(",", ":")) + ";\n")
    msg = "FINISHED done %d/%d mapped %d failed %d\n" % (state["done"], total, len(mapping), len(state["failed"]))
    open(LOG, "w", encoding="utf-8").write(msg)
    print(msg, flush=True)
    if state["failed"]:
        open(os.path.join(HERE, "gen_audio_failed.txt"), "w", encoding="utf-8").write("\n".join(state["failed"]))


asyncio.run(main())
