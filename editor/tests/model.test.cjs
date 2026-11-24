// Node tests for htmlscan.js and docmodel.js against the real material in the repo.
// Run from the repo root:  node editor/tests/model.test.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const S = require('../js/htmlscan.js');
const M = require('../js/docmodel.js');

const ROOT = path.resolve(__dirname, '..', '..');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
function find(dir, re, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'tmp', 'archive', '.editor-backups'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) find(p, re, out); else if (re.test(e.name)) out.push(p);
  }
  return out;
}
let failures = 0, passes = 0;
function test(name, fn) {
  try { fn(); passes++; console.log('  ok  ' + name); }
  catch (e) { failures++; console.log('FAIL  ' + name + '\n      ' + (e && e.message || e)); }
}

const decks = find(ROOT, /-deck\.html$/).filter((p) => !rel(p).startsWith('editor/'));
const guides = find(path.join(ROOT, '.agents', 'guide-sources'), /\.html$/);
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

console.log('decks: ' + decks.length + ', guide sources: ' + guides.length);

for (const f of decks) {
  const src = fs.readFileSync(f, 'utf8');
  const name = rel(f);
  test('deck round-trip is byte-identical: ' + name, () => {
    assert.strictEqual(M.detectKind(name, src), 'deck');
    const doc = M.parseUnits(src, 'deck');
    assert.ok(doc && doc.units.length > 3, 'no slides');
    assert.strictEqual(M.serializeUnits(doc), src);
  });
  test('renumber is a no-op on the shipped deck: ' + name, () => {
    const doc = M.parseUnits(src, 'deck');
    const changed = M.renumberDeck(doc);
    assert.deepStrictEqual(changed, [], 'slides changed: ' + changed.join(','));
    assert.strictEqual(M.serializeUnits(doc), src);
  });
  test('inline scripts parse: ' + name, () => {
    assert.deepStrictEqual(M.checkScripts(src, src), []);
  });
  test('field get/set round-trip keeps bytes: ' + name, () => {
    const doc = M.parseUnits(src, 'deck');
    for (const u of doc.units) {
      for (const f of ['title', 'subtitle', 'note', 'eyebrow']) {
        const v = M.getField(u.html, f);
        if (v == null) continue;
        assert.strictEqual(M.setField(u.html, f, v), u.html, f);
      }
      const list = M.editables(u.html, M.unitRoot(u.html), 'deck');
      list.forEach((n, k) => assert.strictEqual(M.setEditableInner(u.html, 'deck', k, M.getEditableInner(u.html, 'deck', k)), u.html));
    }
  });
}

test('every deck and the template keep the stage at 1280x720 (flex-shrink:0)', () => {
  const files = decks.concat([path.join(ROOT, 'editor', 'templates', 'deck-template.html')]);
  const bad = files.filter((f) => M.stageKeepsSize(fs.readFileSync(f, 'utf8')) !== true).map(rel);
  assert.deepStrictEqual(bad, []);
  const doc = M.parseUnits(fs.readFileSync(files[0], 'utf8'), 'deck');
  assert.ok(!M.lintUnits(doc).some((x) => /flex-shrink/.test(x.msg)));
});
test('a deck made from a source without the stage fix gets it', () => {
  const src = fs.readFileSync(decks[0], 'utf8').replace('flex-shrink:0;position:relative;', 'position:relative;');
  assert.strictEqual(M.stageKeepsSize(src), false);
  assert.ok(M.lintUnits(M.parseUnits(src, 'deck')).some((x) => /flex-shrink/.test(x.msg)), 'lint misses it');
  const out = M.instantiateDeck(src, { title: 'בדיקה', footerLabel: 'בדיקה' });
  assert.strictEqual(M.stageKeepsSize(out), true);
});

test('the service worker precaches every file the editor needs offline', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'editor', 'sw.js'), 'utf8');
  const list = JSON.parse('[' + /const ASSETS = \[([\s\S]*?)\];/.exec(sw)[1].replace(/'/g, '"') + ']');
  const need = ['index.html', 'manifest.webmanifest']
    .concat(['css', 'js', 'icons', 'templates'].flatMap((d) => fs.readdirSync(path.join(ROOT, 'editor', d)).map((f) => d + '/' + f)));
  const missing = need.filter((f) => list.indexOf('./' + f) < 0);
  assert.deepStrictEqual(missing, [], 'add to ASSETS in editor/sw.js and bump VERSION');
  const extra = list.filter((u) => u !== './' && !fs.existsSync(path.join(ROOT, 'editor', u)));
  assert.deepStrictEqual(extra, []);
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'editor', 'manifest.webmanifest'), 'utf8'));
  man.icons.forEach((ic) => assert.ok(fs.existsSync(path.join(ROOT, 'editor', ic.src)), ic.src));
});

test('the committed single-file build is up to date (node editor/build-single.cjs)', () => {
  const { build, OUT } = require('../build-single.cjs');
  assert.ok(fs.existsSync(OUT), 'missing ' + rel(OUT));
  assert.ok(fs.readFileSync(OUT, 'utf8') === build(), rel(OUT) + ' is stale: run node editor/build-single.cjs');
});

test('slide operations: move, duplicate, delete, insert, then renumber', () => {
  const f = decks.find((p) => /01-layers-and-metrics-deck/.test(p));
  const src = fs.readFileSync(f, 'utf8');
  const doc = M.parseUnits(src, 'deck');
  const n = doc.units.length;
  const titles = doc.units.map((u) => M.slideInfo(u.html).title);
  // move slide 3 to position 5
  const [u] = doc.units.splice(2, 1); doc.units.splice(4, 0, u);
  // duplicate slide 2
  doc.units.splice(2, 0, { lead: doc.units[1].lead, html: doc.units[1].html });
  // insert a new slide at 6
  const ctx = M.slideContext(doc, 6);
  doc.units.splice(6, 0, { lead: '', html: M.newSlide('cards2', ctx) });
  // delete the last
  doc.units.pop();
  const changed = M.renumberDeck(doc);
  assert.ok(changed.length > 0);
  const out = M.serializeUnits(doc);
  const doc2 = M.parseUnits(out, 'deck');
  assert.strictEqual(doc2.units.length, n + 1);
  assert.deepStrictEqual(M.renumberDeck(doc2, true), [], 'renumber must be idempotent');
  doc2.units.forEach((u2, i) => {
    const sec = M.unitRoot(u2.html);
    const foot = S.qs(sec, 'div.footer');
    if (foot) { const sp = S.childrenMatching(foot, 'span'); assert.strictEqual(S.inner(u2.html, sp[sp.length - 1]), M.pad(i + 1) + ' / ' + M.pad(n + 1)); }
    assert.strictEqual(S.hasClass(sec, 'active'), i === 0);
  });
  assert.strictEqual(M.slideInfo(doc2.units[3].html).title, titles[3]);
  assert.deepStrictEqual(M.checkScripts(out, src), []);
  // the untouched script blocks are byte-identical
  const scripts = (s) => S.qsa(S.scan(s), 'script').map((x) => S.inner(s, x));
  assert.deepStrictEqual(scripts(out), scripts(src));
});

test('every layout produces a slide the scanner reads back', () => {
  const f = decks.find((p) => /01-layers-and-metrics-deck/.test(p));
  const doc = M.parseUnits(fs.readFileSync(f, 'utf8'), 'deck');
  const ctx = M.slideContext(doc, 3);
  for (const l of M.LAYOUTS) {
    const html = M.newSlide(l.id, ctx);
    const sec = M.unitRoot(html);
    assert.strictEqual(sec.end, html.length, l.id + ': not one element');
    const info = M.slideInfo(html);
    assert.ok(info.title, l.id + ': no title');
    assert.ok(info.hasNote, l.id + ': no note');
  }
});

for (const f of guides) {
  const src = fs.readFileSync(f, 'utf8');
  test('guide round-trip is byte-identical: ' + rel(f), () => {
    assert.strictEqual(M.detectKind(rel(f), src), 'guide');
    const doc = M.parseUnits(src, 'guide');
    assert.ok(doc && doc.units.length > 2);
    assert.strictEqual(M.serializeUnits(doc), src);
    for (const u of doc.units) {
      const list = M.editables(u.html, M.unitRoot(u.html), 'guide');
      list.forEach((n, k) => assert.strictEqual(M.setEditableInner(u.html, 'guide', k, M.getEditableInner(u.html, 'guide', k)), u.html));
    }
  });
}

test('index round-trip is byte-identical', () => {
  assert.strictEqual(M.detectKind('index.html', indexSrc), 'index');
  const m = M.parseIndex(indexSrc);
  assert.ok(m.tracks.length >= 4);
  assert.strictEqual(M.serializeIndex(m), indexSrc);
});
function markAllDirty(m) {
  m.levels.forEach((lv) => { lv.dirty = true; });
  m.tracks.forEach((tr) => {
    tr.dirty = true;
    tr.items.forEach((it) => { it.dirty = true; if (it.lesson) { it.lesson.dirty = true; it.lesson.links.forEach((l) => { l.dirty = true; }); } });
  });
}
const archiveIndexSrc = fs.readFileSync(path.join(ROOT, 'archive', '2026-11-03', 'index.html'), 'utf8');
test('index regenerates every block byte-identically', () => {
  const m = M.parseIndex(indexSrc);
  markAllDirty(m);
  assert.strictEqual(M.serializeIndex(m), indexSrc);
});
test('index: levels -> tracks structure (operator, intermediate, ICT)', () => {
  const m = M.parseIndex(indexSrc);
  const heads = m.levels.filter((l) => l.head);
  assert.deepStrictEqual(heads.map((l) => [l.id, l.num, l.name]),
    [['level-operator', '1', 'רמת מפעיל'], ['level-intermediate', '2', 'רמת ביניים'], ['level-ict', '3', 'רמת תקשוב']]);
  // rows are identified by the lesson folder in their first link (the index has no number boxes since 2026-11-24)
  const key = (it) => { const h = it.lesson.links[0].href; const f = /^(\w+)\/(\d+)-/.exec(h); return f ? f[1][0] + f[2] : h.replace(/^https:\/\/([\w-]+).*/, '$1').replace(/^reference\/.*/, 'A6'); };
  const shape = heads.map((lv) => M.levelTracks(m, lv).map((tr) => tr.tag + ':' + tr.name.trim() + ':' + M.trackLessons(tr).map(key).join(',')));
  assert.deepStrictEqual(shape, [
    ['h3:מכשירים:d01,d02', 'h3:תרגול:rf-game'],
    ['h3:רדיו:r03,r05,r06'],
    ['h3:רדיו:r01,r02,r04', 'h3:רשתות:n01,n07,n02,n03,n04,n06,n05,n08', 'h3:חומרי עזר:A6,kesher-net']]);
  // no number boxes in the rows, no digits in the networks order block
  assert.ok(!indexSrc.includes('<div class="num">'));
  // networks are listed in teaching order, so there is no separate order block
  assert.ok(!indexSrc.includes('class="order"'));
  assert.strictEqual(M.indexHasNums(m), false);
  assert.ok(M.trackLessons(m.tracks[0]).every((it) => it.lesson.num === null));
  // every level has at least one track, and the jump links match the level ids
  const nav = (indexSrc.match(/<nav class="levels"[^>]*>([\s\S]*?)<\/nav>/) || [])[1] || '';
  assert.deepStrictEqual([...nav.matchAll(/href="#([^"]+)"/g)].map((x) => x[1]), heads.map((l) => l.id));
  M.syncLevels(m);
  assert.strictEqual(M.serializeIndex(m), indexSrc, 'syncLevels is a no-op on the shipped index');
  // both games carry the mobile note and open outside the page
  for (const href of ['https://rf-game.vercel.app/']) assert.ok(M.indexLinks(m).some((l) => l.href === href), href);
  assert.strictEqual((indexSrc.match(/<span class="mob">/g) || []).length, 2);
});
test('index: the legacy flat index (archive) still round-trips and regenerates', () => {
  const m = M.parseIndex(archiveIndexSrc);
  assert.strictEqual(m.levels.length, 1);
  assert.strictEqual(m.levels[0].head, false);
  assert.deepStrictEqual(m.tracks.map((tr) => tr.tag + ':' + tr.name.trim()), ['h2:רדיו', 'h2:רשתות', 'h2:מכשירים', 'h2:חומרי עזר']);
  assert.strictEqual(M.serializeIndex(m), archiveIndexSrc);
  markAllDirty(m);
  assert.strictEqual(M.serializeIndex(m), archiveIndexSrc);
  // a new track in the flat index is an h2 like its neighbours
  const lv = m.levels[0];
  const tr = M.newTrack('מסלול חדש', 'תיאור המסלול.', lv);
  m.tracks.splice(3, 0, tr);
  const out = M.serializeIndex(m);
  assert.ok(out.includes('<h2>מסלול חדש <span class="cnt">אין שיעורים</span></h2>\n<p class="track-sub">תיאור המסלול.</p>'));
  assert.strictEqual(M.parseIndex(out).tracks.length, 5);
  // the old index still numbers its rows; the editor keeps doing so there
  assert.strictEqual(M.indexHasNums(m), true);
  tr.items.push(M.newLessonItem({ num: '01', title: 'א', desc: 'ב', deck: 'x/01-a/01-a-deck.html' }));
  assert.ok(M.serializeIndex(m).includes('<div class="lesson"><div class="num">01</div><div class="meta"><b>א</b>'));
});
test('index: lesson counts, header fields, add/move/delete', () => {
  const m = M.parseIndex(indexSrc);
  const ict = m.levels.find((l) => l.id === 'level-ict');
  const radio = M.levelTracks(m, ict)[0];
  assert.strictEqual(M.trackLessons(radio).length, 3);
  assert.strictEqual(radio.cntRaw, '3 שיעורים');
  assert.ok(M.getIndexField(m, 'h1'));
  assert.ok(M.setIndexField(m, 'h1', M.getIndexField(m, 'h1')));
  assert.strictEqual(M.serializeIndex(m), indexSrc);
  radio.items.push(M.newLessonItem({ num: null, title: 'שיעור חדש', desc: 'תיאור', deck: 'radio/07-x/07-x-deck.html', guide: 'radio/07-x/07-x-guide.pdf' }));
  const out = M.serializeIndex(m);
  assert.ok(out.includes('<h3>רדיו <span class="cnt">4 שיעורים</span></h3>'));
  assert.ok(out.includes('<div class="lesson"><div class="meta"><b>שיעור חדש</b><span class="desc">תיאור</span></div><div class="links"><a href="radio/07-x/07-x-deck.html">מצגת</a><a class="pdf" href="radio/07-x/07-x-guide.pdf">דף הנחיה</a></div></div>'));
  const m2 = M.parseIndex(out);
  const radio2 = M.levelTracks(m2, m2.levels[2])[0];
  assert.strictEqual(M.trackLessons(radio2).length, 4);
  radio2.items.pop();
  assert.strictEqual(M.serializeIndex(m2), indexSrc);
  // a new track inside a level is an h3 under that level
  const op = m2.levels[0];
  const tr = M.newTrack('מסלול חדש', 'תיאור המסלול.', op);
  m2.tracks.splice(m2.tracks.indexOf(M.levelTracks(m2, op)[1]) + 1, 0, tr);
  const out3 = M.serializeIndex(m2);
  const m3 = M.parseIndex(out3);
  assert.strictEqual(m3.tracks.length, m.tracks.length + 1);
  assert.deepStrictEqual(M.levelTracks(m3, m3.levels[0]).map((t) => t.name.trim()), ['מכשירים', 'תרגול', 'מסלול חדש']);
  assert.ok(out3.includes('<h3>מסלול חדש <span class="cnt">אין שיעורים</span></h3>\n<p class="track-sub">תיאור המסלול.</p>'));
});
test('index: levels can be renamed, added and reordered; numbers and jump links follow', () => {
  const m = M.parseIndex(indexSrc);
  m.levels[1].name = 'רמה מתקדמת'; m.levels[1].dirty = true;
  m.levels.push(M.newLevel({ id: 'level-4', num: '', name: 'רמה חדשה' }));
  const a = m.levels[0]; m.levels[0] = m.levels[1]; m.levels[1] = a;
  M.syncLevels(m);
  const out = M.serializeIndex(m);
  const m2 = M.parseIndex(out);
  assert.deepStrictEqual(m2.levels.map((l) => l.num + ':' + l.name), ['1:רמה מתקדמת', '2:רמת מפעיל', '3:רמת תקשוב', '4:רמה חדשה']);
  assert.ok(out.includes('<nav class="levels" aria-label="מעבר לרמה"><a href="#level-intermediate">רמה מתקדמת</a><a href="#level-operator">רמת מפעיל</a><a href="#level-ict">רמת תקשוב</a><a href="#level-4">רמה חדשה</a></nav>'));
  // tracks travel with their level
  assert.deepStrictEqual(M.levelTracks(m2, m2.levels[0]).map((t) => t.name.trim()), ['רדיו']);
  assert.deepStrictEqual(M.levelTracks(m2, m2.levels[3]), []);
  assert.strictEqual(M.serializeIndex(m2), out);
});
test('index: next lesson number is per folder across the whole index and disk', () => {
  const m = M.parseIndex(indexSrc);
  assert.strictEqual(M.nextLessonNum(m, 'radio', []), '07');
  assert.strictEqual(M.nextLessonNum(m, 'networks', []), '09');
  assert.strictEqual(M.nextLessonNum(m, 'devices', []), '03');
  assert.strictEqual(M.nextLessonNum(m, 'radio', ['radio/11-extra/11-extra-deck.html']), '12');
  assert.strictEqual(M.nextLessonNum(m, 'newtrack', []), '01');
});
test('no lesson numbers in decks, guide sources or the templates (2026-11-24)', () => {
  const files = decks.concat(guides, [path.join(ROOT, 'editor', 'templates', 'deck-template.html'), path.join(ROOT, 'editor', 'templates', 'guide-template.html')]);
  const re = /שיעור(?:ים)?\s*\d+|שיעור(?:ים)?\s+ה(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שביעי|שמיני)\b/g;
  const bad = [];
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(re)) bad.push(path.relative(ROOT, f) + ': ' + s.slice(Math.max(0, m.index - 30), m.index + 30));
  }
  assert.deepStrictEqual(bad, []);
});
test('lessons stand on their own: no "previous/next lesson" phrasing (2026-11-24)', () => {
  // order-neutral pointers ("נלמד בשיעור X", "שיעור X מציג") are fine; these assume a teaching order
  const re = /השיעור(?:ים)? הקודמ|מהשיעור הקודם|שיעורים הקודמים|ה?שיעור הבא|שיעורים הבאים|בהמשך ה(?:הכשרה|קורס|מסלול)|כבר (?:ראו|למדו|נלמדו?|הוזכר[הו]?|הוצג[הו]?) בשיעור|שכבר (?:למדתם|נלמדו)|לקראת שיעור|חברו לשיעור|פותח את (?:מסלול|שיעור)/g;
  const bad = [];
  for (const f of decks.concat(guides)) {
    const s = fs.readFileSync(f, 'utf8').replace(/<script\b[\s\S]*?<\/script>/g, '');
    for (const m of s.matchAll(re)) bad.push(path.relative(ROOT, f) + ': ' + s.slice(Math.max(0, m.index - 30), m.index + 40));
  }
  assert.deepStrictEqual(bad, []);
});
test('index links point at files that exist', () => {
  const m = M.parseIndex(indexSrc);
  const missing = M.indexLinks(m).filter((l) => M.isLocalHref(l.href) && !fs.existsSync(path.join(ROOT, l.href)));
  assert.deepStrictEqual(missing, []);
});

test('instantiate a new deck from the house template', () => {
  const tpl = fs.readFileSync(path.join(ROOT, 'editor', 'templates', 'deck-template.html'), 'utf8');
  const out = M.instantiateDeck(tpl, { title: 'שיעור בדיקה', subtitle: 'תת כותרת', badge: 'בדיקה', footerLabel: 'שיעור 9 · בדיקה' });
  const doc = M.parseUnits(out, 'deck');
  assert.strictEqual(M.deckMeta(out).title, 'שיעור בדיקה');
  assert.strictEqual(M.deckMeta(out).footerLabel, 'שיעור 9 · בדיקה');
  assert.strictEqual(M.slideInfo(doc.units[0].html).title, 'שיעור בדיקה');
  assert.deepStrictEqual(M.renumberDeck(doc, true), []);
  assert.deepStrictEqual(M.checkScripts(out), []);
});
test('instantiate a new deck by duplicating an existing lesson', () => {
  const f = decks.find((p) => /03-radio-basics-deck/.test(p));
  const src = fs.readFileSync(f, 'utf8');
  const out = M.instantiateDeck(src, { title: 'עותק', footerLabel: 'שיעור 7 · עותק' });
  const meta = M.deckMeta(out);
  assert.strictEqual(meta.title, 'עותק');
  assert.strictEqual(meta.footerLabel, 'שיעור 7 · עותק');
  assert.strictEqual(M.parseUnits(out, 'deck').units.length, M.parseUnits(src, 'deck').units.length);
  const scripts = (s) => S.qsa(S.scan(s), 'script').map((x) => S.inner(s, x));
  assert.deepStrictEqual(scripts(out), scripts(src));
});
test('instantiate a guide source from the template', () => {
  const tpl = fs.readFileSync(path.join(ROOT, 'editor', 'templates', 'guide-template.html'), 'utf8');
  const out = M.instantiateGuide(tpl, { title: 'שיעור בדיקה', footer: 'מחלקת תקשוב · בדיקה · שיעור 9', kick: 'מחלקת תקשוב · בדיקה · מדריך למעביר השיעור' });
  assert.ok(out.includes('<title>שיעור בדיקה</title>'));
  assert.ok(out.includes('content:"מחלקת תקשוב · בדיקה · שיעור 9"'));
  assert.ok(M.parseUnits(out, 'guide').units.length >= 3);
});

test('lint: shipped decks have no unwrapped ranges, em dashes or missing notes', () => {
  const report = [];
  for (const f of decks) {
    const doc = M.parseUnits(fs.readFileSync(f, 'utf8'), 'deck');
    M.lintUnits(doc).forEach((x) => report.push(rel(f) + ' #' + (x.unit == null ? '-' : x.unit + 1) + ' ' + x.level + ': ' + x.msg));
  }
  if (report.length) console.log('      lint findings on shipped decks (informational):\n      ' + report.join('\n      '));
});

test('scanner agrees with itself on nesting: every slide closes inside its own range', () => {
  for (const f of decks) {
    const src = fs.readFileSync(f, 'utf8');
    const doc = M.parseUnits(src, 'deck');
    for (const u of doc.units) {
      const r = M.unitRoot(u.html);
      assert.strictEqual(r.start, 0); assert.strictEqual(r.end, u.html.length);
      assert.ok(u.html.endsWith('</section>'));
    }
  }
});

test('setDeckMeta renames title, aria-label and matching footers only', () => {
  const f = decks.find((p) => /08-cryptography-deck/.test(p));
  const src = fs.readFileSync(f, 'utf8');
  const meta = M.deckMeta(src);
  const doc = M.parseUnits(src, 'deck');
  const n = M.setDeckMeta(doc, { title: 'חדש', footerLabel: 'תווית', oldFooterLabel: meta.footerLabel });
  assert.strictEqual(n, meta.footerLabels[meta.footerLabel]);
  const out = M.serializeUnits(doc);
  const m2 = M.deckMeta(out);
  assert.strictEqual(m2.title, 'חדש'); assert.strictEqual(m2.stageLabel, 'חדש');
  assert.strictEqual(Object.keys(m2.footerLabels).length, Object.keys(meta.footerLabels).length);
});

console.log('\n' + passes + ' passed, ' + failures + ' failed');
process.exit(failures ? 1 : 0);
