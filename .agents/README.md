# `.agents/` — index of recorded remarks

Anything an agent deferred, approximated, or decided against the obvious default
gets written here and referenced from `../agents.md`. Read before changing a
lesson.

| Date | File | Scope |
|---|---|---|
| 2026-07-26 | [`remarks-2026-07-26-lesson-06-antennas.md`](remarks-2026-07-26-lesson-06-antennas.md) | Lesson 06 build across three review rounds. Physics-engine validation; impossible preset geometry and the arc-length rule that prevents it; **the ״שיפצורי אנטנה״ leaflet is authoritative and my tie-position rule was backwards** — see "Review round 3"; the exact distance-to-metal model; a polarisation correction that may also apply to lesson 4; an unverified WebGL path. |

| 2026-07-26 | [`remarks-2026-07-26-deck-visual-pass.md`](remarks-2026-07-26-deck-visual-pass.md) | Visual pass over **all 11 decks**. Two real bugs fixed set-wide (the `.steps` arrow printed over neighbouring labels; `.ltr` collapsing table cells), projection contrast and type sizes lifted, SVG label halo shared. Includes the unaddressed sparseness weakness and a renderer caveat. |

| 2026-07-26 | [`remarks-2026-07-26-rules-and-animation.md`](remarks-2026-07-26-rules-and-animation.md) | Rules-of-thumb card for lesson 06 (all nine verified numerically; tilt loss turns out to be *exactly* `20·log₁₀(cos α)`), plus a motion pass over all 11 decks — travelling/standing/interfering waves in `רדיו`, 46 packets on process connectors in `רשתות`. Includes two mistakes caught in review. **Round 3** made motion default-on set-wide (and notes the `prefers-reduced-motion` trade that implies), added the Yagi forward/backward summation slide, and animated the eight remaining slides whose content is a change over time — 132 animated elements total. |

| 2026-07-30 | [`remarks-2026-07-30-humanizer-pass.md`](remarks-2026-07-30-humanizer-pass.md) | Humanizer skill pass, all 11 decks. Almost none of the skill's usual patterns were present (this is terse technical slide copy, not generated prose) except one real, pervasive tell: the em dash, 168 raw instances, 72% in lesson 06. 190 fixed total (HTML text, SVG captions, JS string literals in the antenna sim and terminal sim), 16 left alone on purpose (data placeholders, English code comments, one intentionally-realistic simulated terminal title bar). Safety method matches the `<script>` lesson from Addendum 4 below: offset/exact-match edits only, `node --check` after every script change. **Open question for Omer: the 11 guide PDFs have no editable source anywhere in the repo** — resolved below, 2026-07-30 rebuild. |
| 2026-07-30 | [`remarks-2026-07-30-guide-pdf-rebuild.md`](remarks-2026-07-30-guide-pdf-rebuild.md) | All 11 guide PDFs rebuilt from scratch (Omer's call, most ambitious of three options offered). Lesson 06's recovered source became the style template; the other 10 came from `pdftotext -layout` extractions + full-page reference renders of the originals, built by 10 parallel subagents, then independently re-verified by the controller (not taken on trust): page counts, em-dash counts, and the leading-space regex all re-run fresh against the deliverables. **Real finding: a bidi bug already in shipped work** — `85–90 דקות` had been rendering as `90–85 דקות` in lesson 06's own title-page chip, undetected by every prior verification pass on that file. Root-caused, fixed at all 17 affected instances set-wide, verified by `pdftotext`-extracting every rendered PDF and checking programmatically for the correct digit order rather than eyeballing renders. New standing rule below. |
| 2026-07-28 | [`remarks-2026-07-28-glitch-sweep-and-terminal-sim.md`](remarks-2026-07-28-glitch-sweep-and-terminal-sim.md) | **Read the top section before any visual QA.** WeasyPrint does not run bidi in SVG and cannot draw canvas, so it had been reporting phantom defects for three rounds; verification now goes through headless Chrome `--print-to-pdf`. Four systemic root causes fixed set-wide (SVG text inheriting RTL — 268 labels; `.checklist li` being a flex container; table cells inheriting RTL; `.step` starving its last card), ~50 individual fixes, three self-inflicted regressions. Plus the six-step domain-trust terminal simulator in `04_כלי_תחקור`. **Addendum:** the week structure was removed set-wide, the Yagi slide became a wave-propagation animation, and three SMIL findings — SMIL does not run in `--print-to-pdf`, `--screenshot` timing is unreliable (use `setCurrentTime`), and `clipPath` suppresses animated circles in Chrome. **Addendum 2:** the Yagi animation was rejected (expanding circles read as three independent emitters) and rebuilt as a three-lane reflection figure — direct wave, reflected wave, sum — with the 0.4λ + 0.5λ = 0.9λ derivation on the slide. **Addendum 3:** unit branding (crest + גדס״ם 5059 / מחלקת תקשוב on title slides, crest + תקשוב 5059 in all 148 footers), embedded as one 8 KB base64 background-image per deck, crest at top-right. **Addendum 4 — read this one:** a content regex run over a whole file injected an HTML span into a JS string literal and killed the entire 608 KB inline bundle (the WebGL simulator). Never regex across `<script>`; gate with `node --check`. |

| 2026-11-03 | [`remarks-2026-11-03-editor-and-archive.md`](remarks-2026-11-03-editor-and-archive.md) | HTML editor in `editor/` (decks, guide sources, index, new lessons, ZIP) and the `archive/` snapshot + ZIP. Byte-preserving splice editing; eyebrow `.num` = slide position with the title as 0; script syntax gate at save; sandboxed preview/present. Limits: demos are code, prose slide references go stale, PDFs are printed by hand. |

| 2026-08-04 | [`remarks-2026-08-04-new-lessons-and-index.md`](remarks-2026-08-04-new-lessons-and-index.md) | Gap review + two new רשתות lessons (06 DHCP, 07 שכבה פיזית) + root index page. Records the no-renumbering decision and the recommended teaching order; what was deliberately NOT added (TCP/UDP depth — recorded scope; נהלי קשר — needs doctrine source; Wi-Fi — stated omission); WeasyPrint Hebrew-font fallback caveat for future PDF rebuilds; the phantom `arp -a` bidi defect and the `pdftotext -bbox` method that disproved it; one real pre-ship fix (`100 מטר` wrapped whole inside a `.ltr` span in deck 07). **Addendum 1:** A6 technician pocket card. **Addendum 2:** set-wide ASCII rename for IIS publishing + card side B rebuilt as a hardware-triage flowchart after Omer's scope correction (his دרג-ב' technicians top out at a power check). Carries an open verification request on מעד/רמ״ק. |

## Standing rules that came out of this work

- **Edit by splicing, not by re-serialising.** Tools that touch decks/guides/index change only the edited
  byte range (`editor/js/htmlscan.js`). A DOM round trip rewrites SVG, quoting and entities file-wide.
  (2026-11-03)
- **Eyebrow `.num` is the slide position with the title slide as 0**, not a running counter (n08/r06 part-2
  slides prove it). Footer is `NN / total`. (2026-11-03)
- **`archive/` is frozen.** Never edit it; add a new dated snapshot instead. (2026-11-03)

- **Unit doctrine outranks my derivation.** If a leaflet and the model disagree,
  test it — and if the leaflet wins, say so on a slide rather than quietly
  changing the deck. Round 3 of lesson 06 is the worked example.
- **Every simulated number needs a stated limit.** Each lesson that ships a
  model carries a "what this does not tell you" slide and a matching guide
  appendix.
- **The decks share one CSS baseline.** A defect found in one is almost
  certainly in all of them — fix it across the set and then run a consistency
  probe over every deck, not just the one you touched.
- **Never put Hebrew prose and an LTR formula in the same line box.** Bidi
  interleaves them. Give the formula its own `direction:ltr; unicode-bidi:isolate`
  cell — a table row per rule is the reliable pattern.
- **Avoid nested grids inside the flex `.body`.** They drop content silently in
  at least one renderer. Plain flex rows survive everywhere.
- **CSS animation dies under `prefers-reduced-motion`,** which is commonly on in
  Windows. Every deck now scopes that rule to `:not(.motion-on)` and exposes an
  `A` toggle; if motion "doesn't work", check that first.
- **Verify a rule of thumb before putting it on a slide.** Every number in the
  lesson-06 reference card was checked against the model or a standard
  reference first; one candidate marker set was wrong and only the check caught it.
- **An animation must not contradict its own slide.** Check the panel title and
  its neighbours before animating — a phase sweep on a panel titled "peaks
  arrive together" undoes the slide's argument.
- **An authored SVG attribute is the no-SMIL fallback.** SMIL only overrides an
  attribute while it runs, so the value on disk is what a printout shows — it must
  not contradict the slide. `animateMotion` markers additionally park at `(0,0)`
  without SMIL, so they carry `opacity="0"` plus a `<set>` to appear only if the
  animation is live.
- **Verify visual work in headless Chrome, never in WeasyPrint.** WeasyPrint skips
  the bidi algorithm inside SVG (Hebrew comes out reversed) and cannot execute
  canvas or WebGL (panels come out empty). Both look exactly like real defects.
  Use `chrome --headless=new --print-to-pdf` against a copy with `@page` injected;
  the decks' own `@media print` block already gives one slide per page.
- **Only CSS animation advances in `--print-to-pdf`; SMIL is frozen.** A CSS packet
  part-way along a line is correct and not a glitch; a SMIL element will simply be
  absent. To see SMIL, screenshot a page that calls `pauseAnimations()` +
  `setCurrentTime(t)` — `--virtual-time-budget` alone gives an unpredictable clock.
- **An `<animate>` pins its attribute to the animation's first keyframe,** so the
  authored attribute is NOT the print fallback. Use a separate un-animated ghost
  layer if the still needs to carry meaning.
- **`clipPath` can suppress animated SVG circles in Chrome.** Size the geometry to
  the frame instead of clipping it.
- **A flex container makes every inline child its own flex item.** `.checklist li`
  was `display:flex`, so each `<strong>` and value span got its own box and gap —
  that, not bidi, is what tore wrapped bullets apart.
- **Only tag SVG text LTR when it contains no Hebrew.** A blanket
  `svg text{direction:ltr}` mis-sets mixed labels; content-aware tagging does not.
- **Re-render after every geometry nudge.** Three of my own label moves in this
  round created new collisions or pushed text off-panel, each caught only by the
  next render.
- **Never run a content regex over a whole HTML file that has inline JavaScript.**
  Splitting on `<...>` does not protect the script blocks — there, the text between
  "tags" is source code. One injected `<span class="ltr">` terminated a JS string
  and disabled 608 KB of bundle. Exclude `<script>` regions explicitly, then extract
  every block and run `node --check` on it. HTML parsing, slide counts and visual
  renders are all blind to a dead script.
- **The folder mount can change name or drop mid-session** (it went from
  `תכנית_הדרכה_תקשוב_גדודית` to `חומרי הדרכה`). Re-verify that a deploy actually
  landed before reporting it done.
- **A digit-dash-digit numeric range in RTL flow can render bidi-reversed**
  (`85–90` becomes `90–85`) with no error and no structural signal — this
  shipped undetected in lesson 06's own title-page chip through multiple
  prior verification passes. It is not reliably predictable from context:
  the same pattern buried in a long Hebrew paragraph often resolves
  correctly on its own, while an isolated chip or a range glued to a Latin
  unit (`6–7dB`) reliably reverses. Wrap the range alone (not any trailing
  unit word) in `<span class="ltr">` — cheap, and a no-op on ranges that
  were already resolving correctly, so apply it to every one rather than
  guessing which need it. `td.n`/`th.n` table cells already carry
  `direction:ltr` and don't need the extra span. Verify with
  `pdftotext -layout` text extraction checked against the known correct
  order, not a visual spot-check of one page.
- **Verifying one page is not verifying the document.** Lesson 06's guide
  had a real, visible defect on page 1 that survived a spot-check of page 2
  and a full multi-round Chrome sweep of the *decks* that never touched
  this PDF's own pages. When a fix could plausibly affect more than the one
  spot checked, check the whole set programmatically (page count, text
  extraction, grep) rather than sampling.
- **Suspected bidi defects are settled with coordinates, not pixels.** Extract
  the line with `pdftotext -bbox` and compare word x-positions against the
  expected visual order. Low-resolution contact sheets reliably manufacture
  phantom reversals of LTR islands (`arp -a` read as reversed three times in
  2026-08-04 review; coordinates showed it was correct all along).
- **Paths are ASCII; Hebrew lives in content only.** The tree is published from
  IIS to the open web, so a Hebrew path becomes a percent-encoded URL. Lessons
  are `radio|networks/NN-<slug>/NN-<slug>-deck.html` + `-guide.pdf`, all index
  links relative. Renaming on the device is done with `device_bash` `mv` — that
  tool cannot delete, so emptied directories get parked in `_to_delete/` for
  Omer to remove by hand.
- **`.agents/` and `agents.md` are not part of the published set.** IIS serves
  dot-directories (unlike Apache convention), so internal notes would be
  world-readable if the whole folder were copied to a webroot. The publishable
  set is exactly `index.html`, `radio/`, `networks/`, `reference/`.
- **Aim field aids at the actual competence ceiling, not at the syllabus
  ceiling.** The first technician card put VNA/S11 work on a card for people
  whose real ceiling is a forward/reflected power check; Omer's correction was
  that ~90% of radio faults never get near it. A field aid answers "what do I
  do in the first five minutes", which is not the same content as the lesson
  that taught the theory.
- **A looped translation of clipped content needs a multi-phase edge test.**
  Freeze the animation at several phases (`animation-delay` + a paused
  `animation-play-state`), crop to the clip window, and measure the gap from the
  content to each edge. The surplus geometry goes on the side the motion comes
  *from*: translating over `[0,−P]` means the path must cover `[left, right+P]`.
  A single screenshot lands near phase 0, where this bug is invisible — the
  2026-08-04 wave slide shipped a 74px gap that only opened mid-cycle. Also
  confirm the test can fail against the broken geometry before trusting a pass.
- **`@keyframes` blocks are nested; `\{[^}]*\}` truncates them** and leaves an
  orphan `}` that browsers silently swallow. Use `\{[^{]*\{[^}]*\}\}` or a
  brace-aware walker. And when injecting CSS into a shipped stylesheet, verify by
  **stripping your own rules and diffing the remainder against a backup** — a
  brace count catches damage, byte equality proves the absence of it.

- **Text fields inside a deck must stop keydown propagation.** The house nav listens on `window`, so typing a
  space, `n`, `a` or `f` in an input changes slide or toggles notes. `keydown -> e.stopPropagation()` on
  inputs/textareas/selects (not ranges), and `Esc` blurs. (net-08)
- **Hebrew SVG labels: `text-anchor="end"` puts the LEFT edge at x.** Right-aligned Hebrew labels use `start`.
  Same family as the "x is the right edge" rule. (net-08)
- **`1-RTT`, `2-RTT` and similar digit-hyphen-Latin tokens reverse in RTL** (render as `RTT-1`). Wrap in `.ltr`. (net-08)
- **Descendant selectors on card children break inline `.ltr` spans** (`.card span{display:block}` turned
  `<span class="ltr">` into a block). Use child selectors (`.card>span`). (net-08)
- **Write like the instructor, not like a template.** Name the content instead of counting it ("כללי קשירה",
  not "ארבעה כללים"); break mirrored twin cards into a list/table/uneven split; keep a "X - ולא Y" contrast only
  where it is the technical point; state each key message once; no punchlines, teasers or "בשקופית הבאה".
  Guides must not share one skeleton word for word. Full pattern list and the validator/render tooling used:
  `remarks-2026-10-29-wording-and-structure-pass.md`. (2026-10-29)
- **Visible text also lives in `<script>`** (simulator verdicts, demo messages). A wording pass must list those
  strings and edit them separately with exact replacements and `node --check`. (2026-10-29)
