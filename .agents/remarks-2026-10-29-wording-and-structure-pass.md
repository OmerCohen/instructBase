# Remarks - wording and structure pass over the whole set (2026-10-29)

Request (Omer): go over every deck and guide and fix wording and structure so it does not read as
AI-written. His examples: mirrored split cards (חלק א׳/חלק ב׳, כן/לא), titles like "ארבעה כללים",
"ארבע הטעויות", "שני חצאים". Decision recorded the same day: lessons 3 and 8 overlap on TLS/certificates
and **both stay as they are**.

## Scope
14 decks (radio 01-06, networks 01-08), their 14 guide sources + PDFs, `index.html`, the A6 card source + PDF.
Backups of everything replaced: `tmp/rewrite-review/before-2026-10-29/` (46 files, not published).

## Method
1. Brief with the concrete pattern list (count-announcing headings, mirror structures, "X - ולא Y" hinge
   titles, colon titles as a habit, slogans/punchlines, meta narration, room-scripting notes, bold lead-ins,
   uniformity) and hard constraints (no new facts, slide count, one speaker note per slide, `<script>`/`<style>`/
   head/SVG geometry/ids untouched, no em/en dash, guide page count must not grow).
2. Pass 1: one agent per lesson (cloud workspace), each with validator + Chrome render check + guide PDF check.
3. Independent review of the result (a fresh reviewer that did not write it), 80 findings + 5 cross-lesson
   observations (guide skeleton uniformity, one key message repeated 3-6 times as a hinge, mixed forms of
   address, forced cross-links/teasers, calques such as קנס/מתמחר/מתלכד/מיתקון).
4. Pass 2 applied those findings. Conventions now used: instructor notes in plural imperative (הדגישו,
   הראו); technician procedures in impersonal present (מנתקים, בודקים); each lesson's key message stated once.
5. Visible strings inside scripts edited separately with exact replacements + `node --check`:
   r06 simulator verdicts, n04 terminal simulator, n08 demos (also in `.agents/build/net08/demos.js`).
6. Head `<title>`/aria-label synced with the new title slides of r01, r04, n08.

Codex: Omer asked to use it if needed. `codex exec` on the PC fails: `~/.codex/config.toml` sets
`model = "gpt-6.1-sol"`, which the ChatGPT account rejects ("model is not supported"). Not changed (user config);
the independent review in step 3 was done by a separate Claude agent instead. Fix the model line to use Codex.

## Verification
- Structure validator per deck: OK for all 14 (expected diffs only: the intentional script-string and head
  edits in r01, r04, r06, n04, n08).
- Chrome render of all 229 slides, compared with the originals: no new overflow, no title over 2 lines,
  no page errors (n08 slide 19 differs on every run by design: random hex background).
- n08 demos re-driven (48 assertions) after the string edits: all pass.
- Guide PDFs re-rendered in headless Chrome; page counts identical to before for all 14; no em/en dashes.
- Card: still exactly 2 A6 pages. Index: all hrefs unchanged.
- Device files hash-verified against the delivered copies (46/46).

## Technical doubts found (NOT changed, need Omer or a technical review)
- r06: Fresnel near-antenna example "2.5 cm" where the formula gives ~2.5 m (known since 2026-09-11).
- r06: many slide-number references follow an older slide order (notes on slides 1, 3, 9, 18; guide pages
  01, 05, 08, the "שק׳" columns, Appendix A). Needs one renumbering decision.
- r06: slide 4 note says up to ~0.6λ helps; guide Appendix B says the pattern splits above ~0.7λ.
- r06: slide 29 "lower tie → less range" contradicts slides 6/10/11 (probably means lowering the tip).
- r02: guide timing rows add to 56 min vs chips "50-55"; r05: 62 min vs "55-60".
- r03: guide defines radiation efficiency as radiated/loss (should be radiated/input).
- r03: "≈ 1 W" h3 on slide 11 renders reversed (no ltr span) in the original markup.
- n02: slide 9 `route print` routes 10.20.40.0/24 via 10.20.30.2, contradicting slides 2/5.
- n04: has a simulator but no "what this does not tell you" slide (house rule); guide has no time slot for it.
- n05: slide 7 title is about a wrong prefix while its diagram shows a wrong address with the right /24;
  slide 4 shows the same IP on reference and faulty systems; slide 8 shows Linux-style `arp -a` "incomplete".
- n06: "three bottom lines are DHCP-only" in note 4/guide vs the slide 4 SVG (DNS Servers is among them).
- n07: slide 9 says PoE uses all eight wires (802.3af/at use two pairs; only 802.3bt uses four).
- n08: slide 22 note generalises XOR to "every modern symmetric cipher" (true for stream/CTR/GCM, not ECB/CBC).
- House CSS: `.checklist li::before` renders the bullet on its own line above the text in several decks.
- Card: duplex instruction "היפוך בצד הקצר" probably wrong for a portrait card (see 2026-08-06 card audit).

## Other notes
- `.agents/build/net08/slides_all.html` is now stale: the installed n08 deck is the source of truth for its
  slide HTML; only `demos.js` was kept in sync.
- Omer's phone screenshots show the decks reflowed at phone width, with the footer text overlapping the nav
  buttons. Not part of this request; worth a separate mobile pass if decks are used on phones.
- Working records (dumps, brief, per-lesson reports, screenshots) stayed in the cloud workspace; the review text
  dump is at `tmp/rewrite-review/all_after.txt`.

## Addendum: clean-judge loop (same day, second request)

Request (Omer): every rewritten element goes to a clean agent with one question, "was this written by AI, and if so
what gives it away". If the agent says AI, fix the tells it found and send it again.

Method
- Elements extracted per slide (eyebrow, title, subtitle, body, diagram labels, speaker note) and per guide page;
  visible strings inside `<script>` (r06 simulator, n04 terminal, n08 demos) judged as their own elements.
  Index and A6 card included.
- Judge = fresh agent with only the judging instructions + the element texts (no lesson context, no knowledge of
  who wrote it). Returns probability, verdict (ai / human / unclear) and the quoted tells. Fails if verdict is "ai".
- Fixer agents changed only the quoted tells, under the same hard constraints as the main pass (facts, slide
  count, notes, scripts, SVG, page count). Only changed elements were re-judged, each round by new judges.
- After every fix round: structure validator, Chrome render check, guide PDF page count, n08 demo drive.

Rounds (elements judged "ai")
- Round 1: 365 elements, 94 ai. Round 2 (209 changed + 3 script elements): 14. Round 3 (31): 5. Round 4 (5): 0
  (4 human, 1 unclear: r06 slide 04).
- n01, index and the A6 card passed in round 1 and were not changed.

Caveat: the judges are noisy. Round 1 flagged 0/21 slides in n01 but 18/21 in n07, which were written the same
way. Passing means "a model with no context did not spot an AI tell", not proof that a human reader won't. The
most reliable tells it found and that were fixed: balanced pairs and triplets, closing summary sentences,
"not X but Y" turns, abstract or inflated wording where a technician would name the thing, English calques, the same idea
said twice on one slide.

Titles changed in the loop (guide slide maps synced): n02 s7, n03 s2/s3/s12/s17, n06 s12, n07 s4/s12, r06 s4.

Files: 40 replaced (decks, guide PDFs and sources of r01-r06, n02-n08, plus `.agents/build/net08/demos.js`),
hash-verified 40/40. Backup of the state before the loop: `tmp/rewrite-review/before-judge-loop/` (43 files).
Guide page counts unchanged. The technical doubts listed above are still open; the loop did not touch them.
`.agents/build/net08/slides_all.html` is still stale (deck is the source of truth).
