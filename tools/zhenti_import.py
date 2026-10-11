"""
CET-4 真题 -> 结构化 JSON 导入管线
- 真题 PDF：优先文字解析；失败则渲染成图片交给 deepseek-flash(视觉) 提取
- 答案 PDF：解析答案/范文/参考译文
- 用法：  set DEEPSEEK_API_KEY=sk-xxx  &&  python zhenti_import.py
- 断点续跑：已完成的套卷会跳过
"""
import os, re, io, json, base64, time, sys, urllib.request, urllib.parse

sys.stdout.reconfigure(encoding="utf-8")
GH = os.environ.get("GH_TOKEN", "")
KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()
REPO = "0609x/CET46-Resources"
CACHE = r"C:\dev\downloads\zhenti_cache"
OUT = r"C:\dev\downloads\zhenti_structured.json"
os.makedirs(CACHE, exist_ok=True)


def gh_api(p):
    r = urllib.request.Request("https://api.github.com" + p, headers={"User-Agent": "x", "Authorization": "Bearer " + GH})
    return json.load(urllib.request.urlopen(r, timeout=30))


def enc(p):
    return "/".join(urllib.parse.quote(s) for s in p.split("/"))


def ls(path):
    return gh_api("/repos/%s/contents/%s" % (REPO, enc(path)))


def fetch(url, cname):
    fp = os.path.join(CACHE, cname)
    if os.path.exists(fp):
        return open(fp, "rb").read()
    url = urllib.parse.quote(url, safe=":/")
    b = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "x"}), timeout=180).read()
    open(fp, "wb").write(b)
    return b


# ---------- text extraction ----------
from pypdf import PdfReader
import pymupdf


def pdf_text(b):
    try:
        return "".join((p.extract_text() or "") for p in PdfReader(io.BytesIO(b)).pages)
    except Exception:
        return ""


def render_pages(b, max_pages=30):
    imgs = []
    doc = pymupdf.open(stream=b, filetype="pdf")
    for i, page in enumerate(doc):
        if i >= max_pages:
            break
        pix = page.get_pixmap(dpi=140)
        imgs.append(pix.tobytes("jpeg", jpg_quality=70))
    return imgs


# ---------- deepseek vision ----------
def ds_chat(messages, max_tokens=16000):
    body = json.dumps({"model": "deepseek-flash", "messages": messages, "temperature": 0.1, "max_tokens": max_tokens}).encode("utf-8")
    req = urllib.request.Request("https://api.deepseek.com/chat/completions", data=body,
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer " + KEY})
    for attempt in range(4):
        try:
            resp = json.load(urllib.request.urlopen(req, timeout=300))
            return resp["choices"][0]["message"]["content"]
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))


def img_block(data):
    return {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(data).decode()}}


def extract_json(txt):
    m = re.search(r"\{.*\}", txt, re.S)
    if not m:
        raise ValueError("no json")
    return json.loads(m.group(0))


PAPER_PROMPT = """这是一份大学英语四级(CET-4)真题的若干页截图。请把试卷内容提取为严格的 JSON（不要解释，只输出 JSON）。
结构：
{"writing":{"prompt":"作文Directions原文"}, 
 "listening":[{"n":1,"options":["...","...","...","..."]}],
 "reading":{"cloze":{"passage":"选词填空短文(用 ___26___ 标注空格)","bank":[{"letter":"A","word":"..."}]},
            "matching":{"statements":[{"n":36,"stem":"..."}]},
            "careful":[{"n":46,"stem":"题干","options":["...","...","...","..."]}]},
 "translation":{"source":"汉译英中文原文"}}
要求：listening 为第1-25题（每题4个选项，无题干，按图片顺序）；reading.careful 为第46-55题（含题干与4选项）；matching 为第36-45题陈述句；cloze 词库为A-O。只提取确实出现在图片中的内容。"""

ANSWER_PROMPT = """这是大学英语四级(CET-4)真题的标准答案,请提取为严格 JSON（只输出 JSON）：
{"listening":{"1":"B","2":"A", "...":"..."},
 "reading":{"26":"D","27":"M", "...":"..."},
 "writing_ref":"作文参考范文全文",
 "translation_ref":"翻译参考译文全文"}
听力为1-25题答案(字母A-D)；阅读为26-55题答案(字母A-O)。"""


def parse_answers_text(a):
    res = {}
    for k1, k2 in [("Listening Comprehension", "Reading Comprehension"), ("Reading Comprehension", "Translation")]:
        seg = re.search(re.escape(k1) + r"(.*?)" + re.escape(k2), a, re.S)
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


def build_task_list():
    years = sorted([x["name"] for x in ls("四级真题") if x["type"] == "dir"])
    tasks = {}
    for y in years:
        try:
            pdfs = ls("四级真题/%s/真题PDF" % y)
            ans = ls("四级真题/%s/答案解析" % y)
        except Exception:
            continue
        for f in pdfs:
            if not f["name"].lower().endswith(".pdf"):
                continue
            m = re.match(r"cet4_(\d{4})_(\d{2})_(\d)\.pdf$", f["name"])
            if m:
                setn = m.group(3); prefer = True
            else:
                m2 = re.search(r"第?([123])套", f["name"])
                setn = m2.group(1) if m2 else None; prefer = False
            if not setn:
                continue
            tid = "%s-%s" % (y, setn)
            if tid in tasks and not prefer:
                continue
            a = [x for x in ans if ("第%s套" % setn) in x["name"] and x["name"].lower().endswith(".pdf")]
            tasks[tid] = {"year": y, "set": setn, "id": tid, "q": f, "a": a[0] if a else None}
    return list(tasks.values())


def main():
    if not KEY:
        print("ERROR: 请先设置环境变量 DEEPSEEK_API_KEY")
        return
    tasks = build_task_list()
    done = []
    if os.path.exists(OUT):
        done = json.load(open(OUT, encoding="utf-8"))
    have = set(d["id"] for d in done)
    for t in tasks:
        if t["id"] in have:
            continue
        print("== %s ==" % t["id"], flush=True)
        try:
            qb = fetch(t["q"]["download_url"], t["id"] + "_q.pdf")
            qt = pdf_text(qb)
            if len(qt) > 2500 and "Part" in qt:
                # 文字可解析 -> 交给模型把文本转 JSON（不用图，便宜快速）
                paper = extract_json(ds_chat([
                    {"role": "system", "content": "你是四级真题结构化助手，只输出 JSON。"},
                    {"role": "user", "content": PAPER_PROMPT + "\n\n【试卷文字】\n" + qt}
                ]))
            else:
                paper = extract_json(ds_chat([
                    {"role": "system", "content": "你是四级真题结构化助手，只输出 JSON。"},
                    {"role": "user", "content": [{"type": "text", "text": PAPER_PROMPT}] + [img_block(x) for x in render_pages(qb)]}
                ]))
            answers = {}
            if t["a"]:
                ab = fetch(t["a"]["download_url"], t["id"] + "_a.pdf")
                at = pdf_text(ab)
                if len(at) > 200:
                    answers = parse_answers_text(at)
                    mw = re.search(r"Writing\s*参考[^：:]*[：:]\s*(.*?)\s*Part\s*(?:Ⅱ|II)\s*Listening", at, re.S)
                    if mw:
                        paper["writing_ref"] = mw.group(1).strip()
                    mtr = re.search(r"Translation\s*参考译文[^：:]*[：:]\s*(.*)$", at, re.S)
                    if mtr:
                        paper["translation_ref"] = mtr.group(1).strip()
                if len(answers) < 20:
                    aobj = extract_json(ds_chat([
                        {"role": "system", "content": "你是四级真题答案提取助手，只输出 JSON。"},
                        {"role": "user", "content": [{"type": "text", "text": ANSWER_PROMPT}] + [img_block(x) for x in render_pages(ab, 12)]}
                    ]))
                    for src in ("listening", "reading"):
                        for k, v in (aobj.get(src) or {}).items():
                            try:
                                answers[int(k)] = v
                            except Exception:
                                pass
                    if aobj.get("writing_ref"):
                        paper["writing_ref"] = aobj["writing_ref"]
                    if aobj.get("translation_ref"):
                        paper["translation_ref"] = aobj["translation_ref"]
            paper["id"] = t["id"]
            paper["year"] = t["year"]
            paper["answers"] = answers
            done.append(paper)
            json.dump(done, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
            print("   saved. listen=%d read=%d match=%d ans=%d" % (
                len(paper.get("listening", [])), len((paper.get("reading", {}) or {}).get("careful", [])),
                len((paper.get("reading", {}) or {}).get("matching", {}).get("statements", []) if isinstance((paper.get("reading", {}) or {}).get("matching"), dict) else []),
                len(answers)), flush=True)
        except Exception as e:
            print("   ERR", e, flush=True)
    print("DONE total", len(done))


if __name__ == "__main__":
    main()
