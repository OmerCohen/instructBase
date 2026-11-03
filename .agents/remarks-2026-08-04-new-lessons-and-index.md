# 2026-08-04 · שני שיעורי רשתות חדשים (06 DHCP, 07 שכבה פיזית) + עמוד אינדקס

Task: gap review over all 11 lessons, add lessons where a real hole exists, and
build an index page linking every deck and guide. Omer approved building both
proposed lessons (offered as options, not built unilaterally).

## Gap analysis — what was added, what was deliberately NOT added

- **DHCP was a real hole.** Before this work it appeared exactly once in the
  entire set — as an `ipconfig` output line in net-04 — while net-05 tells the
  technician to "check IP settings" and never says where they come from. Now
  net-06.
- **Physical layer was a real hole.** net-05 opens with "הפיזי קודם" with no
  lesson establishing what "the physical" is; the radio track got a full field
  lesson, networks had nothing. Now net-07.
- **TCP/UDP depth was NOT added.** net-01 explicitly bounds it ("היכרות בלבד,
  אין צורך להעמיק") — that is a recorded scoping decision and I did not reverse
  it. If someone later wants a transport-layer lesson, it is a decision to
  revisit, not an oversight.
- **נהלי קשר / משמעת קשר was NOT added.** It is unit doctrine; authoring it
  without a source document would mean inventing doctrine. Flagged to Omer as
  requiring source material. Still open.
- **Wi-Fi was NOT added**, deliberately; the omission is stated on lesson 07's
  גבולות slide and in its guide so it reads as a decision, not a gap.

## Numbering decision (do not "fix" this)

The physical-layer lesson pedagogically belongs early (recommended teaching
order on the index: 1 → 7 → 2 → 3 → 4 → 6 → 5) but it is numbered **07**.
Renumbering the existing set would touch footers, title chips and explicit
cross-references ("חפיפה עם שיעור 6", "שיעור 4 נתן את הכלי") across 11 shipped
artifacts — exactly the set-wide churn prior remarks warn about. The index
carries the recommended order instead; the numbering note is printed on the
index itself.

## Build notes

- Decks clone lesson net-04's head (full CSS incl. crest/branding), nav and
  script **verbatim** (extracted programmatically, not retyped); only title,
  aria-label and deck-root id replaced. 13 slides each, speaker note on every
  slide, motion default-on, footers `שיעור N · <name>` + `NN / 13`.
- Deck 06 reuses the established lab addressing so examples line up across
  lessons: `10.20.30.0/24`, gateway `.1`, DNS `10.20.4.10` (net-04's simulator
  values), DHCP server `10.20.10.20`, host `WS-4487`, domain `unit.local`.
- Guide sources live in `.agents/guide-sources/` as `06_net_guide_source.html`
  and `07_net_guide_source.html`, cloned from `01_net_guide_source.html`
  (title page → `00 · בריף` → content pages → `מהלך המצגת` + glossary +
  closing questions). PDFs rendered with WeasyPrint 69.
- **Font caveat for future PDF rebuilds:** this build container has no
  Hebrew-capable "Liberation Sans"; Hebrew glyphs fall back to DejaVu Sans.
  Visually consistent with the set but possibly not glyph-identical to the
  2026-07-30 rebuild environment. If a pixel-diff against the other 11 PDFs
  ever matters, check which font the original environment fell back to first.

## Verification done

- `node --check` on every extracted `<script>` block (house rule after
  Addendum 4). Slide counts, footer numbering, single `motion-on` root.
- Both decks Chrome-printed (13 pages each) and reviewed as contact sheets;
  both guides text-extracted with `pdftotext -layout` — `169.254`, `100 Mbps`,
  `1 Gbps` all in correct digit order; no digit-dash-digit ranges exist in any
  new file (checked by regex, 0 matches); 0 em dashes.
- One real defect found and fixed pre-ship: deck 07 had `<span class="ltr">100
  מטר</span>` — the Hebrew unit word wrapped inside the LTR span, violating
  the "wrap the number, never the trailing unit word" rule. Now only `100`.
- Index links: every href URL-decoded and checked against the folder listing;
  4 targets are the new files, all others exist on the device.

## New lesson learned (candidate standing rule)

**Low-resolution contact sheets produce phantom bidi defects.** I "saw"
`arp -a` render reversed in a card title on three successive crops; a
`pdftotext -bbox` word-coordinate extraction proved the rendering was correct
all along (`arp` at x=267 < `-a` at x=297, island at the right end of the RTL
line, exactly as intended). This is the eyeballing trap the 2026-07-30 remark
describes, in a new costume. When a bidi defect is suspected in a render,
extract word coordinates and compare x-positions — do not squint at pixels.

## Deferred / observations for a future pass

- Radio lesson 06's deck filename has no `NN_` prefix
  (`אנטנות_מונופול_פרנל_ותבניות_קרינה.html`) — the only such inconsistency in
  the set. The index links it as-is; renaming a shipped file was out of scope
  for this task and would need Omer's nod (and breaks nothing today).
- The index page (`00_אינדקס_שיעורים.html`, repo root) is a standalone RTL
  HTML in the deck colour language, crest embedded, hrefs percent-encoded.
  Its list is maintained **by hand** — adding a lesson means adding a row.
  Two of its bugs died in review: a `.meta span` type-selector leak that made
  the "חדש" badge display:block (description now uses `.desc`), and bidi
  scrambling in the recommended-order line (each step now `unicode-bidi:isolate`).
- New content claims worth an SME glance: renewal at half-lease (T1/T2 not
  named by design), APIPA has no default gateway, auto-vs-forced duplex falls
  back to half (802.3 behaviour), 100 m copper segment guidance, PoE budget
  as an exhaustible switch resource. All are textbook-standard and each is
  stated with its limits per the house tone rule.

## Addendum (same day) · דפית טכנאי A6

Omer asked for a double-sided A6 technician pocket card: side A a Windows
network-diagnostics cheatsheet, side B either common radio faults+fixes or a
troubleshooting flowchart. **I chose the faults table with a five-step flow
strip on top, not a full flowchart** — at A6 a real decision tree drops below
readable size; the table is denser and every row is symptom → suspect →
action. A full tree remains a natural A5 candidate if ever wanted.

- Files: `דפית_טכנאי_A6.pdf` (2 pages, exact A6) + `דפית_טכנאי_A6_מקור.html`,
  **both at repo root** — the editable source deliberately does NOT live in
  `.agents/guide-sources/` because Omer explicitly asked for an accessible
  editable source. The source header comment documents the duplex print
  setting (flip on short edge) and the WeasyPrint re-render command.
- Content is drawn only from the shipped lessons (net 1-7 chain for side A;
  radio 1-6 measurement doctrine for side B: PTT voltage sag, dummy-load
  isolation, forward/reflected reading, match≠radiation, S11 vs reference,
  cable-motion curve jump). Nothing on the card introduces a claim the decks
  don't teach.
- Two fit iterations were needed: first render overflowed to 4 pages
  (typography tightened ~8%, texts shortened, columns rebalanced), then side
  B's flow strip overflowed the page edge (labels shortened). Body text ends
  at ~5.9pt — near the floor for print; anything added to this card must
  displace something else, not shrink the type further.
- The card is linked from the index under a new "חומרי עזר" section.

## Addendum 2 (same day) · ASCII rename for IIS + card side B rebuilt

Omer is publishing this tree from IIS to the open web and asked for all-ASCII
names; separately he rejected side B of the technician card as aimed too high.

### The rename

Every file and folder is now ASCII, structure `radio|networks/NN-<slug>/
NN-<slug>-deck.html` + `-guide.pdf`, plus `index.html` and `reference/`.
See `../agents.md` for the canonical layout — it is live documentation and was
rewritten, not appended to.

- Done in place on the device with `device_bash` `mv`, moving by **glob**
  (`for f in "$src"/*.html`) rather than by typed Hebrew filename — each lesson
  folder held exactly one HTML and one PDF, so this was typo-proof. Worth
  reusing: hand-transcribing 26 Hebrew filenames would have been the likeliest
  source of a silent mistake.
- `device_bash` cannot delete. The emptied Hebrew directories were moved to
  `_to_delete/` — **Omer has to remove that folder by hand**, and it must not be
  copied to the webroot.
- Side effect worth noting: this also fixed the radio-06 filename that had no
  number prefix (previously flagged as a deferred inconsistency above). It is
  now `06-monopole-fresnel-patterns-deck.html` like everything else.
- All 28 index links were re-resolved against the real tree on the device after
  the move (`[ -f "$h" ]` per href) — 0 missing. Decks were confirmed
  self-contained first (no `src`/`href` to any local file, crest is base64), so
  renaming could not break them internally.
- Added: `techgame/` link in the index, `target="_blank" rel="noopener"`,
  pointing at the directory so IIS serves its default document. Omer drops his
  published game there. **The link 404s until he does**, and its title and
  description are placeholders awaiting the real ones.

### Card side B rebuilt

Omer's correction, recorded because it should shape future field aids: **~90% of
radio faults never reach the level side B was written for; a דרג-ב' technician's
ceiling is a forward/reflected power check.** The VNA/S11/match-vs-radiation
table was the syllabus talking, not the job.

Replaced with a hardware-triage flow: one entry box (`אין קשר`) fanning into
three symptom branches — **A** dark set (power: switch → feed connector →
voltage *under PTT* → fuse → known-good source), **B** lit but no comms at all
(antenna seated on the right port → connector → cable damage → antenna
integrity/grounding → known-good swap, one at a time), **C** works direct but
not through the מעד/רמ״ק, which ends in a **bypass test**: handset straight into
the radio isolates the box from the set. Each branch terminates in an explicit
verdict and an escalation line. Built from `div`/CSS, **not SVG** — WeasyPrint
does not run bidi inside SVG, so Hebrew in an SVG flowchart would render
reversed (existing standing rule; it decided the implementation here).

**Open verification request for Omer — do not treat as approved doctrine:** I do
not know what מעד/רמ״ק expand to or what the unit's sanctioned checks on them
are, so branch C is built only from claims that hold regardless (cable seated
both ends, selector position, non-zero volume, box powered, and the bypass
test). If the unit has a prescribed procedure for these, branch C should be
replaced with it. I deliberately did not invent one.

Also added on Omer's request: unit crest + `גדס״ם 5059 / מחלקת תקשוב` in both
card headers (same base64 crest as the decks, one shared CSS class), and the
card name moved from the header to the footer to make room.

### Publishing note

`.agents/` and `agents.md` are internal and must stay out of the webroot; IIS
serves dot-directories. Omer said he only publishes the relevant parts, so no
`web.config` deny rule was added — the publishable set is exactly `index.html`,
`radio/`, `networks/`, `reference/`, `techgame/`.

## Addendum 3 (same day) · card side B replaced again + B&W print pass

**Omer rejected the radio side outright: "כמעט שום חלק לא נכון."** Recording this
plainly because it is the second miss on the same surface and the lesson is
about me, not about the layout.

What went wrong: I generated field-facing radio content from what the *decks*
teach plus general RF reasoning, in a domain where the real procedures are unit
equipment doctrine I do not have. Addendum 2 already flagged one branch as
unverified; the honest read is that the whole side was in that category and
should not have shipped. **Rule for next time: for radio/equipment field
procedure, produce nothing without a source document — an empty side is better
than a plausible one.** The decks are not a source for field procedure; they
teach why a measurement means what it means, which is a different artefact.

Omer's options were "leave it blank or make it a network extension, maybe a
troubleshooting procedure", plus one fact that reframes things: **their
environment has no DHCP.** Side B is now a network troubleshooting procedure
built around exactly that.

### New side B: נוהל איתור תקלות רשת · כתובות סטטיות

A seven-row numbered procedure (0 symptom/scope/what-changed → 1 healthy station
as the reference → 2 physical → 3 address vs. plan → 4 adjacency and routing →
5 name and service → 6 identity), each row paired with "the finding that moves
you on". Above it, the part that carries the actual value — **what is different
in a static environment**:

- A typo is suspect #1, not the server; one digit in a mask or gateway does it.
- Nothing self-heals: a NIC switched to "obtain automatically" lands on
  `169.254` and **stays there**, because no server will answer.
- Duplicate addresses are common — there is no central allocation.
- A plan change (new DNS/gateway) is a manual round; a station that was missed
  keeps a stale value and **looks exactly like a server fault**.
- A NIC swap or a re-image resets the config; record the address before touching
  anything.

Side A gained two static-environment rows in the same spirit (`DHCP Enabled`
should read `No`; `ipconfig /all` is compared to the plan value-by-value) and
lost the `release`/`renew` row, which is meaningless with no server. Footer now
reads "מבוסס שיעורי רשתות 1-5 ו-7" — deliberately excluding 6.

### Black-and-white printing

Requirement: keep colour for colour printers, stay readable on a mono laser.

Method, worth reusing: **WCAG contrast ratio is computed from relative
luminance, which is exactly what a grayscale conversion preserves — so auditing
every foreground/background pair to ≥4.5:1 is a proof of B&W legibility, not an
approximation.** A script in the build enumerates all 18 declared pairs and
prints the ratio; worst pair is now 5.06:1, zero failures. Verified again by
rendering to PNG and hard-converting to L mode as a proof.

Changes it forced: coloured heading text inside tinted boxes became dark navy
(`#a8701a` on `#fdf4e6` was only 3.81:1); the footer grey went `#8b9bab` →
`#5b7186` (2.86 → 5.06); table-header text went teal → navy; borders darkened
`#dbe3ea` → `#c7d2db` so they survive; amber/red accents darkened to `#b07414` /
`#c0374b`. Structurally: **no information is carried by colour alone** — every
tinted box opens with a bold word label (`אסור:`, `הסלמה = ראיות:`), branches
carry numbers, so the greyscale copy loses nothing but decoration. Added
`print-color-adjust:exact` for browser printing.

### Open question raised to Omer, not yet answered

**Lesson 06 (DHCP) rests on a premise that this new fact contradicts.** If there
is no DHCP anywhere in the environment, then DORA, lease renewal, Relay and
Reservation are theory for these technicians; the durable part is narrow —
recognising `169.254` as "someone set this NIC to automatic and nothing will
answer". Options put to him: retarget the lesson to static addressing (keeping
DHCP as the contrast case), keep it as background, or drop it from the set.
Until he decides, the lesson stays as built and the index still lists it.

## Addendum 4 (same day) · radio-06: new slide 20 "אורך ופאזה"

Omer asked for an illustration of **why antenna length matters**: an over-long
mast with current travelling up and reflecting, wavelets radiated from many
heights with small progressive phase differences, at least 8 sample points up to
the quarter-wave point, and a dashed line at λ/4 where the phase crosses into
the opposing half and interference turns destructive.

### The physics actually put on the slide (checked, not asserted)

Model: uniform line source, travelling current wave, element at height s
contributes with phase −ks, observed toward the horizon. Coherence of the sum is
`|sinc(kL/2)| = |sin(πL/λ)/(πL/λ)|`, computed rather than guessed:

| L | top-element phase | coherence |
|---|---|---|
| λ/4 | −90° | 90% |
| λ/2 | −180° | 64% |
| 3λ/4 | −270° | 30% |
| λ | −360° | 0% |

The mast is drawn at **3λ/4** with 25 emitters, 14px apart, 11.25° of phase per
step — **9 of them at or below 90°**, which satisfies the "at least 8 up to the
quarter point" requirement exactly. The dashed λ/4 line is the point where a
contribution arrives perpendicular to the feed's; past it the projection onto
the accumulated sum turns negative. Beside the mast is a **tip-to-tail phasor
chain**: 25 equal contributions curling through 270° whose chord is only 6.47
long (verified two ways — vector sum and the closed form
`|sin(Nα/2)/sin(α/2)|`).

**Honesty box on the slide, and this matters:** the model explains why length
stops paying past λ/4; it does **not** support "every extra centimetre hurts".
A real base-fed monopole can still gain toward the horizon out to roughly 0.6λ
before the pattern breaks into lobes, and the dominant field penalty is the
match/reflection story from lesson 4. That caveat is on the slide and in the
speaker note, per the standing rule that every modelled number states its limit.

### Build method — the safe path through a 770KB deck with a 608KB inline bundle

`device_stage_files` was refused mid-task (`session_stale_relogin` — the
desktop's sign-in went stale), so the deck could not be pulled into the
container. Editing was done **in place on the device** with `device_bash` +
python3, which turned out to be the better method anyway:

- **All 30 `<section>`s live before the first `<script>` (offset 110537).** The
  edit operated only on `head = t[:SCR]` and re-concatenated `tail` untouched —
  a structural guarantee against the Addendum-4-of-2026-07-28 disaster
  (a content regex that killed the WebGL bundle). Both script blocks were then
  **SHA-1 compared against a backup**: 608680 and 36024 bytes, byte-identical,
  and `node --check` passed on both.
- Renumbering was done by **re-deriving** every footer and eyebrow from the
  slide's new index (`footer = i+1 of 30`, `eyebrow = i`) rather than by
  arithmetic on matched digits. Verified: 0 numbering errors across 30 slides.
- `html.parser` tag-balance run over the whole file: 30 sections, no unclosed
  tags, no stray closes.
- The injected keyframes were then **lifted out of an in-body `<style>` into the
  head stylesheet** (brace balance re-checked = 0, in-body `<style>` count = 0),
  so the deck keeps exactly one stylesheet.
- Backups kept: `.agents/build/radio06-deck-BACKUP.html`,
  `.agents/build/06_guide_source-BACKUP.html`, and the inserted fragment itself
  as `.agents/build/radio06-slide20-length-and-phase.frag.html`.
- The slide was visually iterated **in the container** against the shared CSS
  baseline before insertion, then the deck's real rule values were read off the
  device and compared: real `.title` 38px / `.key.sm` 15.5px / `.copy.sm` 16px /
  slide padding 38-58-62 are all *tighter* than the harness used, so the text
  column has more room in the deck than in the proof. No overflow.
- Three bidi placement bugs were caught and fixed in the proof renders. Cause
  worth remembering: **in these decks a Hebrew SVG `<text>` treats `x` as its
  RIGHT edge** (RTL flows leftward from the anchor), so a label meant to sit to
  the right of an object must be given `x` = its intended right edge, not its
  left. Three labels initially landed on top of the mast, and two overran the
  viewBox and were clipped.

### Left undone, needs Omer

1. **The guide PDF for radio-06 is now stale.** Its source chips were corrected
   (28 → 29 slides, `16 / 12` → `16 / 13` per part — part B counts the divider,
   which is how 16+12=28 reconciled), but the PDF itself needs one WeasyPrint
   run and that needs the source in the container, i.e. it is blocked on the
   device re-authenticating. One command once it is.
2. **Timing not touched.** The guide's time chips (`85–90` total, `30–35` part B)
   and its time-split table do not account for the new slide, which realistically
   costs 3-4 minutes. Changing published timings is his call, not mine.
3. **A pre-existing numbering defect in the guide, unrelated to this change.**
   In the part-B slide map, `מסלול החזרה` is numbered **21**, while 10 of the
   other 11 rows follow a consistent offset that implies **18** — and 21 is
   already taken by `נוסחת פרנל`. I did **not** "fix" it: I cannot explain the
   offset the map uses (it is not the deck's section index or eyebrow number, so
   the map may simply predate slide churn recorded in earlier addenda), and
   renumbering an instructor document on a pattern I cannot justify is exactly
   the class of unforced error to avoid. Flagged for his decision.

## Addendum 5 (same day) · radio-06 slide moved to part A and the figure rebuilt

Omer rejected two things about Addendum 4's slide, both correctly:

1. **Placement.** It belongs in **part A, right after slide 2** (the
   monopole/dipole slide) — the natural question after "a monopole is half an
   antenna" is "so why does its length matter?". It is now **section 3**,
   between `מונופול הוא חצי אנטנה` and `כמה מתכת קרובה עולה לכם?`, with
   part A's eyebrow style (no `p2`) and part A's footer text
   (`אנטנות · התקנה, תבניות ופרנל · שיעור 6`).
2. **The figure.** "straight lines at different angles" — the phasor chain — was
   an abstraction, and wrong for the practical half. He wants **actual waves
   with a small, accumulating phase difference.** Fair: a phasor diagram asks
   the audience to already accept that a wave can be drawn as an arrow.

### The rebuilt figure

17 **real sinusoids**, one per sampled height on a λ/2 mast (twice the length it
should be), each shifted 11.25° from the one below it — **9 of them at or below
90°**, which is the "at least 8 up to the quarter-wave point" he asked for. A
static dotted vertical reference line marks one instant and one place, and the
geometry makes the punchline exact rather than illustrative:

- row 0 (feed, 0°) is at a **crest** there,
- row 8 (λ/4, 90°) is at a **zero crossing**,
- row 16 (tip, 180°) is at a **trough**.

Verified numerically before drawing (`sin` at the reference x = +1.000, −0.000,
−1.000). The wave from the tip is literally upside down relative to the wave
from the base, which is the whole point and needs no phasor vocabulary.

Sinusoids are drawn as **one cubic Bézier per half period** (control points at
the thirds, handle 4A/3) rather than as polylines: 16KB instead of 50KB for the
same curve, max deviation from a true sine 0.36px on a 6.5px amplitude (5.6% of
amplitude, invisible at this scale) — measured, not assumed.

### Animation: clipPath, and why the standing rule did not apply

A travelling wave cannot be made frame-safe by geometry alone. Sizing the path
to the frame was tried and failed: the endpoints must land on zero crossings for
the Bézier chain, crossings are P/2 = 38px apart, and the safe window for an
endpoint is only ~4px wide, so for many phase offsets no crossing exists in it.
So the wave group is wrapped in a `clipPath` and CSS-translated by exactly one
period (seamless loop).

The `.agents` standing rule says *"`clipPath` can suppress animated SVG circles
in Chrome"*. That was about `<animateMotion>`-driven circles, not about a CSS
`transform` on a group of static-geometry paths. **Verified rather than
assumed**: rendered at two virtual-time budgets (300ms and 875ms), diffed the
wave field — mean absolute pixel difference 2.82 (so the animation advances) and
26371 lit pixels in the field (so the clipped content renders at all). The rule
stands as written; this is a different case and the note above records why.

### Three label defects caught in the proof renders

- The horizontal λ/4 dashed line started at x=18, immediately left of the `90°`
  label, and **rendered as "−90°"** — a dash reading as a minus sign. Line now
  starts at x=56. This is the same family as the digit-range bidi trap: an
  adjacent glyph changing how a number reads.
- `רבע מחזור` on the reference line fell in the 6px gap between two waves and
  collided with both; the clear band between adjacent rows is only
  `spacing − 2·amplitude`. Dropped from the figure (the text column already
  says it).
- Its replacement on the right-hand side extended leftward across the mast
  (Hebrew SVG text treats `x` as its right edge). Also dropped.

### Bookkeeping

- Guide chips: part split `16 / 13` → **`17 / 12`** (the slide moved from part B
  to part A; total stays 29). The `85–90` minute chips and the time-split table
  are still untouched — his call.
- The old part-B slide and its lifted CSS rules were removed cleanly
  (`a6chip`/`cwray` leftover count in the head sheet = 0), the new slide's
  keyframes lifted into the head sheet, in-body `<style>` count 0, head CSS
  brace balance 0.
- Same verification battery as Addendum 4, all passing: both script blocks
  SHA-identical to the backup (608680 / 36024 bytes), `node --check` on both,
  30 slides, 0 numbering errors, `html.parser` clean.
- Fragment kept at `.agents/build/radio06-slide03-length-and-phase.frag.html`;
  the superseded one at `radio06-slide20-length-and-phase.frag.html`.

## Addendum 6 (same day) · the waves were not continuous — two real bugs

Omer spotted it from the rendered slide: **the waves opened a gap that grew
through the cycle and snapped shut each period.** He was right, and it was a
plain error on my part.

### Bug 1 — the spare period was extended on the wrong side

The wave group translates **left** by exactly one period. I had extended each
path one period to the **left** of the clip window (`xs = crossing ≤ CL − P`)
and ended it at the first crossing **at** the right edge (`xe = crossing ≥ CR`).
That is backwards: as the group slides left, the right end travels left with it,
so the right edge of the clip runs out of wave. Correct rule:

> With translation over `[0, −P]`, the path must cover `[CL, CR + P]` in its
> untranslated frame: start at the largest zero crossing **≤ CL**, end at the
> smallest crossing **≥ CR + P**. The surplus period goes on the side the motion
> comes *from*, not the side it goes *to*.

Measured shortfall of the old geometry: up to **74px** of SVG at the end of each
cycle (~66px on screen) — exactly the gap he saw.

### The regression test this needed, and that I should have written first

Analytic coverage is now asserted for every row at five phases before drawing.
More useful, there is an **empirical** test: render the slide five times with
`.a6ws{animation-delay:-Xs; animation-play-state:paused}` to freeze exact phases
of the cycle, derive the SVG→screen mapping from a known feature (the green
ground-plane line), crop precisely to the clip window, and measure the distance
from the leftmost and rightmost wave pixel to each edge, per row.

Result after the fix: **gap 0px at both edges at all five phases.** And the test
was checked for the ability to fail — against the old geometry the right-edge
gap is ~66 screen px, far above the noise floor. A test that cannot fail proves
nothing; that check is now part of the method, not an afterthought.

**Generalisable rule: any looped translation of clipped content needs a
multi-phase edge test, not a single screenshot.** A single frame is almost
always taken near phase 0, which is exactly where this class of bug is
invisible.

### Bug 2 — a regex that ate a brace (found by the balance check, not by eye)

Refreshing the injected CSS block used
`@keyframes a6\w+\{[^}]*\}` to strip the previous rules. `@keyframes` blocks
are **nested**: that pattern stops at the first inner `}` and leaves the outer
one behind. Three keyframes blocks left three **orphan `}`** in the head
stylesheet.

Browsers discard a stray top-level `}` during error recovery, so nothing looked
wrong — the brace-balance assertion is what caught it (`−3`). Repaired with a
brace-aware pass that walks the stylesheet tracking depth and drops only
closers seen at depth 0, then verified two ways: balance back to `0`, and each
`@keyframes` block matched whole (`@keyframes a6up{to{...}}`).

The stronger check now in the battery: **strip my own rules from the head
stylesheet and assert the remainder is byte-identical to the backup** —
28597 bytes vs 28597, equal. That proves the deck's own CSS was not touched,
which a brace count alone cannot.

For at-rules use `\{[^{]*\{[^}]*\}\}` or a real brace walker. Added to the
standing-rules list.

### Final state of radio-06

30 slides; the new slide is section 3 with 17 continuous sinusoids; scripts
SHA-identical (608680 / 36024); `node --check` clean on both; original
stylesheet provably untouched; head CSS balanced; every slide has a footer
`NN / 30`, a matching eyebrow number and a speaker note; `html.parser` clean.
