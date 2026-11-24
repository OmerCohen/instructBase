---
name: unit-training-decks
description: Create or revise Hebrew training decks and instructor guides for Omer's גדס״ם 5059 signals/IT training set (radio, networks, devices): visual template, content, wording, animation, demo, verification and delivery rules.
---

# Training decks and instructor guides (גדס״ם 5059 · מחלקת תקשוב)

Hebrew (RTL) lessons for young field technicians/operators, taught by an instructor who **projects the deck on a 16:9 screen or TV** (1920x1080 / 1366x768; not phones). Every lesson = one HTML deck + one detailed A4 instructor guide (HTML source rendered to PDF). Owner: Omer. Tracks: רדיו (radio/), רשתות (networks/), מכשירים (devices/), plus reference/ and index.html.

## 0. Start of every task
- Read `agents.md` and everything in `.agents/` (treat `.agents` like `.claude`): remarks files, the standing-rules list in `.agents/README.md`, guide sources in `.agents/guide-sources/`, device sources in `.agents/devices-sources/`. Do not reverse a recorded decision without saying why.
- Write every deferred item, doubt or decision into a dated remarks file in `.agents/` and reference it in `agents.md`. If Omer says to put something aside, record it there; never drop it.
- Be critical of every idea, including Omer's and your own; say so when something is wrong.
- Ask clarifying questions as numbered, self-contained questions (each carries its own context; Omer often answers by number only). When an answer is ambiguous, ask once more, briefly.

## 1. Files, paths, publishing
- Paths are ASCII: `radio|networks|devices/NN-<slug>/NN-<slug>-deck.html` and `NN-<slug>-guide.pdf`; guide source `.agents/guide-sources/<NN>_<track>_guide_source.html`. Index links are relative.
- Publishable: `index.html`, `radio/`, `networks/`, `devices/`, `reference/`. Internal, never published: `.agents/`, `agents.md`, `tmp/`, `_to_delete/`, `.claude/`.
- Only unclassified material that may go to a cloud service. Never write unit frequencies, keys, comms plans, equipment/technician numbers or doctrine you were not given.
- Device tools cannot delete: back up with copies to `tmp/rewrite-review/before-<date>-<tag>/`, park unwanted files in `_to_delete/`.

## 2. Visual template (keep the set looking like one product)
Always start a new deck by copying the head (all `<style>` blocks incl. the base64 crest), the root/stage markup and the nav script from an existing deck of the set (e.g. `networks/06-dhcp-and-addressing/06-dhcp-and-addressing-deck.html`). Do not restyle the shell; lesson additions go in ONE extra `<style>` block with classes prefixed `.<lesson>-` (e.g. `.n6-`, `.d01-`), using the tokens below.

**Color tokens (dark theme, `:root`):**
`--deep:#04070d` `--panel:#0b1220` `--panel2:#101b30` `--card:rgba(255,255,255,.052)` `--border:rgba(255,255,255,.105)` `--cyan:#22d3ee` (primary accent) `--cyan2:#0891b2` `--amber:#fbbf24` `--red:#fb7185` `--green:#4ade80` `--ink:#f1f5f9` (headings, strong) `--muted:#a7b7c9` (body text) `--dim:#8ba0b5` (captions, footers).
- Page background: `.deck-root` radial `#0c1a2b`→`#000`; `.stage` 1280x720, radius 16px, gradient `#08111e`→`#0a1829`→`#07101c`, faint cyan horizontal rules every 56px.
- **Color semantics, consistent everywhere:** cyan = primary/info/the thing to look at; amber = attention, warnings, instructor/notes, "current step"; red = fault/error/wrong; green = OK/correct/healthy. Translucent fills of the same hue (`rgba(<hue>,.07-.16)`) with a 1px or 4px side border of the solid hue. Never introduce new hues (no purple/blue themes, no light slides); device LCD/7-segment drawings may use their own realistic colors.
- Fonts: `"Segoe UI",Arial,sans-serif` for everything; `Consolas,'Courier New',monospace` for terminal output, commands, hex and device readouts.

**Type scale (projector-readable; never below ~13px on a slide):**
Title slide h1 70px/800; slide title `.title` 42px/800 (≤ 2 lines, ~45 Hebrew chars per line); `.subtitle` 19px muted (one or two lines); body `.copy` 19px/1.58; `.key` 18px; card h3 22px, card p 16.5px; tables 16px; checklist 18px; captions `.visual-label` 14px dim; eyebrow 15px/700 cyan; footer 13px dim; terminal 13.5px.

**Slide skeleton:**
```html
<section class="slide" aria-hidden="true">
  <div class="slide-mark" aria-hidden="true"><span class="crest crest-sm"></span><span>תקשוב 5059</span></div>
  <div class="eyebrow"><span class="num">03</span>תווית נושא קצרה</div>
  <h1 class="title">כותרת שמשמה את המושג</h1>
  <p class="subtitle">משפט אחד שמסביר מה רואים.</p>
  <div class="body"> ... </div>
  <aside class="speaker-note">מה עושים, מה מדגישים, טעות נפוצה, תשובות.</aside>
  <div class="footer"><span>שיעור 6 · שם השיעור</span><span class="ltr">04 / 15</span></div>
</section>
```
Title slide: `section.slide.title-slide.active` with `.brand` (crest-lg + `<b>גדס״ם 5059</b><i>מחלקת תקשוב</i>`), `.badge` (track · topic chip), h1, one `<p>` describing the lesson, and a small live visual (hero SVG/animated element); no footer, no eyebrow. Root: `<div class="deck-root motion-on" dir="rtl"><div class="stage-shell"><main class="stage">` + `.motion-badge` ("אנימציות כבויות") + `.kbd-hint` ("← → ניווט · N הערות · F מסך מלא · A כיבוי אנימציות") + slides + `.nav` (הקודם, הבא, progress bar cyan→amber, counter, הערות) + `.notes-panel` (amber border).

**Layout rules:**
- Slide padding 43px 62px 66px; content must stay inside the stage and the bottom ~70px is reserved for the nav bar (the on-screen footer is hidden under it).
- Typical bodies: `.split` (text column + `.visual` panel, ratio 1 : 1.34; `.split.text-wide` 1.3 : 1); a live demo = controls/explanation on the right (RTL start), visual/device on the left; `.stack` for vertical groups (gap 13px).
- Components: `.visual` (bordered dark panel with soft cyan glow, SVG max-height 500px); `.key` (side-bar callout; `.amber`, `.red` variants); `.card` (+ `.tag`; `.amber/.red/.green`); `.grid2/3/4`; `.table` (header `--panel2` with cyan text, first column ink bold); `.checklist` (green bullet squares); `.steps/.step` (process boxes with ← arrows); `.formula` (LTR isolated, 31px bold, accents cyan/amber); `.metric` (58px cyan value + unit); `.question`/`.answer-row`/`.answer` for exercise slides; chips for key sequences (small bordered pills, LTR, arrows between).
- Avoid nested grids inside the flex `.body`; use flex rows. Use child selectors (`.card>span`) so inline `.ltr` spans stay inline. Uneven, content-driven layouts are better than symmetric twin cards.
- SVG: Hebrew labels with the house halo (`paint-order:stroke; stroke:#071019; stroke-width:2.4px`), `text-anchor="start"` for right-aligned Hebrew, class `ltrtx` on LTR-only labels; strokes and fills from the token hues; numbered callouts on photos are small cyan circles with dark numbers.
- Photos: real photos (Omer's or rights-cleared) cropped tight, rounded corners, inside `.visual`; embed as data URIs (≤ ~900-1280px wide, JPEG ~80). Crop stickers, numbers, real frequencies.
- Sparse is fine; never shrink fonts to fit: cut text or split the slide.

**Guide template (A4, light theme):** copy the head of an existing guide byte-for-byte; change only `<title>` and the `@page @bottom-right` footer text ("מחלקת תקשוב · <שם השיעור> · שיעור N"). Palette: text `#1b2a38`, navy `#0f2740` (h1/h2/eyebrow/chips/band), teal `#0f8793`/`#0f6f7a`, soft boxes teal `#e9f4f7`, amber `#fdf4e6`, red `#fdeef0`, green `#eef7f0` with a 5pt side bar; chips navy with `#3fd0e0` values; tables with `#dbe3ea` borders and `#eef4f8` headers. Font "Liberation Sans", Arial, 10pt/1.55. Pages are `div.pg` (title page `div.pg.title-pg` with `.kick`, h1, `.sub`, `.chips`, `.meta`); each page has `.eyebrow` "NN · שקופיות a-b", h1, `hr.rule`, then h2 per slide.

## 3. Content rules
- **Accuracy first.** Textbook-level, verifiable facts; when unsure use "בערך" / "בדרך כלל" instead of false precision. Verify every number, formula and rule of thumb (Python reference) before it goes on a slide.
- **Never invent unit doctrine** (procedures, frequencies, settings, rules, unit numbers). Unit material from Omer (leaflets, sheets, his answers, his photos, his games) outranks your own derivation; if they disagree, test it, and if the unit source wins, say so.
- **What is unknown is not mentioned** (no "לפי נוהל היחידה" fillers, no "בודקים במכשיר", no caveats about what we don't know). Never cite internal sources on slides ("בעלון כתוב", "לפי העלון"); state facts directly.
- **No conversation leaks:** nothing that exists only because of how the material was gathered (alternative names Omer used to explain, corrections of a source, "the photo shows", reasoning he gave you to steer you, history/manufacturer trivia, explanations of how a demo was built, "computed in the browser", "verified against X").
- **Relevance:** only what the audience needs for the job. No irrelevant technical remarks. Technical-data slides list only what is used in the field.
- **Titles name the concept** ("קידוד מול הצפנה"), never a specific example or spec number as the title.
- Lessons that ship a model/simulator keep a short "מגבלות ההדגמות" slide stating what the demos simplify, **except** device (operator) lessons, which have no limits slide.
- Slide 2 is a **live opening** that shows the lesson's core idea on the trainee's own input (not an agenda/"מהלך השיעור" slide; the lesson structure goes to the title slide's speaker note). Each lesson has an **exercise slide** (2-4 questions or symptom cards, answers in the speaker note and the guide), normally at the end of the practical part.
- Example values only (illustrative frequencies, addresses, keys); never real ones seen in sources or photos.

## 4. Wording (Omer's dislikes; AI-detection judges check this)
- No count-announcing headings or intros ("שלושה דברים", "ארבע הטעויות", "שני חצאים"); name the content.
- No mirrored twin cards/blocks (כן/לא, פרקטי/תיאורטי) with parallel headings and equal bullet counts; use a list, a table or an uneven split.
- No "X, לא Y" / "לא X אלא Y" / "X - ולא Y" hinges as rhetoric; keep a contrast only where it is the technical point. Vary colon titles ("נושא: טענה"), not on consecutive slides.
- No slogans or punchline closers ("זה כל הסוד", "וזה כל החישוב"), no rule-of-three padding, no summarising last sentence that repeats the paragraph, no restating the same point twice.
- No meta narration ("בשקופית הבאה", "כאן רואים", "לפי הערות השקופית", "ההערה מבקשת", "התכנון הקודם היה"), no changelog talk about earlier versions.
- Speaker notes are practical: what to show/do, what to stress, the typical mistake, answers. Not a stage script of the room.
- No bold lead-in on every bullet, no English calques, no uniform rhythm; plain direct military-technical Hebrew; no emoji, no marketing tone.
- Instructor instructions in plural imperative (הראו, שאלו, הדגישו); technician procedures in impersonal present (מנתקים, בודקים).
- **No em dash or en dash anywhere** (text, SVG labels, JS strings); " - " sparingly.
- Visible text also lives in `<script>` (demo messages, verdicts); review and fix it there too.

## 5. RTL / bidi rules
- Wrap Latin+digit tokens, units and numeric ranges inside Hebrew text in `<span class="ltr">` (`<span class="ltr">6 dB</span>`, `<span class="ltr">1-RTT</span>`, `<span class="ltr">85-90</span>`). Comma-joined Latin runs ("A, CNAME") need each token wrapped. Guide `td.n`/`th.n` cells are already LTR.
- Never put Hebrew prose and an LTR formula in the same line box; give formulas their own LTR cell/row.
- Key sequences render LTR as chips with arrows in pressing order.
- Settle suspected reversals with `pdftotext -bbox` / DOM coordinates, not low-res screenshots.

## 6. Deck mechanics
- Exactly one `<aside class="speaker-note">` per slide; footer `NN / total` (2 digits) on every slide except the title; eyebrow number = slide index − 1 (none on title/divider slides); part labels in footers.
- Nav: ArrowRight/Space/PageDown forward, Home/End, N notes, F fullscreen, A toggles motion. The on-screen footer is hidden (`@media screen{.stage .footer{display:none}}`); print shows it (one slide per page).
- New lesson code goes in ONE extra `<script>` after the existing scripts. Never run a content regex over a file with inline JS; edit with exact string replacements (assert each old string occurs once), then `node --check` every script block.

## 7. Animation and live demos
- Decks ship `<div class="deck-root motion-on">` (motion on by default). The reduced-motion rule is scoped to `.deck-root:not(.motion-on)`, and A must pause **everything**: SVG/SMIL, JS loops and CSS (`.deck-root:not(.motion-on) *{animation-play-state:paused!important}`). JS animations check `motion-on` and stop on hidden slides.
- House motion vocabulary: `.flow` (dashed line flowing), `.pkt` (packet moving along a line, `--run`), `.wave` (travelling wave, `--period`), `.pulse`, `.blink`, `.breathe`, `.float`, `.fade-cycle`. Slow and calm (1-5 s cycles); no flashy transitions; slide change is a 0.28 s fade/slide.
- Animate only where change over time is the content; an animation must never contradict its own slide or panel title. The authored SVG attribute must be a sensible still (print/no-SMIL fallback); `animateMotion` markers start hidden.
- Replace static diagrams with live demos (1-3 per lesson) only where interaction teaches something. Sensible defaults that give a meaningful picture on first view; a short visible explanation; defaults written in the speaker note.
- Demo helpers: `safe()`, `$()`, `onInput`, `motionOK`, `activeSlideOf`. Every input/textarea/select stops keydown propagation (typing must not drive the deck); Esc blurs. Invalid input is marked and keeps the last valid value (no NaN). Buttons: small bordered pills, the selected one cyan-filled.
- Computation must be right: verify each demo against an independent Python reference at defaults and edge inputs.
- Step players for procedures: הבא / הקודם / נגן / התחלה; the pressed key lights, the step text highlights (amber); playback pauses with A and stops off-slide.
- Draw devices/screens only as they really are (from photos); for an unknown intermediate state keep the last known screen dimmed without caveat text, then show the known end state. Do not invent behaviour to make a demo work; choose defaults that avoid it.

## 8. Instructor guide content
- Detailed: the instructor must understand what he presents and answer "why". Title page (kick, h1, one-line sub, chips: slides / duration / one real fact), `00 · לפני השיעור` (who, goal, preparation, keyboard, time plan with an honest total and what new slides cost, how to shorten), then for every slide an h2 `שקופית N · <exact deck title>` with, as fits (never a uniform template): על המסך, רקע, ההדגמה (exact defaults and what the class sees), בשטח, Q&A table, `note red` טעות נפוצה. Appendices: slide map (exact titles), demo test values, glossary, printable card where useful.
- Slide numbers in the guide = the nav counter ("2 / N"); the small eyebrow number is one lower.
- Render with headless Chrome `--print-to-pdf` (never WeasyPrint for verification); check reversed tokens with `pdftotext`.

## 9. Process for a lesson (new or reworked)
1. Research facts; gather unit sources; ask Omer what only he knows.
2. Write a brief (sources, confirmed facts, rules from this skill, slide plan, checks) and build deck + guide (for large jobs, one builder agent per lesson; resume the same agent for follow-ups).
3. Independent technical reviewer: re-drives every demo against a Python reference, checks facts, units, commands and output formats, deck/guide consistency, invented doctrine; fixes in place with minimal edits and lists doubts.
4. Context-free style judges (verdict ai/human/unclear per element with quoted tells) on every new/changed slide and guide section; rewrite anything flagged "ai"; re-judge the fixed elements.
5. Central checks (section 10), render the guide PDF, deliver (section 11), write remarks, reply.

## 10. Verification checklist
- Structure: slide count, one note per slide, footers/eyebrows, `node --check` on every script, guide h2s match deck titles one to one, every "שקופית N" reference valid, guide head unchanged, no `[–—]` in visible text.
- Render every slide at 1920x1080 in headless Chromium (toggle `.active`): no overflow/clipping, titles ≤ 2 lines, nothing under the nav bar, no page errors. Look at screenshots of every changed slide; compare against a neighbouring existing deck for visual consistency.
- Bidi scan for Latin runs outside `.ltr` spans; PDF text extraction for reversed ranges.
- Playwright drive of every demo with assertions (values vs reference, sequences vs sources, A pauses motion, typing does not move slides, no page errors) plus a banned-phrase scan (count headings, meta phrases, unknown fillers, source citations, real frequencies).
- A defect found in one deck is probably in all of them: fix set-wide and probe every deck.

## 11. Delivery
- Before overwriting: confirm the device copies are unchanged since the last delivery (sha256) and back them up.
- Commit deck, guide PDF and guide source; verify sha256 on the device; update `index.html` descriptions/counts if the lesson changed (index uses the same dark tokens; lesson rows = number, title, one-sentence description, links מצגת / דף הנחיה).
- Remarks file in `.agents/` (what changed, slide orders, durations, open items for Omer, contradictions between sources, image rights) + `agents.md` entry.
- Reply in Hebrew, concise: what changed, what is still open (numbered questions), what you need next.

## 12. Device (operator) lessons: extra rules
- Source order: Omer's answers > his photos of the real device > unit info/fault sheets (transcribe into `.agents/devices-sources/`, mark missing parts) > his games (`D:\VS_DEV\Temp\RFGame` primary, `D:\VS_DEV\Temp\TechGame`; comments quoting Omer are facts; list contradictions) > public specs (background only).
- Start by mapping operator actions and ask per device in small batches; ask for photos of every screen state you need.
- Operator level only; no limits slide; no terrain/line-of-sight fault; faults organised by symptom with what the operator sees and the exact fix, self-test behaviour where known.
- Real screen formats (dot-matrix rows, 7-segment windows, reverse-video icons, flashing text, indicators that appear only during PTT); key sequences taught as menu navigation when keys double as arrows; use the label printed on the device.
- Photos: crop stickers, equipment/technician numbers, any frequency; do not embed photos showing a frequency; flag stock images before public use. Do not mention emergency erase.
