# 2026-11-24 — index grouped by training level, RFGame link, editor support

## What Omer asked

"תוסיף באינדקס הראשי גם קישור ל-RFGame וחלוקה לרמות. השיעורים על המכשירים והקישור ל-RFGame שייכים לרמת
מפעיל, שיעורים 3, 5 ו-6 שייכים לרמת ביניים והשאר שייכים לרמת תקשוב." Then: "לשני המשחקים תוסיף הערה שהם
מיועדים למובייל".

Answers to my questions (same day):

- "שיעורים 3, 5 ו-6" = **radio** 03, 05, 06 (not networks).
- RFGame lives at **https://rf-game.vercel.app/** (external; it is not in this repo).
- Levels are the **main sections**, tracks are sub-headings inside them. The networks "recommended order"
  block stays with networks, in רמת תקשוב.
- TechGame: **leave the link as it is** (external). TechGame and the A6 card are "the rest" → רמת תקשוב
  (track "חומרי עזר").

## What changed

`index.html`:

- Three level bands, in this order: `#level-operator` רמת מפעיל (1), `#level-intermediate` רמת ביניים (2),
  `#level-ict` רמת תקשוב (3). Markup: `div.level-head > span.lvl-num + div.lvl-txt > h2`. Tracks inside a
  level are `<h3>` (they were `<h2>`); counters and track descriptions as before.
- רמת מפעיל: מכשירים (01, 02) + new track **תרגול** with the RFGame row (`▶`, opens in a new tab,
  `rel="noopener"`).
- רמת ביניים: רדיו 03, 05, 06 with a new track description I wrote ("קשר רדיו בשטח: מבנה המערכת, אבחון
  תקלות והתקנת אנטנות.").
- רמת תקשוב: רדיו 01, 02, 04 (new description: "יסודות החשמל והגלים, ואחריהם אנטנות ו-SWR."), רשתות
  01–08 with its existing description and order block, חומרי עזר (A6 card, TechGame).
- Jump links under the legend (`nav.levels`), header sub-line now names the three levels.
- Both game rows start with an amber pill `<span class="mob">מיועד לטלפון נייד</span>`.
- Every lesson row is byte-identical to before; only its position moved.

Editor (`editor/js/docmodel.js`, `editor/js/app.js`, `editor/css/editor.css`):

- `parseIndex` returns `levels` (each `{head, id, num, name, sub, raw, lead, pre}`) and the flat `tracks`
  list with `tr.level`. A flat index (the archive's) parses as one implicit level with `head:false` and
  `<h2>` tracks, and still round-trips and regenerates byte for byte (tested).
- `syncLevels` renumbers the level badges by order and rewrites the `nav.levels` jump links; a no-op on the
  shipped file (tested).
- Index form: level band with editable name, ↑/↓ (moves the level with its tracks), delete (only when empty),
  "+ מסלול ברמה". Track head has a level dropdown (move to another level), ↑/↓ within its level.
  Toolbar "+ רמה" replaces "+ מסלול" when the index has levels.
- New-lesson dialog lists "רמה · מסלול (dir/)" and asks for a level when creating a new track.
- **Bug fixed on the way:** the suggested lesson number used to be max+1 *within the track*. With radio split
  across two levels it would have suggested 05 for the תקשוב radio track (01, 02, 04), and `radio/05-…`
  already exists. It is now max+1 *per folder across the whole index and the disk*
  (`M.nextLessonNum`), so both radio tracks suggest 07.
- Library (home) view shows level headings above the tracks.

Tests: model 100, e2e 37 (39 with `SINGLE=1`), offline 12, all passing. New: level structure,
legacy flat index round trip + regeneration, level rename/reorder/nav, per-folder numbering, a browser
step that moves a track to another level and back, and a level down and up, each restoring the file byte
for byte.

## Remarks — please read (critical)

1. **Radio's teaching order now crosses levels.** Radio 03's guide states its goal as "לחבר את תורת
   הגלים למערכת שלמה", i.e. it builds on 02 (גלים ואיפנון), which is now in רמת תקשוב. Lesson 06's guide
   ends with a "המשך" list pointing to 02, 04 and 05, and its notes say "כאן מתחברים לשיעור 4 (SWR). אם
   הקהל עבר אותו…". If the levels are taught bottom-up (מפעיל → ביניים → תקשוב), the intermediate group
   meets 03 without 01/02. 06 already handles 04 being optional; 03 does not say what to do without 02.
   I did **not** change any lesson text. Options for Omer: (a) accept, the instructor bridges; (b) add a
   short "בלי שיעור 2" note in guide 03; (c) move 02 to ביניים. Decision needed.
2. **The level order is my assumption**: I numbered them 1 מפעיל, 2 ביניים, 3 תקשוב in the order Omer
   listed them, as if תקשוב is the most advanced. If תקשוב is a parallel professional track rather than a
   step above ביניים, the numbers in the circles are misleading and should go.
3. **Both games are external links.** In an isolated network, or in the editor's offline mode, they do not
   open. RFGame (per earlier remarks) also fetches map tiles/Overpass data at runtime. The index does not
   say so; only the "מיועד לטלפון נייד" pill was asked for.
4. **Wording that is mine, not Omer's:** RFGame row ("משחק תרגול · RFGame", "תרגול אינטראקטיבי בקשר רדיו.
   נפתח בחלון חדש."), the two radio track descriptions, the header sub-line, the track name "תרגול".
   I have not seen RFGame's content; "בקשר רדיו" is a guess from the name. Please check.
5. **A "lesson" row for a game.** The RFGame row reuses `div.lesson` with `▶` in the number box (as the
   TechGame row already did). The library view in the editor therefore lists it as a lesson with no deck.
   Harmless; a dedicated row type would be cleaner if more external tools are added.
6. Editor limits: items placed between a level band and its first track (`lv.pre`) are preserved but not
   editable in the form (none exist today); a level's optional description (`p.level-sub`) is supported by
   the model but has no field in the form; a new level gets the id `level-N`.
7. The archive (`archive/2026-11-03/`) keeps the old flat index, as it must (frozen).
8. `SKILL.md` got one sentence: index.html groups tracks by level, a new lesson row goes under the level
   Omer assigns, and a folder can appear in more than one level.

## Addendum (same day): lesson numbers removed from the index

Omer: "תוריד את המספור של השיעורים, זה רק יוצר בלגן". After the split, radio showed 03/05/06 in one level
and 01/02/04 in another.

- All 19 number boxes (`div.num`) are gone from the index rows, including the `A6` and `▶` boxes of the card
  and the two games, so every row has the same shape. The `.num` CSS rule went with them.
- The networks "סדר העברה מומלץ" block referred to lessons by those numbers (`<i>7</i> שכבה פיזית`); the
  digits are removed and the block now lists names only.
- Editor: a row's number box is optional (`L.num === null`); new rows get one only if the index still has
  numbered rows (`M.indexHasNums`), so the archive index keeps working as before. The lesson number still
  names the folder and files (`radio/07-<slug>/`), as the ASCII path convention requires.
- **Not changed, waiting for Omer:** the decks and guides still say "שיעור N" (deck footers "שיעור 3 · רדיו
  בסיסי", guide titles and `@page` footers, cross references such as "כאן מתחברים לשיעור 4 (SWR)" and the
  "המשך" list in guide 06). Removing those means rewording the cross references by name and re-printing
  the guide PDFs. The URLs keep the numbers regardless.
- Open suggestion: with no numbers on screen, the networks rows could simply be listed in the recommended
  order (שכבות, שכבה פיזית, IP, Domain, כלי תחקור, DHCP, איתור תקלות, הצפנה), and the order block dropped.
  Not done: it moves rows, which Omer did not ask for.
- The level circles (1, 2, 3) are not lesson numbers and stay; see remark 2 above.
