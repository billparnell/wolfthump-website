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
