# Remarks - net-08 cryptography lesson (built 2026-10-11, installed 2026-10-28)

Scope: new lesson `networks/08-cryptography/` (deck + guide PDF). Built in the cloud workspace while the
device bridge was offline; assembled on the device with `.agents/build/net08/assemble_on_device.py`
(takes the house head/nav from the net-07 deck, so the shell stays byte-identical).

## What was verified
- Engines (`engines.js`): SHA-256 vs Python hashlib (32 vectors incl. Hebrew and padding edges);
  AES-128 vs OpenSSL (50 random blocks) + FIPS-197 C.1 and App. B; textbook RSA 61/53/17 -> 3233/3120/2753,
  65 -> 2790, 10,766 round trips; DH p=23 g=5 a=6 b=15 -> 8/19/2; Atbash בבל -> ששך; Caesar crack 26/26.
- Playwright drive of every live demo (48 assertions, 0 page errors), run on the assembled deck.
- All 30 slides rendered in headless Chrome; overflow scan clean except intended scroll in `#fq-pt`.
- No em dashes; keydown on text fields stops propagation (typing space/n/a/f does not drive the deck; Esc blurs).

## Open items / decisions for Omer
1. **Overlap with net-03 (Domain & certificates).** Slides 11-14 (TLS for technicians, signature, chain,
   cert faults) partly repeat net-03. Decide: keep both, or trim net-03 to a pointer here.
2. **Smart-card policy is NOT sourced.** Slide 16 uses 3 tries for the demo only and says the real number and
   unblock process are unit policy. No unblock procedure was written. Needs the unit's card-system doc if a
   procedure is wanted.
3. **Toy signature collision.** Part-A and part-B signature demos reduce SHA-256 mod 3233, so a random edit has
   ~1/3233 chance to verify. Disclosed on slide 29 and in the guide. Acceptable for teaching; do not "fix" by
   comparing full hashes (that would misrepresent RSA).
4. **Guide** is built on lesson 7's guide template (head copied verbatim, footer text changed) and rendered
   with headless Chrome, 11 pages. Digit ranges wrapped in `.ltr`; `pdftotext` shows every range in order.
5. **Assembly**: deck head/nav taken from the net-07 deck (house CSS rule-for-rule identical to the local
   reconstruction except lesson-7-only `.tsim-*` terminal rules, which ride along unused). Post-fixes: deck id
   `network-lesson-8`, `main.stage` aria-label and `<title>`. Eyebrows zero-padded like net-07.
   Index: row 08 added, count 7 -> 8, recommended order now ends `5 -> 8` (lesson 8 leans on 3, 4 and 5).
   Backup of the previous index: `.agents/build/net08/index.backup-2026-10-28.html`.
6. **Bridge outage**: the device link was down 2026-10-11..28; everything was built in the cloud and installed
   in one pass when it returned. If that recurs, `assemble_on_device.py` is the single install step.
7. **Codex**: the Codex MCP server was not available in this cloud session, so no Codex review was run.
   Suggested Codex task: independent review of `demos.js` controllers and the TLS 1.3 step texts.

## Lessons (add to README standing rules)
- Text fields inside a deck must `stopPropagation()` on keydown, or the house nav eats space/n/a/f.
- `.c8-link span{display:block}` (descendant) broke inline `span.ltr` inside cards; use child selectors.
- SVG Hebrew labels: `text-anchor="end"` puts the LEFT edge at x (RTL), so labels drift into shapes.
  Use `start` for right-aligned Hebrew labels.
- Flat-colour cover image is what makes the LSB steganography demo readable; gradients make the LSB plane noisy.
- "1-RTT" in RTL text renders as "RTT-1"; always wrap in `<span class="ltr">`.

## Still open from earlier sessions
- radio-06 slide 3 (antenna-length animation) contains em dashes - replace with " - ".
- `reference/technician-card-a6.pdf` on the device is stale (commit was refused while the file was open);
  must be rebuilt (container was reset) and re-committed.
- radio-06 guide re-render and timings; guide map numbering defect (21 vs 18) awaiting Omer.
- Omer to review DHCP lesson 06; Omer to delete `_to_delete/` manually; nahalei kesher need source material.
