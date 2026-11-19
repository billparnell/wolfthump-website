# Wolfthump — Tech & Design

## Stack
- **Site:** one static HTML page (`index.html`) + `css/default.css`,
  hosted on **GitHub Pages**. No build step. DNS for wolfthump.com is at
  **NameSilo**.
- **Booking form backend:** a Cloudflare Worker, `worker/contact.mjs`, deployed
  by hand to `wolfthump-contact.<subdomain>.workers.dev`. It is not a Cloudflare
  static site, so PLAYBOOK §9's assets setup doesn't apply; only the
  wrangler login and secrets steps do.
- **Email:** Resend HTTP API.

**What's published:** GitHub Pages builds the repo with Jekyll, and
`_config.yml` excludes the docs and `worker/` (2026-10-25). Before that,
`/BACKLOG.html`, `/CLAUDE.md` and `/worker/contact.mjs` were all served on the
live site. The repo itself is public on github.com, so **never commit a secret**.
All secrets live in Cloudflare, set with `wrangler secret put`.

**Domain (2026-10-25):** `https://wolfthump.com` is the main address; the
`CNAME` file in the repo root tells GitHub Pages that, and GitHub redirects
`www.wolfthump.com` and the old `billparnell.github.io/wolfthump-website/` to it.
NameSilo DNS (Bill has a sub-user on Mike's account, limited to this domain):

| Name | Type | Value |
|---|---|---|
| `@` | A | `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` (four rows) |
| `www` | CNAME | `billparnell.github.io` |
| `_domainconnect` | TXT | NameSilo's own; leave it |

| `@` | MX | `mx4.emailowl.com` (10), `mx5.emailowl.com` (20), `mx6.emailowl.com` (30) |

The NameSilo parking records (Service "Forwarding") were deleted. NameSilo's
add-record form won't take a blank hostname: use `@` for the bare domain. The
MX records were added by hand, **not** with NameSilo's "Email Forwarding
Template", which may replace the site's records.

**booking@wolfthump.com (2026-10-25):** NameSilo's free email forwarding
(Domain Manager → wolfthump.com → Email Forwarding, at the bottom of the page;
the paid "email" item in the sidebar is a real mailbox, not needed).
- **One destination per alias.** NameSilo won't take several addresses or
  repeat an alias. `booking@` → Mike's personal email (since 2026-10-25;
  briefly Bill's Gmail while testing).
- **`MAIL_TO` = `booking@wolfthump.com` + Bill's Gmail**, so the form reaches
  whoever `booking@` points at, plus Bill directly. Changing who answers is one
  edit in NameSilo; the Worker doesn't change.
- **`MAIL_REPLY_TO` = `booking@wolfthump.com`**, so replies to the confirmation
  email reach the band. The address is on no page; the form is the way in.
- **Forwarded mail lands in Gmail spam** (the forwarder breaks SPF for the
  original sender). Fix on each receiving inbox: a Gmail filter To
  `booking@wolfthump.com` → Never send it to Spam + Categorize as Primary.
- **Symptom/fix:** a test bounced with `554 5.7.1 Relay access denied` from
  emailowl. The MX records worked but the forward hadn't reached NameSilo's mail
  servers yet. It worked after a wait. If it persists, delete and re-add the
  forward now that MX exists.
- Free alternative if forwarding gets flaky: Cloudflare Email Routing (needs
  wolfthump.com's nameservers moved to Cloudflare; one destination per rule,
  so two inboxes needs an email Worker).

**URL:** the site is `index.html` (renamed 2026-10-25; before that the bare
URL showed the README). `wolfthump_index.html` is now a `noindex` redirect to
`./` that keeps the `#hash`, so links already shared still work.

**Favicon:** `img/favicon-32.png` and `img/apple-touch-icon.png` (180px). Both
are the bullseye drum from the logo's centre, cropped to the rings, inverted to
cream on `--deep-water`, and rendered with headless Chrome. The full crest is
mush below 64px.

## Videos

**Home page (2026-11-19):** the `.video-wrap` holds a
`youtube-nocookie.com/embed/videoseries?list=PLMbeFSuVov64` iframe. YouTube
starts it on the first video in the channel's **Featured** playlist, so the
home-page video changes when someone reorders the playlist in YouTube Studio,
with no code change. Channel `@wolfthumpgrooves` = `UCvJxyIG6eTOkeZhJ7zi3brQ`.
The self-hosted `video/womens_club_2025.mp4` is no longer used.

**`GET /videos` on the Worker (2026-11-19)** feeds `videos.html`. It lives in
`worker/videos.mjs`; `contact.mjs` routes the `/videos` path there before any
booking checks, so the two don't share config requirements.
- Reads **one** public YouTube feed, with **no API key**:
  `youtube.com/feeds/videos.xml?playlist_id=YT_PLAYLIST_ID` (the Featured
  playlist). `YT_CHANNEL_ID` is only used to tell our videos from other
  channels'. Both are plain vars in `wrangler.jsonc`; public IDs. The feed holds
  the playlist's **first 15** videos, **in playlist order** (checked against the
  playlist page 2026-11-19: Maracatu, Goosebumps, Samba Duro, which isn't date
  order). Until the same day it also merged the channel's uploads, newest
  first; dropped so unlisted uploads stay off the site (PRODUCT_BRIEF).
- Parses `<entry>` blocks with regexes (Workers have no DOMParser) and decodes
  XML entities. An entry whose video id isn't `[\w-]{6,20}` is dropped, because
  the id goes into URLs on the page.
- Keeps the feed's order and drops a repeat of a video already listed. Returns
  `{ ok, videos: [{ id, title, published, channel, ours }] }`; `ours` is false
  for videos from other channels, so the page can add "Posted by {channel}".
- **Caching:** the Cache API is a no-op on `workers.dev`, so each isolate keeps
  the last good list in memory and reuses it for an hour. If a fetch fails it
  serves that last list, and YouTube isn't asked again for **5 minutes**, not
  on every visit. No list ever loaded → 502 (for up to 5 minutes, then a
  retry). Browsers may reuse a 200 for 10 minutes (`max-age=600`). So a
  playlist change shows up within about an hour.
- Numeric character codes outside Unicode (`&#9999999;`) are left as text,
  because `String.fromCodePoint` would throw and drop the whole feed.
- The route matches `/videos` and `/videos/`.
- CORS: `access-control-allow-origin` only for `ALLOWED_ORIGINS`. Other callers
  (curl) still get the data, since it's public anyway. GET only.

**`videos.html` (2026-11-19):** a second page, linked from the "More videos"
button under the home-page video. Small logo (links home), the "Videos" label (it's the page's `<h1>`,
styled as a `.section-label`),
then one `.video-card` per video, built in vanilla JS from a `<template>`
with `textContent` only (titles come from strangers' YouTube channels, so
never `innerHTML`). Video ids are checked against `[\w-]{6,20}` again before
they go into a URL.
- **Card (reworked 2026-11-19):** YouTube's own player (a `youtube-nocookie`
  iframe, `loading="lazy"`, `enablejsapi=1`), then our full title, then
  "Posted by {channel}" when `ours` is false (`hidden` otherwise). No date: the
  Worker still sends `published`, but it's the upload date, not the show date.
  - **Why the real player, not a thumbnail:** the first version showed our own
    thumbnail and swapped in the player on a tap. On Bill's iPhone that needed
    **two taps**: iOS only plays sound when the tap lands on the player
    itself. Muted autoplay was rejected (a silent video looks broken to this
    audience). The home-page embed always worked in one tap for the same reason.
  - **Why our title stays:** at phone width YouTube's overlay title is cut off at
    "Wolfthump - Women's Club Chic…", before the song name that tells the videos apart.
  - **One at a time:** `https://www.youtube.com/iframe_api` is loaded and each
    iframe is wrapped in `YT.Player`; when one reports PLAYING, the others that
    are playing get `pauseVideo()`. If that script fails, the players still
    work; two could just play at once. Checked in headless Chrome (muted):
    states went [1,5,5] → [2,1,5]. YouTube's widget script logs harmless
    "Failed to execute 'postMessage'" warnings before each player loads.
  - Lazy players load as you scroll near them; a full-page screenshot that
    doesn't scroll shows the lower ones as dark boxes. That's expected.
- Load failure or an empty list → "Sorry, the videos didn't load…" and the
  "See us on YouTube" button (always on the page) is the way out.
- `VIDEOS_URL` is the Worker on the real site. On `localhost`/`127.0.0.1` it's
  same-origin `/videos`, because the Worker only gives CORS to the real site; a
  local preview server answers `/videos` by running `worker/contact.mjs`.
- No water canvas on this page; it's an inline script on the home page only.
- **Grid gotcha:** `.video-list` columns are `minmax(0, 1fr)`, not `1fr`.
  Plain `1fr` wouldn't shrink below the old thumbnail's 480px intrinsic width,
  and the page was ~500px wide on a phone until that was fixed. Kept for the
  players too.

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
1. **Inquiry → `MAIL_TO`**, which can be a comma-separated list (one email,
   every inbox on the To line), with `Reply-To` set to the sender, so answering is just
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

**The page side** is in `index.html`, in the inline script next to the
form. It does the same empty, email and Turnstile checks before sending, so a
visitor sees the message without a round trip. It sends
`{name,email,message,website,elapsed,turnstile}` to `CONTACT_URL`, the constant
at the top of that script, then swaps the form for the thank-you card. On an
error it shows the Worker's message, keeps what they typed, and resets
Turnstile, because each token works only once.

## Tests
`node --test worker/contact.test.mjs`. It needs no dependencies, mocks `fetch`,
and covers every row of the booking table above plus `/videos` (parsing,
entities, playlist order kept, repeats dropped, reordering, CORS, hourly
reuse, 5-minute retry wait, stale-on-outage, bad character codes, trailing
slash, 502, 503, 405). The `videos … feed 500` lines in the output are expected logs.

## Visual system
Tokens are on `:root` in `css/default.css` (deep-water / teal / cream / gold),
with Cinzel for headings and Crimson Pro for body text, 18px base.

- **One card family:** `.booking-card` and `.video-card` share the same border and
  background rule. Video cards drop the padding so the thumbnail runs edge to edge.
- **Colors added with videos.html are tokens:** `--night`, `--night-deep`,
  `--pale-water-30` (the play-ring tokens went with the custom thumbnails). Older rules still have the
  same values spelled out; switch them over when touching those rules.
- **One button:** `.form-button`. On an `<a>` (`a.form-button`) it centers its
  label with flex: "More videos" and "See us on YouTube".
- **Checking 375px without the Chrome extension:** headless Chrome on macOS won't
  open a window narrower than about 500px, so `--window-size=375,…` screenshots
  are wrong (they crop a wider layout). Use the DevTools protocol's
  `Emulation.setDeviceMetricsOverride` (375×812, mobile) instead. Headless also
  draws the logo's `mix-blend-mode: screen` as a faint box, on both pages; real
  browsers don't.

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
- **Turnstile is `data-appearance="interaction-only"`.** The box only shows
  when Cloudflare wants a click, so most visitors never see it. Chosen
  2026-10-25 because the always-on box looked clunky.
- **Bump `?v=` on the stylesheet link whenever `default.css` changes.** GitHub
  Pages sends `cache-control: max-age=600`. On the first phone test the new
  HTML arrived with the old CSS, which showed the honeypot, the thank-you card
  and browser-default inputs. Versioning the link makes the new page fetch the
  new CSS.
- **Headless check at 375px:** with the Chrome extension not connected, use
  `groove-bank/tools/cdp.js`. The Phase 2 script drove the real page and Worker
  with Turnstile's test keys and Resend stubbed out.
