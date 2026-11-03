# Remarks — humanizer pass over all 11 decks

Date: 2026-07-30 · Author: Claude · Requested by: Omer

Request: run the `humanizer` skill over the presentations (and, if possible, the
documents) so the writing doesn't read as AI-generated. The skill wasn't
loadable earlier in the session (`Skill`, `list_skills`, and a filesystem check
all came back empty); it loaded once Omer invoked it directly as
`/anthropic-skills:humanizer`.

## What the skill actually found here

Before editing anything, I extracted every piece of visible prose across all
11 decks (titles, subtitles, body copy, cards, checklists, speaker notes) and
checked it against the skill's full pattern list: inflated significance,
promotional language, vague attribution, rule-of-three padding, "AI vocabulary"
words, sycophantic tone, filler phrases, hedging.

Almost none of that is present. Counts across the whole set: `מהווה` 0,
`חשוב לציין`/`ראוי לציין` 0, `תפקיד מרכזי/משמעותי/חשוב` 0, `מגוון רחב` 0,
`ייחודי` 0, `על מנת` 0. The content is technical slide copy that has already
been through several content-accuracy passes; it was never the flowing
generated prose that most of the skill's checklist targets. I'm noting this so
the pass doesn't get credited with fixing problems that weren't actually there.

**The one real, pervasive tell: the em dash.** 168 raw instances, concentrated
72% (113) in lesson 06 (the antenna deck), which has had the most iterative
content added across sessions. Every non-antenna deck had single digits; the
four networks decks other than the terminal-sim one had zero. This reads as a
habit I fell into during heavy generation, not a deliberate house style: the
deck's own titles already have an established compound-clause convention
(comma: `מתח דוחף, התנגדות מגבילה...`; semicolon: `DC שומר על כיוון; AC מחליף
כיוון שוב ושוב`) that never used a dash, which is what the fix now matches
instead of inventing a new pattern.

En dashes (`–`) are untouched. All 7 are legitimate numeric ranges (`3–17`,
`6–7dB`, `85–90 minutes`) and are not the tell the skill is about.

## What got fixed, and what didn't

190 em dashes replaced across HTML text nodes and SVG `<text>` captions
(comma, colon, semicolon or period, chosen per instance by the relationship
between the two clauses, following the skill's own ranked preference). Two
paired em dashes that were genuine parenthetical asides (`X — Y — Z`) became
real parentheses instead of a third comma. One instance restated a "not only
X — but Y" as a straight comma join rather than rewording it, since the
Hebrew `לא רק... אלא` construction on its own reads as normal idiom here, not
as the English "not only/but also" tell; rewording it would have been a
content change the request didn't ask for.

**36 more were inside `<script>` string literals**: 29 in the antenna deck's
two inline bundles (hotspot/tie descriptions, simulator captions, the dynamic
feedback strings built from template literals), 7 in the terminal simulator's
`STEPS`/`FINAL` data. These are genuine on-screen text at runtime, so they
needed the same fix, just applied inside JS strings instead of HTML.

**Left alone on purpose, 16 total:**
- 6 in the antenna deck are `—` used as a literal "no value yet" placeholder
  (`<b data-mt-best>—</b>` style live-readout fields, and one static "not
  applicable" property value in a tie-material card). These aren't prose.
- 9 in the antenna deck's second script block are English `/* */` and `//`
  code comments (section banners like `DEMO 2 — tilt`, physics notes).
  They're developer-facing, never rendered to a trainee, so they're not "the
  presentation" in the sense Omer asked about. I left them rather than
  touching code I wasn't asked to touch.
- 1 in the terminal-sim deck is inside the simulated PowerShell window's
  title bar (`Administrator: Windows PowerShell — WS-4487`), deliberately
  styled to look like a real Windows terminal title. That em dash is the
  point, not a writing tell.

## How this was done safely

This session had already broken the antenna deck once (a whole-file regex
injected a span into a JS string literal and killed the entire 608 KB script;
see the 2026-07-28 remarks). To not repeat that:

- Every HTML-text-node fix was applied by exact character offset (verified to
  actually be `—` before writing) or by exact-substring match with the
  occurrence count checked first. No pattern-based regex touched the file.
- Script blocks were extracted, edited in memory as plain text swaps (no
  markup ever introduced into a JS string, which is what broke it last time),
  and run through `node --check` before being written back. All 12 script
  blocks across the set still pass.
- After every round: HTML re-parsed on all 11 files, slide count reconfirmed
  at 162, and a full re-scan for `—` anywhere (including inside `<svg>` and
  `<script>`, which earlier passes had deliberately excluded) to make sure
  nothing was missed. The first two rounds *did* miss the 10 dashes living
  inside SVG `<text>` captions, caught only by that final unrestricted
  re-scan, not by the original targeted one.
- The antenna deck was also rendered in real headless Chrome after the script
  edits (title slide, screenshot + console log). It loads clean: no console
  errors, correct slide count in the counter, and the title's fixed comma
  renders exactly as intended.

## Left open

**The 11 guide PDFs.** Omer's request said "the presentations and the
documents." The documents are the `NN_דף_הנחיה_למדריך_...pdf` guides, and
there's no HTML/markdown source for them anywhere in the repo, just the
compiled PDF binaries. Editing prose inside a PDF in place can't reliably
preserve the established house style (teal accents, the `hdr` rule, the page
footer, title page, `X / N` counter) without risking exactly the kind of
layout breakage this pass was trying to avoid elsewhere. I did not guess at
an approach here and asked Omer directly instead. Whatever gets decided
should be recorded back in this file.
