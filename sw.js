// build 6.02: офлайн-кэш сайта. Раньше код воркера создавался из blob:
// URL — браузеры такое запрещают, поэтому офлайн фактически не работал.
// Версия кэша приходит в адресе: sw.js?v=6.02 — при новой версии старый
// кэш удаляется. Для всех файлов «сначала сеть», кэш — только без сети.
const CACHE = 'quran-app-shell-' + (new URL(self.location.href).searchParams.get('v') || 'v3');
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
  // аккаунты/чат — только сеть, не кэшируем чужие данные
  if (url.includes('supabase.co')) return;
  // Аудио плеер просит файл кусками (Range). Записи «Дуа и зикры» храним
  // целиком: при первом прослушивании докачиваем файл в фоне, потом
  // отдаём нужный кусок из кэша — так они играют и без интернета.
  if (req.headers.has('range')) {
    if (url.indexOf('/audio-hisn/') < 0) return;
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
  e.respondWith(
    fetch(req).then(resp => {
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
