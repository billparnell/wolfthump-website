# Wolfthump — Tech & Design

## Stack
- **Site:** one static HTML page (`wolfthump_index.html`) + `css/default.css`,
  hosted on **GitHub Pages**. No build step. DNS for wolfthump.com is at
  **NameSilo**.
- **Booking form backend:** a Cloudflare Worker, `worker/contact.mjs`, deployed
  by hand to `wolfthump-contact.<subdomain>.workers.dev`. It is not a Cloudflare
  static site, so PLAYBOOK §9's assets setup doesn't apply; only the
  wrangler login and secrets steps do.
- **Email:** Resend HTTP API.

⚠️ **GitHub Pages publishes the whole repo**, including `worker/` and these
docs. That's fine as long as no secret is ever committed. All secrets live in
Cloudflare, set with `wrangler secret put`.

## Booking form

**Flow:** the page POSTs JSON to the Worker, and the Worker runs these checks
in order:

| Check | Why | On failure |
|---|---|---|
| Config present | safe before secrets are set | 503 "not switched on yet" |
| `Origin` in `ALLOWED_ORIGINS` | stops other sites posting through it, and is the CORS allow-list | 403 |
| Rate limit (`LIMITER`, 3/min per IP) | caps anyone who gets past Turnstile | 429 |
| Body ≤ 20 KB, valid JSON | cheap junk filter | 413 / 400 |
| Honeypot `website` empty | bots fill every field | **fake 200, nothing sent** |
| `elapsed` ≥ 3 s since the form appeared | scripts submit instantly | **fake 200, nothing sent** |
| Field validation | name ≤100, email shape ≤254, message ≤5000 | 400, plain-language message |
| **Cloudflare Turnstile** verified server-side | the real human check | 400 "complete the check" |

Then two emails go out through Resend:
1. **Inquiry → `MAIL_TO`**, with `Reply-To` set to the sender, so answering is just
   pressing reply.
2. **Confirmation → the sender.** The wording is fixed and contains **nothing
   the sender typed**, not even their name. Otherwise the form could send a
   stranger an email carrying a spammer's words. Its `Reply-To` is
   `MAIL_REPLY_TO` if set, otherwise none. **Never set it to `MAIL_TO`**: that
   would hand the private inbox to anyone who fills in the form.

If the inquiry fails, the visitor sees a 502 and is told to retry. If the
confirmation fails, it's only logged, because the inquiry already landed.

The honeypot and timer return a fake success on purpose, so a bot never learns
which check caught it.

**Config:** the secrets and vars are listed at the top of `worker/contact.mjs`,
and `ALLOWED_ORIGINS` plus the rate limit are in `worker/wrangler.jsonc`.

**Sender domain (open, decide in Phase 3):** either reuse the already-verified
`parnellprojects.com` (no DNS work; PLAYBOOK §3) or verify `wolfthump.com` by
adding Resend's records at NameSilo. Either way it's only `MAIL_FROM`.

## Tests
`node --test worker/contact.test.mjs`. It needs no dependencies, mocks `fetch`,
and covers every row of the table above.

## Visual system
Tokens are on `:root` in `css/default.css` (deep-water / teal / cream / gold),
with Cinzel for headings and Crimson Pro for body text, 18px base.
