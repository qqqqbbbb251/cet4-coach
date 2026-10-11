const CACHE = "cet4-v7";
const CORE = [
  "./", "./index.html", "./style.css", "./app.js", "./manifest.json",
  "./data/data.js", "./data/zhenti.js", "./data/zaudio.js", "./data/wordmeta.js",
  "./data/roots.js", "./data/eztor.js", "./data/papers.js", "./data/words_extra.js", "./data/vocabtest.js", "./data/wordcolloc.js", "./data/voa.js", "./data/dict.js"
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

// 联网优先：在线永远取最新；离线时回退到缓存
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy).catch(function () { }); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) { return hit || caches.match("./index.html"); });
    })
  );
});
