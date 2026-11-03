# Agent instructions — תכנית הדרכה תקשוב גדודית

## Repository shape

**All paths are ASCII on purpose** (2026-08-04): this tree is served from IIS to
the open web, so a Hebrew filename would become a percent-encoded URL. Hebrew
belongs in page *content*, never in a path. Anything added here follows suit.

```
index.html                       ← hand-maintained index, links every artefact
radio/NN-<slug>/NN-<slug>-deck.html
radio/NN-<slug>/NN-<slug>-guide.pdf
networks/NN-<slug>/NN-<slug>-deck.html
networks/NN-<slug>/NN-<slug>-guide.pdf
reference/technician-card-a6.pdf + -source.html
agents.md · .agents/           ← internal, NOT part of the published set
```

Each lesson ships as exactly **two** artefacts, `-deck.html` and `-guide.pdf`,
in a folder named for the lesson. Slugs are English, lowercase, hyphenated, and
carry the lesson number (`04-antennas-swr`). Every link in `index.html` is
**relative**, so the whole tree is portable: copying `index.html`, `radio/`,
`networks/` and `reference/` to a webroot is a complete deploy.

| Artefact | Name pattern | Notes |
|---|---|---|
| Deck | `NN-<slug>-deck.html` | Single self-contained HTML file. No external files, no network. |
| Instructor guide | `NN-<slug>-guide.pdf` | A4 portrait, RTL, matches the house style. |

## House conventions (do not diverge without a reason recorded in `.agents/`)

- **Deck**: fixed 1280×720 `.stage`, scaled to fit via a transform. RTL. Slide
  navigation with `← →`, `N` for speaker notes, `F` for fullscreen. Every slide
  carries an `<aside class="speaker-note">`. Footer shows `NN / total`.
- **Colour tokens**: `--cyan #22d3ee`, `--amber #fbbf24`, `--red #fb7185`,
  `--green #4ade80`, `--ink #f1f5f9`, `--muted #a7b7c9`, panel `#0b1220`.
- **Guide PDF**: teal `#0f8793` accents, `hdr` rule at the top, page footer via
  CSS `@page` margin boxes, `X / N` on the left. Page 1 is a title page with no
  footer; page 2 is `00 · בריף למדריך` with the time-split table.
- **Tone**: no absolute performance claims without stating the model's limits.
  Every lesson that ships a simulation must include a "what this does **not**
  tell you" slide.

## Before making significant changes

1. Read this file and everything in `.agents/`.
2. Check `.agents/README.md` for the index of prior remarks.
3. Do not reverse a decision recorded in `.agents/` without explaining why.

## Remarks index

Written remarks from prior work live in `.agents/`. Current entries:

- 2026-10-28: [`.agents/remarks-2026-10-11-net08-cryptography.md`](.agents/remarks-2026-10-11-net08-cryptography.md) - new רשתות lesson **08 הצפנה וזהות** (30 slides, two halves, split at slide 19): classical/Hash/symmetric/asymmetric, TLS, signatures, certificate chain, smart card + PIN, then live SHA-256/AES/RSA/DH engines and a TLS 1.3 stepper. Engines verified against hashlib/OpenSSL/FIPS-197; 48 browser assertions. **Open for Omer**: overlap with net-03, smart-card policy unsourced (no unblock procedure written on purpose). Build kit and single-step installer in `.agents/build/net08/`.

- 2026-08-04: [`.agents/remarks-2026-08-04-new-lessons-and-index.md`](.agents/remarks-2026-08-04-new-lessons-and-index.md) — gap review over the full set; two new רשתות lessons built with Omer's approval (**06 DHCP ואתחול תחנה**, **07 שכבה פיזית וכבילה** — the set's only real holes; TCP/UDP depth deliberately NOT added, it is a recorded scoping decision in net-01) plus the root index page. **Numbering decision: existing lessons were NOT renumbered** even though 07 belongs pedagogically earlier — the index carries the recommended teaching order instead. New verification lesson: suspected bidi defects are checked with `pdftotext -bbox` word coordinates, never by squinting at low-res renders (a phantom `arp -a` reversal cost three crops before coordinates proved it correct). Two same-day addenda: the A6 double-sided technician pocket card, and the **set-wide rename of every file and folder to ASCII** for IIS hosting (old empty Hebrew directories parked in `_to_delete/` — device tooling cannot delete, only move).

- 2026-07-30: [`.agents/remarks-2026-07-30-humanizer-pass.md`](.agents/remarks-2026-07-30-humanizer-pass.md) — humanizer skill pass over all 11 decks. 190 em dashes fixed (72% were in lesson 06) across HTML text, SVG captions and JS string literals; 16 left alone on purpose (live-data placeholders, English code comments, one deliberately-realistic simulated terminal title bar). Everything else the skill checks for (inflated significance, promotional language, filler, rule-of-three) was essentially absent. Its open question (no editable source for the 11 guide PDFs) is resolved by the next entry.
- 2026-07-30: [`.agents/remarks-2026-07-30-guide-pdf-rebuild.md`](.agents/remarks-2026-07-30-guide-pdf-rebuild.md) — all 11 guide PDFs rebuilt from scratch onto lesson 06's recovered template, sources now permanently kept in `.agents/guide-sources/`. **Found and fixed a real bug already in shipped work**: a numeric range in RTL flow (`85–90 דקות`) was rendering digit-reversed in lesson 06's own title-page chip, undetected by every earlier verification pass. Fixed set-wide (17 instances), verified by text-extracting every rendered PDF rather than eyeballing pages. New standing rule in `.agents/README.md`.
- [`.agents/remarks-2026-07-26-lesson-06-antennas.md`](.agents/remarks-2026-07-26-lesson-06-antennas.md)
- 2026-07-28: [`.agents/remarks-2026-07-28-glitch-sweep-and-terminal-sim.md`](.agents/remarks-2026-07-28-glitch-sweep-and-terminal-sim.md) — full graphics glitch sweep over all 162 slides and the new domain-trust terminal simulator in `04_כלי_תחקור`. **Read its first section before doing any visual QA**: WeasyPrint had been producing phantom defects (no bidi in SVG, no canvas), and verification now runs through headless Chrome. Four systemic root causes fixed set-wide.
  — build of lesson 06 (אנטנות: מונופול, פרנל ותבניות קרינה): physics-engine
  design, validation results, deferred items, and a correction to a claim about
  polarisation that also affects how lesson 4 should be taught.
