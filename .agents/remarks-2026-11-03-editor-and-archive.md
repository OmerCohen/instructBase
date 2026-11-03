# 2026-11-03 · HTML editor (`editor/`) and archive (`archive/`)

Omer's request: step back from per-lesson agent work and build an HTML tool to load, edit and save the
decks, create new lessons and change the index; keep all existing material available under a subfolder;
make all of it downloadable as one ZIP. Decisions he made up front: files are plain self-contained HTML;
saving through the File System Access API (Chrome/Edge), no server.

## What was built

- `editor/`: static, dependency-free tool. Usage in `editor/README.md` (Hebrew).
- `archive/2026-11-03/`: byte-identical copy of the published set + the 16 guide sources;
  `archive/instructbase-2026-11-03.zip` (51 files, 5.2 MB); `archive/index.html` landing page;
  `archive/README.md`.
- The stale root `חומרי הדרכה.zip` (2026-08-06, 13 lessons) moved to `archive/instructbase-2026-08-06.zip`:
  it was outdated and its Hebrew file name broke the ASCII-path rule. Contents unchanged.
- Root `index.html`: one footer sentence linking to `archive/index.html`, plus `footer a{color:var(--cyan)}`.
  This is the only change to published material. The snapshot was taken before it.
- `.gitignore`: `.editor-backups/`.

## Design decisions (read before changing the editor)

1. **Source-preserving edits, never re-serialisation.** `editor/js/htmlscan.js` scans HTML into a tree
   that keeps byte offsets; every edit is a splice of exactly the changed range. A deck is
   `head + [slides] + tail` and each slide keeps its own source string. Consequence: untouched bytes,
   including every `<script>`, stay identical, so git diffs show only real edits. Verified:
   parse→serialise is byte-identical for all 16 decks, 16 guide sources and `index.html`. A DOM
   `outerHTML` round trip was rejected: it rewrites SVG (`<path/>` to `<path></path>`), attribute quoting
   and entities across the whole file, so every save would produce a full-file diff.
2. **Numbering rule (discovered, not designed).** Footer `NN / total` on every slide except the title.
   `.eyebrow .num` = the slide's position **counting the title slide as 0**. It is not a running counter:
   in n08 and r06 the part-2 title slide has no eyebrow, yet the slides after it continue the position
   count. Renumbering runs after every structural edit and is a verified no-op on all 16 shipped decks.
3. **Visual editing only where it is safe.** The preview marks the outermost elements whose content is
   inline text only, with no `id` (demo targets) and outside SVG. When editing starts, the live
   innerHTML is compared to the source; if a demo script has changed it, the edit is refused. This keeps
   runtime values from being saved into the file.
4. **Script gate at save.** Every inline classic script is parsed with `new Function` (parse only, the
   browser equivalent of `node --check`). A script that fails *and differs from the loaded version*
   blocks the save. Same lesson as Addendum 4 of `remarks-2026-07-28`.
5. **Isolation.** Preview and "present"/"print" windows run the document in
   `sandbox="allow-scripts allow-modals"` without `allow-same-origin`. A `blob:` URL was the first
   version and was replaced: it runs with the editor's origin, so a hostile HTML file opened in the editor
   could read the stored folder handle from IndexedDB and write to the folder. The e2e test asserts that
   the presented deck cannot reach `top` or `indexedDB`.
6. **Index.** Each block keeps its raw source and is regenerated only when edited. A test regenerates
   every block and gets byte-identical output, so the generator matches the hand-written format exactly.
   The track counter (`N שיעורים`) is derived from the rows; for 1 lesson the text is "שיעור אחד" rather than "1 שיעורים".
7. **New lessons** follow the ASCII path rule (`<track>/NN-<slug>/NN-<slug>-deck.html`; slug validated),
   write the guide source to `.agents/guide-sources/NN_<code>_guide_source.html` (codes radio, net,
   devices; new tracks use the folder name), and add an index row **without** a PDF link. The PDF does
   not exist until it is printed, and the published index should not carry a broken link. The library
   then offers "קישור ה-PDF באינדקס" once the file exists.
8. **Templates.** `editor/templates/deck-template.html` = house core CSS (variant 456e64, from n01) +
   `@page` + footer/motion styles + nav script, with 3 generic slides. `guide-template.html` = the
   n01 guide's style with 4 generic pages. Both pass the same model tests.

## Critical remarks: limits of the approach

- **The editor does not reach most of what makes these decks good.** The live demos (n08 crypto engines,
  r06 WebGL simulator, terminal simulators, 132 animated elements) are code. The editor protects them
  but cannot author them. A lesson made from the template is static slides until someone writes demos,
  and the standing rule "every lesson that ships a simulation must include a limits slide" is only
  supported by the "מה ההדגמה לא אומרת" layout. It is not enforced.
- **Slide-number references in prose do not follow structural edits.** Notes ("בשקופיות 2, 3, 6 ו-13"),
  guide sections ("שקופית 7"), the guide's time-split table and the guide's slide map all go stale when
  slides move. The editor warns once per deck. *Deferred:* a lint that extracts "שקופית/שקופיות N"
  mentions and flags them after a structural change, and a deck↔guide cross-check.
- **PDFs are a manual step** (browser print → save as `NN-<slug>-guide.pdf`). `@page` margin boxes
  (page numbers, footer text) need a recent Chrome. *Deferred:* a reproducible print script on
  Playwright/headless Chrome (the verified pipeline in `.agents/README.md`) so PDFs stop depending on
  whoever presses Ctrl+P.
- **"Duplicate an existing lesson" copies its demo CSS/JS** with the old prefix (`n01-`, `r06-`...).
  Deleting the slides leaves dead but guarded script code in the file. Harmless, and it adds size.
- **"One CSS baseline" is already not true.** The core `<style>` exists in 5 variants across the 16 decks
  (456e64 ×7, fdaaf4 ×5 = core + terminal-sim, 0bdfea ×2, n08's own, r06's own). The template is one more
  copy. A set-wide CSS fix must now also touch `editor/templates/deck-template.html`. *Deferred:*
  consolidation; it cannot be an external stylesheet, because decks must stay single files.
- **Lint covers only the mechanical rules** (missing notes, em dash, unwrapped digit ranges). The style
  rules that need judgment (count-announcing titles, mirrored twin cards, "X - ולא Y" hinges, slogans) are
  not checked. `1-RTT`-type digit-hyphen-Latin tokens are not checked either. Baseline: zero mechanical
  findings on all 16 shipped decks.
- **Browser support.** Writing in place needs Chrome/Edge. Firefox/Safari get read-only + ZIP of changes.
- **Do not open the IIS webroot itself in the editor.** It writes `.editor-backups/` next to the files,
  and IIS serves dot-directories (see the `.agents/` publishing rule). Open the git clone instead.
- **Concurrent edits** (Codex/Claude agents and the editor on the same file): the editor re-reads the file
  before saving and asks if it changed on disk, but it does not merge.

## Repository hygiene (seen, not touched; Omer's call)

- `tmp/` holds ~90 MB of review renders and backups committed to git; `.agents/build/` and
  `.codex-remote-attachments/` are also committed. Suggest `tmp/` in `.gitignore` and removing it from
  the index. History keeps it either way.
- `README.md` was literally `"# instructBase" ` (a Windows `echo` artefact). Replaced with an overview.

## Independent review (same day, two Fable agents, given the code and not my conclusions)

**Code review.** It verified invariants 1-6 with its own probes and found three ways to lose an edit.
All are fixed and each has a regression test that drives the failure path:
1. *Edits during a save were marked clean.* `saveDoc` set `dirty = false` after several awaits, so a change
   that landed during a slow write disappeared from the dirty state (Save disabled, no unload warning).
   Now `dirty = serialize(d) !== text`, and saves of one document are serialised (a second save during a
   write runs after it; before, it compared the disk with the stale `diskText` and asked a false
   "changed on disk" question).
2. *The full-source view still accepted clicks in the preview*, then "החלה" restored the stale textarea and
   erased them. The preview is now read-only while `view === 'source'`.
3. *An edit in progress was dropped when the preview frame was replaced* (tab switch, rail move/delete,
   undo) before the agent's `commit` message arrived. Real users were protected by mouse timing, not by
   design. The agent now posts a `draft` on every input. `change()`, undo/redo, save, close, tab switch,
   present and print apply the pending draft before they read or replace anything.
Smaller, also fixed: a deck that stops parsing in the source view now gets a toast, and a confirm before
saving. Duplicating a slide with ids strips the ids from the copy, with a confirm, so the original demo
keeps its bindings. Emptied headings/subtitles stay editable, and in the preview only they get a minimum
size and an "(ריק)" marker (the test caught a second bug here: Chrome's placeholder `<br>` made the next edit look
script-written, so it was refused). Enter at the end no longer leaves a trailing `<br>`. The sanitizer no
longer drops comments. Links in the preview resolve relative to the document.
Not changed, recorded: `checkScripts` skips `type="module"` scripts (none in the set). The preview's
postMessage channel is unauthenticated: a deck's own script could post a fake commit or save of *its
own* file. That is not an escape: the sandbox has no same-origin, so the script cannot reach the editor,
IndexedDB or other files.

**Hebrew review** (house tone rules + israeli-hebrew-writer). Applied: no internal history on the public
archive page ("לפני המעבר לעורך"), one name per thing in the UI ("הערות מדריך", "העורך החזותי",
"התצוגה המקדימה"), "אין ממצאים" instead of "אין הערות" in the lint panel (it read as "no speaker
notes"), number agreement through a `count(n, one, many)` helper ("קובץ אחד", not "1 קבצים"), no
hard-coded date in the ZIP dialog, "ניקוי עיצוב" to match the other noun labels, guide-template
heading matches its content.

## Tests

- `node editor/tests/model.test.cjs`: 92 tests over the real files (round trips, renumber no-op,
  field set/get identity, slide operations, index regeneration, templates, lint baseline).
- `node editor/tests/e2e.cjs`: 26 tests in headless Chromium (6 of them are regressions from the review). The repo is copied into the Origin Private
  File System, whose directory handle has the same API as a picked folder, so the real save path runs.
  Covers visual edit, LTR/bold, side panel, layouts, move, refused runtime text, raw HTML validation,
  undo/redo, save + backup, blocked save on a broken script, heavy decks (r06/n08/d01), sandboxed present
  window, guide edit, index edit, new-lesson wizard, ZIP.
