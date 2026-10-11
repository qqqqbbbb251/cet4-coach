const CACHE = "cet4-v3";
const CORE = [
  "./", "./index.html", "./style.css", "./app.js", "./manifest.json",
  "./data/data.js", "./data/zhenti.js", "./data/zaudio.js", "./data/wordmeta.js",
  "./data/roots.js", "./data/eztor.js", "./data/papers.js", "./data/words_extra.js", "./data/vocabtest.js"
];
for (let i = 1; i <= 24; i++) CORE.push("./assets/audio/listen-" + (i < 10 ? "0" + i : i) + ".mp3");

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () { }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return; // 只处理本站资源（AI 请求等放行）
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy).catch(function () { }); });
        }
        return res;
      }).catch(function () {
        return caches.match("./index.html");
      });
    })
  );
});
