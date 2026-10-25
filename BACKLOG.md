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
- [x] `npx wrangler login`: already logged in from groove-bank.
- [x] Deployed: `https://wolfthump-contact.bparnell.workers.dev`. It answers
      503 "not switched on yet" until all secrets are set (checked with curl).
- [x] `MAIL_FROM` secret set.
- [x] Bill, in his own Terminal: `npx wrangler secret put <NAME> -c worker/wrangler.jsonc`
      for TURNSTILE_SECRET, RESEND_API_KEY, MAIL_TO (his Gmail for now).
- [x] Real Turnstile site key `0x4AAAAAAFlmLSyv_cTDlIYJ` is in the page (widget
      "Wolfthump booking", hostname `billparnell.github.io`). `CONTACT_URL` matches
      the deployed Worker. **Push only after the three secrets above are set.**
- [x] `ALLOWED_ORIGINS` confirmed: the page is served at `https://billparnell.github.io/wolfthump-website/wolfthump_index.html`.

### Phase 4 — End-to-end and review — ✅ DONE 2026-10-25
- [x] Real submission from the live page on a phone: inquiry arrives, Reply-To
      works, confirmation arrives and doesn't land in spam. ✅ Bill confirmed 2026-10-25.
- [x] Live curls, 2026-10-25: all four secrets listed. A fake or missing
      Turnstile token gets 400, a foreign or missing Origin 403, honeypot a fake
      200, GET 405, and preflight 204 with the right CORS origin. The rate limit
      does engage (429s in a 15-request burst) but only loosely; see TECH_DESIGN.
- [x] **`/security-review` before announcing the form.** No findings, 2026-10-25.

### Later
- [x] Site renamed to `index.html`, so the bare URL works. `wolfthump_index.html`
      redirects there. Verify after push: `curl -sL <base>/wolfthump_index.html`.
- [x] `_config.yml` keeps docs and `worker/` off the live site. **After the push,
      check that `/BACKLOG.html`, `/CLAUDE.md` and `/worker/contact.mjs` return 404.**
- [x] Favicon and apple-touch icon, from the logo's drum.
- [x] `MAIL_TO` takes a comma-separated list. Worker redeployed. Bill sets
      `MAIL_TO` to both his and Mike's addresses.
- [ ] Before each push: offer `/code-review`.
- [x] Post-push checks: docs and `worker/` 404 on the live site; redirect and
      favicon 200.
- [ ] **wolfthump.com go-live** (in progress 2026-10-25):
  - [x] Bill has a NameSilo sub-user on Mike's account.
  - [x] NameSilo DNS: parking records deleted; four GitHub A records on `@`,
        `www` CNAME → `billparnell.github.io` (see TECH_DESIGN "Domain").
  - [x] `CNAME` file (`wolfthump.com`) committed and pushed.
  - [x] Turnstile hostname `wolfthump.com` added; Bill's form test passed.
  - [x] Certificate issued (Let's Encrypt, 2026-10-25). `https://wolfthump.com`,
        `www.` and the old github.io link all land on the site.
  - [ ] **Bill: GitHub repo → Settings → Pages → tick Enforce HTTPS.** As of
        2026-10-25 `http://wolfthump.com` still serves plain http, and the old
        github.io link forwards to `http://`. Then Claude rechecks with curl.
- [x] **booking@wolfthump.com** forwards to Bill's Gmail (NameSilo, free).
      `MAIL_TO` = Bill's Gmail + booking@, `MAIL_REPLY_TO` = booking@. See
      TECH_DESIGN "booking@wolfthump.com".
- [ ] **Hand booking@ to Mike** (when he's ready): NameSilo → Email Forwarding →
      change `booking`'s destination to Mike's address. Then have Mike add a
      never-spam rule for mail To `booking@wolfthump.com` in his mail app. Then
      Bill may drop his Gmail from `MAIL_TO` (`npx wrangler secret put MAIL_TO
      -c worker/wrangler.jsonc`, value `booking@wolfthump.com`).
- [x] Facebook link is live (`facebook.com/wolfthumpmusic`). Bandcamp and Instagram are
      commented out in `index.html` until the band has them.

---

## Log

- **2026-10-25 (late afternoon):** wolfthump.com is live on GitHub Pages with a
  certificate. booking@wolfthump.com forwards to Bill's Gmail via NameSilo;
  `MAIL_TO` and `MAIL_REPLY_TO` updated, form test passed. Bill added a Gmail
  never-spam filter for booking@. Open: tick Enforce HTTPS; later, hand booking@
  to Mike.

- **2026-10-25 (afternoon, with Mike):** Bill set up a NameSilo sub-user and
  pointed DNS at GitHub Pages. Main address decided: `https://wolfthump.com`.
  `CNAME` file committed. Waiting on Bill: Turnstile hostname, push, Enforce
  HTTPS. Then Claude runs the go-live checks above.

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

- **2026-10-25 (wrap-up):** Renamed to `index.html` with a redirect, excluded the
  docs and Worker from Pages, added the favicon, and `MAIL_TO` now accepts several
  inboxes. Pending on Bill: push, set `MAIL_TO` for both inboxes, and run the
  post-push 404 checks above.
- **2026-10-25 (late night):** The form is live and working (Bill's phone test passed).
  Facebook is linked, Bandcamp and Instagram are hidden, CSS is at `?v=3`. Booking-form
  Phases 1–4 are done. Next is the Later list; the top item is the index.html rename.
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
