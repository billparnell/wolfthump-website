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

## Out of scope (for now)
- Calendars, pricing, availability, payments.
- Any login or admin.
