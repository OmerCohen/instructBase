# Remarks — rules of thumb + motion pass

Date: 2026-07-26 · Author: Claude · Requested by: Omer

Two requests handled together: add the `75/f` monopole rule (plus any other
useful rules of thumb), and add animation — especially to the process diagrams
in `רשתות`, and to waves / interference / reflected wave / standing wave in
`רדיו`.

## Part 1 — rules of thumb (lesson 06)

**Every rule was checked numerically before it went on a slide.** New slide 17,
״תשעה מספרים שאפשר לחשב בראש״, grouped into lengths / installation / angle /
path, with the requested `75/f` as the headline formula band.

| rule | verification |
|---|---|
| `λ = 300/f` · `λ/4 = 75/f` · `λ/2 = 150/f` | exact by definition; checked at 30/40/48/60/88/150 MHz |
| practical resonant cut `≈71.5/f` | the standard ~5% end-effect shortening, stated separately so nobody trims to the geometric length |
| stand-off from metal `≥ λ/10 = 30/f` | **measured with the deck's own image model**: λ/12 = 0.0 dB (break-even), λ/10 = +1.4 dB, λ/20 = −4.2 dB, λ/40 = −10.1 dB |
| tilt loss `= 20·log₁₀(cos α)` | **exact, not a fit** — matched the model to within 0.03 dB at 0/10/20/30/45/60/70/80° |
| radio horizon `≈ 4.1·(√h₁+√h₂)` km | standard 4/3-earth constant; sanity-checked over 2–50 m |
| midpath Fresnel `r₁ ≈ 274·√(D/f)` | reproduces the exact geometry to 1 m over D = 4–20 km, f = 30–150 MHz |
| double height ≈ +6 dB · double power ≈ +19% range | two-ray: `Pr ∝ (h₁h₂)²/d⁴`, so range ∝ P^¼ |

**The nicest find:** the tilt loss is *exactly* `20·log₁₀(cos α)`, and for a
clean physical reason — over a conducting plane only the vertical component of
the current radiates (the horizontal part is cancelled by its image), so the
effective current is `I·cos α`. That means the tilt table and the polarisation
table are the same table, which is now said on the slide.

Four rules were also cross-linked onto the slides they were measured on
(metal proximity, tilt, Fresnel, current distribution) so the card is a summary
rather than an isolated list. Deck is now **29 slides**.

## Part 2 — motion, across all 11 decks

`.flow` was defined in every deck's stylesheet and used **zero times** — the
vocabulary existed but had never been applied. Added a shared motion layer to
all 11 decks (`.wave`, `.pkt`, `.blink`, `.breathe`, `.fade-cycle`, plus
`.rev`/`.slow`/`.fast` modifiers), CSS-driven so the existing
`prefers-reduced-motion` rule switches all of it off.

**SMIL is not covered by that media query**, so each deck's bootstrap now also
calls `svg.pauseAnimations()` when reduced motion is requested.

### Radio — the physics ones

- **Standing wave** (`04`, slide 3): rebuilt properly. A static dashed envelope,
  an instantaneous wave that morphs between `+2A·sin(kx)` and `−2A·sin(kx)`, red
  dots on the nodes and amber on the antinodes. Nodes stay fixed by
  construction because both extreme paths share the same zero crossings.
- **Forward and reflected wave** (`04`, slide 2): two generated sinusoids
  travelling in opposite directions, each extended a full period beyond the
  clip so the loop is seamless.
- **Interference** (`02`, slide 3): both panels animate in lockstep — left, two
  waves in phase with a doubled sum; right, two waves 180° apart with a sum that
  stays flat. Verified the sum amplitude is exactly 80 → 0.
- **Field radiation** (`03`, slide 3): feed current and radiated field now run.

### Networks — the process ones

46 packets now travel their connectors, added by a geometry-aware transform:
horizontal connector paths 60–520 units long with a stroke and no fill, packet
colour inherited from the line, direction taken from the path's own sign,
staggered start delays so parallel flows do not pulse in unison. Deck `04`
(tools) instead got a single packet running the full seven-tool chain, which
reads better than seven 59-px hops.

## Two mistakes I made and caught

1. **Node markers on the wrong points.** First version put the standing-wave
   dots at `x = 50,150,250…`, which are the *antinodes*. `sin(2πx/200)` is zero
   at `100,200,300…`. Would have projected a physics error; fixed and re-checked
   against the sine.
2. **An animation that contradicted its own slide.** My first interference
   version swept the relative phase continuously — on a panel titled ״הפסגות
   מגיעות יחד״ (*peaks arrive together*), next to a second panel that exists to
   show the opposite case. Replaced with lockstep motion that preserves the
   slide's two-panel argument.

## Verified

Re-rendered all ten other decks: **slide counts unchanged, text unchanged**
except the intended new labels (`+14` chars on the waves deck, `+31` on SWR).

## Follow-up — the card was unreadable, and the animations were invisible

### The reference card, rebuilt

First version put nine formulas into four narrow cards using `.checklist`, with
Hebrew prose and LTR formulas **in the same line box**. Bidi then interleaved
them — `λ = 300 / — אורך הגל במטרים f` — and the narrow columns made it worse.

Rebuilt as **two tables, one rule per row**: the formula lives in its own
`.fx` cell (`direction:ltr; unicode-bidi:isolate`) so bidi can never mix it with
the Hebrew explanation beside it. Also learned the hard way, twice:

- **Nested grids inside the flex `.body` silently dropped content** — the two
  example boxes rendered as nothing. Plain flex rows only now.
- **`justify-content:center` on `.body`** pulled the formula band up over the
  title. Removed.
- **Hebrew inside an `.fx` cell scrambles**, because the cell is LTR-isolated.
  The `×2 גובה ⟵ +6dB` cell came out as `×2 6+ ⟵ גובהdB`. Formula cells are
  now strictly symbolic (`×2 h → +6 dB`) with the Hebrew in the meaning column.

### Why no animation was visible anywhere

Omer reported seeing motion only in lesson 06 — which is exactly the signature
of **`prefers-reduced-motion: reduce`**. Every deck already carried
`@media(prefers-reduced-motion:reduce){*{animation:none!important}}`, which
kills all CSS animation; lesson 06's visible motion is three.js on
`requestAnimationFrame`, which that rule cannot touch. On Windows, *Settings →
Accessibility → Visual effects → Animation effects* off produces this, and it is
commonly off.

Verified the markup and CSS were correct on disk first (5 `class="wave"` in the
waves deck, 45 packets across the network decks, keyframes present and
well-formed) — so this was a delivery problem, not an authoring one.

**Fix, applied to all 11 decks:** the reduced-motion rule is now scoped to
`.deck-root:not(.motion-on)`, and **`A` toggles motion on**, with a small
״אנימציות פעילות״ badge so the state is visible and a hint added to the header
line. Default behaviour still respects the OS preference; the instructor can
override it for a class. The same key also un-pauses SMIL.

## Caveats

- **Motion cannot be verified in WeasyPrint** — it renders one static frame.
  Geometry, phase relationships and endpoints were checked numerically, and the
  static frames were inspected, but **the animations themselves want one look in
  a browser.** The seam-free loop depends on each wave being extended exactly
  one period beyond its clip; that is generated, not eyeballed.
- Decks `05_אבחון` (radio) and `01_יסודות` still have no added motion. The
  first is mostly resonance-dip curves where a sweeping marker would help but is
  real work; the second already had 10 SMIL animations of its own. Left alone
  deliberately rather than forcing motion where it adds nothing.
- Packet speed is uniform across all connectors regardless of length, so a long
  path looks faster than a short one. Acceptable, but if it grates, the fix is a
  per-path duration proportional to `--run`.

---

## Round 3 — motion on by default, the Yagi summary, and the remaining lessons

Omer: *"עכשיו יש אנימציות, אבל אני רוצה שהן יהיו שם כדיפולט. בנוסף, הייתי רוצה
גם אנימציה שמדגימה את תהליך ההתאבכות\ההחזרה של אנטנת יאגי… אחרי זה תמשיך לשאר
השיעורים."*

### Motion is now the default

All 11 decks ship `<div class="deck-root motion-on">`. The `A` key still toggles,
but the badge and hint are inverted (״אנימציות כבויות״ / ״A כיבוי אנימציות״) so
the visible affordance matches the new default.

**A consequence I had to chase:** the SMIL guard added in round 2 paused
`svg.pauseAnimations()` at load whenever the OS asked for reduced motion. With
`motion-on` default that was now *wrong* — CSS ran while SMIL stayed frozen, so
some slides half-animated. The load-time pause is removed; `A` is the single
source of truth for both CSS and SMIL. Removed from 10 decks (lesson 06 has no
SMIL).

This does mean **we now override `prefers-reduced-motion` by default.** That is a
deliberate trade for a projector deck and it is reversible in one attribute, but
it is a real accessibility regression for anyone opening these on their own
machine — worth knowing before the set goes anywhere wider than the classroom.

### The Yagi slide (lesson 06, slide 24)

Retitled ״איך יאגי עושה את זה: אותם מקורות, סכום אחר״. Two stacked blocks share
one clock: forward, the three element currents arrive nearly aligned and the sum
wave is **×2.04**; backward, the same three spread out and the sum is **×0.41**
— **14.0 dB F/B**. Every number comes from the same 3-element model that produces
the 7.4 dBi pattern on slide 11, so the two slides cannot drift apart.

Two build notes: the labels had to sit **outside** the `clipPath` (only the moving
`<path class="wave">` belongs inside), and the magnitude captions had to move off
the sum trace — at `y=211/387` they sat exactly on it.

### The rest of the lessons

Deliberately *not* "add motion everywhere". A terminal-output slide gains nothing.
I only animated slides whose **content is a change over time**, where a static
picture was already the weaker version of the point:

| deck | slide | what moves | why it earns it |
|---|---|---|---|
| `05` אבחון | 9 סורקים את כל התחום | marker rides the SWR trace, cursor tracks it | the slide's whole claim is that one spot frequency misses the dip |
| `05` אבחון | 13 הרזוננס זז | whip slides away from the metal **and** the dip slides with it, one clock | the causal link *is* the lesson |
| `05` אבחון | 14 העקומה קופצת | cable flexes, S11 spikes in the same frame | same — synchronised or it says nothing |
| `03` רדיו בסיסי | 6 הספק מוקרן | packets shrink down the chain; energy drops out at each loss | shows where the power *went* |
| `03` רדיו בסיסי | 8 אות מעל רעש | all three noise floors flicker live | static noise is a contradiction in terms |
| `01` מודל שכבות | 11 Jitter ו-Loss | 5 packets, equal send cadence, **unequal travel times**; the 5th dies in flight | jitter is variable delay — you cannot draw that still |
| `01` מודל שכבות | 12 צוואר בקבוק | dense in, one slow crossing, sparse out | throughput limiting, visibly |
| `04` כלי תחקור | 5 Ping | probe out, echo back, per hop | RTT is a round trip |

Totals: **132 animated elements across the set, up from 81.** Slide counts and
prose unchanged everywhere (probe re-run over all 11).

### Static-frame discipline (new rule)

SMIL animation replaces an attribute *only while it runs*. The authored value is
therefore the **print / no-SMIL fallback**, and it must not contradict the slide.
I got this wrong once: slide 14's trace was authored flat, so a printed copy of
״העקומה קופצת בדיוק כאשר הכבל זז״ showed a curve that never jumps. Authored
values are now the *claim* state; the animation cycles away from it and back.

The same problem in reverse hit `animateMotion`: a marker with no SMIL parks at
`(0,0)`, i.e. in the corner of the plot. Those groups now carry `opacity="0"`
plus a SMIL `<set>` — if the animation runs they appear, and if it does not they
are simply absent rather than wrong.

### Also fixed while in there

- `05` slide 9: the `M1` and `M2` marker labels were 56 px apart and ~100 px wide
  — they overlapped. Separated on both axes.
- `04` כלי תחקור: the echo packets use `.pkt.rev`, whose keyframe translates by
  **−`--run`**. They must therefore be authored at the *far* end of the hop, not
  the near one. Got this backwards first time.

### Caveats carried forward

- **Still not seen in a browser.** Every geometry, phase and endpoint here was
  checked numerically and every static frame was rendered, but WeasyPrint shows
  one frame and ignores SMIL entirely. The synchronised pairs (slide 13's whip
  and dip, slide 14's cable and spike) are the ones most worth a real look —
  they are only worth anything if they are actually in step.
- **`calcMode="discrete"` noise** flickers at ~3.5 Hz. That reads as noise on a
  projector; on a large bright screen it may be more agitating than useful.
- Packet speed is still uniform per path regardless of length (round-2 caveat),
  **except** on the bottleneck and jitter slides where the differing speed is the
  entire point.
