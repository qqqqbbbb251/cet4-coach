import base64, os, re

web = r"C:\Users\24678\Documents\Default Project\cet4_web"


def read(p):
    with open(os.path.join(web, p), encoding="utf-8") as f:
        return f.read()


def b64(p):
    with open(os.path.join(web, p), "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


style = read("style.css")
app = read("app.js")
data = read(os.path.join("data", "data.js"))
zhenti = read(os.path.join("data", "zhenti.js"))
wordmeta = read(os.path.join("data", "wordmeta.js"))
roots = read(os.path.join("data", "roots.js"))
eztor = read(os.path.join("data", "eztor.js"))
papers = read(os.path.join("data", "papers.js"))
wextra = read(os.path.join("data", "words_extra.js"))
vtest = read(os.path.join("data", "vocabtest.js"))
wcolloc = read(os.path.join("data", "wordcolloc.js"))
voa = read(os.path.join("data", "voa.js"))
dic = read(os.path.join("data", "dict.js"))
gram = read(os.path.join("data", "grammar.js"))
wform = read(os.path.join("data", "wordform.js"))

audiodir = os.path.join(web, "assets", "audio")
replaced = 0
for name in sorted(os.listdir(audiodir)):
    if not name.endswith(".mp3"):
        continue
    rel = "assets/audio/" + name
    uri = "data:audio/mpeg;base64," + b64(os.path.join("assets", "audio", name))
    if rel in data:
        data = data.replace(rel, uri)
        replaced += 1

html = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#3949AB">
<title>四级备考 · CET-4 Coach</title>
<style>
""" + style + """
</style>
</head>
<body>
<header id="appbar">
  <div class="bar-inner">
    <button id="btn-home" class="brand">四级备考 · CET-4</button>
    <div class="bar-actions">
      <button id="btn-dash" class="icon-btn" aria-label="仪表盘" title="学习仪表盘">&#128202;</button>
      <button id="btn-theme" class="icon-btn" aria-label="深色模式" title="深色/浅色">&#127769;</button>
      <button id="btn-settings" class="icon-btn" aria-label="设置">&#9881;</button>
    </div>
  </div>
</header>
<main id="main"></main>
<div id="toast" class="toast"></div>
<script>
""" + data + """
</script>
<script>
""" + zhenti + """
</script>
<script>
""" + wordmeta + """
</script>
<script>
""" + roots + """
</script>
<script>
""" + eztor + """
</script>
<script>
""" + papers + """
</script>
<script>
""" + wextra + """
</script>
<script>
""" + vtest + """
</script>
<script>
""" + wcolloc + """
</script>
<script>
""" + voa + """
</script>
<script>
""" + dic + """
</script>
<script>
""" + gram + """
</script>
<script>
""" + wform + """
</script>
<script>
""" + app + """
</script>
</body>
</html>
"""

out = os.path.join(web, "四级备考.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(html)
print("replaced audio refs:", replaced)
print("size MB:", round(os.path.getsize(out) / 1048576, 2))
print("remaining external refs: style.css?" , "style.css" in html, "| app.js?", "app.js" in html)
