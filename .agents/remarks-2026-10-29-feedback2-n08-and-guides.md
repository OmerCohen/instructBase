# Remarks - Omer's second feedback round (2026-10-29): relevance, titles, lesson 8, detailed guides

Request (Omer, sampling the decks on a projector): (1) technical remarks nobody in class cares about
(e.g. n08 map slide "כל ההדגמות מחושבות בדפדפן, בלי חיבור לרשת"); (2) titles that name a specific example
instead of the concept (n08 "מה הצפנה נותנת, ולמה Base64 הוא לא הצפנה" -> "קידוד מול הצפנה"); (3) add the
keystream topic (short key -> keystream for gigabytes without repetition) to n08, move Atbash/Caesar to an
exercise; (4) instructor guides must be much more detailed: a full explanation so the instructor understands
what he presents. Decks are projected, not shown on phones.

Decisions taken with Omer (2026-10-29): guides -> pilot on lesson 8 first, then the other 13 after approval;
each slide gets background + expected questions with answers + common mistakes (no read-aloud script);
keystream slide in part B right after XOR; Atbash/Caesar exercise at the end of part A.

## What changed
- All 14 decks: on-screen slide footer hidden (`@media screen{.stage .footer{display:none}}`, one extra
  `<style>` before `.deck-root`). Cause: the nav bar overlays the bottom of the stage at 16:9 (1920x1080,
  1366x768), so footer text rendered under the buttons. NOT a phone-only issue as the 2026-10-29 remarks said.
  Print/PDF still shows the footer; the nav counter shows "N / total". Measured: no other content under the nav.
- Sweep for kind (1)/(2) by context-aware reviewers (not the context-free judges, which missed both kinds):
  r02 s5, r05 s1, r06 s2/s6/s9/s13, n01 s8, n03 s1 meta remarks removed; n06 s12 and n07 s12 "not covered in this
  lesson" lists moved to the speaker note; titles r06 s12 "תבניות קרינה לפי סוג אנטנה", r06 s26 "אזור פרנל:
  הפרש מסלול של חצי גל", n06 s12 "מה הקצאה מוצלחת לא מוכיחה" (n06 guide synced). Rejected reviewer proposals:
  r06 s9 (Hummer is the unit's vehicle), r06 s25 (Yagi is the subject), n02 s4, instructor-scope notes.
- n08 deck, 30 -> 31 slides: slide 3 "קידוד מול הצפנה"; old slide 5 became exercise slide 17 "אתב״ש וקיסר:
  קידוד או הצפנה?" (3 questions, answers in note: Atbash has no key = encoding by slide-3 definition; Caesar 21
  keys; general substitution 22! keys but broken by frequency analysis; Kerckhoffs); new slide 23 "מפתח זרם"
  with live AES-128-CTR demo (12-byte nonce + 32-bit counter, nonce-reuse panel C1^C2^P1 recovers P2);
  titles 21/24/25/27 de-spec'd; map/divider/limits updated; FIPS and "verified against libraries" remarks
  removed; slide 22 note no longer says every symmetric cipher is XOR (closes the earlier doubt).
  Tech-review fixes: slide 1 note no longer calls Atbash encryption; slide 14 subtitle/note match PKINIT
  (workstation builds the one-time data incl. time, no DC challenge); Chrome shows a "tune" icon, not a lock,
  since 2023 (slide 13 note); RSA signatures are PKCS#1 v1.5 or PSS (slides 27, 30).
- `demos.js`: new `safe('keystream', ...)` block, embedded verbatim in the deck. Index row 08 description updated.
- n08 guide rebuilt: 11 -> 25 pages, ~7,800 words, same house template. Per slide: on screen, background,
  Q&A, common mistakes; appendices: slide map, demo test values, glossary. Time plan 105 min (58 + 47).

## Verification
- Demo drive: 55 assertions pass, incl. keystream vs `openssl enc -aes-128-ctr` (ASCII and Hebrew UTF-8).
- Chrome render: n08 31 slides (only the known divider background / fq-pt scroll); r02 r05 r06 n01 n03 n06 n07
  RENDER OK vs before. Structure validator OK (expected style change only).
- Independent technical review of n08 deck + guide (no wrong numbers/dates/math found; fixes above applied).
- Clean-judge loop on every new/changed element (71 elements): round 5 -> 2 ai, 7 unclear; fixed; round 6 -> 0 ai
  of 20; index line 0 ai. Judges remain noisy (see 2026-10-29 addendum).
- Device: 19 files + index committed, sha256 verified 19/19. Backups: `tmp/rewrite-review/before-2026-10-29-feedback2/`.

## Open / for later
- Detailed guides for the other 13 lessons: waiting for Omer's verdict on the n08 pilot. Radio guides must not
  invent unit procedures; where background needs unit doctrine, mark it as a gap instead.
- n08 slide 14 diagram still animates a DC "challenge" (generic principle); text and note now say PKINIT differs.
  Redrawing the animation is optional.
- Eyebrow numbers are page number minus 1 in every deck (house convention). Guide states that slide numbers mean
  the nav counter. Worth unifying in a separate pass if it confuses instructors.
- Latin term lists inside Hebrew text ("AM, FM ו-FSK") display as one LTR run (normal Hebrew typography);
  only the n08 map line was split into isolates. Not changed elsewhere.
- r06 deck still has 5 em dashes (known since 2026-09-11).
- `.agents/build/net08/slides_all.html` stays stale; the deck is the source of truth.
- Codex still unusable (model line in `~/.codex/config.toml`).
- Lesson: a context-free "is this AI?" judge does not catch irrelevance or example-named titles; keep a
  context-aware review (audience + whole slide) next to it.

## Follow-up (same day): mapping slide replaces map + encoding slides in n08
Omer: drop the "מהלך השיעור" slide and the encoding slide; instead one slide with a text field on top and a
table showing the same text Hex-encoded, encrypted with a password, and hidden in an image.
- n08 now 30 slides. New slide 2 "קידוד, הצפנה והסתרה": text + password fields; rows Hex, Base64, password
  encryption (PBKDF2-HMAC-SHA256, 1000 iterations, random salt; AES-128-CTR, random nonce; shown in Hex) with a
  "try to decrypt" field (default has a lower-case u, so the class first sees noise), and LSB hiding in a small
  picture with the recovered text. Base64 row added beyond the request because Base64 is what technicians meet.
- CIA (confidentiality/integrity/authentication) moved to the key box of the tools slide (now 4).
- Slide 1 note now holds the "short on time" advice from the removed map slide. All slide references in notes and
  guide renumbered (-1 from old slide 4 on); guide slide map rebuilt from deck titles.
- `demos.js`: Base64 block replaced by `safe('map', ...)`. Verified: Hex/Base64 vs Python; ciphertext vs
  Python `pbkdf2_hmac` + `openssl enc -aes-128-ctr` (seeded Math.random); right/wrong password; stego extract.
  Full drive test 53/53 pass. Context-aware slide review (9 findings) applied; clean judges: 0 ai.
- The map slide ("מפת השיעור") still exists in the other 13 decks. Removing it everywhere is Omer's call.
- Backups: `tmp/rewrite-review/before-2026-10-29-feedback3/`.

## Follow-up 2026-10-30: Hex only on the mapping slide
Omer: one encoding is enough; keep Hex, with the character next to each byte.
- n08 slide 2: Base64 row removed. Hex row is now one chip per character (character on top, its UTF-8 bytes
  below; space shown as ␣). Latin/digit runs such as "06:00" or "Unit-5059" are grouped LTR inside the RTL row
  so they read correctly. Chip CSS is a slide-local `<style>` inside the section (house shell untouched).
- Note and guide: Base64 is now mentioned only as the encoding technicians meet in the field.
- Tests: chip bytes and labels vs Python; full drive test pass; clean judges 0 ai.
- Backups: `tmp/rewrite-review/before-2026-10-30-hex-only/`.
