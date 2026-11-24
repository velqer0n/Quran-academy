// build 6.02: офлайн-кэш сайта. Раньше код воркера создавался из blob:
// URL — браузеры такое запрещают, поэтому офлайн фактически не работал.
// Версия кэша приходит в адресе: sw.js?v=6.02 — при новой версии старый
// кэш удаляется. Для всех файлов «сначала сеть», кэш — только без сети.
// 7.50: одна постоянная копия сайта (не по номеру версии): сайт открывается из неё сразу, а свежие файлы докачиваются в фоне —
// со следующего запуска уже новая версия (есть плашка «Вышла версия — обновить»). Старые копии «по версиям» удаляются.
const CACHE = 'quran-app-shell-main';
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.indexOf('quran-app-shell-') === 0 && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;
  if (!/^https?:/.test(url)) return;
  // 7.38: APK (10 МБ) воркером не кэшируем — только скачивание
  if (/\.apk(\?|$)/.test(url)) return;
  // аккаунты/чат — только сеть, не кэшируем чужие данные
  if (url.includes('supabase.co')) return;
  // build 6.35: суры целиком (десятки МБ) не кэшируем воркером
  if (url.includes('cdn.mp3quran.net')) return;
  // 7.54: аудио чтецов и слов хранит сам сайт (своя база) — копия в кэше воркера была лишней и занимала место вдвое
  if (/everyayah\.com|qurancdn\.com|verses\.quran\.com/.test(url)) return;
  // Аудио плеер просит файл кусками (Range). Записи «Дуа и зикры» храним
  // целиком: при первом прослушивании докачиваем файл в фоне, потом
  // отдаём нужный кусок из кэша — так они играют и без интернета.
  if (req.headers.has('range')) {
    if (url.indexOf('/audio-hisn/') < 0 && url.indexOf('/audio-salah/') < 0) return;
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(url);
      if (hit) return rangeFrom(hit, req.headers.get('range'));
      const net = fetch(req);
      e.waitUntil(fetch(url).then(r => { if (r.ok) return cache.put(url, r); }).catch(() => {}));
      return net;
    })());
    return;
  }
  // build 6.93: файлы самого сайта всегда сверяем с сервером (cache: 'no-cache' — короткий
  // запрос «не изменился ли», 304 без перекачки), чтобы HTTP-кэш браузера не держал старую версию
  const own = url.indexOf(self.location.origin + '/') === 0;
  // 7.50: файлы сайта (страница, скрипты, стили) — сразу из копии, обновление в фоне. Проверка версии (no-store, _check) — всегда из сети.
  const shell = own && (req.mode === 'navigate' || /\.(js|css|html)(\?|$)/.test(url) || /\/(\?|$)/.test(url)) && req.cache !== 'no-store' && url.indexOf('_check=') < 0 && url.indexOf('/sw.js') < 0;
  if (shell) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      const netP = fetch(req.mode === 'navigate' ? req.url : req, { cache: 'no-cache', credentials: 'same-origin' })
        .then(resp => { if (resp && resp.ok) cache.put(req.mode === 'navigate' ? new Request(new URL(req.url).pathname) : req, resp.clone()).catch(() => {}); return resp; });
      if (hit) { e.waitUntil(netP.catch(() => {})); return hit; }
      return netP.catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || Response.error()));
    })());
    return;
  }
  const net = own ? fetch(req.mode === 'navigate' ? req.url : req, { cache: 'no-cache', credentials: 'same-origin' }).catch(() => fetch(req)) : fetch(req);
  e.respondWith(
    net.then(resp => {
      if (resp && resp.ok) { // непрозрачные (opaque) ответы не храним — они раздувают квоту
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(req, clone)).catch(() => {});
      }
      return resp;
    }).catch(() => caches.match(req, { ignoreSearch: /\.(js|css|html)(\?|$)|\/$/.test(url) }).then(r => r || Response.error()))
  );
});
async function rangeFrom(resp, range) {
  const buf = await resp.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range || '');
  const size = buf.byteLength;
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
  if (m && !m[1] && m[2]) { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
  end = Math.min(end, size - 1);
  if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': resp.headers.get('Content-Type') || 'audio/mpeg',
    'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
    'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
}
