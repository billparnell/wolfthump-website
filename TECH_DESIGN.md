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
| Rate limit (`LIMITER`, 3/min per IP) | caps anyone who gets past Turnstile. **Loose by design:** Cloudflare's limiter counts per data center and is eventually consistent, so a live burst got 4 of 15 refused, not 12. It's a backstop, not the gate. | 429 |
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

**Sender domain, decided 2026-10-25:** `MAIL_FROM` is
`Wolfthump <wolfthump@parnellprojects.com>`, reusing the already-verified shared
domain (PLAYBOOK §3), so there's no DNS work at NameSilo. Moving to
`@wolfthump.com` later means verifying it in Resend and changing that one secret.

**The page side** is in `wolfthump_index.html`, in the inline script next to the
form. It does the same empty, email and Turnstile checks before sending, so a
visitor sees the message without a round trip. It sends
`{name,email,message,website,elapsed,turnstile}` to `CONTACT_URL`, the constant
at the top of that script, then swaps the form for the thank-you card. On an
error it shows the Worker's message, keeps what they typed, and resets
Turnstile, because each token works only once.

## Tests
`node --test worker/contact.test.mjs`. It needs no dependencies, mocks `fetch`,
and covers every row of the table above.

## Visual system
Tokens are on `:root` in `css/default.css` (deep-water / teal / cream / gold),
with Cinzel for headings and Crimson Pro for body text, 18px base.

- **`.booking-card`** is the one card in the booking area. The form and the
  thank-you are both one. Field labels and inputs are 1.15rem (18.4px), and
  inputs and the button are at least 56px tall.
- **Error text is `--gold`.** There's no red in this palette, and gold reads as
  "look here" without clashing.
- **`[hidden] { display: none !important }`** is a global rule. Any component
  that sets `display` would otherwise beat the `hidden` attribute. The Phase 2
  check caught exactly that bug: the thank-you card was always visible.
- **`.hero { overflow: hidden }`**: the 520px decorative rings made the page
  448px wide at 375px, so it could drag sideways on a phone. This was there
  before the form; found during the Phase 2 check.
- **Headless check at 375px:** with the Chrome extension not connected, use
  `groove-bank/tools/cdp.js`. The Phase 2 script drove the real page and Worker
  with Turnstile's test keys and Resend stubbed out.
