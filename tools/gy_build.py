import os, re, json, urllib.request, urllib.parse, sys
sys.stdout.reconfigure(encoding="utf-8")
REPO = "gongyining0601/cet4"
CACHE = r"C:\dev\downloads\gybank"
os.makedirs(CACHE, exist_ok=True)


def enc(p):
    return "/".join(urllib.parse.quote(s) for s in p.split("/"))


def raw(path, br="main"):
    fp = os.path.join(CACHE, path.replace("/", "_"))
    if os.path.exists(fp):
        return open(fp, encoding="utf-8").read()
    u = "https://raw.githubusercontent.com/%s/%s/%s" % (REPO, br, enc(path))
    txt = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "x"}), timeout=60).read().decode("utf-8", "replace")
    open(fp, "w", encoding="utf-8").write(txt)
    return txt


def api(p):
    r = urllib.request.Request("https://api.github.com" + p, headers={"User-Agent": "x", "Authorization": "Bearer " + os.environ.get("GH_TOKEN", "")})
    return json.load(urllib.request.urlopen(r, timeout=30))


bank = [x["name"] for x in api("/repos/%s/contents/bank" % REPO) if x["name"].endswith(".js") and x["name"].startswith("cet4-")]
print("bank files:", len(bank))

papers = []
types = {}
for i, name in enumerate(sorted(bank)):
    txt = raw("bank/" + name)
    m = re.search(r"push\((\{.*\})\)", txt, re.S)
    if not m:
        print("parse fail", name); continue
    o = json.loads(m.group(1))
    for q in o.get("questions", []):
        types[q.get("type")] = types.get(q.get("type"), 0) + 1
    o["year"] = "-".join(o["id"].split("-")[:2])
    papers.append(o)

print("papers:", len(papers), "questions:", sum(len(p.get("questions", [])) for p in papers))
print("types:", types)
json.dump(papers, open(r"C:\dev\downloads\zhenti_gy.json", "w", encoding="utf-8"), ensure_ascii=False)
print("saved zhenti_gy.json MB", round(os.path.getsize(r"C:\dev\downloads\zhenti_gy.json") / 1048576, 2))

# audio meta
for f in ["bank/listeningMeta.js", "bank/meta.js"]:
    try:
        t = raw(f)
        print("\n== %s (head) ==\n%s" % (f, t[:600]))
    except Exception as e:
        print(f, "ERR", e)
