# Hebrew copy review, 2026-09-11

## Scope and decisions

The user requested a second wording pass over all presentations, instructor guides and the technician pocket card, with no emoji, AI filler, “new” badges or last-edited labels. The review covers 13 decks, 13 guide sources and the card source, plus the public index. Guide sources remain in `.agents/guide-sources/`.

Shortened inflated headings and dramatic metaphors, replaced generic teaching jargon with direct instructions, corrected small wording errors, and removed decorative emoji from visible text, speaker notes and simulator messages. Functional arrows, mathematical notation and the close control remain. Removed the index's “new” badges, update footer and historical numbering explanation; retained the teaching order. “New” in protocol examples and actual certificate/lease dates are content, not editorial badges.

Preserved technical quantities, lesson structure, simulation code and model-limit explanations. Corrected “ask the instructor” to “ask the trainee” where the guide addressed the instructor. A close-control symbol affected by the initial cleanup was restored before final export.

Working records, original backups, exact substitutions, rendered screenshots and validation reports are under `tmp/humanizer-review/`. These are internal work products and are not part of the public deployment. PDFs are regenerated from their editable sources using headless Chrome. Final validation and replacement are recorded below.

## Technical observations deferred from this wording pass

These require a separate technical review; the editorial pass does not certify the technical content.

- Radio 06's near-antenna Fresnel example states 2.5 cm at 1 m from the antenna over a 10 km path at 48 MHz. Its stated formula gives approximately 2.5 m, and the approximation's validity near the endpoint also needs review. No numerical correction was silently introduced during copy editing.
- Several instructor-guide slide maps lag behind their decks. In particular, radio 06 describes 29 slides while the deck contains 30; networks 04's guide describes 13 while the deck contains 14. Other radio guide mappings also need reconciliation.
- Radio 06's angle discussion and model feedback need reconciliation. The polarization limitations already recorded in earlier remarks remain relevant when teaching radio 04.
- Networks 06's categorical wording about DORA Offer/ACK delivery needs a protocol review.
- Some compact fault-diagnosis statements on the technician card still risk suggesting a unique cause from one test result. Review these as diagnostic logic, beyond shortening the wording.
- Screen inspection cannot establish physical readability of the small type on the A6 card. The earlier card-design audit remains relevant.

## Completed validation and delivery

All 14 PDF artifacts were replaced locally at their existing public paths after validation (13 A4 guides and the two-sided A6 card; 114 pages total). Reopened PDF exports were checked for page dimensions, page counts, Hebrew text and missing glyphs. Every PDF page was rendered; contact sheets and both full card faces were inspected. The radio 06 brief was shortened and its local spacing tightened to keep its time-split table on page 2. This fixes an existing spill and reduces that guide from 16 pages to 15, matching its 15 source page sections. Other PDF page counts are unchanged.

All 13 decks were exercised through their 189 slides in Chrome with zero JavaScript page errors. Source checks preserved all slide and speaker-note counts, passed JavaScript syntax checks, checked index links and found no emoji or last-edited markers. Functional close controls were checked in the source. Exact file hashes confirmed that the 14 installed PDF files match the validated exports. Original HTML and PDF backups remain in `tmp/humanizer-review/before/`; completion details are in `tmp/humanizer-review/completion-report.json`.

The index's remaining numbering-history sentence was removed during the final visual check. The recommended teaching order remains. No IIS deployment was performed.

## Tooling notes

The automated slide click initially used the visible label rather than its accessible name; switching to the deck's ArrowRight navigation resolved the test failure. The bundled Poppler installation has pdftoppm but no pdftotext, so extraction checks used pypdf and visual checks used Poppler renders. Windows image-tool calls were intermittently slow or failed to spawn. An attempted base64 image transfer through a PTY corrupted the transport; that output was discarded, and actual files were inspected with view_image. Do not diagnose an artifact from a PTY-transferred image.

## Game link follow-up

At the user's request, the index game link now points to https://kesher-net.vercel.app/ instead of techgame/. Kept the existing new-window behavior and rel="noopener". Verified the saved href. This user-directed external game link is an exception to the relative-link convention for locally shipped training artifacts. This note is already referenced from claude.md.
