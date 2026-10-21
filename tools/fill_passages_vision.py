# -*- coding: utf-8 -*-
"""Fill reading passages for scanned (image-only) papers via DeepSeek vision.
Target: 2025-06-3.  Usage: set DEEPSEEK_API_KEY=sk-... ; python tools/fill_passages_vision.py"""
import sys, os, io, re, json, base64, time, urllib.request, shutil
sys.stdout.reconfigure(encoding="utf-8")
import pymupdf

WEB = r"C:\Users\24678\Documents\Default Project\cet4_web"
ZJ = os.path.join(WEB, "data", "zhenti.js")
CACHE = r"C:\dev\downloads\zhenti_cache"
KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()
TARGET = "2025-06-3"
PID = "2025.06-3"
BASE = "https://api.deepseek.com"


def render(b, dpi=120, q=65):
    doc = pymupdf.open(stream=b, filetype="pdf")
    out = []
    for page in doc:
        pix = page.get_pixmap(dpi=dpi)
        out.append(pix.tobytes("jpeg", jpg_quality=q))
    return out


def img_block(data):
    return {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(data).decode()}}


def call(imgs):
    content = [{"type": "text", "text": (
        "下面是一份大学英语四级真题的 6 页图片。请找到 Part III Reading Comprehension 的 Section C（仔细阅读）的"
        "两篇文章：Passage One 在 Questions 46-50 之前，Passage Two 在 Questions 51-55 之前。"
        "只输出 JSON（不要 Markdown）：{\"passage46\":\"第一篇完整英文正文\",\"passage51\":\"第二篇完整英文正文\"}。"
        "要求：只要文章正文，不要包含题目、选项、Directions；尽量完整、逐句照录。")}]
    for d in imgs:
        content.append(img_block(d))
    body = json.dumps({"model": "deepseek-flash", "messages": [{"role": "user", "content": content}], "temperature": 0.1, "max_tokens": 8000}).encode("utf-8")
    req = urllib.request.Request(BASE + "/chat/completions", data=body,
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer " + KEY})
    for attempt in range(3):
        try:
            r = json.loads(urllib.request.urlopen(req, timeout=300).read().decode("utf-8"))
            return r["choices"][0]["message"]["content"]
        except Exception as e:
            print("retry", e); time.sleep(3 * (attempt + 1))
    raise RuntimeError("vision failed")


def main():
    if not KEY:
        print("需要 DEEPSEEK_API_KEY"); return
    b = open(os.path.join(CACHE, PID + "_q.pdf"), "rb").read()
    imgs = render(b)
    print("rendered", len(imgs), "pages")
    txt = call(imgs)
    m = re.search(r"\{[\s\S]*\}", txt)
    if not m:
        print("no json:", txt[:300]); return
    obj = json.loads(m.group(0))
    p46 = re.sub(r"\s+", " ", str(obj.get("passage46", ""))).strip()
    p51 = re.sub(r"\s+", " ", str(obj.get("passage51", ""))).strip()
    print("passage46 len", len(p46), "| passage51 len", len(p51))
    print("46 head:", p46[:120])
    print("51 head:", p51[:120])
    if len(p46) < 400 or len(p51) < 400:
        print("passages too short; abort"); return
    s = open(ZJ, encoding="utf-8").read()
    head, tail = s.split("=", 1)
    Z = json.loads(tail.strip().rstrip(";"))
    p = [x for x in Z if x.get("id") == TARGET][0]
    rp = p.setdefault("readingPassages", {})
    for qno in range(46, 51):
        rp[str(qno)] = p46
    for qno in range(51, 56):
        rp[str(qno)] = p51
    shutil.copy2(ZJ, ZJ + ".bak_vision")
    open(ZJ, "w", encoding="utf-8").write(head + "= " + json.dumps(Z, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print("written")


main()
