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
const FRESH_MS = 60 * 60 * 1000;  // after a clean fetch, reuse the list for an hour
const RETRY_MS = 5 * 60 * 1000;   // after any feed fails, wait this long to retry
const BROWSER_MAX_AGE = 600;      // seconds a browser may reuse a reply

// Per-isolate memory. The Cache API is a no-op on workers.dev, so this is the
// cache. Each feed keeps its own last good list, so one feed failing (even for
// good) never freezes the other, and an outage serves what we had.
let state = null;  // { nextAt, feeds: { channel: [...]|null, playlist: [...]|null } }
export function _resetMemo() { state = null; }

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;  // bad code: leave as text
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

  if (!state || now >= state.nextAt) {
    const feeds = state ? state.feeds : { channel: null, playlist: null };
    const [channel, playlist] = await Promise.allSettled([
      fetchFeed('channel_id=' + encodeURIComponent(env.YT_CHANNEL_ID)),
      fetchFeed('playlist_id=' + encodeURIComponent(env.YT_PLAYLIST_ID))
    ]);
    let allOk = true;
    for (const [name, r] of [['channel', channel], ['playlist', playlist]]) {
      if (r.status === 'fulfilled') feeds[name] = r.value;
      else { allOk = false; console.error('videos', r.reason); }
    }
    state = { feeds, nextAt: now + (allOk ? FRESH_MS : RETRY_MS) };
  }

  const lists = Object.values(state.feeds).filter(Boolean);
  if (lists.length) return reply(200, { ok: true, videos: mergeVideos(lists, env.YT_CHANNEL_ID) }, origin, env);
  return reply(502, { ok: false, error: 'Could not reach YouTube.' }, origin, env);
}
