# Wolfthump — Backlog

One phase per session. Pick the top unchecked phase and execute it.
Context is in [`PRODUCT_BRIEF.md`](PRODUCT_BRIEF.md) and [`TECH_DESIGN.md`](TECH_DESIGN.md).

---

## Booking form

### Phase 1 — Worker backend — ✅ DONE 2026-10-25
- [x] `worker/contact.mjs`: origin check, rate limit, honeypot, timer,
      validation, Turnstile, inquiry + fixed confirmation via Resend
- [x] `worker/wrangler.jsonc`: name, `ALLOWED_ORIGINS`, rate-limit binding
- [x] `worker/contact.test.mjs`: 14 tests, `node --test worker/contact.test.mjs`

### Phase 2 — Form on the page
- [ ] Replace the `mailto:` booking card in `wolfthump_index.html` with a form:
      name, email, message. Labels above the fields, inputs ≥56px tall, text ≥18px,
      one big Send button. Style it with the existing tokens in `css/default.css`.
- [ ] Hidden honeypot field `website`: off-screen, `tabindex="-1"`,
      `autocomplete="off"`, `aria-hidden`.
- [ ] Turnstile widget (`https://challenges.cloudflare.com/turnstile/v0/api.js`),
      site key in the HTML (it's public). Use the **test site key**
      `1x00000000000000000000AA` until Phase 3.
- [ ] JS: record when the form appeared, then POST JSON
      `{name,email,message,website,elapsed,turnstile}` to the Worker URL
      (a constant at the top of the script).
- [ ] Success: replace the form with "Thanks! We'll be in touch soon." **Don't
      name Mike.** Error: show the Worker's `error` text above the button, keep
      what they typed, and reset Turnstile.
- [ ] Send button disabled while sending, with a "Sending…" label.
- [ ] Check at 375px in a browser; no console errors.

### Phase 3 — Accounts, secrets, deploy (Bill's hands, Claude gives the steps)
- [ ] **Decide the sender:** reuse `parnellprojects.com` (no DNS work) or verify
      `wolfthump.com` at NameSilo. See TECH_DESIGN "Sender domain".
- [ ] Cloudflare → Turnstile → add a widget for the page's hostnames → copy the
      site key (goes in the HTML) and the secret key (goes into a Worker secret).
- [ ] Resend → new API key for this app only (PLAYBOOK §3: one key per app).
- [ ] `npx wrangler login` in Terminal (not via `!`; PLAYBOOK §9).
- [ ] `npx wrangler deploy -c worker/wrangler.jsonc`, then
      `npx wrangler secret put <NAME> -c worker/wrangler.jsonc` for
      RESEND_API_KEY, TURNSTILE_SECRET, MAIL_TO (Bill's email for now), MAIL_FROM.
- [ ] Put the real Worker URL and Turnstile site key in the page, commit.
- [ ] Confirm `ALLOWED_ORIGINS` matches where the page is actually served.

### Phase 4 — End-to-end and review
- [ ] Real submission from the live page on a phone: inquiry arrives, Reply-To
      works, confirmation arrives and doesn't land in spam.
- [ ] `curl` without Turnstile → rejected; with a foreign Origin → 403.
- [ ] **`/security-review` before announcing the form.**

### Later
- [ ] Booking mailbox: NameSilo free email forwarding for `booking@wolfthump.com`,
      then set `MAIL_TO` and/or `MAIL_REPLY_TO`. Needs Mike's call.
- [ ] Social links in the booking section are still `href="#"`.

---

## Log

### Where we are (2026-10-25, end of session)
- **State:** the live site is unchanged and still shows the old
  `mailto:booking@wolfthump.com` card, which probably goes nowhere. The form
  backend (`worker/`) is built, and its 14 tests pass. It isn't deployed and has
  no accounts or secrets yet. Nothing is in flight.
- **Waiting on Bill:**
  - Push `main` when ready. It's safe: the Worker code being published by Pages
    is harmless, and the page doesn't change until Phase 2.
  - **Where is the page actually live?** The repo has no `CNAME` file, and the
    page is `wolfthump_index.html`, not `index.html`. `ALLOWED_ORIGINS` in
    `worker/wrangler.jsonc` is a guess
    (`billparnell.github.io`, `wolfthump.com`, `www.wolfthump.com`). Confirm it
    before Phase 3.
  - **Thank-you copy:** Claude read "it might not always be Mike" as "don't
    name Mike", so the copy is "Thanks! We'll be in touch soon." Confirm, or give
    the exact wording.
  - Sender domain choice (Phase 3), and Mike's eventual inbox (Later).
- **Next task:** Phase 2, the form on the page. It needs no accounts, because it
  uses Turnstile's test site key.

- **2026-10-25:** Decided on a form instead of a published email (PRODUCT_BRIEF).
  Built and tested the Worker backend (Phase 1). Next: Phase 2.
