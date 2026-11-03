// Proves the single-file editor works with no network at all.
//   node editor/tests/offline.cjs            (from the repo root, after node editor/build-single.cjs)
//
// Every request the browser makes is recorded. Anything that is not local
// (file:, data:, blob:, about:, or the in-browser test origin of scenario B)
// fails the test, as does any Content-Security-Policy violation or page error.
//
//  A. The real use: editor/dist/instructbase-editor.html opened from file:// in a
//     browser context with the network switched off. The folder is opened with the
//     read-only picker (the only folder access a test can drive on file://), then:
//     every deck previewed with its scripts running, an edit in the preview, the
//     slide modal with an image from disk, save, a new lesson from the embedded
//     template, an index edit, "present in a new window", and a ZIP download.
//  B. The write path: the same file served by the test itself inside the browser
//     (route.fulfill, no network) from https://offline.invalid, so a real folder
//     handle (OPFS) can be written: edit + modal image + save, read back from disk.
//  C. An older Chrome/Edge (88-102) without CompressionStream('deflate-raw'): the
//     ZIP falls back to STORE and is still valid.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');
const M = require('../js/docmodel.js');

const ROOT = path.resolve(__dirname, '..', '..');
const SINGLE = path.join(ROOT, 'editor', 'dist', 'instructbase-editor.html');
const DECKS = execFileSync('bash', ['-c', 'ls */*/*-deck.html'], { cwd: ROOT }).toString().trim().split('\n');
const LOCAL = /^(file:|data:|blob:|about:)/;

let passed = 0, failed = 0;
async function step(name, fn) {
  try { await fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + String(e && e.stack || e).split('\n').slice(0, 4).join('\n      ')); }
}
function watch(ctx, allow) {
  const log = { external: [], csp: [], errors: [] };
  ctx.on('request', (r) => { const u = r.url(); if (!LOCAL.test(u) && !(allow && allow(u))) log.external.push(u); });
  ctx.on('page', (p) => attach(p, log));
  return log;
}
function attach(p, log) {
  p.on('pageerror', (e) => log.errors.push(e.message));
  p.on('console', (m) => { const t = m.text(); if (/Content Security Policy|Refused to/i.test(t)) log.csp.push(t); });
}
function makePng(W, H) {
  const zlib = require('zlib');
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = y * (W * 3 + 1) + 1 + x * 3; raw[o] = (x * 255 / W) | 0; raw[o + 1] = (y * 255 / H) | 0; raw[o + 2] = 90; }
  const crc = (b) => { let c = ~0; for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; } return (~c) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  const f = path.join(os.tmpdir(), 'ib-offline-photo.png');
  fs.writeFileSync(f, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  return f;
}
function zipOk(file) { return /No errors detected/.test(execFileSync('unzip', ['-t', file]).toString()); }

(async () => {
  assert.ok(fs.existsSync(SINGLE), 'build first: node editor/build-single.cjs');
  const IMG = makePng(1600, 900);
  // a lesson folder WITHOUT editor/: the new-lesson templates must come from inside the file
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ib-offline-repo-'));
  for (const f of ['index.html', ...DECKS, '.agents/guide-sources/01_net_guide_source.html']) {
    fs.mkdirSync(path.join(repo, path.dirname(f)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, f), path.join(repo, f));
  }
  const browser = await chromium.launch();

  /* ---------------- A ---------------- */
  const ctxA = await browser.newContext({ offline: true, acceptDownloads: true, viewport: { width: 1500, height: 900 } });
  const A = watch(ctxA);
  const page = await ctxA.newPage();
  attach(page, A);
  page.on('dialog', (d) => d.accept());
  const frame = () => page.frameLocator('.frame-wrap iframe').last();

  await step('A: opens from file:// with the network off', async () => {
    await page.goto('file://' + SINGLE);
    await page.waitForSelector('.welcome');
    assert.strictEqual(await page.evaluate(() => navigator.onLine), false);
  });
  await step('A: a lesson folder opens (read-only picker) and the library lists it', async () => {
    await page.setInputFiles('#fallback-input', repo);
    await page.waitForSelector('.home .card');
    assert.ok((await page.locator('.home .card').count()) >= 16);
  });
  await step('A: all 16 decks preview with their scripts running', async () => {
    for (const d of DECKS) {
      await page.evaluate((p) => window.IBApp.openDoc(p, { kind: 'deck' }), d);
      await page.waitForTimeout(1200);
      const n = await frame().locator('section.slide').count();
      assert.ok(n > 5, d + ': ' + n + ' slides in the preview');
    }
  });
  await step('A: edit in the preview, slide modal with an image from disk, save', async () => {
    const D = 'networks/01-layers-and-metrics/01-layers-and-metrics-deck.html';
    await page.evaluate((p) => window.IBApp.openDoc(p, { kind: 'deck' }), D);
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.IBApp.gotoUnit(window.IBApp.activeDoc(), 3));
    await page.waitForTimeout(400);
    await frame().locator('section.slide.active h1.title').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' מנותק');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.evaluate(() => window.IBApp.openSlideEditor(window.IBApp.activeDoc(), 3));
    await page.evaluate(() => window.IBSlideEditor.current.ready);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.se-palette button', { hasText: 'תמונה…' }).click()]);
    await fc.setFiles(IMG);
    await page.waitForFunction(() => window.IBSlideEditor.current.doc.querySelector('img[src^="data:image/jpeg"]'));
    await page.locator('.se-top button', { hasText: 'החלה וסגירה' }).click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);
    const r = await page.evaluate((p) => { const t = window.IBApp.serialize(window.IBApp.activeDoc()); return { changed: window.IBApp.state.fs.changed.has(p), title: t.includes(' מנותק</h1>'), img: t.includes('data:image/jpeg;base64,') }; }, D);
    assert.deepStrictEqual(r, { changed: true, title: true, img: true });
  });
  await step('A: new lesson from the templates embedded in the file', async () => {
    const ok = await page.evaluate(() => window.IBApp.createLesson({ track: { dir: 'radio', name: 'רדיו', ti: 0 }, num: '07', slug: 'offline-test', title: 'שיעור בדיקה', desc: 'תיאור.', badge: '', footer: 'שיעור 7 · בדיקה', src: 'template', withGuide: true, withIndex: true }));
    assert.strictEqual(ok, true);
    const has = await page.evaluate(() => ['radio/07-offline-test/07-offline-test-deck.html', '.agents/guide-sources/07_radio_guide_source.html'].map((p) => window.IBApp.state.fs.changed.has(p)));
    assert.deepStrictEqual(has, [true, true]);
  });
  await step('A: index edit and save', async () => {
    await page.evaluate(() => window.IBApp.openDoc('index.html', { kind: 'index' }));
    await page.waitForTimeout(400);
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(400);
    assert.ok(await page.evaluate(() => window.IBApp.state.fs.changed.has('index.html')));
  });
  await step('A: "present in a new window" runs the deck with no network', async () => {
    await page.evaluate(() => window.IBApp.openDoc('radio/06-monopole-fresnel-patterns/06-monopole-fresnel-patterns-deck.html', { kind: 'deck' }));
    await page.waitForTimeout(1200);
    const [pop] = await Promise.all([page.waitForEvent('popup'), page.locator('.toolbar button', { hasText: 'הצגה בחלון חדש' }).click()]);
    await pop.waitForTimeout(2000);
    const inner = pop.frames().find((f) => f !== pop.mainFrame());
    assert.ok(inner && (await inner.locator('section.slide').count()) > 20);
    await pop.close();
  });
  await step('A: ZIP of the changed files downloads and is valid', async () => {
    await page.locator('#btn-zip').click();
    await page.waitForSelector('dialog.dlg');
    await page.locator('dialog.dlg label.check input').check();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('dialog.dlg button', { hasText: 'יצירת ZIP' }).click()]);
    const out = path.join(os.tmpdir(), 'ib-offline-changes.zip');
    await dl.saveAs(out);
    assert.ok(zipOk(out));
    const list = execFileSync('unzip', ['-Z1', out]).toString().trim().split('\n').sort();
    assert.ok(list.includes('networks/01-layers-and-metrics/01-layers-and-metrics-deck.html') && list.includes('index.html'), list.join(','));
  });
  await step('A: no request left the machine, no CSP violation, no page error', async () => {
    assert.deepStrictEqual(A.external, [], 'external requests: ' + A.external.join(', '));
    assert.deepStrictEqual(A.csp, [], A.csp.join('\n'));
    assert.deepStrictEqual(A.errors, [], A.errors.join('\n'));
  });
  await ctxA.close();

  /* ---------------- B ---------------- */
  const ORIGIN = 'https://offline.invalid/';
  const ctxB = await browser.newContext({ offline: true, viewport: { width: 1500, height: 900 } });
  await ctxB.route('**/*', (route) => {
    const u = route.request().url();
    if (!u.startsWith(ORIGIN)) return route.abort();
    const p = path.join(ROOT, decodeURIComponent(new URL(u).pathname));
    if (!p.startsWith(ROOT) || !fs.existsSync(p)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream', body: fs.readFileSync(p) });
  });
  const B = watch(ctxB, (u) => u.startsWith(ORIGIN));
  const pb = await ctxB.newPage();
  attach(pb, B);
  pb.on('dialog', (d) => d.accept());
  const D = 'networks/01-layers-and-metrics/01-layers-and-metrics-deck.html';
  await step('B: served inside the browser, a real folder handle is written with no network', async () => {
    await pb.goto(ORIGIN + 'editor/dist/instructbase-editor.html');
    await pb.waitForSelector('.welcome');
    const files = {};
    for (const f of ['index.html', D]) files[f] = fs.readFileSync(path.join(ROOT, f), 'utf8');
    await pb.evaluate(async (files) => {
      const root = await navigator.storage.getDirectory();
      try { await root.removeEntry('repo', { recursive: true }); } catch (e) { /* first run */ }
      const repo = await root.getDirectoryHandle('repo', { create: true });
      for (const [f, text] of Object.entries(files)) {
        const parts = f.split('/'); const name = parts.pop(); let d = repo;
        for (const p of parts) d = await d.getDirectoryHandle(p, { create: true });
        const w = await (await d.getFileHandle(name, { create: true })).createWritable(); await w.write(text); await w.close();
      }
      window.__repo = repo;
      await window.IBApp.openWithHandle(repo);
    }, files);
    await pb.evaluate((p) => window.IBApp.openDoc(p, { kind: 'deck' }), D);
    await pb.waitForTimeout(1200);
    await pb.evaluate(() => window.IBApp.openSlideEditor(window.IBApp.activeDoc(), 4));
    await pb.evaluate(() => window.IBSlideEditor.current.ready);
    const [fc] = await Promise.all([pb.waitForEvent('filechooser'), pb.locator('.se-palette button', { hasText: 'תמונה…' }).click()]);
    await fc.setFiles(IMG);
    await pb.waitForFunction(() => window.IBSlideEditor.current.doc.querySelector('img[src^="data:image/jpeg"]'));
    await pb.locator('.se-top button', { hasText: 'החלה וסגירה' }).click();
    await pb.waitForTimeout(400);
    await pb.keyboard.press('Control+s');
    await pb.waitForTimeout(800);
    const disk = await pb.evaluate(async (p) => { const parts = p.split('/'); const name = parts.pop(); let d = window.__repo; for (const x of parts) d = await d.getDirectoryHandle(x); return (await (await d.getFileHandle(name)).getFile()).text(); }, D);
    assert.ok(disk.includes('data:image/jpeg;base64,'), 'image not saved to the folder');
    assert.deepStrictEqual(M.checkScripts(disk), []);
  });
  await step('B: no request left the browser, no CSP violation, no page error', async () => {
    assert.deepStrictEqual(B.external, [], 'external requests: ' + B.external.join(', '));
    assert.deepStrictEqual(B.csp, [], B.csp.join('\n'));
    assert.deepStrictEqual(B.errors, [], B.errors.join('\n'));
  });
  await ctxB.close();

  /* ---------------- C ---------------- */
  await step('C: older Chrome/Edge without deflate-raw still writes a valid ZIP (stored)', async () => {
    const ctx = await browser.newContext({ offline: true });
    await ctx.addInitScript(() => {
      const Orig = window.CompressionStream;
      window.CompressionStream = function (fmt) { if (fmt === 'deflate-raw') throw new TypeError("Unsupported compression format: 'deflate-raw'"); return new Orig(fmt); };
    });
    const p = await ctx.newPage();
    await p.goto('file://' + SINGLE);
    const b64 = await p.evaluate(async () => {
      const blob = await window.IBZip.makeZip([{ path: 'index.html', data: '<h1>שלום</h1>'.repeat(50) }, { path: 'תיקייה/קובץ.txt', data: 'עברית' }]);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); });
      return { b64: btoa(s), deflate: window.IBZip.canDeflate() };
    });
    assert.strictEqual(b64.deflate, false);
    const out = path.join(os.tmpdir(), 'ib-offline-stored.zip');
    fs.writeFileSync(out, Buffer.from(b64.b64, 'base64'));
    assert.ok(zipOk(out));
    await ctx.close();
  });

  await browser.close();
  fs.rmSync(repo, { recursive: true, force: true });
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
