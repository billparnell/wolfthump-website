# Wolfthump — Product Brief

## What it is
A one-page website for Wolfthump, Mike Wofchuck's Afro-Brazilian bateria /
drum-funk drumline out of Chico, CA. Hero, video, about, photos, booking.

## Who it's for
People booking the band: festival and event organizers, venues, private
parties. Many are older and non-technical, so the booking path has to be
obvious and forgiving.

## The booking path
The page's main job is to turn a visitor into a booking inquiry.

## Decisions

- **2026-10-25: Booking is a form, not a published email address.** There is no
  booking mailbox yet, and an address on a public page gets scraped. The form
  hides the inbox, and moving the inbox later is a settings change.
  - Fields: **name, email, message**. Kept minimal on purpose; event date,
    venue and similar can come later if inquiries turn out to need them.
  - After sending, the page says thanks and that we'll be in touch. **The copy
    must not promise Mike personally** — someone else may answer.
  - The sender gets a short **confirmation email** with fixed wording.
  - Inquiries go to Bill's email until Mike says which address he wants.
  - Spam protection is required, not optional (the bocce-app bot-signup lesson).
- **2026-10-25: The site stays on GitHub Pages and DNS stays at NameSilo.** The
  form backend is a separate Cloudflare Worker on `workers.dev`, so neither has
  to move. See `TECH_DESIGN.md`.

- **2026-10-25: The address is `https://wolfthump.com`** (no `www`). The `www`
  form and the old github.io link redirect to it.
- **2026-10-25: booking@wolfthump.com exists but isn't published on the page.**
  It forwards to Bill for now and moves to Mike later. It's the reply address on
  the confirmation email, and the band can give it out by hand.

- **2026-11-19: Videos come from YouTube and nobody edits code to add one.**
  - One source: the **"Featured" playlist** on the channel. Whoever manages the
    channel adds *any* public YouTube video to it (their own uploads, fan clips,
    venue clips) with Save → Featured in the YouTube app. Non-YouTube links
    (Facebook, Instagram) are out of scope.
  - **Home page:** keeps a single video, which is **the first video in the
    Featured playlist**. To change it, drag another video to the top of the
    playlist in YouTube Studio. Below it, a "More videos" link.
  - **`videos.html`:** the Featured playlist, **in the playlist's own order**.
    Videos from other channels show a small credit line ("Posted by …").
    **No dates on the cards** (2026-11-19): YouTube's date is when a clip was
    uploaded, not when it was played, which confused more than it helped. Put
    the show date in the video's title instead, as the Women's Club clips do.
  - **Changed 2026-11-19 (same day):** channel uploads are *not* pulled in
    automatically any more. The first version merged them in, newest first.
    Bill: "we might have videos we don't want to show up on the website." So an
    upload reaches the site only when it's added to Featured, and the
    playlist's drag order is the page's order. (YouTube Studio can add a video
    to a playlist during upload.)
  - Limits we accept: only the playlist's first 15 videos come through, and a
    change can take up to an hour to show.

## Out of scope (for now)
- Calendars, pricing, availability, payments.
- Any login or admin. (Videos are managed in YouTube, not on our site.)
