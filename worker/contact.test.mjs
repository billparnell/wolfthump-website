// Run: node --test worker/contact.test.mjs
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import worker, { validate, CONFIRMATION_TEXT } from './contact.mjs';

const ORIGIN = 'https://billparnell.github.io';
const ENV = {
  RESEND_API_KEY: 're_test', TURNSTILE_SECRET: 'ts_test',
  MAIL_TO: 'inbox@example.com', MAIL_FROM: 'Wolfthump <wolfthump@example.com>',
  ALLOWED_ORIGINS: ORIGIN + ',https://wolfthump.com'
};
const GOOD = { name: 'Pat', email: 'pat@example.com', message: 'Can you play June 3?',
               website: '', elapsed: 8000, turnstile: 'tok' };

let calls, turnstileOk, resendOk;
beforeEach(() => {
  calls = []; turnstileOk = true; resendOk = [true, true];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('turnstile')) return Response.json({ success: turnstileOk });
    const ok = resendOk.shift();
    return new Response(ok ? '{}' : 'nope', { status: ok ? 200 : 500 });
  };
});

function post(body, { origin = ORIGIN, env = ENV, method = 'POST' } = {}) {
  const req = new Request('https://w.example/', {
    method, headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': '1.2.3.4' },
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
  });
  return worker.fetch(req, env);
}
const emails = () => calls.filter(c => c.url.includes('resend')).map(c => JSON.parse(c.init.body));

test('good submission emails the inbox and confirms to the sender', async () => {
  const res = await post(GOOD);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
  const [inquiry, confirm] = emails();
  assert.deepEqual(inquiry.to, ['inbox@example.com']);
  assert.equal(inquiry.reply_to, 'pat@example.com');
  assert.match(inquiry.text, /Can you play June 3\?/);
  assert.deepEqual(confirm.to, ['pat@example.com']);
  assert.equal(confirm.text, CONFIRMATION_TEXT);
});

test('confirmation never exposes MAIL_TO and carries no sender text', async () => {
  await post({ ...GOOD, name: 'Buy pills at spam.example' });
  const confirm = emails()[1];
  assert.equal(confirm.reply_to, undefined);
  assert.doesNotMatch(JSON.stringify(confirm), /inbox@example\.com|spam\.example/);
});

test('MAIL_REPLY_TO sets the confirmation reply-to', async () => {
  await post(GOOD, { env: { ...ENV, MAIL_REPLY_TO: 'booking@wolfthump.com' } });
  assert.equal(emails()[1].reply_to, 'booking@wolfthump.com');
});

test('MAIL_TO may list several inboxes, comma-separated', async () => {
  await post(GOOD, { env: { ...ENV, MAIL_TO: 'a@example.com, b@example.com,' } });
  const [inquiry, confirm] = emails();
  assert.deepEqual(inquiry.to, ['a@example.com', 'b@example.com']);
  assert.doesNotMatch(JSON.stringify(confirm), /a@example|b@example/);
});

test('honeypot and too-fast submissions fake success and send nothing', async () => {
  for (const body of [{ ...GOOD, website: 'http://x' }, { ...GOOD, elapsed: 500 }, { ...GOOD, elapsed: undefined }]) {
    calls = [];
    const res = await post(body);
    assert.equal(res.status, 200);
    assert.equal(calls.length, 0);
  }
});

test('failed Turnstile is rejected without sending', async () => {
  turnstileOk = false;
  const res = await post(GOOD);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /human/);
  assert.equal(emails().length, 0);
});

test('missing Turnstile token is rejected without calling Cloudflare', async () => {
  const res = await post({ ...GOOD, turnstile: '' });
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test('unknown origin is forbidden', async () => {
  const res = await post(GOOD, { origin: 'https://evil.example' });
  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);
});

test('preflight from an allowed origin gets CORS headers', async () => {
  const res = await post(null, { method: 'OPTIONS' });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
});

test('GET is not allowed', async () => {
  assert.equal((await post(null, { method: 'GET' })).status, 405);
});

test('missing config answers 503', async () => {
  const { MAIL_TO, ...partial } = ENV;
  assert.equal((await post(GOOD, { env: partial })).status, 503);
});

test('bad JSON and oversized bodies are rejected', async () => {
  assert.equal((await post('{nope')).status, 400);
  assert.equal((await post({ ...GOOD, message: 'x'.repeat(30000) })).status, 413);
});

test('inquiry send failure is reported; confirmation failure is not', async () => {
  resendOk = [false];
  assert.equal((await post(GOOD)).status, 502);
  resendOk = [true, false];
  assert.equal((await post(GOOD)).status, 200);
});

test('rate limiter blocks when it says no', async () => {
  const env = { ...ENV, LIMITER: { limit: async () => ({ success: false }) } };
  assert.equal((await post(GOOD, { env })).status, 429);
  assert.equal(calls.length, 0);
});

test('validate trims, flattens the name, and checks each field', () => {
  assert.deepEqual(validate({ name: ' Pat\r\nBcc: x ', email: ' a@b.co ', message: ' hi ' }),
                   { name: 'Pat Bcc: x', email: 'a@b.co', message: 'hi' });
  assert.match(validate({ email: 'a@b.co', message: 'hi' }).error, /name/);
  assert.match(validate({ name: 'P', email: 'nope', message: 'hi' }).error, /email/);
  assert.match(validate({ name: 'P', email: 'a@b.co', message: '  ' }).error, /message/);
  assert.match(validate({ name: 'x'.repeat(101), email: 'a@b.co', message: 'hi' }).error, /long/);
});

// ── GET /videos (videos.mjs) ──
import { parseFeed, toVideos, handleVideos, _resetMemo } from './videos.mjs';

const US = 'UCvJxyIG6eTOkeZhJ7zi3brQ';
const VENV = { ALLOWED_ORIGINS: ORIGIN, YT_CHANNEL_ID: US, YT_PLAYLIST_ID: 'PLtest' };
const entry = (id, title, published, channelId = US, name = 'Wolfthump') => `
 <entry>
  <id>yt:video:${id}</id>
  <yt:videoId>${id}</yt:videoId>
  <yt:channelId>${channelId}</yt:channelId>
  <title>${title}</title>
  <author><name>${name}</name><uri>https://www.youtube.com/channel/${channelId}</uri></author>
  <published>${published}</published>
  <media:group><media:title>${title}</media:title></media:group>
 </entry>`;
const feed = (...entries) => `<?xml version="1.0"?><feed><title>Featured</title>${entries.join('')}</feed>`;

// Playlist order on purpose: not date order (the newest video is last).
const PLAYLIST_XML = feed(entry('aaaaaaaaaaa', 'Maracatu', '2026-11-19T16:04:19+00:00'),
                          entry('ccccccccccc', 'Fan clip &amp; &#39;friends&#39;', '2026-11-15T10:00:00+00:00',
                                'UCother0000000000000000', 'Joe&apos;s Bar'),
                          entry('bbbbbbbbbbb', 'Samba Duro', '2026-11-19T19:00:07+00:00'));

let playlist;  // the feed's reply: XML text, or an HTTP status number
function stubFeed() {
  calls = [];
  globalThis.fetch = async (url) => {
    calls.push({ url });
    return typeof playlist === 'number' ? new Response('', { status: playlist }) : new Response(playlist);
  };
}
function getVideos({ env = VENV, origin = ORIGIN, method = 'GET', path = '/videos', now } = {}) {
  const req = new Request('https://w.example' + path, { method, headers: origin ? { origin } : {} });
  return now === undefined ? worker.fetch(req, env) : handleVideos(req, env, now);
}

test('parseFeed reads id, title, date and channel, decoding entities', () => {
  const [v] = parseFeed(feed(entry('ccccccccccc', 'A &amp; B &#x2014; &quot;live&quot;', '2026-01-01T00:00:00+00:00',
                                   'UCx', 'Joe&apos;s Bar')));
  assert.deepEqual(v, { id: 'ccccccccccc', title: 'A & B — "live"', published: '2026-01-01T00:00:00+00:00',
                        channel: "Joe's Bar", channelId: 'UCx' });
});

test('parseFeed skips entries with a missing or odd video id', () => {
  assert.deepEqual(parseFeed(feed(entry('bad"id<x>', 'X', '2026-01-01T00:00:00Z'), '<entry><title>no id</title></entry>')), []);
  assert.deepEqual(parseFeed('not xml at all'), []);
});

test('an out-of-range character code in a title is left as text', () => {
  const [v] = parseFeed(feed(entry('eeeeeeeeeee', 'Odd &#9999999; &#x110000; ok &#65;', '2026-01-01T00:00:00Z')));
  assert.equal(v.title, 'Odd &#9999999; &#x110000; ok A');
});

test('toVideos keeps playlist order, drops repeats, and marks our videos', () => {
  const entries = parseFeed(PLAYLIST_XML);
  const out = toVideos([...entries, entries[0]], US);
  assert.deepEqual(out.map(v => [v.id, v.ours]),
                   [['aaaaaaaaaaa', true], ['ccccccccccc', false], ['bbbbbbbbbbb', true]]);
  assert.equal(out[1].channel, "Joe's Bar");
  assert.equal('channelId' in out[0], false);
});

test('GET /videos returns the Featured playlist in its order, with CORS for the site', async () => {
  _resetMemo(); playlist = PLAYLIST_XML; stubFeed();
  const res = await getVideos();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
  assert.match(res.headers.get('cache-control'), /max-age=600/);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.videos.map(v => v.id), ['aaaaaaaaaaa', 'ccccccccccc', 'bbbbbbbbbbb']);
  assert.equal(calls.length, 1, 'only the playlist feed is read');
  assert.match(calls[0].url, /playlist_id=PLtest/);
});

test('GET /videos works without booking secrets and gives other origins no CORS', async () => {
  _resetMemo(); playlist = PLAYLIST_XML; stubFeed();
  const res = await getVideos({ origin: 'https://evil.example' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('the list is reused for an hour, then refetched; stale beats an outage', async () => {
  _resetMemo(); playlist = PLAYLIST_XML; stubFeed();
  const t0 = 1_000_000_000_000;
  await getVideos({ now: t0 });
  await getVideos({ now: t0 + 59 * 60_000 });
  assert.equal(calls.length, 1, 'served from memory');
  playlist = 503;
  const res = await getVideos({ now: t0 + 61 * 60_000 });
  assert.equal(calls.length, 2, 'refetched after an hour');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).videos.length, 3, 'last good list');
});

test('after a failure, YouTube is retried in 5 minutes, not on every visit', async () => {
  _resetMemo(); playlist = 503; stubFeed();
  const t0 = 1_000_000_000_000;
  assert.equal((await getVideos({ now: t0 })).status, 502, 'nothing cached yet');
  await getVideos({ now: t0 + 4 * 60_000 });
  assert.equal(calls.length, 1, 'no refetch inside the retry wait');
  playlist = PLAYLIST_XML;
  const res = await getVideos({ now: t0 + 5 * 60_000 });
  assert.equal(calls.length, 2, 'retried after 5 minutes');
  assert.equal(res.status, 200);
});

test('a reordered playlist shows up in the new order', async () => {
  _resetMemo(); playlist = PLAYLIST_XML; stubFeed();
  const t0 = 1_000_000_000_000;
  await getVideos({ now: t0 });
  playlist = feed(entry('bbbbbbbbbbb', 'Samba Duro', '2026-11-19T19:00:07+00:00'),
                  entry('aaaaaaaaaaa', 'Maracatu', '2026-11-19T16:04:19+00:00'));
  const body = await (await getVideos({ now: t0 + 61 * 60_000 })).json();
  assert.deepEqual(body.videos.map(v => v.id), ['bbbbbbbbbbb', 'aaaaaaaaaaa']);
});

test('GET /videos needs its IDs and only allows GET', async () => {
  _resetMemo(); playlist = PLAYLIST_XML; stubFeed();
  assert.equal((await getVideos({ env: { ALLOWED_ORIGINS: ORIGIN } })).status, 503);
  assert.equal((await getVideos({ method: 'POST' })).status, 405);
  assert.equal(calls.length, 0);
});

test('/videos/ with a trailing slash reaches the video list', async () => {
  _resetMemo(); playlist = PLAYLIST_XML; stubFeed();
  const res = await getVideos({ path: '/videos/' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).videos.length, 3);
});
