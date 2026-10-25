// Wolfthump booking form backend — a Cloudflare Worker.
//
// The site is static on GitHub Pages, so the form POSTs JSON here. This file
// checks that a human sent it, then emails the booking inbox (MAIL_TO) with
// Reply-To set to the sender, and sends the sender a short fixed confirmation.
// TECH_DESIGN.md "Booking form" has the why behind every check.
//
// Secrets (set with `npx wrangler secret put`, never committed — this repo is
// served publicly by GitHub Pages):
//   RESEND_API_KEY    re_… sending key
//   TURNSTILE_SECRET  Cloudflare Turnstile secret key
//   MAIL_TO           where inquiries land — personal inbox for now
//   MAIL_FROM         e.g. "Wolfthump <wolfthump@parnellprojects.com>"
//   MAIL_REPLY_TO     optional — Reply-To on the confirmation. Leave unset until
//                     a public booking address exists; never set it to MAIL_TO.
// Plain var (worker/wrangler.jsonc):
//   ALLOWED_ORIGINS   comma-separated origins allowed to post the form
// Optional binding: LIMITER (Workers rate limiting). Missing = no limit.

const LIMITS = { name: 100, email: 254, message: 5000, body: 20000 };
const MIN_FILL_MS = 3000;  // faster than this is a script, not a person
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUIRED = ['RESEND_API_KEY', 'TURNSTILE_SECRET', 'MAIL_TO', 'MAIL_FROM', 'ALLOWED_ORIGINS'];

function json(status, body, origin) {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (origin) Object.assign(headers, corsHeaders(origin));
  return new Response(JSON.stringify(body), { status, headers });
}

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    'vary': 'Origin'
  };
}

function allowedOrigins(env) {
  return env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
}

// One line, no control characters — for the subject and the "From:" line.
function oneLine(s) {
  return s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function validate(data) {
  const name = oneLine(String(data.name ?? ''));
  const email = String(data.email ?? '').trim();
  const message = String(data.message ?? '').trim();
  if (!name) return { error: 'Please tell us your name.' };
  if (name.length > LIMITS.name) return { error: 'That name is too long.' };
  if (!EMAIL_RE.test(email) || email.length > LIMITS.email) {
    return { error: 'Please check your email address.' };
  }
  if (!message) return { error: 'Please write a short message.' };
  if (message.length > LIMITS.message) return { error: 'That message is too long. Please shorten it.' };
  return { name, email, message };
}

async function verifyTurnstile(token, ip, env) {
  if (!token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: form
  });
  if (!res.ok) return false;
  const out = await res.json();
  return out.success === true;
}

async function sendEmail(env, message) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'authorization': 'Bearer ' + env.RESEND_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ from: env.MAIL_FROM, ...message })
  });
  if (!res.ok) throw new Error('resend ' + res.status + ' ' + (await res.text()).slice(0, 200));
}

function inquiryEmail(env, { name, email, message }) {
  return {
    to: [env.MAIL_TO],
    reply_to: email,
    subject: 'Booking inquiry from ' + name,
    text: `New message from the Wolfthump website.\n\n` +
          `Name:  ${name}\nEmail: ${email}\n\n${message}\n\n` +
          `— Hit reply to answer ${name} directly.`
  };
}

// Fixed text on purpose: nothing the sender typed goes into it, so the form
// can't be used to send someone else an email with a spammer's words in it.
export const CONFIRMATION_TEXT =
  `Thanks for reaching out to Wolfthump!\n\n` +
  `We got your message and we'll be in touch soon.\n\n` +
  `— Wolfthump\nFor the Love of the Groove`;

function confirmationEmail(env, { email }) {
  const msg = { to: [email], subject: 'Thanks for contacting Wolfthump', text: CONFIRMATION_TEXT };
  if (env.MAIL_REPLY_TO) msg.reply_to = env.MAIL_REPLY_TO;
  return msg;
}

export default {
  async fetch(request, env) {
    const missing = REQUIRED.filter(k => !env[k]);
    if (missing.length) return json(503, { ok: false, error: 'The form is not switched on yet.' });

    const origin = request.headers.get('origin') || '';
    if (!allowedOrigins(env).includes(origin)) return json(403, { ok: false, error: 'Forbidden.' });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' }, origin);

    const ip = request.headers.get('cf-connecting-ip') || '';
    if (env.LIMITER) {
      const { success } = await env.LIMITER.limit({ key: ip || 'unknown' });
      if (!success) return json(429, { ok: false, error: 'Too many tries. Please wait a minute and try again.' }, origin);
    }

    const raw = await request.text();
    if (raw.length > LIMITS.body) return json(413, { ok: false, error: 'That message is too long. Please shorten it.' }, origin);
    let data;
    try { data = JSON.parse(raw); } catch { data = null; }
    if (!data || typeof data !== 'object') return json(400, { ok: false, error: 'Something went wrong. Please try again.' }, origin);

    // Honeypot filled, or submitted faster than a person can type: pretend it
    // worked so the bot learns nothing, and send nothing.
    if (data.website || !(Number(data.elapsed) >= MIN_FILL_MS)) return json(200, { ok: true }, origin);

    const fields = validate(data);
    if (fields.error) return json(400, { ok: false, error: fields.error }, origin);

    if (!(await verifyTurnstile(data.turnstile, ip, env))) {
      return json(400, { ok: false, error: 'Please complete the "I am human" check and try again.' }, origin);
    }

    try {
      await sendEmail(env, inquiryEmail(env, fields));
    } catch (err) {
      console.error('inquiry send failed', err);
      return json(502, { ok: false, error: 'Sorry, your message did not go through. Please try again in a few minutes.' }, origin);
    }

    // The inquiry is what matters; a failed confirmation is logged, not shown.
    try {
      await sendEmail(env, confirmationEmail(env, fields));
    } catch (err) {
      console.error('confirmation send failed', err);
    }

    return json(200, { ok: true }, origin);
  }
};
