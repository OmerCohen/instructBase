# Remarks — visual pass across all 11 decks

Date: 2026-07-26 · Author: Claude · Requested by: Omer

Scope: the five `רדיו` decks (01–05), the five `רשתות` decks (01–05), and
lesson 06. Method: rendered all 135 slides and inspected them, plus a static
audit of the shared CSS. Originals backed up before patching.

## Two genuine bugs, not taste

### 1. The `.steps` connector was printed on top of the neighbouring label

`.step:not(:last-child)::after` draws a 26 px `←` circle at `left:-13px`, so it
straddled the boundary between two step cards, which had only 14–16 px of side
padding and no gutter between them. Any label wide enough to reach its padding
edge got a circle drawn through it. Confirmed visually on
`04_כלי_תחקור` slide 13 — four of the five labels had a circle through them
(`DNS / Port`, `route / tracert`, `ipconfig / arp`, `Get-NetAdapter`).

Fixed **by construction** rather than by nudging padding (padding alone still
failed for long unbreakable tokens like `Get-NetAdapter`):

- `.steps` gains `gap:26px`
- the connector moves to `left:-26px`, so it sits **entirely inside the gutter**
  and cannot touch a card at any label width
- each `.step` becomes a self-contained rounded card (border all round,
  `border-radius:14px`) instead of a segment of a continuous bar; the
  `:first-child`/`:last-child` half-rounding rules are gone
- `overflow-wrap:anywhere` + `word-break:break-word` so a long token wraps
  instead of spilling out of its card

Affects 9 decks (13 `.steps` blocks total). Note this is a small visual
redesign of that component — separated cards with arrows between them, rather
than one continuous strip. It reads cleanly and removes the collision class
entirely.

### 2. `.ltr` forced `display:inline-block`

`.ltr{direction:ltr;unicode-bidi:isolate;display:inline-block}` is applied to
inline spans, but the same class on a `<td>` collapses the table row. Lesson 06
had 12 such cells and was visibly broken; the other decks happened not to use
it on cells yet. Now scoped: the class only sets direction, and
`span.ltr,b.ltr,i.ltr,em.ltr` get the `inline-block`. Latent bug removed
everywhere.

## Projection legibility

These are shown on a projector in a lit room, and the dimmest UI colour was
`--dim:#6f8299` ≈ **4.0:1** against the panel — below comfortable for 12–13 px
text at distance. Lifted to `#8ba0b5` ≈ **5.6:1**, and the same value
hard-coded inside the SVG artwork was lifted with it (4–24 occurrences per
deck, 126 in total). The secondary `#53677e` went to `#74889c`.

Smallest type sizes raised by 1 px each: `.footer` 12→13, `.visual-label`
13→14, `.card .tag` 12→13, `.step span` 14→15, `.counter` 13→14, `.sources`
12→13. Nothing reflowed — verified char counts identical before and after on
every deck.

Added a dark halo behind every SVG label (`paint-order:stroke` with a 2.4 px
`#071019` stroke) so labels stay readable where they cross a line or a filled
shape. This was already in lesson 06; now shared.

Raised `.visual svg{max-height}` from 440 px to 500 px. Purely permissive —
it only takes effect where the container is already taller, letting diagrams
use vertical space the slide was giving away.

## Verified

- 135 slides rendered before and after; **no slide gained or lost, and the text
  character count is identical on all ten decks** — the changes are presentational.
- A consistency probe over all 11 decks confirms every one now has: the lifted
  contrast, the SVG halo, the safe `.ltr`, the raised type sizes, and the gapped
  `.steps` connector.

## Caveats

- **WeasyPrint was the renderer**, and its flexbox support is incomplete. Layout
  judgements here are reliable for block/table/SVG content but not for flex
  internals. The `.steps` fix in particular is argued from the CSS box model,
  not from the render — **it wants one look in a real browser**.
- I deliberately did **not** attempt to fix the sparseness several decks show
  (content sitting in the upper half, e.g. most of `04_כלי_תחקור`). That is
  per-slide layout work across 132 slides with a real chance of making some
  slides worse; the `max-height` bump is the only safe global lever I applied.
  Flagging it as a known, unaddressed weakness rather than silently leaving it.
- Originals are in `/tmp/backup/orig0..9.html` for this session only. If a
  change needs reverting after the session, restore from OneDrive version
  history.

## Operations note

The connected folder dropped out mid-session and came back renamed from
`תכנית_הדרכה_תקשוב_גדודית` to `חומרי הדרכה`. Lesson 06's polished build had been
written just before the drop and silently did not land; it was only caught by
the cross-deck consistency probe, which showed lesson 06 failing checks the
other ten passed. **Worth keeping that probe** — a whole-set consistency check
catches deploy misses that per-file verification does not.
