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

### Phase 2 — Form on the page — ✅ DONE 2026-10-25
- [x] Replace the `mailto:` booking card in `wolfthump_index.html` with a form:
      name, email, message. Labels above the fields, inputs ≥56px tall, text ≥18px,
      one big Send button. Style it with the existing tokens in `css/default.css`.
- [x] Hidden honeypot field `website`: off-screen, `tabindex="-1"`,
      `autocomplete="off"`, `aria-hidden`.
- [x] Turnstile widget (`https://challenges.cloudflare.com/turnstile/v0/api.js`),
      site key in the HTML (it's public). Use the **test site key**
      `1x00000000000000000000AA` until Phase 3.
- [x] JS: record when the form appeared, then POST JSON
      `{name,email,message,website,elapsed,turnstile}` to the Worker URL
      (a constant at the top of the script).
- [x] Success: replace the form with "Thanks! We'll be in touch soon." **Don't
      name Mike.** Error: show the Worker's `error` text above the button, keep
      what they typed, and reset Turnstile.
- [x] Send button disabled while sending, with a "Sending…" label.
- [x] Check at 375px in a browser; no console errors (only the missing favicon 404).
      Also fixed the hero widening the page to 448px.

### Phase 3 — Accounts, secrets, deploy — ✅ DONE 2026-10-25
- [x] **Sender decided:** `Wolfthump <wolfthump@parnellprojects.com>`, so no
      DNS work. `MAIL_TO` is Bill's Gmail for now.
- [x] Cloudflare → Turnstile → add a widget for the page's hostnames → copy the
      site key (goes in the HTML) and the secret key (goes into a Worker secret).
- [x] Resend → new API key for this app only (PLAYBOOK §3: one key per app).
- [x] `npx wrangler login`: already logged in from groove-bank (account bparnell@gmail.com).
- [x] Deployed: `https://wolfthump-contact.bparnell.workers.dev`. It answers
      503 "not switched on yet" until all secrets are set (checked with curl).
- [x] `MAIL_FROM` secret set.
- [x] Bill, in his own Terminal: `npx wrangler secret put <NAME> -c worker/wrangler.jsonc`
      for TURNSTILE_SECRET, RESEND_API_KEY, MAIL_TO (his Gmail for now).
- [x] Real Turnstile site key `0x4AAAAAAFlmLSyv_cTDlIYJ` is in the page (widget
      "Wolfthump booking", hostname `billparnell.github.io`). `CONTACT_URL` matches
      the deployed Worker. **Push only after the three secrets above are set.**
- [x] `ALLOWED_ORIGINS` confirmed: the page is served at `https://billparnell.github.io/wolfthump-website/wolfthump_index.html`.

### Phase 4 — End-to-end and review
- [ ] Real submission from the live page on a phone: inquiry arrives, Reply-To
      works, confirmation arrives and doesn't land in spam.
- [x] Live curls, 2026-10-25: all four secrets listed. A fake or missing
      Turnstile token gets 400, a foreign or missing Origin 403, honeypot a fake
      200, GET 405, and preflight 204 with the right CORS origin. The rate limit
      does engage (429s in a 15-request burst) but only loosely; see TECH_DESIGN.
- [ ] **`/security-review` before announcing the form.**

### Later
- [ ] When wolfthump.com points at the site: add it to the Turnstile widget's
      hostnames (Cloudflare → Turnstile → Wolfthump booking). It's already in
      `ALLOWED_ORIGINS`.
- [ ] Booking mailbox: NameSilo free email forwarding for `booking@wolfthump.com`,
      then set `MAIL_TO` and/or `MAIL_REPLY_TO`. Needs Mike's call.
- [ ] Social links in the booking section are still `href="#"`.
- [ ] No favicon (404 in the console on every load).

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

- **2026-10-25 (night):** Phone screenshot showed an unstyled form, because
  GitHub Pages' 10-minute cache served old CSS to the new page. Fixed with
  `default.css?v=2`. Turnstile is now interaction-only (no box for most people).
  Security review: no findings. Open: Bill asked about right-justifying the
  form; decide after he sees the styled version.
- **2026-10-25 (evening):** Worker deployed with all secrets, real Turnstile key in
  the page, and live curls green. Waiting on: Bill runs `/security-review`, pushes, then
  sends one real message from his phone (Phase 4, first item).
- **2026-10-25 (later):** Bateria replaces Batucada (Mike). Phase 2 done; the
  form was checked end to end at 375px against the real Worker locally.
- **2026-10-25:** Decided on a form instead of a published email (PRODUCT_BRIEF).
  Built and tested the Worker backend (Phase 1). Next: Phase 2.
