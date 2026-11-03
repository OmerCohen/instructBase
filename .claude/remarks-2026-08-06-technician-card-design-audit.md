# 2026-08-06 · A6 technician card design audit

Scope: design-only review of `reference/technician-card-a6.pdf` and its editable HTML source. No changes were made to the published card.

## Evidence checked

- Current PDF: two pages, exact A6 (`297.638 x 419.528 pt`), no rotation.
- Both pages rendered at 300 dpi in colour and grayscale and inspected visually.
- CSS type sizes, colour pairs, margins, rules, and duplex instruction inspected in the source.
- The source HTML is 46 seconds newer than the PDF, so the two deliverables may not be synchronized.

## Findings, in priority order

1. **Side B has a broken/missing header in the current PDF.** The title text appears on white, while the navy header background, crest, unit name, and department name are absent. The HTML contains the full header, so this is probably a stale export or a page-fragmentation/rendering defect. Re-export and inspect the PDF before changing the design.
2. **The card is readable when enlarged on screen, but the body type is at the practical floor for an A6 field aid.** Most content is `5.7-6.1 pt`, with a `5 pt` footer. The previous project remark correctly warned that additions must displace content rather than shrink it. For comfortable field use, aim for roughly `6.5-7 pt` body text where possible; side B has enough spare vertical room to increase its type independently. Side A needs content reduction or regrouping before any increase.
3. **The documented duplex setting is probably wrong for the normal way a portrait card is turned over.** `flip on short edge` makes the reverse upright only when the card is flipped over its top/bottom edge. For ordinary left/right turnover, portrait A6 should use `flip on long edge`. Confirm the intended physical handling and put the correct instruction in both source and user-facing print guidance.
4. **The black-and-white structure is fundamentally sound.** No instruction depends only on hue; numbered steps, bold opening labels, dark section bars, borders, and monospace command styling remain understandable in grayscale. Computed colour contrast is strong; the weakest declared text pair is the footer gray on white at `5.06:1`.
5. **The earlier remark overstates what the contrast calculation proves.** WCAG relative-luminance contrast is a useful grayscale check, but it is not proof of print legibility. Print adds point size, stroke weight, halftoning, toner density, paper, and printer calibration. The `5.7-6.1 pt` type is the actual remaining risk, so a physical print from the target mono laser is still required.
6. **Red, teal, and amber callouts converge to similar gray boxes.** Their bold text labels preserve meaning, so this is not a correctness failure. Scan speed would improve if the warning types also used a non-colour cue such as different border treatment or a small conventional icon.
7. **A few light, thin details may fade on cheap mono output.** The `0.4 pt` command-chip border, pale table fills, and `6 pt` flow arrows are most exposed. The command text and table structure survive even if fills disappear; darkening/thickening the arrows and chip outline would add resilience.

## Strengths worth preserving

- Clear RTL table structure and correct LTR treatment for commands and numeric values.
- Strong numbered troubleshooting sequence on side B.
- Consistent navy/teal house palette in colour.
- Adequate outer margins for ordinary desktop printers.
- The unit crest is rasterized at more than enough resolution for its printed size.

## Recommended next pass

1. Re-export from the current HTML and verify both headers.
2. Confirm the duplex edge through one physical test print.
3. Print one colour and one mono sample at 100% scale; inspect at normal working distance.
4. Enlarge side B type using its spare space; for side A, remove or shorten lower-priority copy before increasing type.
5. Only then polish non-colour cues and thin borders.

