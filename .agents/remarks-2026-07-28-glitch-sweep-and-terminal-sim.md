# Remarks — full graphics glitch sweep + the terminal troubleshooting simulator

Date: 2026-07-28 · Author: Claude · Requested by: Omer

Two requests: another pass over all decks because *"נשארו מלא גליצ'ים בגרפיקות"*, and
a guided troubleshooting simulator in the **commands** deck (`04_כלי_תחקור`).

---

## The most important thing in this file: how the decks are now verified

**WeasyPrint was lying to me, and it had been lying for three rounds.**

The first reviewer of this round came back with 58 defects for lesson 06 alone,
of which the headline finding was that *every Hebrew label inside every SVG was
rendered letter-reversed*. That would have been catastrophic. It was false.

WeasyPrint renders SVG `<text>` without running the Unicode bidirectional
algorithm, so Hebrew comes out in logical order — visually reversed. It runs bidi
correctly for HTML in the same document, which is exactly why the artifact was so
convincing: prose looked right and diagrams looked broken. It also cannot execute
canvas or WebGL, so every interactive panel renders as an empty box and every
JS-filled metric renders as a dash.

**Roughly half of that first report was renderer artifact.** Had I acted on it I
would have "fixed" a dozen correct diagrams into broken ones.

### The replacement pipeline — use this, not WeasyPrint

Chrome is installed on the machine. Every deck already carries an `@media print`
block that lays out one slide per 1280×720 page, so:

1. Copy each deck to a scratch folder with `@page{size:1280px 720px;margin:0}`
   injected (one line, at the head of `<style>`).
2. `chrome --headless=new --disable-gpu --no-pdf-header-footer
   --virtual-time-budget=6000 --print-to-pdf=out.pdf file:///...`
3. Render the PDF pages to PNG and review those.

This gives **true browser layout, real bidi, real canvas, real WebGL**, and
`pages == slides` exactly on all 11 decks (WeasyPrint drifted by up to 2 pages,
which had silently misaligned earlier reviews). `--virtual-time-budget` also lets
animations advance, so this is the first time the motion work has been seen
running at all.

**Consequence for future reviews:** animated elements appear *mid-flight*. A lone
coloured dot part-way along a connector, a cursor part-way across a chart, a
packet sitting over a label — these are correct, not defects. Three reviewers
independently flagged them until told otherwise.

---

## Root causes found (these mattered far more than the individual fixes)

### 1. SVG text inherited RTL in ten of eleven decks

Only lesson 06 had `svg text{direction:ltr}`. Everywhere else SVG labels
inherited `dir="rtl"` from the deck root, and the bidi algorithm then places a
leading neutral on the wrong side. That is a **real** defect and it was
everywhere: `1 Gbps` → `Gbps 1`, `≈50Ω` → `50Ω≈`, `−3dB` → `3dB−`,
`3–30 MHz` → `MHz 30–3`, `0.15 m` → `m 0.15`.

Fixed content-aware rather than with a blanket rule: a script tagged every
`<text>` whose content contains **no Hebrew** with a new `.ltrtx`
(`direction:ltr;unicode-bidi:isolate`) — **268 labels across 11 decks**. Hebrew
and mixed labels keep RTL, which is correct for them. This is deliberately
*better* than lesson 06's blanket `direction:ltr`, which is what mis-set its own
`0.15 m`.

### 2. `.checklist li` was a flex container

`.checklist li{display:flex;gap:11px}` with the ✓ as `::before`. Every inline
`<strong>` and every `<span class="ltr">` in a bullet therefore became **its own
flex item with an 11px gap**. Any bullet long enough to wrap came apart into
gap-separated blocks with orphaned operators — which is what "shredded" bullets
in lesson 06 actually were. I first misdiagnosed this as a bidi problem and
"fixed" `.ltr`'s `display:inline-block`; the symptom survived, which is what
pointed at flex.

Now: `li` is a block with `position:relative;padding-right:35px` and the marker
is absolutely positioned. Applied to all 11 decks.

### 3. Table cells inherited RTL

A leading `−` or `≈` in a numeric cell mirrored. Fixed set-wide with
`unicode-bidi:plaintext` on `.table`/`.rt` cells — the cell picks its own
direction from its first strong character, so Hebrew cells stay RTL and numeric
cells go LTR. `.fx` formula cells keep `isolate` as before.

### 4. `.step{flex:1}` let long cards starve the last one

`flex:1` is `flex:1 1 0%` but `min-width:auto` lets a content-heavy card exceed
its share, squeezing the last one. Added `min-width:0`. (Note: the `net05` chain
cards that looked like the same bug were **hard-coded SVG rects** with a
deliberately narrower last box — re-laid by hand.)

### 5. Canvas inherits `dir=rtl`

`ctx.fillText(D.toFixed(2)+' m', …)` came out `m 0.15`, and a long Hebrew caption
overlapped itself. Canvas needs `ctx.direction` set explicitly per string.

---

## Individual fixes

~50 further edits: connectors that stopped short of their boxes (net03/02 was
four at once), captions wider than the circles containing them (net02/12,
net03/03/10/11), labels lying on same-coloured lines (radio01/06+09,
radio02/02+04+09+11, radio04/03+07+08, radio05/11+12, radio06/03+25, net01/10),
severity dots 280px from the labels they marked (net04/12), a curve strip laid
out LTR under RTL cards so every curve sat under the wrong card (radio05/10),
overlapping port circles, dark-on-bright labels wearing the shared dark halo
(new `.nohalo` opt-out), and a decision branch that ended in empty space
(net02/05).

**Three of my own fixes regressed and had to be fixed again** — moving a label to
`text-anchor="end"` in an RTL SVG pushed it off the right edge (radio01), one
move landed a label on the *other* arrow (net01/10), and one left a duplicate
caption behind (net02/13). Each was caught only by re-rendering and re-reviewing.
**Every geometry change needs a re-render; none of them are safe by inspection.**

Verification ran in three rounds with fresh reviewers each time: 73 defects found
→ 16 fixed / 3 regressions → 12 fixed / 2 left → 2 fixed. Final state: **0 known
HIGH defects**, all 11 decks parse, slide counts unchanged.

---

## The terminal simulator — `04_כלי_תחקור`, new slide 13 of 14

A guided session on a real, common fault: **a local user can log in, a domain
user cannot.** Six steps, each: *what we check and why* → *run* → *read the
output* → *choose the next step*.

| # | check | command | what it eliminates |
|---|---|---|---|
| 1 | IP identity, and whether DNS points at the DC | `ipconfig /all` | local network layer |
| 2 | is the DC reachable at all | `ping 10.20.4.10` | routing |
| 3 | is the domain locatable | `Resolve-DnsName _ldap._tcp.dc._msdcs.unit.local -Type SRV` | name resolution |
| 4 | does LDAP actually open | `Test-NetConnection dc01.unit.local -Port 389` | the service, and filtering |
| 5 | clock skew | `w32tm /query /status` | Kerberos time |
| 6 | the secure channel | `nltest /sc_verify:unit.local` | **the finding** |

Ends on `ERROR_NO_TRUST_SAM_ACCOUNT (1787 / 0x6fb)` — the machine account is
invalid, so no domain user can authenticate while the local one still works.

**The teaching is in the wrong answers, not the commands.** Each step offers two
plausible shortcuts that a real person makes in the field — jump straight to
`nltest`, mark DNS good because ping replied, rejoin the domain before proving
anything, blame the user's password. Choosing one prints why it is premature and
**does not advance**. Twelve such branches, all exercised in the jsdom test.

Two details worth keeping:

- **`ping` proves a path, not a service.** Step 2's wrong answer exists purely to
  make that point, and it matches slide 5 of the same deck.
- **`nltest` prints "The command completed successfully" while the check fails.**
  The summary panel calls this out: read the content, not the exit line.

Numbers verified: 1787 = 0x6FB = `ERROR_NO_TRUST_SAM_ACCOUNT`; LDAP 389; the SRV
record `_ldap._tcp.dc._msdcs.<domain>`; Kerberos default skew 5 minutes.

Implementation: ~2.8KB CSS + ~8KB JS inline, namespaced `tsim-`, no dependencies,
vanilla DOM. Deck renumbered 13 → 14 slides (footers and eyebrow numbers both).

**A reviewer's criticism I accepted:** at rest the terminal was a large empty
black rectangle and the slide read as unfinished. It now boots with a PowerShell
banner, a green prompt and a blinking caret, so it looks live before the first
click; restart returns to that state rather than to a void.

---

## Caveats

- **The animations still have not been watched.** The Chrome pipeline captures
  one arbitrary frame per slide, which proves the elements exist and are placed
  sensibly but not that the synchronised pairs (radio05's whip-and-dip,
  cable-and-spike) are actually in step. That needs a human with the deck open.
- **The simulator has never been clicked by a person.** All six steps and all
  twelve wrong branches pass in jsdom, and the idle and step-1 states render
  correctly in Chrome, but timing, scroll behaviour of the guidance column, and
  whether the 16ms/char typing feels right are unverified.
- **Motion still overrides `prefers-reduced-motion` by default** (round-2
  decision, unchanged).
- Known remaining LOW items, deliberately left: the mistakes cards on lesson 06
  slides 5 and 28 use green ✓ marks for a *don't* list; several summary slides
  have large empty lower halves; a few captions are grazed by a plot's baseline
  without becoming illegible.
- The scratch folder `D:\VS_DEV\Temp\RFGame\_deckqa` was created for the Chrome
  print step and **has been deleted**. If a future run is interrupted, check for
  it.

---

## Addendum — the Yagi propagation animation, and removing the week structure

### The week structure is gone

Omer: the course may not end up organised as weeks at all. Removed
`שבוע רדיו` / `שבוע רשתות` from every footer and title badge across all 11 decks
(≈130 occurrences), plus two prose mentions (״לאורך כל השבוע״ → ״לאורך כל הקורס״,
״השקופיות החשובות בשבוע״ → ״בנושא״). Footers now read `שיעור N · <topic>` and
badges `מחלקת תקשוב · VHF` / `· Windows`. The `deck-root` ids also encoded it
(`radio-week-03-…`) and were renamed to `…-lesson-…`; nothing references them —
the bootstrap selects by class. **Zero remaining occurrences of ״שבוע״.**

### The Yagi slide is now a propagation animation

The previous version was a phasor-sum abstraction (three sine rows adding to
×2.04 / ×0.41). Omer wanted the physical process instead: waves leaving the
driven element, exciting the parasitics, adding forward and cancelling backward.

Rebuilt as a single scene on one 4.2 s clock, narrated in three captions that
appear in turn:

1. **0.1–1.15 s** — the driven element flashes and two cyan wavefronts expand
   both ways.
2. **1.15–2.3 s** — the fronts reach the reflector and director; both flash and
   start radiating their own amber/violet fronts. The bullets say why: they are
   not fed by anything, the wave induces current in them, and their ±5 % length
   sets the sign of the delay.
3. **2.3–4.15 s** — forward, a thick green fan; backward, a thin dashed red
   remnant. `×2.04` and `×0.41` stay pinned on the two sides.

Verified frame-by-frame at t = 0.9 / 1.7 / 2.6 / 3.6 s (see method below). Element
spacing is exaggerated for legibility and the figure says so.

### Three findings about SMIL that cost me most of this session

**1. SMIL does not run in Chrome's `--print-to-pdf` path.** CSS animations do
advance under `--virtual-time-budget`, SMIL does not. This also means my earlier
attribution of "mid-flight animation artifacts" in the QA renders was only half
right: the moving dots were the CSS `.pkt` packets; every SMIL element was frozen.

**2. `--screenshot` does run SMIL, but its clock is unreliable** — page-load
overhead eats an unpredictable slice of the virtual budget, so the same
`--virtual-time-budget` lands on different animation times run to run. I wasted
several rounds concluding "the animation doesn't work" from blank frames.

  **The method that actually works:** build a throwaway page containing just the
  SVG plus
  `svg.pauseAnimations(); svg.setCurrentTime(t);`
  and screenshot that. Exact, repeatable frames at any t.

**3. `clipPath` silently suppressed the animated circles.** The wavefronts were
inside `<g clip-path="url(#...)">`; in Chrome they never painted, while a
*filled* circle in the same group did. A four-variant minimal probe isolated it
in one render. The clip was only there to keep fronts off the labels — removed,
and the geometry now stays in frame by construction (max radius chosen so
`cy ± r` clears the label band, and the forward/backward results are ±22° arc
fans rather than full circles).

### Correction to a rule I wrote earlier in this file

Earlier I wrote *"the authored SVG attribute is the no-SMIL fallback."* **That is
wrong.** An `<animate>` child pins its target attribute to the animation's **first
keyframe**, whichever value the attribute carries. I authored a sensible still
state, re-printed, and got a blank diagram anyway.

The fix that does work: a **separate, un-animated ghost layer** at `opacity .22`
drawn under the animated one — a faint snapshot of the wave field. In the browser
it reads as a background; in a PDF export it is the whole message. Verified in
print.

### Caveats

- Still browser-verified only through headless Chrome. Nobody has watched the
  Yagi animation loop at full speed on a projector; the three-act pacing
  (1.05 s / 1.15 s / 1.85 s) is a guess that wants one live look.
- The ghost layer is visible during the animation too. At `.22` it reads as a
  faint field, but if it looks like smudging on a bright projector, drop it to
  `.12` or gate it behind `@media print` — the latter is cleaner but would then
  never be seen on screen, which is why I did not do it.

---

## Addendum 2 — the Yagi animation, rebuilt around reflection (Omer rejected v2)

Omer's verdict on the expanding-circles version: *"זה ממש לא ממחיש את נושא
ההחזרה\התאבכות. זה נראה כאילו הרפלקטור והדירקטור קורנים בעצמם."* He was right,
and the criticism is exact. Three sources each emitting their own circular fronts
is a **superposition-of-sources** picture. It shows that three things radiate; it
never shows a reflection, and it never shows where two waves meet.

What he asked for, and what it now does: two waves leave the driven element, the
backward one bounces off the reflector and comes back, and you can see where they
interfere and why.

### The new figure — three lanes on one axis

| lane | shows |
|---|---|
| top, cyan | the wave the driven element sends straight forward |
| middle, amber | the wave that went back, reflected, and now travels forward from the reflector |
| bottom, green | the two added — visibly ~2× either one, with both faint components drawn underneath |

Dashed vertical guides at the three element positions run through all lanes, so
the phase alignment is spatial and readable. A marker leaves the driven element,
travels left, flashes at the reflector (״ההחזרה הופכת פאזה״) and returns in amber
— that is the round trip the previous version was missing entirely.

### The number that makes it a physics slide rather than a picture

A boxed derivation sits under the lanes, because without it the alignment looks
arbitrary:

`2 × 0.2λ = 0.4λ` (round trip to the reflector) `+ 0.5λ` (the phase inversion on
reflection) `= 0.9λ ≈ 1λ`

So the returning wave finds the direct one almost crest-on-crest. **This also
explains why the spacing is ~0.2λ in the first place** — it is the value that,
together with the reflection flip, lands the round trip near a whole wavelength.

Amplitudes are computed, not drawn by eye: two waves of relative amplitude 1 and
0.92 separated by 36° give `|1 + 0.92e^{-i36°}| = 1.83`, leading by 17.2°. Both
the drawn sum wave and the bullet text say ×1.83, with the director accounting for
the rest of the way to the validated **×2.04**. My first draft drew 1.9 at
*+*0.1π — wrong magnitude and wrong sign of the phase; corrected.

### Why this version also prints

The two travelling sines use the deck's existing CSS `.wave` class (a path
extended one period beyond its clip, translated by exactly one period).
**CSS animation does render in `--print-to-pdf`** — unlike SMIL — so this figure
needs no ghost layer. Only the round-trip marker is SMIL, and its absence from a
printout costs nothing because the three lanes and the derivation carry the whole
argument on their own.

### Caveats

- Element spacing is exaggerated on screen (100 px wavelength, elements 100/80 px
  apart rather than 20 px); the figure says so, and the derivation is stated in
  units of λ so the exaggeration cannot mislead the arithmetic.
- The reflector-as-mirror account is the standard simplification. It is honest for
  the forward direction, which is what the slide claims. The backward figure
  (×0.41) is stated as a result, not derived on this slide — deriving it properly
  needs the three-current phasor sum, which is what slide 11's pattern already
  comes from.
- Still not watched live at full speed.

---

## Addendum 3 — unit branding across the set

The crest was added to all 11 decks in two places:

- **Title slide** — the crest at 76×107 next to a two-line lockup: **גדס״ם 5059**
  over *מחלקת תקשוב*, then the existing topic pill below it. Since the lockup now
  carries ״מחלקת תקשוב״, that phrase was dropped from the pill, which is now just
  `VHF` or `Windows`.
- **Every content-slide footer** — a 17×24 crest plus **תקשוב 5059** as a third
  footer item on the right, so the footer reads
  `תקשוב 5059 · | · שיעור N — נושא · | · N / M`. 148 footers in total.

Omer offered either the one-line or the two-line wording. I used **both**: the
two-line lockup where there is room (title), the one-line form where there is not
(footer). If only one is wanted, the footer string is a single literal per deck.

### Asset handling

The source is a 427×600 RGBA PNG. Embedding it raw in 11 decks would have been
~3.4 MB. Instead: trimmed to its alpha bbox, resized to 216 px tall (2× the
largest on-screen use), and **quantised to 16 colours with FASTOCTREE and no
dither** — it is a flat heraldic mark, so this is lossless in practice. Result
**5.9 KB → 8.0 KB of base64**, declared **once** per deck as a
`background-image` on `.crest`, with `.crest-lg` / `.crest-sm` setting only the
box size. Deck sizes grew ~8 KB each.

Note for reuse: `Image.quantize` on RGBA only accepts `FASTOCTREE` or
`libimagequant` — `MEDIANCUT` raises. Quantising RGB and re-attaching the alpha
also works but costs an extra step.

### Caveat

The crest is a raster at 216 px tall. On a 4K projector the title-slide instance
(76 px CSS ≈ 152 device px at 2×) is fine, but if it is ever wanted much larger —
a cover page, a printed handout — it should be re-exported from the original
rather than upscaled. The original lives in this session's uploads only; **it is
not stored in the repo**, which is worth fixing if the branding is to be
maintained.

---

## Addendum 4 — I broke the WebGL simulator, and how

Omer: *"נראה שמשהו נדפק עם ה openGL … אני מדבר כרגע על מצגת אנטנות ואזורי פרנל."*
He was right, it was the document, and **it was my bug.**

### What happened

In addendum-2 work I ran a regex over lesson 06 to wrap loose signed values
(`−20dB`, `+6dB`, …) in `<span class="ltr">` so their sign would stop mirroring.
To avoid touching markup I split the file on tags and only substituted in the
text between them:

```python
parts = re.split(r'(<[^>]+>)', s)
for i, p in enumerate(parts):
    if p.startswith('<'): continue
    parts[i] = pat.sub(wrap, p)
```

That is fine for HTML and **completely wrong for a document with 608 KB of inline
JavaScript.** Inside `<script>`, the "text between tags" is source code. One
substitution landed inside a double-quoted JS string in the antenna-workshop
bundle:

```js
description:"… ופוגע בקרינה (<span class="ltr">−2.5dB</span> לכל תופסן)."
```

The injected span carries its own `"` characters, so the string literal
terminated early → **syntax error → the entire bundle never parsed → three.js
never loaded → the whole simulator was dead.** A single 26-character insertion
disabled 608 KB of code.

### Why my verification missed it

Every check I ran was blind to it. `html.parser` accepts it — it is valid markup.
The Chrome print pipeline renders the slide fine, because the simulator lives
behind a button and its panel is a dark box either way. Slide counts, text
diffs and the visual QA passes all came back clean. **Nothing I was measuring
could see a dead script.**

### Fixes

1. Reverted the injection; the string is plain text again.
2. Swept **every `<script>` block in all 11 decks** for `<span class="ltr">`,
   `class="ltrtx"` and `class="nohalo"` leaking in from any of my set-wide passes.
   One injection found, one repaired, nothing else.
3. Added a real gate: extract every script block and run **`node --check`** on it.
   All 7 blocks across the set now parse. This is cheap and should run after any
   regex that touches whole files.

### The rule

**Never run a content regex over a whole HTML file that contains inline
JavaScript.** Restrict the substitution to the regions *outside* `<script>`…
`</script>` explicitly, and verify with `node --check` afterwards. Splitting on
`<...>` does not protect you — in a script block that split is meaningless.

## Addendum 5 — crest moved to the top right

The footer crest was too small to notice (*"למטה לא רואים אותו"*), so it moved to
the top strip; then it was on the wrong side for an RTL deck. It now sits at
`top:28px; right:62px` at 27×38, bottom-aligned with the eyebrow band, with
״תקשוב 5059״ beside it. The eyebrow gets `padding-right:122px` to make room and
now starts to the left of the mark. Footers are back to their original two spans.
Verified across three decks including the longest eyebrow labels; nothing wraps
and nothing touches the title, which starts below the mark in any case.

**Note:** the lesson-06 file was renamed outside this session — it is now
`אנטנות_מונופול_פרנל_ותבניות_קרינה.html` (no `06_` prefix), while its guide PDF
still carries `06_`. Content verified intact (29 slides, both script blocks
parse). Globs of the form `רדיו/*/06_*.html` will no longer find it.
