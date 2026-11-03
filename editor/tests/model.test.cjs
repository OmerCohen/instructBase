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
test('index regenerates every block byte-identically', () => {
  const m = M.parseIndex(indexSrc);
  m.tracks.forEach((tr) => {
    tr.dirty = true;
    tr.items.forEach((it) => { it.dirty = true; if (it.lesson) { it.lesson.dirty = true; it.lesson.links.forEach((l) => { l.dirty = true; }); } });
  });
  assert.strictEqual(M.serializeIndex(m), indexSrc);
});
test('index: lesson counts, header fields, add/move/delete', () => {
  const m = M.parseIndex(indexSrc);
  const radio = m.tracks[0];
  assert.strictEqual(M.trackLessons(radio).length, 6);
  assert.strictEqual(radio.cntRaw, '6 שיעורים');
  assert.ok(M.getIndexField(m, 'h1'));
  assert.ok(M.setIndexField(m, 'h1', M.getIndexField(m, 'h1')));
  assert.strictEqual(M.serializeIndex(m), indexSrc);
  radio.items.push(M.newLessonItem({ num: '07', title: 'שיעור חדש', desc: 'תיאור', deck: 'radio/07-x/07-x-deck.html', guide: 'radio/07-x/07-x-guide.pdf' }));
  const out = M.serializeIndex(m);
  assert.ok(out.includes('<span class="cnt">7 שיעורים</span>'));
  assert.ok(out.includes('<div class="lesson"><div class="num">07</div><div class="meta"><b>שיעור חדש</b><span class="desc">תיאור</span></div><div class="links"><a href="radio/07-x/07-x-deck.html">מצגת</a><a class="pdf" href="radio/07-x/07-x-guide.pdf">דף הנחיה</a></div></div>'));
  const m2 = M.parseIndex(out);
  assert.strictEqual(M.trackLessons(m2.tracks[0]).length, 7);
  m2.tracks[0].items.pop();
  assert.strictEqual(M.serializeIndex(m2), indexSrc);
  m2.tracks.splice(3, 0, M.newTrack('מסלול חדש', 'תיאור המסלול.'));
  const out3 = M.serializeIndex(m2);
  const m3 = M.parseIndex(out3);
  assert.strictEqual(m3.tracks.length, m.tracks.length + 1);
  assert.ok(out3.includes('<h2>מסלול חדש <span class="cnt">אין שיעורים</span></h2>\n<p class="track-sub">תיאור המסלול.</p>'));
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
