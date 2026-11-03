# Remarks — lesson 06, אנטנות: מונופול, פרנל ותבניות קרינה

Date: 2026-07-26 · Author: Claude · Requested by: Omer

## What was built

`רדיו/אנטנות - מונופול, פרנל ותבניות קרינה/`
- `06_אנטנות_מונופול_פרנל_ותבניות_קרינה.html` — 25 slides, 711 KB, fully
  self-contained (three.js r1xx bundle inlined).
- `06_דף_הנחיה_למדריך_אנטנות_מונופול_פרנל_ותבניות_קרינה.pdf` — 16 pages.

Decisions taken with Omer up front:
- **Inline full three.js** (~590 KB tree-shaken IIFE) rather than rewriting the
  simulator on a lightweight canvas renderer. Keeps the already-validated
  RFGame screen intact; cost is file size, which is irrelevant for a local file.
- **Parallel lesson, separate directory** — not a replacement for lesson 4 and
  not a continuation of the 01–05 sequence. The deliberate overlap with lesson 4
  is called out on page 2 of the guide.
- **Mixed audience** — part 1 aimed at people who physically rig antennas,
  part 2 at anyone who wants the mechanism.

## Simulator port (RFGame → deck)

Source: `D:\VS_DEV\Temp\RFGame\src\ui\antenna-workshop.ts` + `src/game/antenna.ts`.
Ported near-verbatim. Deliberate deltas, all additive:

1. **Radiation-pattern opacity slider** (explicitly requested). Implemented as a
   uniform-only update on the cached lobe shader materials — no geometry rebuild,
   so it is free to drag.
2. **Frequency slider, 30–88 MHz.** See the caveat below.
3. **Four preset rigs** (upright / tied mid / tied at the tip / lashed low).
   These directly answer the recurring "does it matter where I tie it?" question
   and make the screen usable in a 12-minute class slot.
4. **Top-view azimuth polar inset.** Reading azimuth off the 3-D cloud is
   unreliable for a lay audience.
5. Apply/cancel replaced with a single close — it is a demonstrator, not a
   planning step.

Scene, materials, solver hookup, picking and the lobe fresnel shader are
unchanged from the reviewed version.

> **Caveat carried over, now surfaced to the audience:** `antenna.ts` uses a
> fixed cosine current taper independent of frequency. That is correct only near
> λ/4. The 3 m whip is ~0.3λ at 30 MHz but ~0.88λ at 88 MHz, where the real
> current distribution reverses. The frequency slider therefore shows the right
> *direction* of the effect but not correct values. Labelled in the UI caption,
> on slide 24, and in appendix A of the guide. **If this ever needs to be real,
> the fix belongs in RFGame's `antenna.ts`, not in the deck.**

## New physics engine written for the deck (`RF`)

A ~60-line thin-wire far-field engine: antennas are lists of short current
elements; the field in a direction is the phasor sum of their transverse
contributions, split into θ̂ (vertical pol) and φ̂ (horizontal pol). PEC ground
is handled by an image rule — mirror z, negate the current — which reproduces
the correct "horizontal reversed / vertical preserved" behaviour for any
orientation. Directivity comes from numeric integration of total radiated power.

**Validated against textbook values** (`node` harness, not shipped):

| Case | Computed | Expected |
|---|---|---|
| λ/4 monopole over PEC, horizon | 5.12 dBi | 5.15 |
| λ/2 dipole, broadside | 2.10–2.15 dBi | 2.15 |
| λ/2 dipole, along its own axis | −21 dBi | deep null |
| 3-element Yagi, forward | 7.4 dBi | 7–8 |
| 3-element Yagi, front/back | 14.1 dB | 10–18 |
| Monopole with no ground plane | 50% of power radiated downward | qualitatively right |

Fresnel geometry matches the standard `17.32·√(d₁d₂/(D·f_GHz))` form to three
significant figures; knife-edge loss matches ITU-R P.526 at reference points
(v=0 → 6.0 dB, v=1 → 13.9 dB). The 60%-clearance rule of thumb lands at exactly
0 dB loss, which is a nice pedagogical coincidence worth keeping.

## Correction that also affects lesson 4

While validating the tilt demo the model contradicted copy I had already
written, and the model is right:

> **Over a good conducting ground plane, a tilted whip stays vertically
> polarised.** The image cancels the horizontal current component, so
> polarisation purity stays >99% even at 80° of tilt. The 15 dB loss at 80° is
> **self-cancellation against the image**, not polarisation mismatch.

Slides 6 and 8 and the tilt verdict copy were rewritten accordingly. Polarisation
mismatch is a real problem, but specifically when there is *no* good plane
(handheld tilted in free space, antenna on an insulated mast).

**Action for whoever owns lesson 4:** check whether its polarisation slide makes
the same conflation. I did not touch lesson 4.

## Review round 2 — three defects Omer found, all fixed

### 1. Preset rigs were geometrically impossible (the serious one)

The first preset anchors were placed by eye on the far side of the vehicle. The
solver dutifully folded the whip back on itself to reach them. Measured on the
original set: **bend of 50–53° per 25 cm segment (radius ≈ 0.27 m) and 1.8–2.2 m
of sideways swing** on a 3 m whip. A real whip snaps well before that, and
nobody lashes an antenna sideways across the cab.

Root cause, now written into the code as a rule: the whip bows *toward* its
anchor, so the straight-line mount→anchor distance must be a large fraction of
the **arc length** to the tied node. Below ~0.75 the rod has to reverse
curvature. The original presets sat at ratios of 0.39–0.61.

New presets, all verified with a headless solver harness:

| preset | ratio | bend/seg | lateral | tip | eff | range | risk |
|---|---|---|---|---|---|---|---|
| זקוף | — | 0° | 0 m | 4.15 m | 0 dB | 100% | 90% |
| מעל האמצע | 0.89 | 10.3° | 0.47 m | 2.82 m | −4.4 dB | 72% | 28% |
| מהקצה | 0.92 | 12.5° | 0.08 m | 2.10 m | −7.0 dB | 59% | 8% |
| לישה נמוכה | 0.87 / 0.84 | 20.7° | 0.31 m | 2.00 m | −8.9 dB | 54% | 2% |

All anchors now sit on the mount's side (x ≈ 0.62–0.75 vs mount x = 0.92) so the
whip bows **forward over the cab**, and the two-tie rig's anchors are closer to
each other than the arc between their nodes — otherwise neither tie is
satisfiable and the solver silently drops both.

Side benefit: the numbers now tell a cleaner story than the original copy did.
Tying mid vs. tip is a genuine range-versus-protection trade (72%/28% against
59%/8%), not "mid good, tip bad".

### 2. A tie could look broken when it was actually correct

If the chosen point on the whip cannot physically reach the anchor,
`tiesSatisfied` rejects it, the rig re-solves without it, and the tie is drawn
red over a perfectly straight antenna. That is correct behaviour inherited from
RFGame and it reads as a bug. Added an alert bar that names the two cases:

- **unreachable tie** — "the point you picked on the whip does not reach that
  anchor; the whip is only 3 m";
- **over-sharp bend** — warns above 22°/segment (radius 0.65 m) and calls it
  impossible above 32°/segment (radius 0.41 m), quoting the actual radius.

The elastica has no failure model, so this is the only thing standing between
the screen and silently-impossible geometry. Kept as UI rather than as a solver
constraint, so RFGame's validated physics is untouched.

### 3. Slide graphics

- **SVG labels were placed with an LTR mental model** (x = left edge) but the
  document is RTL, where `text-anchor:start` anchors the *right* edge. Every
  unanchored label was growing leftward across the artwork. Fixed globally with
  `svg text{direction:ltr}` — the bidi algorithm still orders Hebrew glyphs
  correctly inside the run. Six specific collisions repositioned on top of that.
- Added a dark **text halo** (`paint-order:stroke`) so labels stay readable
  where they must cross a line or a filled lobe.
- **Replaced the hand-drawn vehicle sketches with live 3-D**, per Omer's point
  that the assets already existed. New `mini.ts` exposes a `MiniRig`: same HMMWV
  mesh, same `evaluateRig` shape solver, same lobe shader as the simulator, no
  controls, slow orbit, and it only animates while its slide is on screen.
  Five vignettes now — one on slide 5 (installation types), one on slide 7
  (simulator launcher), and slide 8 rebuilt as three side-by-side rigs with the
  measured numbers as captions. `buildHumvee()` was lifted out of the workshop
  class to module scope to make this possible; the class calls it.
  Degrades to an explanatory note if WebGL is missing — verified, 5/5.

### 4. Instructor guide rewritten

The first version was a school-style lesson plan. Rebuilt against the actual
house style extracted from lesson 04's guide: centred bold headline under a
small eyebrow, hairline rule, dark navy stat chips, rounded cards with a
coloured inner edge, full-width note blocks in the same family, dark headline
band for the one line that matters on each page, generous whitespace, one topic
per page. 16 pages → 15.

## Review round 3 — the unit leaflet, and a doctrine conflict I got backwards

Omer supplied **״שיפצורי אנטנה״, מחלקת תקשוב גדס״ם 9** (`אנטונות.pdf`) and asked
for more on tying materials, antenna-to-body contact and near-field clearance,
and for radials to be demoted — most of the audience doesn't know the word.

### The leaflet's content (transcribed, for future reference)

**עשה:** קשר לא הדוק · חיבור קרוב לבסיס האנטנה ככל האפשר · קצה חופשי ורחוק
מגוף הרכב · זווית מתונה, לא יותר מ־30°.
**אל תעשה:** חיבור הדוק · אנטנה קרובה לגוף הרכב · קצה האנטנה צמוד לרכב ·
כיפוף חד.
**גוף הטקסט:** עדיף שלא לקבע כלל; אם חייבים — קרוב לבסיס, **לא יותר מחצי
אורך**; לא הדוק, לשמור טווח תנועה; לעטוף את נקודת המגע בפלנלית, רצוי מנוילנת;
גומיות רחבות או חומר גמיש אחר, לא פלסטיק קשיח; **לא חומרים מוליכים או סופגי
מים**; **להרחיק את האנטנה מגוף הרכב כמה שאפשר**.

### The conflict — and it was mine, not the leaflet's

My slide 8 said **״קשרו מעל מחצית האורך, לא מתחת״**. The leaflet says the exact
opposite: **״לא יותר מחצי אורך״**, i.e. tie *below* the halfway point.

I tested it against the solver rather than argue. The leaflet wins, decisively:

| rig | base tilt | sharpest bend | nearest metal | efficiency | range |
|---|---|---|---|---|---|
| free, no tie | 0° | 0° | 0.65 m | 0 dB | 100% |
| **per leaflet** — wide rubber, frac 0.35, loose | **11°** | 4.8° | 0.43 m | **−0.9 dB** | 94% |
| tied above half length | 27° | 11.9° | **0.01 m** | −6.1 dB | 63% |
| tip lashed to the vehicle | 28° | 12.5° | **0.00 m** | −7.0 dB | 59% |
| same, with a metal clamp | 24° | 11.9° | 0.03 m | −9.2 dB | 52% |

**Where my reasoning went wrong:** I argued from current distribution — most of
the current is low on the whip, so don't bend the low part. True in isolation,
but it assumes both options bend the whip *equally*. They don't. A low, loose
tie barely bends anything; it just **tilts** the whole whip by ~11°, which my
own tilt demo already priced at about a decibel. Tying high or at the tip forces
a real bow, drives the whip into the cab, and costs 6–9 dB. I compared the wrong
pair.

**How it is handled now** — not by silently swapping the rule, since Omer asked
for contradictions to be explained. There is a dedicated slide (10, ״יישוב
סתירה״) that separates the two questions:

- the leaflet answers *how to restrain the whip without paying for it* — low,
  loose, tip free. This is the default.
- the simulator answers *what it costs when you must physically lower the tip* —
  6–7 dB. That is a price tag on an exception, not a recommendation.

Reconciling sentence, quoted verbatim on the slide and in the guide: **נמוך
ורופף כברירת מחדל; קשירה גבוהה היא חריגה מודעת שעושים רק מול מכשול פיזי אמיתי.**

**Honest limitation surfaced with it:** the simulator's ״סיכון היתקלות״ measures
*snagging on branches* — unsupported whip above the roofline. It does **not**
model base fatigue from flapping, which is precisely what the leaflet's low tie
prevents. So the doctrine-compliant rig looks in the simulator like it "doesn't
help". It does; the metric just doesn't see it. Stated on the slide and in the
guide.

### New: distance-to-metal demo (replaces radials)

`data-demo="metal"`. Exact, no fitted constants: a large vertical conducting
surface mirrors a parallel current with reversed sign — the same image rule
slide 18 already uses for the horizontal ground plane, turned 90°. The whip at
distance *d* therefore sees an antiphase copy at 2*d*, and each has its own
ground image. Four element groups, closed form.

| distance (48 MHz, λ = 6.25 m) | horizon gain vs. a free-standing whip |
|---|---|
| 5 cm | −20.0 dB |
| 15 cm | −10.5 dB |
| 30 cm | −4.6 dB |
| 50 cm | −0.4 dB |
| 1.5 m (≈λ/4) | +6.0 dB |

Plus **two deep blind directions parallel to the surface, at every distance** —
they rotate with the vehicle, which is a ready-made answer to "why does comms
drop when I turn". This gives the leaflet's softest-sounding line ("keep the
antenna away from the body") the biggest number in the lesson.

Caveat stated on the slide, in the speaker note and in appendix A: an infinite
flat PEC plane is an idealisation. A real cab is finite, so the nulls are tens
of dB deep rather than infinite and the magnitudes are optimistic. The mechanism
and the trend are exact.

### Other round-3 changes

- **New materials slide** built from the leaflet's three criteria — conductive,
  water-absorbing, flexible. Wide rubber recommended; natural rope flagged
  (absorbs water → partially conductive → explains "faults that only appear in
  the rain"); zip tie flagged (rigid → the sharp bend the leaflet forbids);
  metal clamp forbidden. The flannel-wrap instruction gets its own block.
- **New near-clearance slide**: three zones around the antenna — first metre
  (electrical, the mirror effect), 1–10 m (near shadowing), beyond (classic
  Fresnel). Includes the counter-intuitive figure that r₁ is only ~2.5 cm one
  metre out on a 10 km link, and the field rule that follows from it.
- **Simulator**: presets replaced with leaflet-aligned ones (ללא קיבוע / לפי
  העלון ✓ / גבוה מדי ✗ / קצה לרכב ✗ / תופסן מתכת ✗✗). Two new readouts —
  **base tilt** (against the leaflet's 30°) and **minimum gap to bodywork**,
  which was the one instruction the build gave no feedback on at all. Alert
  rules re-ordered to follow the leaflet's own list. Tool descriptions rewritten
  around the material criteria.
- **Radials demoted**: zero occurrences left in part 1, one aside in the theory
  half where ground-mounted installs genuinely need the word. The concept
  survives as "מסלול החזרה" / "גוף הרכב".
- Deck is now **28 slides** (16 practical + 12 theory), guide 16 pages.

## Review round 4 — leaflet attribution removed from the deliverables

Omer: the audience doesn't necessarily know the leaflet, so citing it just
confuses them. All references stripped — **zero occurrences of ״עלון״,
״שיפצורי אנטנה״ or ״גדס״ם״ in the shipped deck**, and none in the guide either.

**Nothing pedagogical was lost, and that is not a coincidence.** Every rule the
leaflet states is independently derivable from the model, which is exactly how I
was able to verify it in round 3. So each one now stands on its own measurement
instead of on authority:

| rule | now justified by |
|---|---|
| tie low, not above half length | tying higher drives the whip into the cab: −6.1 dB, gap 0.01 m |
| loose, not tight | keeps base tilt at 11°, which costs <1 dB |
| angle ≤ 30° | measured: 30° = −1.2 dB; past that the loss climbs fast |
| tip free and away from the body | tip lashed down = −7.0 dB, gap 0.00 m |
| no conductive material | −2.5 dB per clamp, measured |
| no water-absorbing material | wet natural fibre becomes partially conductive |
| keep the whip away from the metal | the distance-to-metal demo, exact |

Two slides needed rewriting rather than find-and-replace, because they were
*built around* the leaflet as a source:

- **Slide 5** was ״מה שהעלון אומר — וכמה זה שווה״. Now ״איך קושרים אנטנה — וכמה
  עולה כל טעות״: the same four do/don't pairs, presented as the lesson's own
  rules with the measured table underneath.
- **Slide 10** was ״יישוב סתירה״ — it existed only to reconcile the leaflet with
  the simulator. The underlying tension is real and independent of any document,
  so it is now ״שתי מטרות״: *restraining* the whip (low and loose, the default)
  versus *lowering* it (high or at the tip, costs 6–7 dB). Same conclusion, no
  external reference, and arguably a cleaner framing — it teaches the
  distinction rather than defending a text.

**One deliberate exception, flagged to Omer:** a single instructor-only line on
guide page 2 notes that the four rules match existing unit installation guidance
and were verified against the model, without naming or quoting it. Rationale: if
a trainee says "but the instructions say X", the instructor should not be caught
out. Trivial to delete if unwanted.

## Deferred / not done — pick up later

- **Instructor guide is generated with WeasyPrint**, not headless Chrome like
  the existing guides (no browser in my sandbox). Visual result matches the
  house style closely but the font is Liberation Sans, not Arial. Metrically
  compatible; if exact parity matters, re-print `outputs/build/guide.html` from
  Chrome. Source HTML is kept so this is a one-command job.
- **No real-browser smoke test of the WebGL path.** Chrome tooling refused
  `file://` URLs. Everything else was exercised under jsdom (all 25 slides,
  every control, ~8 000 canvas draw calls, zero errors, and the vignettes
  correctly degrading 5/5 without WebGL). The rig geometry was verified against
  the real solver headless. **Still needs one human pass** over the five 3-D
  vignettes and the simulator — guide page 3 is a 7-step checklist for exactly
  this. Round-2 defects 1 and 2 were both things only a live look would surface,
  which is the argument for doing it before the first class.
- **The radials demo loss model is schematic.** `R_ground = 38·e^(−N/2.2)` and a
  low-angle roll-off knee `el₀ = 7·e^(−N/3.5)+0.6`. It is tuned to produce a
  believable curve with the knee in the right place (0 → −10 dB, 4 → −3.5 dB,
  8 → −1.1 dB), not derived. This is the only number in the deck I would not
  defend in a technical review; it is flagged as schematic on the slide's
  speaker note and in appendix A of the guide. If someone wants it rigorous,
  it needs a real ground-loss model (Sommerfeld / NEC).
- **Tilt slider capped at 80°** rather than 90°, because at exactly 90° a rod
  lying in the ground plane is perfectly cancelled by its image and the readouts
  go to −∞. 80° already reads as "collapsed".
- **Vehicle body coupling is not solved** anywhere — in the simulator it is a
  geometric obstacle only. Unchanged from RFGame; noted, not fixed.

## Build reproduction

Sources kept in the session outputs folder (`build/`): `antenna.ts`,
`workshop.ts`, `mini.ts`, `entry.ts`, `deck.head.html`, `deck.part1.html`,
`deck.part2.html`, `deck.js.html`, `guide.html`. Assembly is

```
esbuild entry.ts --bundle --format=iife --minify --charset=utf8 --target=es2018
```

then concatenating the HTML parts with the bundle inlined between `<script>`
tags. **`--charset=utf8` matters**: without it esbuild escapes every Hebrew
character to `\uXXXX`, which still runs but makes the shipped file impossible to
grep or spot-check.

The guide PDF is `weasyprint guide.html`.

These are scratch files and will not survive the session — if the deck needs
regular maintenance, move them into the repo.
