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
- Decks and guides: done in Addendum 2 below. Networks order: done in Addendum 2.
- The level circles (1, 2, 3) are not lesson numbers and stay; see remark 2 above.

## Addendum 2 (same day): no lesson numbers anywhere in the set; networks in teaching order

Omer: "אפשר להוריד את סדר העברה מומלץ בכלל. פשוט תסדר את האינדקס לפי הסדר המומלץ. ותוריד את ההתייחסויות
למספרי שיעורים מהמצגות ומהדפים".

**This reverses the 2026-08-04 "Numbering decision (do not fix this)"** in
`remarks-2026-08-04-new-lessons-and-index.md`, on Omer's explicit instruction. That decision kept the numbers
to avoid set-wide churn; the churn is now done once, and the numbers no longer exist to go out of sync.

Index: networks rows are now in the recommended order (שכבות, שכבה פיזית, IP וניתוב, Domain, כלי תחקור,
DHCP, איתור תקלות, הצפנה וזהות); the "סדר העברה מומלץ" block and its CSS are gone.

Decks (16) and guide sources (16), 381 occurrences:

- Mechanical: slide footers ("שיעור 3 · רדיו בסיסי" → "רדיו בסיסי"; radio 06 had the number at the end),
  `<title>` and stage `aria-label` of the two device decks, the n08 title badge ("רשתות · שיעור 8" →
  "רשתות"), every guide `@page` footer, guide title-page meta/kick lines, and the amber "שיעור 5" label above
  the h1 of both lesson-5 guides (removed).
- 91 prose edits: cross references now name the lesson by subject. Names used, so they stay consistent:
  שיעור השכבות · שיעור השכבה הפיזית · שיעור ה-IP והניתוב · שיעור ה-Domain · שיעור כלי התחקור ·
  שיעור ה-DHCP · שיעור איתור התקלות · שיעור ההצפנה והזהות · שיעור הגלים · שיעור רדיו בסיסי ·
  שיעור האנטנות וה-SWR · שיעור האבחון בשטח · שיעור המונופול ופרנל. The guide-06 "המשך" list keeps the
  three titles without numbers. Ordinals went too ("השיעור הראשון/השני במסלול המכשירים", "השיעור הראשון
  בסדרת הרשתות" → "פותח את מסלול הרשתות"); 01_net "בפתיחת שיעור 2" → "לפתיחת השיעור הבא".
- Visible on slides (not only notes): the n03 limits slide, the n07 summary key ("לפי סדר הבדיקות של איתור
  תקלות"), the n08 badge. Checked at 1920x1080: no overflow, the n07 key stays on one line.
- Not touched: `<script>` blocks (asserted byte-identical), CSS comments like `/* lesson 4 demos */`
  (invisible), the `id="devices-lesson-1"` attributes, slide numbers ("שקופית 7"), folder/file names,
  `archive/`.
- A model test now fails if "שיעור N" (or an ordinal) reappears in any deck, guide source or template.
- Editor: the new-lesson footer defaults to the lesson title, the guide `@page` footer to
  "מחלקת תקשוב · <title>"; both templates lost "שיעור 0".
- All 16 guide PDFs re-printed with headless Chrome (m153; the shipped ones were m141). A baseline render of
  two unchanged sources first matched the shipped PDFs (same pages; text identical or differing only in
  line wraps). After the change every guide kept its page count, and a word diff shows only the intended
  edits plus a few line-wrap differences.
- Backups: git is the backup (last commit before this change: `722b2de`); nothing copied into `tmp/`, which
  is already 90 MB in the repo.

**Order problems this exposes (pre-existing, not fixed, waiting for Omer):**

1. Networks: the list order is now 01 → 07 → 02 → 03 → 04 → 06 → 05 → 08, but **n06 (DHCP) and n07
   (physical layer) both treat n05 (troubleshooting) as already taught**: n07 "שיעור איתור התקלות קבע ״הפיזי
   קודם״", n06 "חברו לשיעורים הקודמים: … ושיעור איתור התקלות אמר לבדוק את הגדרות ה-IP". In the recommended
   order n05 comes after both. This was already true with the order block; it is just more visible now.
2. Radio: r04 (ICT level) says "סכמו לקראת שיעור האבחון בשטח" and "השלב הזה פותח את שיעור האבחון בשטח", but
   r05 is in the intermediate level, which may be taught before r04. r03 (intermediate) builds on r02 (ICT),
   see remark 1 at the top.
3. 01_net "לפתיחת השיעור הבא" now means the physical-layer lesson in the recommended order, not IP; moving
   the exercise there still works, but the instructor should know.

Omer's own copy of the skill (the one Cowork loads from his account) still has the old footer formats with
"שיעור N"; the repo copy in `.agents/skills/unit-training-decks/SKILL.md` is updated and should be synced.

## Addendum 3 (same day): every lesson stands on its own

Omer, answering the two order questions of Addendum 2: "לנסח מחדש בלי הנחה על הסדר" for both, and
"ככלל כל שיעור אמור לעמוד בפני עצמו". This closes order problems 1-3 above.

Rule applied to all 16 decks and 16 guide sources (now also in SKILL.md section 3):

- Removed or reworded: anything that assumes another lesson was taught before or comes after
  ("כבר ראו בשיעור…", "חברו לשיעורים הקודמים", "מהשיעור הקודם", "בכלים שכבר למדתם", "סכמו לקראת שיעור…",
  "השלב הזה פותח את שיעור…", "חוזרים אליהן בשיעור…", "יופיעו בשיעור…", "בהמשך ההכשרה", "פותח את מסלול
  הרשתות").
- Kept: order-neutral pointers ("נלמד בשיעור X", "שיעור X מציג…", "להרחבה: שיעור X, שקופית N"),
  prerequisites stated as knowledge ("ודאו שרזוננס, אימפדנס וקיטוב ברורים לקבוצה"), conditionals that
  already handled both cases (r06 "אם הקהל עבר אותו… אם לא, מספיקה התיבה האדומה"; r04 "חפיפה" box).
- 63 edits in 18 files (18 in decks, 45 in guides). Visible slide text changed in three places only:
  n06 slide 11 subtitle ("כל שלב מצמצם את החשודים לפני שנוגעים בשרת."), n06 slide 15 subtitle ("לחוליית
  הכתובת בשרשרת מוסיפים את המקור שלה."), n07 slide 15 key ("…ממשיכים לשכבות שמעליה לפי הסדר."). The rest
  are speaker notes and guide prose.
- n06 (DHCP) leaned on "the ipconfig output from the tools lesson". Its own slide 4 is an `ipconfig /all`
  output, so the notes and guide now point there ("חזרו לפלט של ipconfig בשקופית 4"), and the guide's
  recommended opening is to run `ipconfig /all` on a station, or open with slide 4 if none is available.
- "Move the exercise to the opening of lesson X / the next lesson" became "המפגש הבא" (01_net, 02_net,
  04_radio).
- The r06 guide box "המשך" (three lesson titles) is now "שיעורים קשורים".
- "הנושאים האלה … נלמדים בהמשך ההכשרה" (n06, n07) became "… דורשים הכשרה נפרדת": I could not verify that
  those topics (IPv6, switch DHCP protections, structured cabling, fibre types) are taught anywhere, so the
  text no longer promises it.
- Names unified: "שיעור הכלים" → "שיעור כלי התחקור", "שיעור Domain" → "שיעור ה-Domain".
- Index: the networks track description now says the rows are in the recommended order and that each
  lesson stands on its own (my wording, replaces the stale five-lesson description).
- A second model test fails on "previous/next lesson" phrasing in any deck or guide source.
- Changed guides re-printed (10 of 16); page counts unchanged.

**Still true, by nature of the content (not a wording issue):** some lessons need concepts that another
lesson teaches (r04 needs resonance, impedance, polarisation and dB; n03 needs DNS/IP/Gateway; n06 reads
ipconfig output). They now state this as a prerequisite to check with the group, without saying where it
was learned. If Omer wants a lesson to be teachable to a group with none of that background, it needs a
short recap slide, which is new content and was not added.

### Independent wording review of Addendum 3 (context-free reviewer, 63 passages)

Verdict: no order assumption left. It flagged several of my new sentences; fixed in a follow-up commit:

- r03 (deck + guide): "רשמו את נקודות הכשל שעלו…" only made sense as preparation for another lesson; now
  "איתור נקודות הכשל שעלו מפורט בשיעור האבחון בשטח."
- n06 (deck + guide): after dropping the reference to the other lesson, "DHCP Enabled: No … הוגדרה ידנית,
  **בכוונה**" had become a general claim the output cannot support. Now "…מוגדרת ידנית; בתחנה שתוכננה כסטטית
  זה תקין." Also the slide-15 subtitle ("בחוליית הכתובת בודקים גם מאיפה הכתובת הגיעה.") and two guide
  sentences.
- r04 (deck + guide): clumsy phrasing of the cable-loss pointer; dB added to the stated prerequisites.
- n07 (deck + guide): "אטימה" → "איטום"; the filler "זו אותה חשיבה על תווך אחר." removed.

**Found by the reviewer in text I did not write; NOT fixed, for Omer to decide** (out of scope of this
change):

1. Technical, n06 guide objective: "להבחין בין כתובת סטטית, דינמית ושמורה לפי פלט ipconfig /all". A reserved
   address looks exactly like a dynamic one in `ipconfig /all`; the reservation exists only on the server.
2. Technical, 02_net guide: "בסביבת Domain ה-DNS מאתר באמצעותן Domain Controllers". It is the stations that
   locate DCs through SRV records.
3. r04 deck + guide: "כבל אובדני" for a lossy cable reads as "suicidal"; suggest "כבל עם הפסד גבוה".
4. 05_radio guide: "ההזזה של האנטנה מתדר העבודה" sounds like physically moving the antenna; suggest
   "הסטייה של תדר התהודה של האנטנה מתדר העבודה".
5. r03 note: "הנושא יוצא בהספק מלא בלי קול" ("הנושא" reads as "the topic"); suggest "הגל הנושא".
6. Small Hebrew slips: 01_net "את שקופית המגבלות (14) לא מדלגים" (לדלג על); n07 guide "מעליה אפשר עדיין
   לטעות בהרבה מקומות" and "אם הן באותה רשת, זה תלוי…"; n07 "ומה נפגע בו" (ambiguous); n08 note "צעדו ידנית:
   ClientHello והשרת עונה…" (no subject); n06 notes in first person ("נרחיב בשקופית 6", "היום נראה").
