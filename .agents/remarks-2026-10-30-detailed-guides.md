# Remarks - detailed instructor guides for all lessons (2026-10-30)

Omer approved the n08 pilot guide ("המדריך טוב, תעבור לשאר המדריכים"). The other 13 guides were rewritten to the
same model: per slide "על המסך", background, demo walkthrough, "בשטח", real trainee Q&A, common mistakes; prep page
(goal, preparation, keys, time plan with slide ranges, slide numbers = nav counter); appendix (slide map with exact
deck titles, test/example values, glossary). Heads (CSS) byte-identical. Brief: cloud workspace `GUIDE_BRIEF.md`.

## Method
- One writer agent per lesson (deck dump + Playwright run of every demo/simulator), then an independent technical
  reviewer per 1-3 lessons (`REVIEW_BRIEF.md`) who fixed confirmed errors in place, then clean "is this AI?" judges
  on all 276 guide sections (4 flagged, fixed, re-judged to 0).
- Reviewer fixes worth knowing: r01 near-field extent (~λ/2π, not one wavelength), slide 9 drawing does show E/B in
  phase; r03 interference "much like" noise, 12.5 kHz channels use ~2.5 kHz deviation; r04 arrow keys, quarter wave
  at 30 MHz = 2.5 m, misaimed antenna keeps a normal (not "perfect") SWR; r05 polarization does not change SWR, S21
  is out of scope (not impossible); n01 GEO RTT wording, downshift "can" happen; n03 public certificate lifetime
  (200 days since 15 Mar 2026, CA/B ballot SC-081), Chrome/Edge do not log TLS failures to Schannel; n04 window sides
  on slides 7/12, Event Viewer copy path, Phase Offset caveat; n06 duplicate detection when a station was off;
  r06 reversed current starts past λ/2, ground loss improves SWR only when small, reflector/director 5% relative to
  the driven element, removed an invented claim that the rules match unit installation orders.

## Sizes (pages): r01 7→12, r02 8→12, r03 8→12, r04 9→15, r05 9→14, r06 15→29, n01 8→15, n02 8→14, n03 8→14,
n04 8→22, n05 8→13, n06 9→14, n07 8→16 (n08 25). Several are above the 2-3x target; writers named the easiest cuts.

## Timing corrections (durations kept, totals made honest)
r02 rows = 56 min (chips said 50-55); r05 = 62 (said 55-60); r06 rows ≈ 101 vs stated 85-90 (kept, flagged in guide);
r04 overlapping ranges fixed; n04 says 9 min for slides 11-13 incl. simulator is tight (stop after step 4).

## Deck problems found (NOT fixed; decks untouched in this pass) - decision for Omer
- r06: slide 15 "2.5 ס״מ" should be ~2.5 m (body + note); old-numbering slide references in notes of slides
  1, 3, 9, 15, 18, 20, 26, 27; simulator panel points to "גבולות המודל" (actual title "מגבלות הסימולטור וההדגמות");
  slide 29 "קשירה נמוכה יותר ⟵ פחות טווח" contradicts slides 6/10/11 (means lowering the tip); slide 4 bars (64% at
  λ/2) are a simplified model; slide 10 card says 30° but shows 27°; slide 6 table 0.43 m vs simulator 0.25 m;
  slide 22 "ground loss improves SWR" only true for small loss.
- r02: "6 dB" renders "dB 6" (slide 6), "150 MHz" renders "MHz 150" (slide 9); slide 11 envelope drawing; slide 12
  carrier position. r03: slide 11 "≈ 1 W" reversed. r01: slide 7 animation shows one-way flow for AC.
- n02: slide 9 route print 10.20.40.0 via 10.20.30.2 contradicts slides 2/5; slide 2 lines to B leave the gateway box.
- n04: no "simulator limits" slide (guide has a full page instead); simulator's correct answer is always the first
  button; Phase Offset shown without /verbose; slide 7 tracert first hop contradicts route print.
- n05: slide 4 same IP on reference and fault; slide 7 title (prefix) vs diagram (address); slide 8 Linux-style arp.
- n06: slide 10 terminal text is invented ("(released)", "Sending DISCOVER"); slide 4 excerpt order; slide 5 captions
  overlap. n07: slide 9 title "שמונה גידים" wrong for 802.3af/at; slide 4 connector drawing not T568B; slide 10 LEDs.
- House-wide: "A" only pauses SMIL animations; CSS animations keep moving unless the OS reduces motion.

## Backups
Device: `tmp/rewrite-review/before-2026-10-30-detailed-guides/` (13 PDFs + 13 sources). Delivered files sha256-verified 26/26.
