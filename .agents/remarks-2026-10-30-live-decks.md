# 2026-10-30 · Live decks round (all 13 lessons on the n08 model)

Omer's request: "תתקן את הטעויות במצגות ותשכתב את שאר השיעורים לפי הסגנון שגיבשנו". Chosen scope (his answer):
live opening slide instead of the agenda/overview slide, live demos instead of static drawings, an exercise slide
with questions. Guides updated to match. n08 itself only got a note fix (see below) and the A-key rule.

Backups of everything replaced (14 decks, 14 guide PDFs, 14 guide sources): `tmp/rewrite-review/before-2026-10-30-live-decks/`.
Device copies were checked unchanged since the previous delivery before overwriting. All 42 files sha256-verified after commit.

## Process
1. One builder agent per lesson (brief kept in the cloud workspace; same rules as n08: one `<style>` + one `<script>`
   block per deck, inputs stop key propagation, animations pause without `motion-on`, every demo checked against an
   independent Python reference, guide sections rewritten in the detailed style).
2. Central checks: one note per slide, footer/eyebrow numbering, `node --check`, no visible em/en dashes, bidi scan,
   guide h2 = deck title one-to-one, guide head byte-identical, render at 1920x1080, nav-bar clearance.
3. Four independent technical reviewers (RF x2, Windows networking x2) re-drove every demo and fixed confirmed errors.
4. Clean judges on every new/changed slide and guide section (242 elements): 28 flagged "ai", rewritten, re-judged
   (2 left, fixed by hand). The systemic tell was guide text narrating the deck's own notes ("לפי הערות השקופית",
   "ההערה מבקשת") and changelog sentences ("התכנון הקודם היה..."); swept from all 13 guides.

## New A-key rule (all 14 decks)
`A` now also pauses CSS animations (`.deck-root:not(.motion-on) * {animation-play-state:paused}`), not only SVG/JS ones.

## Slides and durations (slides before → after, recommended duration in the guide)
r01 9→11 (60-65) · r02 14→16 (69) · r03 12→14 (65-70) · r04 11→14 (70-75) · r05 14→16 (81) · r06 30→31 (~115) ·
n01 13→15 (65) · n02 14→16 (73) · n03 17→19 (~75) · n04 14→16 (~70) · n05 15→17 (75) · n06 13→15 (~60) · n07 13→15 (70).
**Every lesson is now longer (demos + exercise cost roughly 8-20 minutes each).** The guides' time plans state
what each new slide costs, and most say what to drop when time is short. r06 (~115) and n08 (~105) need two sessions or a cut.

## Errors fixed by the technical reviewers (beyond the builders' own list)
- r03: bidi of "dB, dBm" in slide 1 note and guide.
- r04: limits slide claimed the standing-wave maximum sits on the load for any resistive load (true only for R > Z0;
  fixed in deck and guide); slide 14 calculator rejected forward = reflected with 0 dB cable (full reflection is real).
- r05: tile label "מגיע לאנטנה" showed more power at the antenna than entered the line at 0 dB cable; now "קדמי בקצה האנטנה".
- r06: slide 5 verdict "מעל 14dB" under 15 cm was false for most of the range (now "מעל 10dB"); guide ranges 37%→28%
  and the 45°→"מעל 30°" threshold corrected to what the demos show.
- n01: slide 13 note said a 10G station card "changes nothing" (RTT drops 1.30→1.27 ms); guide counter example 2/13→2/15.
- n02, n04: bidi in column lists and slide 12 subtitle; n04 guide: "Destination host unreachable" is ARP failure
  (no route gives "General failure").
- n05: guide named the wrong messages for fault 3 (demo shows `*** Default servers are not available`).
- n06: renew error text is lower-case "unable to contact your DHCP server" (real Windows output).
- n07: slide 4 title "רוב תקלות הכבילה הן במחבר" was unsupported → "המחבר הוא נקודה חלשה בכבילה"; slide 6 demo
  said "the side on Auto" for a fixed/fixed duplex mismatch (separate result added); PoE glossary wording.
- n08: slide 27 note and guide described lesson 3's handshake in the old order; now "Hello, גזירת מפתחות, תעודה ו-Finished".

## Open for Omer (not changed)
- **Illustrative values** in demos and exercises (addresses, voltages, distances, cable losses, times) were chosen
  by the agents. They are labelled as examples, not unit data; replace with unit values if wanted.
- n06: slide 1 note "רוב התחנות אצלנו סטטיות בכוונה" and demo text "כך מוגדרות התחנות בסביבה הסטטית שלנו" state how
  the unit's stations are set up. They predate this round; confirm or change.
- n01 guide: "אם יש לכם דוגמה מהיחידה לשירות שעובד לאט, הציגו אותה כאן" (placeholder for a unit example).
- r06: simulator shows an amber warning on the "recommended" low tie (gap just under 0.25 m). Physics is fine; if it
  confuses, change `a<.25` to `a<.2` in the simulator and the guide paragraph on slide 9.
- r06 slide 22: "מתכת שנוגעת בבסיס משנה הרבה יותר ממתכת שנוגעת בקצה" is questionable (metal at the high-voltage tip
  detunes strongly). Predates this round; worth a review.
- r06: 9 em dashes remain inside JS comments (invisible).
- In all decks, arrow/space/A while a **slider** has focus still drives the deck (text fields are protected). Kept as
  a house-wide behaviour; the guides say so.
- r02 slide 15: FM deviation "exaggerated פי אלפים" (really ~×10⁴); loose, not wrong.
- n02 slide 14 demo treats an off-subnet gateway (e.g. /29) as reachable, while n04's ipconfig demo flags it; edge case
  not used in the guides.
- n04 guide slide 8 uses the simulator's DNS 10.20.4.10 while the preparation section says slides 3-10 use 10.20.10.10.
- n07 guide: "המכשיר מקבל קצת פחות" understates the 802.3bt Type 4 drop (90 W at the switch, ~71 W at the device).
- n08 guide h2 headings use short names on 11 slides (approved pilot); the other 13 guides use exact deck titles.
- `index.html` lesson descriptions were checked and still match the topics; not changed.
- Codex could not be used (the PC's `~/.codex/config.toml` has `model = "gpt-6.1-sol"`, which is rejected); not changed.
