# Wolfthump — Backlog

One phase per session. Pick the top unchecked phase and execute it.
Context is in [`PRODUCT_BRIEF.md`](PRODUCT_BRIEF.md) and [`TECH_DESIGN.md`](TECH_DESIGN.md).

---

## iPhone crash fix (2026-11-19) — needs Bill's phone test
Bill saw scroll glitches and Safari's "A problem repeatedly occurred" page on
the home page after the YouTube embed went in. That message is Safari killing
the page, almost always memory/GPU. Not reproduced; best guess is the YouTube
player stacked under the full-screen, fixed, live SVG noise filter.
- [x] Grain overlay is now a pre-rendered tile `img/noise.png` (see TECH_DESIGN).
- [x] Home-page YouTube iframe has `loading="lazy"`. CSS `?v=8`.
- [ ] **Not browser-checked by Claude** (Chrome extension not connected, local
      server blocked). Bill: check the grain still looks right, then scroll the
      home page and videos page on the iPhone a few times.
- [x] Bill: still glitching with the tile. **Grain overlay disabled** (rule
      commented out in `default.css`, `?v=9`). Hero tagline now says
      "Modern-Day" (hyphen) so Bill can tell when the deploy is live; keep or
      revert as he likes.
- [x] What Bill saw "moving in slow motion" wasn't the grain: it's the
      **water-ripple canvas** (`#water-canvas`, since May): fixed, full-screen,
      redrawn every frame, `mix-blend-mode: screen` over the YouTube iframe,
      and wiped on every iOS address-bar `resize`. Prime suspect. **Turned off**
      (`WATER_ON = false` in `index.html` + `display: none` in CSS, `?v=10`).
- [ ] Bill: confirm on iPhone that the glitches are gone. If yes, decide:
      leave water off, or bring it back without the blend and resize reset.
      Then decide whether the grain comes back (it was probably innocent).
- [ ] If it still glitches with both off, next suspects in order: the
      YouTube iframe (test by temporarily swapping in a click-to-load
      thumbnail), the hero's infinite ripple animations, the logo's double
      `drop-shadow` filter.

## Videos (decided 2026-11-19, see PRODUCT_BRIEF)

### Phase V0 — Bill/Mike, on YouTube — ✅ DONE 2026-11-19
- [x] Channel `@wolfthumpgrooves`, channel ID **`UCvJxyIG6eTOkeZhJ7zi3brQ`**.
- [x] Public playlist "Featured", ID **`PLMbeFSuVov64`** (a newer, shorter ID
      format, but it's correct: the feed and the playlists page both confirm it).
- [x] Both feeds return 200 with entries (checked with curl): the Women's Club
      11/13/26 clips (Maracatu, Goosebumps, …) are on the channel and in Featured.
      `https://www.youtube.com/feeds/videos.xml?channel_id=…` / `?playlist_id=…`

### Phase V1 — Home page embed — ✅ DONE 2026-11-19
- [x] `index.html`: the self-hosted `<video>` is now a
      `youtube-nocookie.com/embed/videoseries?list=PLMbeFSuVov64` iframe, which
      starts on the playlist's first video. The existing `.video-wrap iframe` CSS
      sizes it, so no CSS change. Bill checked it locally and it looks good.
- [x] "More videos" button **moved to V3**, so it never points at a page that
      doesn't exist yet.
- [x] ~~Ask about the `video/` files~~ → one open item under "Review fixes".

### Phase V2 — Worker `/videos` route — ✅ DONE 2026-11-19
- [x] `worker/videos.mjs` + a `/videos` route in `contact.mjs`: fetch both feeds,
      parse, merge, de-dupe, newest first, JSON. CORS for the site origins only.
      Caching is in memory, because the Cache API is a no-op on workers.dev. See TECH_DESIGN.
- [x] `YT_CHANNEL_ID`, `YT_PLAYLIST_ID` in `wrangler.jsonc` vars.
- [x] 9 tests added to `worker/contact.test.mjs` (24 total, all passing). Also
      ran against the live YouTube feeds: 3 videos, right order and headers.
- [x] **Bill deployed** 2026-11-19 and the curl check returned the list. (In his Terminal, repo folder:
      `npx wrangler deploy -c worker/wrangler.jsonc`, then check
      `curl -s -H 'Origin: https://wolfthump.com' https://wolfthump-contact.bparnell.workers.dev/videos`
      returns `{"ok":true,"videos":[…]}`. This redeploys the booking form too,
      so send one test inquiry from the live site afterwards.)
- [ ] Bill: send one test booking inquiry from wolfthump.com to confirm the
      redeploy didn't break the form.

### Phase V3 — `videos.html` — ✅ DONE 2026-11-19 (not pushed)
- [x] "More videos" button under the home-page video → `videos.html`.
- [x] `videos.html`: logo home link, cards (thumbnail + play ring, title, date,
      "Posted by …" for other channels), tap to play in place, one at a time.
      Fetches the Worker's `/videos`; same-origin `/videos` on localhost.
- [x] Error state: plain apology + "See us on YouTube" button.
- [x] `default.css` styles; `?v=4` on both pages. TECH_DESIGN updated.
- [x] Checked at 375×812 (DevTools emulation, live YouTube data): no sideways
      scroll (fixed a 500px-wide grid), 3 cards, tap swaps in the player and
      restores the previous one, error state. Console clean apart from the
      Turnstile 110200 that every local preview gets (wrong hostname).
- [x] Pushed. The iPhone check found the two-tap bug; the open check is under "Featured-only".
- [x] ~~`video/` files~~ → one open item under "Review fixes".

### Review fixes — 2026-11-19 (`/code-review` + `/security-review`)
`/security-review`: no findings. From `/code-review`:
- [x] Worker keeps each feed's last good list; one feed failing for good no
      longer freezes the other.
- [x] After any feed failure, wait 5 minutes before asking YouTube again.
- [x] Out-of-range `&#…;` codes in a title stay as text instead of throwing.
- [x] `/videos/` (trailing slash) reaches the video list.
- [x] New CSS colors are `:root` tokens; dropped the dead `.video-wrap video`
      rule; `?v=5` on both pages. Rechecked at 375px, same look.
- [x] 4 new tests, 28 total, all passing.
- [x] ~~Bill: redeploy the Worker~~ (folded into "Featured-only" below).
- [x] iPhone check found it took **two taps**. Fixed 2026-11-19: each card is
      now YouTube's own player (one tap, like the home page), our full title
      under it, and starting one pauses the others. `?v=7`.
- [ ] **Bill: confirm on the iPhone that one tap plays with sound**
      and that starting a second video pauses the first. (Headless Chrome isn't
      Safari, so this is the one thing only the phone can confirm.)
- [ ] Bill to decide: delete `video/` (old home-page mp4 + poster, still public
      at /video/…) or add `video/` to `_config.yml` exclude. Don't delete unasked.

### Featured-only, in playlist order — 2026-11-19
- [x] Cards no longer show the upload date (Bill: confusing; the show date is
      in some titles). Only other channels' videos get a "Posted by" line.
      Page-only change, no Worker deploy needed. Checked at 375px.
- [x] Bill's call: the site shows **only** the Featured playlist, in its own
      order; channel uploads are no longer merged in (some shouldn't be on the
      site). `worker/videos.mjs` reads one feed; tests rewritten (26, all
      passing); live run gives the real playlist order.
- [x] Bill's own commit `1a80cd0` removed the "Watch Wolfthump" heading and
      the "Tap a video to play it." line from `videos.html`.
- [x] Worker redeployed and pushed. Confirmed live at /wrap 2026-11-19: `/videos`
      returns Maracatu, Goosebumps, Samba Duro; `/videos/` answers 200;
      wolfthump.com/videos.html serves `?v=7` with the YouTube players.
- [x] Bill OK'd: the "Videos" label is now the page's `<h1>`, same look (checked
      at 375px); unused `.videos-intro` and old `h1` CSS removed; `?v=6`.

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
- [x] **wolfthump.com go-live** — ✅ DONE 2026-10-25:
  - [x] Bill has a NameSilo sub-user on Mike's account.
  - [x] NameSilo DNS: parking records deleted; four GitHub A records on `@`,
        `www` CNAME → `billparnell.github.io` (see TECH_DESIGN "Domain").
  - [x] `CNAME` file (`wolfthump.com`) committed and pushed.
  - [x] Turnstile hostname `wolfthump.com` added; Bill's form test passed.
  - [x] Certificate issued (Let's Encrypt, 2026-10-25). `https://wolfthump.com`,
        `www.` and the old github.io link all land on the site.
  - [x] Enforce HTTPS ticked. Curl-checked: `http://`, `www.` and the old
        github.io link all land on `https://wolfthump.com/`.
- [x] **booking@wolfthump.com** forwards to Bill's Gmail (NameSilo, free).
      `MAIL_TO` = Bill's Gmail + booking@, `MAIL_REPLY_TO` = booking@. See
      TECH_DESIGN "booking@wolfthump.com".
- [x] **booking@ handed to Mike** (2026-10-25): NameSilo forward `booking` →
      Mike's personal email. `MAIL_TO` = `booking@wolfthump.com, Bill's Gmail`,
      so each inquiry reaches Mike (via forward) and Bill (direct).
- [x] Test from a third address to booking@ reached Mike (2026-10-25).
- [ ] Mike: never-spam rule in his mail app for mail To `booking@wolfthump.com`
      (forwarded mail tended to land in Bill's spam). Not confirmed he's added it.
- [ ] Bill's open question from the first phone test: "right-justified" form?
      Never clarified after the restyle; ask before changing anything.
- [ ] Optional: send from `@wolfthump.com` instead of `parnellprojects.com`
      (verify the domain in Resend, add its records at NameSilo, change
      `MAIL_FROM`). Uses a Resend domain slot; Bill thinks 2 of 3 are used.
- [x] Facebook link is live (`facebook.com/wolfthumpmusic`). Bandcamp and Instagram are
      commented out in `index.html` until the band has them.

---

## Log

### Where we are (2026-11-19, end of session — supersedes the notes below)
- **State:** live at https://wolfthump.com. Everything is pushed, and the
  Worker is deployed (both checked with curl at /wrap). The tree is clean and
  `node --test worker/contact.test.mjs` passes 26/26.
  - **Home page:** plays the first video in the YouTube **Featured** playlist
    (channel `@wolfthumpgrooves`), with a "More videos" button under it.
  - **`videos.html`:** the Featured playlist in **playlist order**, one
    YouTube player per card, with our full title under each and "Posted by …"
    for other channels' videos. No dates. Starting one video pauses the others.
  - **Managed entirely in YouTube:** add a video to Featured to show it, drag
    to reorder, and the top video is the home-page video. Changes show within
    about an hour. Channel uploads that aren't in Featured stay off the site on
    purpose.
- **Waiting on Bill:**
  1. On the iPhone: confirm **one tap** plays a video on videos.html with
     sound, and that starting a second one pauses the first. Headless Chrome
     can't test this; only the phone can.
  2. Send **one test booking inquiry** from wolfthump.com. The Worker has been
     redeployed twice since the form was last tested.
  3. Decide what happens to `video/` (the old home-page mp4 + poster, unused
     but still public at /video/…): delete it, or add `video/` to the
     `_config.yml` exclude. **Don't delete it without his OK.**
- **Next task:** none queued. The videos feature is done. If the phone check
  fails, see TECH_DESIGN "Videos" → "Why the real player" for what's been
  tried.
- **For the next session:** to check 375px without the Chrome extension, read
  PLAYBOOK "Checking 375px from the terminal" and reuse `groove-bank/tools/`
  (CDP driver). This session rebuilt that from scratch. The local preview needs
  a server that answers `/videos` too (see TECH_DESIGN "videos.html" → VIDEOS_URL).

- **2026-11-19:** Video cards are YouTube's own players now (iPhone needed
  two taps with our thumbnails). Page-only; push is enough. Bill confirms one
  tap on the phone.

- **2026-11-19:** Videos page now shows only the Featured playlist, in
  playlist order. Waiting on Bill: Worker redeploy, push, iPhone check, `<h1>`
  question, the `video/` decision.

- **2026-11-19:** Both reviews run. Security: clean. Code-review fixes done
  and committed (see "Review fixes"). Waiting on Bill: Worker redeploy, push,
  iPhone tap check, the `video/` decision.

- **2026-11-19:** Videos V3 done: `videos.html` and the "More videos" button. The
  whole videos feature is built; it's live once Bill pushes. Open items: phone
  check, test booking inquiry after the Worker redeploy, the old `video/` files.

- **2026-11-19:** Videos V2 built and committed: Worker `GET /videos`. Not
  deployed yet (Bill runs the deploy). Next: V3, `videos.html`.

- **2026-11-19:** Videos V0 + V1 done. The home page plays the first video in the
  YouTube "Featured" playlist. Next: V2, the Worker `/videos` route.

### Where we are (2026-10-25, end of day — supersedes the older note below)
- **State:** live at **https://wolfthump.com** (GitHub Pages, HTTPS enforced).
  The booking form works on it. Inquiries go to `booking@wolfthump.com` (NameSilo
  forward → Mike's personal email) and Bill's Gmail; replies to the confirmation
  go to booking@. Tests 15/15. Everything is pushed; nothing in flight.
- **Waiting on Bill/Mike:** Mike adds a never-spam rule for booking@ mail.
- **Next task:** nothing urgent. Pick from "Later": Bandcamp/Instagram links when
  the band has them, or the optional `@wolfthump.com` sender.
- **Where things live:** DNS + email forwarding at NameSilo (Bill's sub-user on
  Mike's account); Worker, Turnstile and secrets in Bill's Cloudflare; Resend key
  in Bill's Resend. Secret values: MAIL_TO = booking@ + Bill's Gmail,
  MAIL_REPLY_TO = booking@.

- **2026-10-25 (late afternoon):** wolfthump.com is live on GitHub Pages with a
  certificate. booking@wolfthump.com forwards to Bill's Gmail via NameSilo;
  `MAIL_TO` and `MAIL_REPLY_TO` updated, form test passed. Bill added a Gmail
  never-spam filter for booking@. Open: tick Enforce HTTPS; later, hand booking@
  to Mike.
- **2026-10-25 (evening):** booking@ now forwards to Mike; `MAIL_TO` is booking@ +
  Bill's Gmail. Bill ticked Enforce HTTPS; at last check `http://` hadn't started
  redirecting yet (GitHub can lag); it was redirecting by the wrap. Mike's test to
  booking@ came through.

- **2026-10-25 (afternoon, with Mike):** Bill set up a NameSilo sub-user and
  pointed DNS at GitHub Pages. Main address decided: `https://wolfthump.com`.
  `CNAME` file committed. Waiting on Bill: Turnstile hostname, push, Enforce
  HTTPS. Then Claude runs the go-live checks above.

### Earlier note (2026-10-25, first session — stale)
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
