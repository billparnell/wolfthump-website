// GET /videos — the list behind videos.html.
//
// Reads one public YouTube feed (no API key): the channel's "Featured" playlist.
// Only videos in that playlist reach the site, in the playlist's own order, so
// the band curates and orders the page by editing the playlist (uploads that
// aren't in it stay off the site on purpose). The feed holds the playlist's
// first 15 videos. TECH_DESIGN.md "Videos" has the why.
//
// Plain vars (worker/wrangler.jsonc): YT_PLAYLIST_ID, YT_CHANNEL_ID (only to
// tell our videos from other channels' for the "Posted by" credit),
// ALLOWED_ORIGINS (shared with the booking form; only these get CORS headers).

const FEED = 'https://www.youtube.com/feeds/videos.xml?';
const FRESH_MS = 60 * 60 * 1000;  // after a clean fetch, reuse the list for an hour
const RETRY_MS = 5 * 60 * 1000;   // after a failed fetch, wait this long to retry
const BROWSER_MAX_AGE = 600;      // seconds a browser may reuse a reply

// Per-isolate memory. The Cache API is a no-op on workers.dev, so this is the
// cache. It keeps the last good list, so a YouTube outage serves what we had.
let state = null;  // { nextAt, videos: [...]|null }
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

// Keep the playlist's order; drop a repeat of a video already listed. `ours`
// marks videos from the band's channel so the page can credit everyone else.
export function toVideos(entries, ourChannelId) {
  const seen = new Set();
  return entries
    .filter(v => !seen.has(v.id) && seen.add(v.id))
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
    try {
      const entries = await fetchFeed('playlist_id=' + encodeURIComponent(env.YT_PLAYLIST_ID));
      state = { videos: toVideos(entries, env.YT_CHANNEL_ID), nextAt: now + FRESH_MS };
    } catch (err) {
      console.error('videos', err);
      state = { videos: state ? state.videos : null, nextAt: now + RETRY_MS };
    }
  }

  if (state.videos) return reply(200, { ok: true, videos: state.videos }, origin, env);
  return reply(502, { ok: false, error: 'Could not reach YouTube.' }, origin, env);
}
