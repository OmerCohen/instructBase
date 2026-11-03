// End-to-end test of the editor in headless Chromium.
// The repo files are copied into the browser's Origin Private File System, whose
// directory handle has the same API as a folder picked with showDirectoryPicker,
// so the editor runs its real read/write path.
//   node editor/tests/e2e.cjs            (from the repo root)
//   SHOTS=dir node editor/tests/e2e.cjs  (also save screenshots)
'use strict';
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const S = require('../js/htmlscan.js');
const M = require('../js/docmodel.js');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = process.env.SHOTS || '';
const FILES = [
  'index.html',
  'editor/templates/deck-template.html', 'editor/templates/guide-template.html',
  'networks/01-layers-and-metrics/01-layers-and-metrics-deck.html',
  'networks/01-layers-and-metrics/01-layers-and-metrics-guide.pdf',
  'networks/08-cryptography/08-cryptography-deck.html',
  'radio/06-monopole-fresnel-patterns/06-monopole-fresnel-patterns-deck.html',
  'devices/01-mq-710/01-mq-710-deck.html',
  '.agents/guide-sources/01_net_guide_source.html',
  '.agents/guide-sources/08_net_guide_source.html'
];

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      const ext = path.extname(p);
      res.writeHead(200, { 'content-type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.pdf': 'application/pdf' }[ext] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

let passed = 0, failed = 0;
async function step(name, fn) {
  try { await fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + (e && e.stack || e).toString().split('\n').slice(0, 4).join('\n      ')); }
}

(async () => {
  const srv = await serve();
  const base = 'http://localhost:' + srv.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('page: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.goto(base + '/editor/index.html');
  const shot = async (name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } };

  await step('welcome screen renders', async () => {
    await page.waitForSelector('.welcome');
    await shot('01-welcome');
  });

  await step('copy files into OPFS and open the folder', async () => {
    await page.evaluate(async (files) => {
      const root = await navigator.storage.getDirectory();
      try { await root.removeEntry('repo', { recursive: true }); } catch (e) { /* first run */ }
      const repo = await root.getDirectoryHandle('repo', { create: true });
      for (const f of files) {
        const parts = f.split('/'); const name = parts.pop();
        let d = repo;
        for (const p of parts) d = await d.getDirectoryHandle(p, { create: true });
        const buf = await (await fetch('/' + f)).arrayBuffer();
        const w = await (await d.getFileHandle(name, { create: true })).createWritable();
        await w.write(buf); await w.close();
      }
      window.__repo = repo;
      await window.IBApp.openWithHandle(repo);
    }, FILES);
    await page.waitForSelector('.home .card');
    const n = await page.locator('.home .card').count();
    assert.ok(n >= 16, 'cards: ' + n);
    await shot('02-home');
  });

  const readOPFS = (p) => page.evaluate(async (p) => {
    const parts = p.split('/'); const name = parts.pop();
    let d = window.__repo;
    for (const x of parts) d = await d.getDirectoryHandle(x);
    return (await (await d.getFileHandle(name)).getFile()).text();
  }, p);
  const existsOPFS = (p) => page.evaluate(async (p) => {
    try { const parts = p.split('/'); const name = parts.pop(); let d = window.__repo; for (const x of parts) d = await d.getDirectoryHandle(x); await d.getFileHandle(name); return true; } catch (e) { return false; }
  }, p);

  const DECK = 'networks/01-layers-and-metrics/01-layers-and-metrics-deck.html';
  const orig = fs.readFileSync(path.join(ROOT, DECK), 'utf8');

  await step('open a deck: rail, preview, side panel', async () => {
    await page.evaluate((p) => window.IBApp.openDoc(p, { kind: 'deck' }), DECK);
    await page.waitForSelector('.units li');
    assert.strictEqual(await page.locator('.units li').count(), 15);
    await page.waitForFunction(() => { const f = document.querySelector('.frame-wrap iframe'); return f && f.contentDocument === null; });
    await page.waitForTimeout(800);
  });

  const frame = () => page.frameLocator('.frame-wrap iframe').last();

  await step('navigate to slide 4 from the rail; preview follows', async () => {
    await page.locator('.units li').nth(3).locator('.u-main').click();
    await page.waitForTimeout(400);
    const active = await frame().locator('section.slide.active h1.title').textContent();
    assert.strictEqual(active, 'בצד היעד המעטפות נפתחות בסדר ההפוך');
    await shot('03-deck-editor');
  });

  await step('edit the title in the preview (click, type, Esc) changes only that element', async () => {
    const title = frame().locator('section.slide.active h1.title');
    await title.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' (נערך)');
    // typing a space or "n" must not move the deck
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const d = await page.evaluate(() => { const d = window.IBApp.activeDoc(); return { dirty: d.dirty, cur: d.cur, text: window.IBApp.serialize(d) }; });
    assert.ok(d.dirty, 'not dirty');
    assert.strictEqual(d.cur, 3, 'slide changed while typing');
    assert.ok(d.text.includes('<h1 class="title">בצד היעד המעטפות נפתחות בסדר ההפוך (נערך)</h1>'));
    // byte-identical outside the edited title
    const a = orig.indexOf('בצד היעד המעטפות נפתחות בסדר ההפוך') + 'בצד היעד המעטפות נפתחות בסדר ההפוך'.length;
    assert.strictEqual(d.text.slice(0, a), orig.slice(0, a));
    assert.strictEqual(d.text.slice(a + ' (נערך)'.length), orig.slice(a));
  });

  await step('bold and LTR formatting from the toolbar while editing in the preview', async () => {
    const sub = frame().locator('section.slide.active p.subtitle');
    await sub.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' ipconfig');
    // arrow keys move visually in RTL text, so select the word with a Range
    await sub.evaluate((el) => { const tn = [...el.childNodes].filter((n) => n.nodeType === 3).pop(); const i = tn.data.indexOf('ipconfig'); const r = document.createRange(); r.setStart(tn, i); r.setEnd(tn, i + 8); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    await page.locator('.toolbar button.tb', { hasText: 'LTR' }).click();
    await page.waitForTimeout(150);   // the command reaches the preview by postMessage
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const t = await page.evaluate(() => window.IBApp.serialize(window.IBApp.activeDoc()));
    assert.ok(t.includes('<p class="subtitle">המסגרת נגמרת בכרטיס הרשת, חבילת ה-IP עולה למערכת, והתוכן מגיע ליישום. <span class="ltr">ipconfig</span></p>'), 'ltr span missing');
    assert.ok(!/&nbsp;/.test(t.slice(t.indexOf('<p class="subtitle">המסגרת'), t.indexOf('ipconfig</span></p>'))), 'nbsp typed into source');
  });

  await step('side panel: speaker note edit reaches the source', async () => {
    const box = page.locator('.props .field', { hasText: 'הערות מדריך' }).locator('.rich');
    await box.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' הערה נוספת.');
    await page.locator('.props-title').click();
    await page.waitForTimeout(900);
    const t = await page.evaluate(() => window.IBApp.serialize(window.IBApp.activeDoc()));
    assert.ok(t.includes('הערה נוספת.</aside>'));
  });

  await step('add a slide from a layout, move it, renumbering follows', async () => {
    await page.locator('.rail-head button').click();
    await page.locator('.menu button', { hasText: 'שלושה כרטיסים' }).click();
    await page.waitForTimeout(500);
    let info = await page.evaluate(() => { const d = window.IBApp.activeDoc(); return { n: d.model.units.length, cur: d.cur }; });
    assert.strictEqual(info.n, 16); assert.strictEqual(info.cur, 4);
    await page.locator('.units li').nth(4).hover();
    await page.locator('.units li').nth(4).locator('button[title="הזזה למטה"]').click();
    await page.waitForTimeout(500);
    const t = await page.evaluate(() => window.IBApp.serialize(window.IBApp.activeDoc()));
    const doc = M.parseUnits(t, 'deck');
    assert.strictEqual(doc.units.length, 16);
    assert.deepStrictEqual(M.renumberDeck(doc, true), [], 'numbering not consistent');
    assert.ok(M.slideInfo(doc.units[5].html).title === 'כותרת השקופית');
    await shot('04-after-insert');
  });

  await step('runtime-filled text is refused for visual editing', async () => {
    // slide 2 has demo cells filled by script; their source is empty so they are not marked
    await page.locator('.units li').nth(1).locator('.u-main').click();
    await page.waitForTimeout(400);
    const marked = await frame().locator('section.slide.active [data-ib]').count();
    const filled = await frame().locator('section.slide.active td.n01-st[data-ib]').count();
    assert.ok(marked > 5); assert.strictEqual(filled, 0);
  });

  await step('raw slide HTML: invalid HTML is rejected, valid HTML applied', async () => {
    await page.locator('.props details.panel summary', { hasText: 'HTML של' }).click();
    const ta = page.locator('.props details.panel textarea.code').first();
    const html = await ta.inputValue();
    await ta.fill(html.replace('</section>', ''));
    await page.locator('.props details.panel button', { hasText: 'החלה' }).first().click();
    await page.waitForTimeout(200);
    let n = await page.evaluate(() => window.IBApp.activeDoc().model.units.length);
    assert.strictEqual(n, 16);
    await ta.fill(html.replace('חלוקת האחריות בין השכבות', 'חלוקת האחריות'));
    await page.locator('.props details.panel button', { hasText: 'החלה' }).first().click();
    await page.waitForTimeout(500);
    const t = await page.evaluate(() => window.IBApp.serialize(window.IBApp.activeDoc()));
    assert.ok(t.includes('<h1 class="title">חלוקת האחריות</h1>'));
  });

  await step('undo / redo', async () => {
    await page.locator('#btn-undo').click();
    let t = await page.evaluate(() => window.IBApp.serialize(window.IBApp.activeDoc()));
    assert.ok(t.includes('<h1 class="title">חלוקת האחריות בין השכבות</h1>'));
    await page.locator('#btn-redo').click();
    t = await page.evaluate(() => window.IBApp.serialize(window.IBApp.activeDoc()));
    assert.ok(t.includes('<h1 class="title">חלוקת האחריות</h1>'));
  });

  await step('save writes the file; scripts are byte-identical; a backup is kept', async () => {
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(800);
    const saved = await readOPFS(DECK);
    const scripts = (s) => S.qsa(S.scan(s), 'script').map((x) => S.inner(s, x));
    assert.deepStrictEqual(scripts(saved), scripts(orig));
    const doc = M.parseUnits(saved, 'deck');
    assert.strictEqual(doc.units.length, 16);
    assert.deepStrictEqual(M.checkScripts(saved), []);
    const dirty = await page.evaluate(() => window.IBApp.activeDoc().dirty);
    assert.strictEqual(dirty, false);
    const bak = await page.evaluate(async () => { const d = await window.__repo.getDirectoryHandle('.editor-backups'); const out = []; for await (const k of d.keys()) out.push(k); return out; });
    assert.strictEqual(bak.length, 1);
    assert.strictEqual(await readOPFS('.editor-backups/' + bak[0]), orig);
  });

  await step('a slide edit that breaks a script is blocked at save', async () => {
    await page.evaluate(() => {
      const d = window.IBApp.activeDoc();
      window.IBApp.change(d, () => { d.model.tail = d.model.tail.replace("'use strict';", "'use strict'; var = ;"); });
    });
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);
    assert.strictEqual(await page.evaluate(() => window.IBApp.activeDoc().dirty), true, 'should still be dirty');
    assert.ok(!(await readOPFS(DECK)).includes('var = ;'));
    await page.locator('#btn-undo').click();
  });

  await step('heavy decks load in the preview without errors (r06 WebGL bundle, n08, d01)', async () => {
    for (const p of ['radio/06-monopole-fresnel-patterns/06-monopole-fresnel-patterns-deck.html', 'networks/08-cryptography/08-cryptography-deck.html', 'devices/01-mq-710/01-mq-710-deck.html']) {
      await page.evaluate((p) => window.IBApp.openDoc(p, { kind: 'deck' }), p);
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.IBApp.gotoUnit(window.IBApp.activeDoc(), 8));
      await page.waitForTimeout(600);
      const idx = await frame().locator('section.slide').evaluateAll((s) => s.findIndex((x) => x.classList.contains('active')));
      assert.strictEqual(idx, 8, p + ' active ' + idx);
    }
    await shot('05-r06-or-n08');
  });

  await step('present opens a window whose deck cannot reach the editor', async () => {
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.locator('.toolbar button', { hasText: 'הצגה בחלון חדש' }).click()
    ]);
    await popup.waitForLoadState();
    const sandbox = await popup.locator('iframe').getAttribute('sandbox');
    assert.ok(!/allow-same-origin/.test(sandbox || ''), 'sandbox: ' + sandbox);
    const inner = popup.frames().find((f) => f !== popup.mainFrame());
    await inner.waitForSelector('section.slide');
    const probe = await inner.evaluate(() => { const r = {}; try { r.top = !!top.document; } catch (e) { r.top = 'blocked'; } try { r.idb = !!indexedDB.open('x'); } catch (e) { r.idb = 'blocked'; } r.opener = (function () { try { return top.opener === null ? 'null' : 'present'; } catch (e) { return 'blocked'; } })(); return r; });
    assert.strictEqual(probe.top, 'blocked');
    assert.strictEqual(probe.idb, 'blocked');
    await popup.close();
  });

  await step('guide source opens as pages and edits a paragraph', async () => {
    await page.evaluate(() => window.IBApp.openDoc('.agents/guide-sources/01_net_guide_source.html', { kind: 'guide' }));
    await page.waitForSelector('.units li');
    assert.strictEqual(await page.locator('.units li').count(), 8);
    await page.locator('.units li').nth(1).locator('.u-main').click();
    await page.waitForTimeout(600);
    const p = frame().locator('div.pg').nth(1).locator('p').first();
    await p.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' בדיקה.');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const t = await page.evaluate(() => window.IBApp.serialize(window.IBApp.activeDoc()));
    assert.ok(t.includes('שואל ״למה״. את הרקע לא מקריאים לכיתה. קחו ממנו מה שמתאים לקבוצה, ובמיוחד את הדוגמאות מהשטח. בדיקה.</p>'), 'edit not at paragraph end');
    assert.ok(!t.includes('&nbsp; בדיקה'));
    await shot('06-guide');
  });

  await step('index editor: edit a description, preview updates, save', async () => {
    await page.evaluate(() => window.IBApp.openDoc('index.html', { kind: 'index' }));
    await page.waitForSelector('.idx-lesson');
    const desc = page.locator('.idx-lesson .desc-in').first();
    await desc.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' עוד מילה.');
    await page.locator('.idx-track-head').first().click();
    await page.waitForTimeout(900);
    const t = await page.evaluate(() => window.IBApp.serialize(window.IBApp.activeDoc()));
    assert.ok(t.includes('שקצותיה פתוחים. עוד מילה.</span>'));
    const fr = await frame().locator('body').textContent();
    assert.ok(fr.includes('עוד מילה.'));
    await shot('07-index');
  });

  await step('new lesson wizard creates deck + guide source + index row', async () => {
    await page.evaluate(() => window.IBApp.openDoc('index.html', { kind: 'index' }));
    await page.locator('.idx-pane .toolbar button', { hasText: 'שיעור חדש' }).click();
    await page.waitForSelector('dialog.dlg');
    const dlg = page.locator('dialog.dlg');
    await dlg.locator('select').first().selectOption({ index: 0 });
    await dlg.locator('input[placeholder="radio-antenna-basics"]').fill('test-lesson');
    await dlg.locator('input[placeholder="שם השיעור"]').fill('שיעור בדיקה');
    await dlg.locator('input[placeholder="משפט או שניים לאינדקס"]').fill('תיאור בדיקה.');
    await shot('08-new-lesson');
    await dlg.locator('button', { hasText: 'יצירת השיעור' }).click();
    await page.waitForTimeout(1500);
    assert.ok(await existsOPFS('radio/07-test-lesson/07-test-lesson-deck.html'), 'deck not created');
    assert.ok(await existsOPFS('.agents/guide-sources/07_radio_guide_source.html'), 'guide source not created');
    const deck = await readOPFS('radio/07-test-lesson/07-test-lesson-deck.html');
    assert.strictEqual(M.deckMeta(deck).title, 'שיעור בדיקה');
    assert.deepStrictEqual(M.checkScripts(deck), []);
    const idx = await page.evaluate(() => window.IBApp.serialize(window.IBApp.state.docs.find((d) => d.path === 'index.html')));
    assert.ok(idx.includes('<div class="lesson"><div class="num">07</div><div class="meta"><b>שיעור בדיקה</b><span class="desc">תיאור בדיקה.</span></div><div class="links"><a href="radio/07-test-lesson/07-test-lesson-deck.html">מצגת</a></div></div>'));
    assert.ok(idx.includes('<span class="cnt">7 שיעורים</span>'));
    await shot('09-new-deck');
  });

  await step('ZIP of a folder subset is valid', async () => {
    const r = await page.evaluate(async () => {
      const fsx = window.IBApp.state.fs;
      const files = await fsx.list('networks');
      const entries = [];
      for (const f of files) entries.push({ path: f.path, data: await fsx.file(f.path) });
      const blob = await window.IBZip.makeZip(entries);
      const b = new Uint8Array(await blob.arrayBuffer());
      return { n: files.length, size: blob.size, sig: [b[0], b[1], b[2], b[3]], b64: btoa(String.fromCharCode.apply(null, b.subarray(0, 0))) };
    });
    assert.ok(r.n >= 3); assert.deepStrictEqual(r.sig, [0x50, 0x4b, 3, 4]);
  });

  /* ---- regressions from the 2026-11-03 independent review ---- */
  const D01 = 'devices/01-mq-710/01-mq-710-deck.html';
  const ser = () => page.evaluate(() => window.IBApp.serialize(window.IBApp.activeDoc()));

  await step('review #3: an edit still being typed survives a tab switch (draft is applied)', async () => {
    await page.evaluate((p) => window.IBApp.openDoc(p, { kind: 'deck' }), D01);
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.IBApp.gotoUnit(window.IBApp.activeDoc(), 3));
    await page.waitForTimeout(500);
    await frame().locator('section.slide.active h1.title').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' טיוטה');
    await page.waitForTimeout(100);
    // a programmatic click does not move focus out of the preview, so no commit is sent:
    // only the draft can carry the text across
    await page.evaluate(() => document.querySelector('#tabs button.tab').click());
    await page.waitForTimeout(200);
    const t = await page.evaluate((p) => window.IBApp.serialize(window.IBApp.state.docs.find((d) => d.path === p)), D01);
    assert.ok(t.includes(' טיוטה</h1>'), 'draft lost on tab switch');
    await page.evaluate((p) => window.IBApp.openDoc(p), D01);
    await page.waitForTimeout(1200);
  });

  await step('review #3: an edit still being typed survives a structural change from the rail', async () => {
    await page.evaluate(() => window.IBApp.gotoUnit(window.IBApp.activeDoc(), 4));
    await page.waitForTimeout(500);
    await frame().locator('section.slide.active h1.title').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' לפני הזזה');
    await page.waitForTimeout(100);
    await page.evaluate(() => window.IBApp.moveUnit(window.IBApp.activeDoc(), 4, 5));
    await page.waitForTimeout(600);
    const t = await ser();
    const doc = M.parseUnits(t, 'deck');
    assert.ok(M.slideInfo(doc.units[5].html).title.endsWith('לפני הזזה'), 'draft lost on move: ' + M.slideInfo(doc.units[5].html).title);
    assert.deepStrictEqual(M.renumberDeck(doc, true), []);
  });

  await step('review #1: an edit made while a slow save is writing stays dirty', async () => {
    const r = await page.evaluate(async (p) => {
      const app = window.IBApp, d = app.activeDoc(), fsx = app.state.fs, orig = fsx.write.bind(fsx);
      fsx.write = async (path, data) => { await new Promise((res) => setTimeout(res, 400)); return orig(path, data); };
      app.change(d, () => { d.model.units[2].html = window.IBModel.setField(d.model.units[2].html, 'title', 'גרסה A'); });
      const saving = app.saveDoc(d);
      await new Promise((res) => setTimeout(res, 150));
      app.change(d, () => { d.model.units[2].html = window.IBModel.setField(d.model.units[2].html, 'title', 'גרסה B'); });
      await saving;
      fsx.write = orig;
      const disk = await fsx.readText(p);
      return { dirty: d.dirty, diskHasA: disk.includes('>גרסה A</h1>'), modelHasB: app.serialize(d).includes('>גרסה B</h1>') };
    }, D01);
    assert.deepStrictEqual(r, { dirty: true, diskHasA: true, modelHasB: true });
  });

  await step('review #2: in the full-source view the preview does not take edits', async () => {
    await page.locator('.toolbar button', { hasText: 'קוד מלא' }).click();
    await page.waitForTimeout(1200);
    await frame().locator('section.slide.active h1').first().click();
    await page.waitForTimeout(200);
    const editable = await frame().locator('[contenteditable="true"]').count();
    assert.strictEqual(editable, 0);
    await page.locator('.toolbar button', { hasText: 'חזרה לעורך החזותי' }).click();
    await page.waitForTimeout(1200);
  });

  await step('review #5/#6: an emptied subtitle stays editable; Enter at the end leaves no <br>', async () => {
    await page.evaluate(() => window.IBApp.gotoUnit(window.IBApp.activeDoc(), 6));
    await page.waitForTimeout(500);
    const sub = frame().locator('section.slide.active p.subtitle');
    await sub.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
    let t = await ser();
    let u = M.parseUnits(t, 'deck').units[6].html;
    assert.strictEqual(M.getField(u, 'subtitle'), '');
    assert.strictEqual(await frame().locator('section.slide.active p.subtitle[data-ib]').count(), 1, 'empty subtitle not editable');
    await frame().locator('section.slide.active p.subtitle').click();
    await page.keyboard.type('שורה');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    t = await ser();
    u = M.parseUnits(t, 'deck').units[6].html;
    assert.strictEqual(M.getField(u, 'subtitle'), 'שורה');
  });

  await step('review #7: duplicating a live slide strips the ids in the copy', async () => {
    const before = M.parseUnits(await ser(), 'deck');
    const live = before.units.findIndex((x, i) => i > 0 && M.hasIds(x.html));
    assert.ok(live > 0, 'no live slide with ids');
    await page.evaluate((i) => window.IBApp.gotoUnit(window.IBApp.activeDoc(), i), live);
    await page.waitForTimeout(300);
    await page.locator('.units li').nth(live).hover();
    await page.locator('.units li').nth(live).locator('button[title="שכפול"]').click();
    await page.waitForTimeout(800);
    const after = M.parseUnits(await ser(), 'deck');
    assert.strictEqual(after.units.length, before.units.length + 1);
    // the original keeps its ids and content (only its footer counter moves on)
    const ids0 = (before.units[live].html.match(/\sid="[^"]+"/g) || []);
    assert.deepStrictEqual(after.units[live].html.match(/\sid="[^"]+"/g) || [], ids0);
    assert.strictEqual(M.slideInfo(after.units[live].html).title, M.slideInfo(before.units[live].html).title);
    assert.ok(!M.hasIds(after.units[live + 1].html), 'copy still has ids');
    const ids = (after.units.map((x) => x.html).join('').match(/\sid="[^"]+"/g) || []);
    assert.strictEqual(new Set(ids).size, ids.length, 'duplicate ids');
  });

  const relevant = errors.filter((e) => !/favicon|Failed to load resource/.test(e));
  await step('no page errors', async () => { assert.deepStrictEqual(relevant, []); });

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  await browser.close();
  srv.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
