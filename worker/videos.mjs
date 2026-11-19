// GET /videos — the list behind videos.html.
//
// Reads two public YouTube feeds (no API key): the channel's uploads and the
// "Featured" playlist, where the band adds anyone's videos. Merges them, drops
// duplicates, and returns newest first. Each feed holds its latest 15 entries.
// TECH_DESIGN.md "Videos" has the why.
//
// Plain vars (worker/wrangler.jsonc): YT_CHANNEL_ID, YT_PLAYLIST_ID,
// ALLOWED_ORIGINS (shared with the booking form; only these get CORS headers).

const FEED = 'https://www.youtube.com/feeds/videos.xml?';
const FRESH_MS = 60 * 60 * 1000;  // refetch YouTube at most hourly per isolate
const BROWSER_MAX_AGE = 600;      // seconds a browser may reuse a reply

// Per-isolate memory. The Cache API is a no-op on workers.dev, so this is the
// cache; it also lets us serve the last good list when YouTube has a bad minute.
let memo = null;  // { at, videos }
export function _resetMemo() { memo = null; }

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1].trim()) : '';
}

// Feed XML → [{ id, title, published, channel, channelId }]. Entries without a
// sane video id are skipped, since the id ends up in a URL on the page.
export function parseFeed(xml) {
  const out = [];
  for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = tag(entry, 'yt:videoId');
    if (!/^[\w-]{6,20}$/.test(id)) continue;
    const author = entry.match(/<author>([\s\S]*?)<\/author>/);
    out.push({
      id,
      title: tag(entry, 'title'),
      published: tag(entry, 'published'),
      channel: author ? tag(author[1], 'name') : '',
      channelId: tag(entry, 'yt:channelId')
    });
  }
  return out;
}

// Merge feeds, first copy of a video wins, newest first. `ours` marks videos
// from the band's channel so the page can credit everyone else.
export function mergeVideos(lists, ourChannelId) {
  const seen = new Map();
  for (const v of lists.flat()) if (!seen.has(v.id)) seen.set(v.id, v);
  return [...seen.values()]
    .sort((a, b) => (Date.parse(b.published) || 0) - (Date.parse(a.published) || 0))
    .map(({ channelId, ...v }) => ({ ...v, ours: channelId === ourChannelId }));
}

async function fetchFeed(query) {
  const res = await fetch(FEED + query, { headers: { 'user-agent': 'wolfthump-videos' } });
  if (!res.ok) throw new Error('feed ' + res.status + ' ' + query);
  return parseFeed(await res.text());
}

function reply(status, body, origin, env) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': status === 200 ? `public, max-age=${BROWSER_MAX_AGE}` : 'no-store',
    'vary': 'Origin'
  };
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  if (origin && allowed.includes(origin)) headers['access-control-allow-origin'] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

export async function handleVideos(request, env, now = Date.now()) {
  const origin = request.headers.get('origin') || '';
  if (request.method !== 'GET') return reply(405, { ok: false, error: 'Method not allowed.' }, origin, env);
  if (!env.YT_CHANNEL_ID || !env.YT_PLAYLIST_ID) {
    return reply(503, { ok: false, error: 'Videos are not switched on yet.' }, origin, env);
  }

  if (memo && now - memo.at < FRESH_MS) return reply(200, { ok: true, videos: memo.videos }, origin, env);

  const results = await Promise.allSettled([
    fetchFeed('channel_id=' + encodeURIComponent(env.YT_CHANNEL_ID)),
    fetchFeed('playlist_id=' + encodeURIComponent(env.YT_PLAYLIST_ID))
  ]);
  const lists = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  results.filter(r => r.status === 'rejected').forEach(r => console.error('videos', r.reason));

  if (lists.length === results.length || (lists.length && !memo)) {
    const videos = mergeVideos(lists, env.YT_CHANNEL_ID);
    // Only a complete fetch counts as fresh; a partial one is retried next time.
    memo = { at: lists.length === results.length ? now : 0, videos };
    return reply(200, { ok: true, videos }, origin, env);
  }
  if (memo) return reply(200, { ok: true, videos: memo.videos }, origin, env);  // stale beats nothing
  return reply(502, { ok: false, error: 'Could not reach YouTube.' }, origin, env);
}
