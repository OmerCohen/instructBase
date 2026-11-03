# Remarks — rebuilding all 11 guide PDFs from scratch

Date: 2026-07-30 · Author: Claude · Requested by: Omer

The previous remark (`remarks-2026-07-30-humanizer-pass.md`) left one open
question: the 11 instructor-guide PDFs have no editable source anywhere in
the repo, only the compiled binaries, so the humanizer pass couldn't reach
them. Given three options (skip them / list suggested edits / rebuild all 11
from scratch), Omer chose the most ambitious one: **rebuild all 11 from
scratch.**

## What made this tractable

Lesson 06's actual HTML source (`06_guide_source.html`) turned up intact in
a scratch folder from earlier work this session, byte-identical to the
compiled PDF (verified by re-rendering it and diffing page count and text
against the shipped file). That source became the definitive style
template for the other 10: same CSS, same component vocabulary (`.chip`,
`.pc` cards in teal/amber/red/green, `.note`, `.band`, tables with
`td.n`/`td.k`), same page grammar (title → `00 · בריף למדריך` → numbered
content pages → closing map + glossary).

For the other 10, ground truth came from `pdftotext -layout` extractions of
each original PDF (this project already knew pdfplumber garbles Hebrew
reading order; `pdftotext -layout` reorders correctly) plus full-page PNG
renders of every page of every original, so whoever rebuilt each guide
could see structure (what was a card vs. a table vs. a diagram) that flat
text alone doesn't carry.

## Method: 10 parallel subagents, then I verified independently

Given the scale, I delegated one subagent per remaining guide (01–05 of
`רדיו`, 01–05 of `רשתות`), each with the template path, its own extracted
text, its own reference images, the matching deck (for wording/speaker-note
context when the extracted guide text was thin), `agents.md`, and an
explicit "never invent a fact" constraint plus the humanizer em-dash rule
(including the leading-space lesson from the lesson-06 rebuild earlier this
session). Each was told to render, sanity-check its own page count, and
report anything that didn't map cleanly onto the template rather than
paper over it.

**I did not take the subagents' self-reports at face value.** After all 10
returned, I independently re-verified, from the controller, before writing
anything to `.agents/README.md`:

- `pdfinfo` page counts on all 10 deliverables, cross-checked against what
  each subagent claimed.
- A fresh `grep -c "—"` em-dash count on all 10 new sources (all zero).
- The same precise leading-space regex from the earlier humanizer pass
  (`(?<=[Hebrew/quote])( )([,:;.])(?=[space/Hebrew/quote/<])`) re-run
  against all 10 (zero hits).
- The one flagged content oddity (01_net's "בכל שכבה בקש **מהמדריך**",
  literally "ask the instructor," in a document that addresses the
  instructor throughout) against the original `pdftotext` extraction —
  confirmed it's genuinely what the source PDF says, not a transcription
  slip. Left as-is per the subagent's own judgment call; flagging here
  again for Omer in case "מהחניך" (ask the trainee) was the intended
  meaning.

That last check matters on its own: it's the difference between "the
subagent says it preserved the source" and "I looked at the source myself
and it matches."

## The real finding: a bidi bug that was already in shipped work

Two subagents (02 and 04 of `רדיו`), working independently with no
visibility into each other, both discovered and fixed the same defect:
**a numeric range next to a unit inside RTL flow can render digit-reversed
in WeasyPrint/Pango** — `85–90 דקות` (85 to 90 minutes) can come out as
`90–85 דקות` on the page, with no error, no exception, nothing any
structural check would catch. Both subagents flagged, unprompted, that
lesson 06's own shipped title-page chip almost certainly had this exact
defect, since it uses the identical unprotected pattern.

I did not take that claim on faith either. I rendered lesson 06's actual
deployed PDF and looked at the title page:

> the chip read **`90–85`** / `דקות` — reversed. The lesson was scheduled to
> run 85 to 90 minutes; the shipped guide told a instructor 90 to 85.

This is a real defect that survived every previous verification pass on
lesson 06, including the multi-round headless-Chrome sweep from
2026-07-28 and the page-2 spot-render done when this guide's source was
first recovered earlier in this session. Neither ever looked at this
specific chip on this specific page. **That's the lesson**: a defect class
that no structural check (HTML validity, `node --check`, slide/page count,
even a one-page visual spot-check) can catch needs either full-set
rendering or a targeted, repeatable text-extraction check — "I looked at
page 2 and it seemed fine" does not generalize to page 1.

### Root cause and fix

`85–90 דקות` inside a bare `<b>` tag, with nothing else in that inline
block, is exactly the shape that triggers it: digits, an en dash, digits,
a space, then a Hebrew word, with no strong preceding context to anchor
the bidi resolution. The fix already existed in the template's own CSS
(`.ltr{direction:ltr;unicode-bidi:embed;display:inline-block}`, used
elsewhere in lesson 06 for things like `7–8dBi`) — it just hadn't been
applied to every chip. Wrapping only the digit-dash-digit run (not the
trailing unit word) in `<span class="ltr">` fixes it:

```html
<!-- before, latent bug -->
<div class="chip"><b>85–90 דקות</b><span>משך מומלץ</span></div>
<!-- after -->
<div class="chip"><b><span class="ltr">85–90</span> דקות</b><span>משך מומלץ</span></div>
```

I could not fully predict from context alone which instances would
actually reverse. A sweep found the same unprotected pattern 17 more times
across the set, and direct rendering (not eyeballing — `pdftotext -layout`
text extraction, checked programmatically for the correct ascending digit
order) showed **most of the ones buried deep in a longer Hebrew paragraph
resolved correctly on their own** (`6–9 דציבל`, `3–4 ניחושים` inside running
prose both rendered right), while **short, isolated blocks and a
digit-dash-digit-immediately-followed-by-a-Latin-unit run
(`6–7dB` inline in prose, and every page-header "eyebrow" like
`05 · שקופיות 8–10`) reliably reversed.** Rather than try to keep
classifying which contexts are safe, I wrapped every unprotected instance
across the whole set — the wrapper is a no-op on ones that were already
resolving correctly, so there's no cost to over-applying it, only to
under-applying it.

**Full list fixed** (12 in lesson 06 alone, since it's the longest guide
and uses "eyebrow" slide-ranges on almost every page; 2 each in 01/03/05 of
`רדיו`, which use the same one-chip pattern; 02 and 04 of `רדיו` had already
self-fixed their own instances, verified unchanged): every `NN–NN` and
`NN–NNunit` run outside a `td.n`/`th.n` cell (already protected by the
table CSS) now sits inside `<span class="ltr">`. Verified afterward by
re-rendering all 11 PDFs fresh and grepping each one's `pdftotext -layout`
output for the correct (non-reversed) form of every known range in that
document — not a visual spot-check, a programmatic check against every
range that exists in the set. All 11 passed. Page counts unchanged from
before this fix (7/8/8/9/9/16/8/8/8/8/8). Em-dash and leading-space
regressions re-checked on every file this fix touched: zero.

**New standing rule, added to `.agents/README.md`**: any digit-dash-digit
numeric range in RTL flow needs `<span class="ltr">` around just the
range, regardless of whether it "looks fine" in a quick render — the
failure is context-dependent and silent. Table cells already using
`td.n`/`th.n` are self-protecting via that class's own `direction:ltr` and
don't need the extra span.

## Other things the subagents surfaced, worth having on record

- **Diagram translation.** The template's component vocabulary has cards,
  notes, a `.band`, and tables — no diagram/flowchart primitive. Every
  guide whose original had custom box-and-arrow diagrams (signal chains,
  Kerberos/TLS handshake sequences, the 5-layer stack, VLAN topology, etc.)
  had that content translated into tables or short card sequences instead
  of redrawn as art. This is a real structural translation, not a missing
  detail: every fact in a diagram survived, just not in diagram form.
- **Two self-caught rendering bugs**, fixed by the subagents before they
  reported back: `03_net`'s closing map first came out with garbled/
  overlapping text from putting `<table>` elements inside the template's
  flex `.cards` container (WeasyPrint-specific; fixed by using a plain
  2-items-per-row table instead), and the same duration-chip bidi issue
  covered above, independently found in two files before I generalized the
  fix.
- **Deck speaker-notes used as supporting content.** Several original
  guides had visually sparse pages (the source PDF's own reference images
  show real blank space), thinner than lesson 06's dense style. Where the
  extracted guide text alone would have left a page nearly empty, a few
  subagents pulled additional grounded material from the matching deck's
  slide body or speaker notes to fill it out (e.g. `05_רדיו`'s field-
  scenario cards, `03_net`'s authn/authz-confusion note). Every addition
  traces to either the guide's own extracted text or the deck, never
  invented — but it does mean a handful of the rebuilt guides carry more
  content than a strict transcription of the original PDF would have.
  Listed per-file in each subagent's own report if you want to see exactly
  which page in which guide.
- **`01_net`'s "מהמדריך" line** (see above) — preserved verbatim because
  it's genuinely what the source says, not touched without Omer's say.

## What I did not do

I did not personally proofread all 10 new guides sentence-by-sentence for
Hebrew register or tone the way I would for a from-scratch writing task —
verification here focused on structural fidelity (facts present, nothing
invented, page counts sane, renders cleanly), the humanizer's specific
em-dash/spacing rules, and the bidi defect class this pass surfaced. A
native-Hebrew read-through before wide distribution is still worth doing,
same caveat as any AI-drafted document.

## Deliverables

All 11 sources now live in `.agents/guide-sources/` (`01_radio` through
`05_radio`, `06_guide_source.html` — patched, not just recovered — and
`01_net` through `05_net`), so the "no editable source" problem this whole
question started from cannot recur. All 11 compiled PDFs are deployed at
their existing `NN_דף_הנחיה_למדריך_...pdf` paths, replacing the previous
binaries.
