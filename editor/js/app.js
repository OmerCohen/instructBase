/* app.js — the editor UI. Depends on htmlscan.js, docmodel.js, zip.js, fs.js, preview-agent.js. */
(function () {
  'use strict';
  var S = window.IBScan, M = window.IBModel, Z = window.IBZip, F = window.IBFS;

  /* ================================================================== */
  /* tiny DOM helpers                                                    */
  /* ================================================================== */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function btn(label, onclick, cls, title) { return h('button', { type: 'button', class: cls || '', title: title || null, onclick: onclick }, label); }
  function toolBtn(label, cmd, title) {
    // mousedown keeps the caret where it is, in the side panel or in the preview
    return h('button', { type: 'button', class: 'tb', title: title, onmousedown: function (e) { e.preventDefault(); }, onclick: function () { formatCmd(cmd); } }, label);
  }
  var toastEl;
  function toast(msg, kind, ms) {
    if (!toastEl) { toastEl = h('div', { class: 'toasts', 'aria-live': 'polite' }); document.body.appendChild(toastEl); }
    var t = h('div', { class: 'toast ' + (kind || '') }, msg);
    toastEl.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, ms || (kind === 'error' ? 7000 : 3500));
  }
  function fmtBytes(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n > 1024 ? Math.round(n / 1024) + ' KB' : n + ' B'; }
  function stamp(d) { d = d || new Date(); var p = M.pad; return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); }
  function dateStr(d) { d = d || new Date(); return d.getFullYear() + '-' + M.pad(d.getMonth() + 1) + '-' + M.pad(d.getDate()); }
  function download(blob, name) {
    var a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function pref(k, v) {
    try { if (v === undefined) return localStorage.getItem('ib.' + k); localStorage.setItem('ib.' + k, v); } catch (e) { return null; }
  }
  function esc(s) { return S.escapeText(s); }
  /* Hebrew count: count(1, 'קובץ אחד', 'קבצים') -> 'קובץ אחד', count(3, ...) -> '3 קבצים' */
  function count(n, one, many) { return n === 1 ? one : n + ' ' + many; }

  /* ================================================================== */
  /* rich-text helpers (shared with the slide edit modal: richtext.js)   */
  /* ================================================================== */
  var R = window.IBRich;
  var sanitize = R.sanitize, sameHtml = R.sameHtml, wrapIn = R.wrapIn, clearIn = R.clearIn;
  /* a contenteditable box bound to an HTML string */
  function richBox(html, onCommit, opts) {
    opts = opts || {};
    var orig = html, last = html, timer = null;
    var el = h('div', { class: 'rich' + (opts.cls ? ' ' + opts.cls : ''), contenteditable: 'true', dir: 'rtl', spellcheck: 'true', 'data-placeholder': opts.placeholder || '' });
    el.innerHTML = html;
    function commit() {
      clearTimeout(timer);
      var v = sanitize(el.innerHTML, orig);
      if (sameHtml(v, last)) return;
      last = v;
      onCommit(v);
    }
    el.addEventListener('keydown', function (e) {
      var mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Enter') { e.preventDefault(); if (opts.multiline) document.execCommand('insertLineBreak'); else el.blur(); return; }
      if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); wrapIn(el, 'strong'); }
      else if (mod && e.key.toLowerCase() === 'l') { e.preventDefault(); wrapIn(el, 'span', 'ltr'); }
      else if (mod && (e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'u')) e.preventDefault();
    });
    el.addEventListener('paste', function (e) { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\r?\n/g, ' ')); });
    el.addEventListener('drop', function (e) { e.preventDefault(); });
    el.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(commit, opts.delay || 600); });
    el.addEventListener('blur', commit);
    return el;
  }
  function formatCmd(cmd) {
    var a = document.activeElement;
    if (a && a.classList && a.classList.contains('rich')) {
      if (cmd === 'strong') wrapIn(a, 'strong');
      else if (cmd === 'ltr') wrapIn(a, 'span', 'ltr');
      else if (cmd === 'clear') clearIn(a);
      return;
    }
    var d = activeDoc();
    if (d && d.frame) sendPreview(d, { type: 'cmd', cmd: cmd });
  }

  /* ================================================================== */
  /* state                                                               */
  /* ================================================================== */
  var state = { fs: null, lib: null, docs: [], active: 'home', nextId: 1 };
  function activeDoc() { return state.docs.find(function (d) { return d.id === state.active; }) || null; }
  var SKIP_SCAN = { '.git': 1, 'node_modules': 1, '.editor-backups': 1, 'tmp': 1, 'archive': 1, 'techGame': 1, '.agents': 1, '.claude': 1, '.codex-remote-attachments': 1, 'editor': 1 };

  /* ---------- documents ---------- */
  function serialize(d) {
    if (d.kind === 'deck' || d.kind === 'guide') return M.serializeUnits(d.model);
    if (d.kind === 'index') return M.serializeIndex(d.model);
    return d.model.text;
  }
  function loadModel(d, text) {
    var kind = d.wantKind;
    if (kind === 'deck' || kind === 'guide') {
      var m = M.parseUnits(text, kind);
      if (m) { d.kind = kind; d.model = m; d.cur = Math.min(d.cur || 0, m.units.length - 1); return; }
    } else if (kind === 'index') {
      var im = M.parseIndex(text);
      if (im) { d.kind = 'index'; d.model = im; return; }
    }
    d.kind = 'raw'; d.model = { text: text };
  }
  /* An edit in progress in the preview reaches the editor as 'draft' messages.
     Anything that replaces the preview, reads the model or changes it applies
     the draft first, so a pending edit is never dropped by a reload or a tab switch. */
  function flushDraft(d) {
    if (!d || !d.draft) return;
    var x = d.draft; d.draft = null;
    applyEdit(d, x.id, x.html);
  }
  /* every mutation goes through here: undo snapshot, dirty flag, refresh */
  function change(d, fn, opts) {
    opts = opts || {};
    flushDraft(d);
    var before = serialize(d);
    fn();
    var after = serialize(d);
    if (after === before) return false;
    d.undo.push(before); if (d.undo.length > 60) d.undo.shift();
    d.redo = [];
    d.dirty = after !== d.diskText;
    afterChange(d, opts);
    return true;
  }
  function afterChange(d, opts) {
    renderTabs();
    if (state.active !== d.id) return;
    if (d.kind === 'index') { renderIndexForm(d, opts.keepForm); refreshIndexPreview(d); return; }
    if (d.kind === 'deck' || d.kind === 'guide') {
      renderRail(d);
      if (opts.reload) reloadPreview(d);
      if (!opts.keepProps) softProps(d);
      scheduleLint(d);
    }
  }
  /* re-render the side panel unless the user is typing in it */
  function softProps(d) {
    setTimeout(function () { if (d.propsEl && !d.propsEl.contains(document.activeElement)) renderProps(d); }, 0);
  }
  function undo(d) {
    if (!d) return;
    flushDraft(d);
    if (!d.undo.length) return;
    d.redo.push(serialize(d));
    loadModel(d, d.undo.pop());
    d.dirty = serialize(d) !== d.diskText;
    renderActive(true);
  }
  function redo(d) {
    if (!d) return;
    flushDraft(d);
    if (!d.redo.length) return;
    d.undo.push(serialize(d));
    loadModel(d, d.redo.pop());
    d.dirty = serialize(d) !== d.diskText;
    renderActive(true);
  }

  async function openDoc(path, opts) {
    opts = opts || {};
    var existing = state.docs.find(function (d) { return d.path === path; });
    if (existing) { activate(existing.id); return existing; }
    var text;
    try { text = await state.fs.readText(path); }
    catch (e) { toast('לא הצלחתי לקרוא את ' + path, 'error'); return null; }
    var d = { id: state.nextId++, path: path, diskText: text, origText: text, dirty: false, undo: [], redo: [], cur: opts.unit || 0, editing: true };
    d.wantKind = opts.kind || M.detectKind(path, text);
    loadModel(d, text);
    if (d.kind === 'raw' && d.wantKind !== 'raw') toast('לא זיהיתי את המבנה של הקובץ; נפתח לעריכת קוד', 'warn');
    state.docs.push(d);
    activate(d.id);
    return d;
  }
  function closeDoc(d) {
    flushDraft(d);
    if (d.dirty && !confirm('יש שינויים שלא נשמרו ב-' + d.path + '. לסגור בלי לשמור?')) return;
    state.docs = state.docs.filter(function (x) { return x !== d; });
    if (state.active === d.id) state.active = 'home';
    renderActive();
  }
  function activate(id) {
    var cur = activeDoc();
    if (cur) flushDraft(cur);
    state.active = id;
    renderActive();
  }

  /* ---------- saving ---------- */
  async function saveDoc(d) {
    if (!d) return false;
    if (d.saving) { d.saveAgain = true; return false; }   // one save at a time per document
    d.saving = true;
    try { return await saveDocNow(d); }
    finally {
      d.saving = false;
      if (d.saveAgain) { d.saveAgain = false; if (d.dirty) saveDoc(d); }
    }
  }
  async function saveDocNow(d) {
    var a = document.activeElement; if (a && a.classList && a.classList.contains('rich')) a.blur();
    flushDraft(d);
    var text = serialize(d);
    if (d.wantKind !== d.kind && d.wantKind !== 'raw' && !confirm('הקובץ ' + d.path + ' כבר לא מזוהה כ' + ({ deck: 'מצגת', guide: 'מקור דף הנחיה', index: 'אינדקס' })[d.wantKind] + ', ולכן הבדיקות של העורך החזותי לא חלות עליו. לשמור בכל זאת?')) return false;
    // gate: every inline script must still parse (house rule: never ship a dead script)
    var fails = M.checkScripts(text, d.origText);
    var newFails = fails.filter(function (f) { return f.changed; });
    if (newFails.length) {
      toast('השמירה נחסמה: סקריפט ' + (newFails[0].index + 1) + ' בקובץ לא עובר בדיקת תחביר (' + newFails[0].message + '). תקנו את הקוד או בטלו את השינוי.', 'error', 12000);
      return false;
    }
    if (d.kind === 'deck' || d.kind === 'guide') {
      var doc2 = M.parseUnits(text, d.kind);
      if (!doc2 || doc2.units.length !== d.model.units.length) { toast('השמירה נחסמה: מספר ה' + M.KINDS[d.kind].t.plural + ' אחרי השמירה לא תואם. בדקו את ה-HTML האחרון שהוחל.', 'error', 12000); return false; }
    }
    try {
      if (await state.fs.exists(d.path)) {
        var disk = await state.fs.readText(d.path);
        if (disk !== d.diskText && !confirm('הקובץ ' + d.path + ' השתנה בדיסק מאז שנפתח (אולי git pull או עורך אחר). לדרוס אותו?')) return false;
        if (pref('backup') !== '0' && state.fs.canWrite && disk) await backup(d.path, disk);
      }
      await state.fs.write(d.path, text);
    } catch (e) {
      toast('השמירה נכשלה: ' + (e && e.message || e), 'error', 10000);
      return false;
    }
    d.diskText = text;
    d.dirty = serialize(d) !== text;   // edits made while the file was being written stay unsaved
    renderTabs();
    if (state.fs.kind === 'memory') toast('נשמר בזיכרון הדפדפן. כדי לקבל את הקבצים, הורידו ZIP של השינויים.', 'warn');
    else toast('נשמר: ' + d.path, 'ok');
    if (fails.length) toast('שימו לב: ' + count(fails.length, 'סקריפט אחד', 'סקריפטים') + ' בקובץ לא עוברים בדיקת תחביר, גם לפני העריכה.', 'warn', 8000);
    if (d.kind === 'index' || /-deck\.html$/.test(d.path)) refreshLibrary();
    return true;
  }
  async function backup(path, text) {
    var name = '.editor-backups/' + path.replace(/\//g, '__') + '.' + stamp() + '.bak';
    await state.fs.write(name, text);
    try {
      var all = (await state.fs.list('.editor-backups', { skip: {}, maxDepth: 0 })).map(function (x) { return x.path; });
      var mine = all.filter(function (p) { return p.indexOf('.editor-backups/' + path.replace(/\//g, '__') + '.') === 0; }).sort();
      while (mine.length > 20) await state.fs.remove(mine.shift());
    } catch (e) { /* pruning is best effort */ }
  }
  async function saveAll() {
    for (var i = 0; i < state.docs.length; i++) if (state.docs[i].dirty) { if (!(await saveDoc(state.docs[i]))) return; }
  }

  /* ================================================================== */
  /* folder / library                                                    */
  /* ================================================================== */
  async function setFS(fs) {
    if (state.docs.some(function (d) { return d.dirty; }) && !confirm('יש מסמכים עם שינויים שלא נשמרו. להחליף תיקייה בלי לשמור?')) return;
    state.fs = fs; state.docs = []; state.active = 'home';
    await refreshLibrary(true);
    renderActive();
    if (!state.lib.indexModel) toast('לא נמצא index.html בתיקייה. פתחו את תיקיית השורש של המאגר (זו שיש בה index.html, radio, networks).', 'warn', 9000);
  }
  async function pickFolder() {
    if (!F.supported) { $('#fallback-input').click(); return; }
    try {
      var dir = await window.showDirectoryPicker({ id: 'instructbase', mode: 'readwrite' });
      var fs = new F.HandleFS(dir);
      if ((await fs.permission(true)) !== 'granted') { toast('בלי הרשאת כתיבה העורך לא יוכל לשמור.', 'error'); return; }
      try { await F.kvSet('lastDir', dir); } catch (e) { /* ignore */ }
      await setFS(fs);
    } catch (e) { if (e && e.name !== 'AbortError') toast('פתיחת התיקייה נכשלה: ' + e.message, 'error'); }
  }
  async function reopenLast() {
    var dir;
    try { dir = await F.kvGet('lastDir'); } catch (e) { dir = null; }
    if (!dir) return pickFolder();
    var fs = new F.HandleFS(dir);
    try { if ((await fs.permission(true)) !== 'granted') return; } catch (e) { return pickFolder(); }
    await setFS(fs);
  }
  async function refreshLibrary(quiet) {
    var fs = state.fs; if (!fs) return;
    var lib = { files: new Set(), indexModel: null };
    var entries = await fs.list('', { skip: SKIP_SCAN, maxDepth: 3 });
    entries.forEach(function (e) { lib.files.add(e.path); });
    (await fs.list('.agents/guide-sources', { maxDepth: 0 })).forEach(function (e) { lib.files.add(e.path); });
    (await fs.list('editor/templates', { maxDepth: 0 })).forEach(function (e) { lib.files.add(e.path); });
    if (lib.files.has('index.html')) {
      try { lib.indexText = await fs.readText('index.html'); lib.indexModel = M.parseIndex(lib.indexText); } catch (e) { lib.indexModel = null; }
    }
    var all = Array.from(lib.files);
    lib.decks = all.filter(function (p) { return /-deck\.html$/.test(p) && p.indexOf('editor/') !== 0; }).sort();
    lib.guideSources = all.filter(function (p) { return p.indexOf('.agents/guide-sources/') === 0 && /\.html$/.test(p); }).sort();
    lib.htmlFiles = all.filter(function (p) { return /\.html?$/i.test(p); }).sort();
    state.lib = lib;
    if (state.active === 'home') renderHome();
    if (!quiet) renderTabs();
  }
  function currentIndexModel() {
    var d = state.docs.find(function (x) { return x.path === 'index.html' && x.kind === 'index'; });
    return d ? d.model : state.lib && state.lib.indexModel;
  }
  /* lesson rows from the index, enriched with what exists on disk */
  function libraryLessons() {
    var m = currentIndexModel(), lib = state.lib, out = [];
    if (!m) return out;
    m.tracks.forEach(function (tr, ti) {
      var row = { name: S.decodeEntities(tr.name.replace(/<[^>]+>/g, '')).trim(), track: tr, ti: ti, lessons: [] };
      tr.items.forEach(function (it, ii) {
        if (it.kind !== 'lesson') return;
        var L = it.lesson, deck = null, pdf = null, other = [];
        L.links.forEach(function (l) {
          if (/-deck\.html$/.test(l.href)) deck = l.href;
          else if (/\.pdf$/i.test(l.href) && /guide/.test(l.href)) pdf = l.href;
          else other.push(l);
        });
        var info = { L: L, ii: ii, deck: deck, pdf: pdf, other: other, num: S.decodeEntities(L.num.replace(/<[^>]+>/g, '')), title: S.decodeEntities(L.title.replace(/<[^>]+>/g, '')) };
        if (deck) {
          var parts = deck.split('/');
          info.trackDir = parts[0];
          info.deckExists = lib.files.has(deck);
          var expectedPdf = deck.replace(/-deck\.html$/, '-guide.pdf');
          info.expectedPdf = expectedPdf;
          info.pdfExists = lib.files.has(pdf || expectedPdf);
          var nn = (/(\d+)-/.exec(parts[1] || '') || [])[1];
          info.guideSource = M.guideSourceCandidates(parts[0], nn).find(function (p) { return lib.files.has(p); }) || null;
        }
        row.lessons.push(info);
      });
      out.push(row);
    });
    return out;
  }
  function orphanDecks() {
    var m = currentIndexModel();
    var linked = new Set(m ? M.indexLinks(m).map(function (l) { return l.href; }) : []);
    return (state.lib ? state.lib.decks : []).filter(function (p) { return !linked.has(p); });
  }
  function brokenLinks() {
    var m = currentIndexModel(); if (!m || !state.lib) return [];
    return M.indexLinks(m).filter(function (l) { return M.isLocalHref(l.href) && !state.lib.files.has(l.href.split('#')[0]); });
  }

  /* ================================================================== */
  /* chrome: top bar and tabs                                            */
  /* ================================================================== */
  function renderTabs() {
    var bar = $('#tabs'); clear(bar);
    bar.appendChild(h('button', { type: 'button', class: 'tab' + (state.active === 'home' ? ' on' : ''), onclick: function () { activate('home'); } }, 'ספרייה'));
    state.docs.forEach(function (d) {
      var name = d.path.split('/').pop();
      var t = h('div', { class: 'tab' + (state.active === d.id ? ' on' : '') + (d.dirty ? ' dirty' : ''), title: d.path },
        h('button', { type: 'button', class: 'tab-main', onclick: function () { activate(d.id); } }, h('span', { class: 'kind k-' + d.kind }, ({ deck: 'מצגת', guide: 'הנחיה', index: 'אינדקס', raw: 'קוד' })[d.kind]), name, d.dirty ? h('i', { class: 'dot', title: 'לא נשמר' }) : null),
        h('button', { type: 'button', class: 'tab-x', title: 'סגירה', onclick: function () { closeDoc(d); } }, '×'));
      bar.appendChild(t);
    });
    var d = activeDoc();
    $('#btn-save').disabled = !d || !d.dirty;
    $('#btn-undo').disabled = !d || !d.undo.length;
    $('#btn-redo').disabled = !d || !d.redo.length;
    $('#folder').textContent = state.fs ? state.fs.name + (state.fs.kind === 'memory' ? ' (קריאה בלבד)' : '') : 'לא נפתחה תיקייה';
    var memChanged = state.fs && state.fs.kind === 'memory' ? state.fs.changed.size : 0;
    $('#mem-banner').hidden = !memChanged;
    $('#mem-count').textContent = memChanged;
    document.title = (state.docs.some(function (x) { return x.dirty; }) ? '• ' : '') + 'עורך חומרי הדרכה' + (state.fs ? ' · ' + state.fs.name : '');
  }
  function renderActive(reloadPreview) {
    renderTabs();
    var d = activeDoc(), main = $('#main');
    if (!d) { renderHome(); return; }
    if (d.kind === 'index' && d.view !== 'source') renderIndexEditor(d);
    else if ((d.kind === 'deck' || d.kind === 'guide') && d.view !== 'source') renderUnitEditor(d, reloadPreview);
    else renderSourceEditor(d);
    main.scrollTop = 0;
  }

  /* ================================================================== */
  /* home                                                                */
  /* ================================================================== */
  function renderHome() {
    var main = clear($('#main'));
    main.className = 'home';
    if (!state.fs) { main.appendChild(welcome()); return; }
    var lessons = libraryLessons();
    var head = h('div', { class: 'home-head' },
      h('div', null, h('h1', null, 'ספריית השיעורים'), h('p', { class: 'muted' }, 'מה שמופיע כאן נקרא מ-index.html ומהקבצים בתיקייה ', h('b', null, state.fs.name), '.')),
      h('div', { class: 'home-actions' },
        btn('עריכת האינדקס', function () { openDoc('index.html', { kind: 'index' }); }, 'primary'),
        btn('+ שיעור חדש', function () { newLessonDialog(); }, 'primary'),
        btn('פתיחת קובץ HTML…', openFileDialog),
        btn('הורדת ZIP…', zipDialog),
        btn('רענון', function () { refreshLibrary(); })));
    main.appendChild(head);
    if (!lessons.length) main.appendChild(h('p', { class: 'empty' }, 'לא נמצאו שיעורים באינדקס.'));
    lessons.forEach(function (tr) {
      var sec = h('section', { class: 'track' }, h('h2', null, tr.name, h('span', { class: 'cnt' }, tr.lessons.length + '')));
      var grid = h('div', { class: 'cards' });
      tr.lessons.forEach(function (x) {
        var chips = h('div', { class: 'chips' });
        if (x.deck) chips.appendChild(h('span', { class: 'chip ' + (x.deckExists ? 'ok' : 'bad') }, x.deckExists ? 'מצגת' : 'מצגת חסרה'));
        if (x.deck) chips.appendChild(h('span', { class: 'chip ' + (x.pdfExists ? 'ok' : 'bad') }, x.pdfExists ? 'PDF' : 'PDF חסר'));
        if (x.deck) chips.appendChild(h('span', { class: 'chip ' + (x.guideSource ? 'ok' : 'dim') }, x.guideSource ? 'מקור הנחיה' : 'אין מקור הנחיה'));
        if (x.deck && !x.pdf && x.pdfExists) chips.appendChild(h('span', { class: 'chip warn' }, 'PDF לא מקושר באינדקס'));
        var acts = h('div', { class: 'acts' });
        if (x.deck && x.deckExists) acts.appendChild(btn('עריכת המצגת', function () { openDoc(x.deck, { kind: 'deck' }); }, 'primary'));
        if (x.guideSource) acts.appendChild(btn('עריכת דף ההנחיה', function () { openDoc(x.guideSource, { kind: 'guide' }); }));
        if (x.guideSource) acts.appendChild(btn('הדפסה ל-PDF', function () { printGuidePath(x.guideSource, x.expectedPdf); }, '', 'פותח את מקור ההנחיה להדפסה. שמרו בשם ' + (x.expectedPdf || '')));
        if (x.deck && !x.pdf && x.pdfExists) acts.appendChild(btn('קישור ה-PDF באינדקס', function () { linkPdfInIndex(tr.ti, x.ii, x.expectedPdf); }));
        if (!x.deck) x.other.forEach(function (l) { if (M.isLocalHref(l.href) && /\.html?$/i.test(l.href)) acts.appendChild(btn('עריכת ' + S.decodeEntities(l.text.replace(/<[^>]+>/g, '')), function () { openDoc(l.href); })); });
        grid.appendChild(h('article', { class: 'card' },
          h('div', { class: 'card-top' }, h('span', { class: 'num' }, x.num), h('b', null, x.title)),
          h('p', { class: 'desc' }, S.decodeEntities(x.L.desc.replace(/<[^>]+>/g, ''))), chips, acts));
      });
      sec.appendChild(grid);
      main.appendChild(sec);
    });
    var orphans = orphanDecks(), broken = brokenLinks();
    if (orphans.length || broken.length) {
      var box = h('section', { class: 'track warnbox' }, h('h2', null, 'דורש תשומת לב'));
      if (broken.length) box.appendChild(h('div', null, h('h3', null, 'קישורים באינדקס לקבצים שלא קיימים'), h('ul', null, broken.map(function (l) { return h('li', null, h('code', null, l.href)); }))));
      if (orphans.length) box.appendChild(h('div', null, h('h3', null, 'מצגות שלא מקושרות מהאינדקס'), h('ul', null, orphans.map(function (p) { return h('li', null, h('code', null, p), ' ', btn('עריכה', function () { openDoc(p, { kind: 'deck' }); }, 'link')); }))));
      main.appendChild(box);
    }
    main.appendChild(h('section', { class: 'track' }, h('h2', null, 'מקורות דפי הנחיה'),
      h('p', { class: 'muted' }, 'דפי ההנחיה נבנים מקובצי HTML בתיקייה ', h('code', null, '.agents/guide-sources/'), '. עורכים את המקור, מדפיסים ל-PDF ב-Chrome ושומרים את ה-PDF בתיקיית השיעור.'),
      h('div', { class: 'filelist' }, state.lib.guideSources.map(function (p) { return btn(p.split('/').pop(), function () { openDoc(p, { kind: 'guide' }); }, 'file'); }))));
  }
  function welcome() {
    var supported = F.supported;
    return h('div', { class: 'welcome' },
      h('h1', null, 'עורך חומרי הדרכה'),
      h('p', { class: 'lead' }, 'טעינה, עריכה ושמירה של המצגות, מקורות דפי ההנחיה והאינדקס, ויצירת שיעורים חדשים בתבנית הבית.'),
      h('div', { class: 'welcome-actions' },
        btn('פתיחת תיקיית המאגר…', pickFolder, 'primary big'),
        supported ? btn('פתיחה מחדש של התיקייה האחרונה', reopenLast, 'big') : null),
      h('div', { class: 'note ' + (supported ? '' : 'warn') }, supported
        ? 'בחרו את תיקיית השורש של המאגר (זו שיש בה index.html). הדפדפן יבקש אישור לקריאה ולכתיבה; השמירה נעשית ישירות בקבצים.'
        : 'הדפדפן הזה לא תומך בכתיבה לתיקייה מקומית (File System Access). אפשר לפתוח תיקייה לקריאה, לערוך, ולהוריד את הקבצים ששונו כ-ZIP. לשמירה ישירה פתחו את העורך ב-Chrome או ב-Edge.'),
      h('div', { class: 'note' }, h('b', null, 'כדאי לדעת: '), 'העורך משנה רק את הקטע שערכתם. סקריפטים, סגנונות והדגמות חיות נשארים כמו שהם, ושמירה של קובץ שבו סקריפט לא עובר בדיקת תחביר נחסמת. ',
        'לפני כל שמירה נשמר עותק של הקובץ הקודם ב-', h('code', null, '.editor-backups/'), ' (עד 20 עותקים לקובץ).'));
  }
  async function linkPdfInIndex(ti, ii, href) {
    var d = await openDoc('index.html', { kind: 'index' });
    if (!d || d.kind !== 'index') return;
    change(d, function () {
      var L = d.model.tracks[ti].items[ii].lesson;
      L.links.push({ href: href, cls: 'pdf', text: 'דף הנחיה', extra: '', dirty: true });
      L.dirty = true;
    });
    toast('הקישור נוסף לאינדקס. בדקו ושמרו.', 'ok');
  }

  /* ================================================================== */
  /* unit editor (deck slides / guide pages)                             */
  /* ================================================================== */
  function unitName(d) { return M.KINDS[d.kind].unitName; }
  function T(d) { return M.KINDS[d.kind].t; }
  function renderUnitEditor(d, forceReload) {
    var main = clear($('#main'));
    main.className = 'editor';
    d.railEl = h('ol', { class: 'units' });
    d.propsEl = h('div', { class: 'props-body' });
    d.lintEl = h('ul', { class: 'lint' });
    var isDeck = d.kind === 'deck';
    var addBtn = btn('+ ' + unitName(d), function (e) { addUnitMenu(d, e.currentTarget); }, 'primary small');
    var rail = h('aside', { class: 'rail' },
      h('div', { class: 'rail-head' }, h('b', null, isDeck ? 'שקופיות' : 'עמודים'), h('span', { class: 'muted', id: 'unit-count' }), addBtn),
      d.railEl);
    var editToggle = h('label', { class: 'switch', title: 'כשמצב עריכה כבוי, ההדגמות במצגת מגיבות ללחיצות כרגיל' },
      h('input', { type: 'checkbox', checked: d.editing !== false, onchange: function (e) { d.editing = e.target.checked; sendPreview(d, { type: 'mode', editing: d.editing }); } }), ' מצב עריכה');
    var tools = h('div', { class: 'toolbar' },
      btn(isDeck ? 'עריכת השקופית' : 'עריכת העמוד', function () { openSlideEditor(d, d.cur); }, 'primary small', 'עורך חזותי במסך מלא: טקסט, בלוקים, טבלאות ותמונות'),
      h('span', { class: 'sep' }),
      editToggle,
      h('span', { class: 'sep' }),
      toolBtn('B', 'strong', 'הדגשה (Ctrl+B)'),
      toolBtn('LTR', 'ltr', 'עטיפה ב-<span class="ltr"> לטקסט באנגלית, פקודות ומספרים (Ctrl+L)'),
      toolBtn('ניקוי עיצוב', 'clear', 'הסרת עיצוב מהטקסט המסומן'),
      h('span', { class: 'sep' }),
      btn('‹ הקודם', function () { gotoUnit(d, d.cur - 1); }, 'small'),
      btn('הבא ›', function () { gotoUnit(d, d.cur + 1); }, 'small'),
      h('span', { class: 'grow' }),
      isDeck ? btn('הצגה בחלון חדש', function () { presentDoc(d); }, 'small') : btn('הדפסה ל-PDF', function () { printGuide(d); }, 'small'),
      btn('קוד מלא', function () { d.view = 'source'; renderActive(); }, 'small', 'עריכת קוד המקור של כל הקובץ (מתקדם)'));
    d.frameWrap = h('div', { class: 'frame-wrap' + (isDeck ? ' deck' : ' guide') });
    var center = h('section', { class: 'center' }, tools, d.frameWrap,
      h('p', { class: 'hint' }, 'לחצו על טקסט בתצוגה כדי לערוך אותו. Enter שובר שורה, Esc מסיים. את הטקסט שההדגמה כותבת בזמן ריצה, ואת התוויות בתוך איורי SVG, עורכים ב"HTML של ' + T(d).the + '".'));
    var props = h('aside', { class: 'props' }, d.propsEl,
      h('details', { class: 'panel', open: true }, h('summary', null, 'בדיקות לפי כללי הבית'), d.lintEl));
    main.appendChild(h('div', { class: 'ed-grid' }, rail, center, props));
    renderRail(d);
    renderProps(d);
    reloadPreview(d);
    scheduleLint(d, 0);
  }
  function renderRail(d) {
    if (!d.railEl) return;
    var rail = clear(d.railEl);
    var isDeck = d.kind === 'deck';
    var cnt = $('#unit-count'); if (cnt) cnt.textContent = d.model.units.length;
    d.model.units.forEach(function (u, i) {
      var info = isDeck ? M.slideInfo(u.html) : M.pageInfo(u.html);
      var li = h('li', { class: (i === d.cur ? 'on ' : '') + (info.isTitle ? 'title-unit' : ''), draggable: 'true', 'data-i': i },
        h('button', { type: 'button', class: 'u-main', onclick: function () { gotoUnit(d, i); }, ondblclick: function () { openSlideEditor(d, i); }, title: 'לחיצה כפולה: עריכה במסך מלא' },
          h('span', { class: 'u-n' }, i + 1),
          h('span', { class: 'u-t' }, h('b', null, info.title || '(ללא כותרת)'), info.eyebrow ? h('small', null, info.eyebrow) : null),
          h('span', { class: 'u-flags' },
            info.interactive ? h('i', { class: 'flag live', title: 'יש בשקופית הדגמה חיה (כפתורים/שדות/canvas)' }, 'חי') : null,
            isDeck && !info.hasNote ? h('i', { class: 'flag warn', title: 'אין הערות מדריך' }, 'הערות') : null)),
        h('span', { class: 'u-acts' },
          btn('✎', function () { openSlideEditor(d, i); }, 'icon', 'עריכה במסך מלא'),
          btn('↑', function () { moveUnit(d, i, i - 1); }, 'icon', 'הזזה למעלה'),
          btn('↓', function () { moveUnit(d, i, i + 1); }, 'icon', 'הזזה למטה'),
          btn('⧉', function () { duplicateUnit(d, i); }, 'icon', 'שכפול'),
          btn('🗑', function () { deleteUnit(d, i); }, 'icon danger', 'מחיקה')));
      li.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/x-ib-unit', String(i)); e.dataTransfer.effectAllowed = 'move'; li.classList.add('dragging'); });
      li.addEventListener('dragend', function () { li.classList.remove('dragging'); });
      li.addEventListener('dragover', function (e) { if (e.dataTransfer.types.indexOf('text/x-ib-unit') >= 0) { e.preventDefault(); li.classList.add('drop'); } });
      li.addEventListener('dragleave', function () { li.classList.remove('drop'); });
      li.addEventListener('drop', function (e) { e.preventDefault(); li.classList.remove('drop'); var from = +e.dataTransfer.getData('text/x-ib-unit'); if (from !== i) moveUnit(d, from, i); });
      rail.appendChild(li);
    });
    var on = rail.querySelector('li.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  }
  /* full-size visual editor for one slide/page (slide-editor.js) */
  function openSlideEditor(d, i) {
    if (!(d.kind === 'deck' || d.kind === 'guide') || !d.model.units[i]) return null;
    flushDraft(d);
    if (i !== d.cur) gotoUnit(d, i);
    var styles = S.qsa(S.scan(d.model.head), 'style').map(function (n) { return S.outer(d.model.head, n); }).join('');
    var n = d.model.units.length;
    return window.IBSlideEditor.open({
      kind: d.kind, html: d.model.units[i].html, styles: styles,
      title: (d.kind === 'deck' ? 'שקופית ' : 'עמוד ') + (i + 1) + ' מתוך ' + n + ' ·', file: d.path.split('/').pop(),
      hasPrev: i > 0, hasNext: i < n - 1,
      onApply: function (html) {
        change(d, function () { d.model.units[i].html = html; if (d.kind === 'deck') M.renumberDeck(d.model); }, { reload: true });
      },
      onSave: function () { saveDoc(d); },
      onNav: function (dir) { openSlideEditor(d, i + dir); },
      toast: toast
    });
  }
  function gotoUnit(d, i) {
    if (i < 0 || i >= d.model.units.length) return;
    d.cur = i;
    sendPreview(d, { type: 'goto', index: i });
    renderRail(d); renderProps(d);
  }
  function structural(d, fn, newCur) {
    change(d, function () { fn(); if (d.kind === 'deck') M.renumberDeck(d.model); if (newCur != null) d.cur = newCur; }, { reload: true });
    if (d.kind === 'deck' && !d.warnedRefs) {
      d.warnedRefs = true;
      toast('המספור בכותרות-העל ובתחתית עודכן. הפניות למספרי שקופיות בתוך הטקסט (בהערות המדריך ובדף ההנחיה) לא מתעדכנות לבד.', 'warn', 9000);
    }
  }
  function moveUnit(d, from, to) {
    if (to < 0 || to >= d.model.units.length || from === to) return;
    structural(d, function () { var u = d.model.units.splice(from, 1)[0]; d.model.units.splice(to, 0, u); }, to);
  }
  function duplicateUnit(d, i) {
    var u = d.model.units[i], html = u.html;
    if (M.hasIds(html)) {
      if (!confirm('יש ב' + T(d).the + ' הדגמה חיה. בעותק ההדגמה לא תפעל: המזהים (id) שלה מוסרים מהעותק, כדי שלא יתנגשו במקור. לשכפל בכל זאת?')) return;
      html = M.stripIds(html);
    }
    structural(d, function () { d.model.units.splice(i + 1, 0, { lead: u.lead || (d.kind === 'guide' ? '\n\n' : ''), html: html }); }, i + 1);
  }
  function deleteUnit(d, i) {
    if (d.model.units.length <= 1) { toast(T(d).only + ', ולכן אי אפשר למחוק.', 'warn'); return; }
    var info = d.kind === 'deck' ? M.slideInfo(d.model.units[i].html) : M.pageInfo(d.model.units[i].html);
    if (!confirm('למחוק את ' + unitName(d) + ' ' + (i + 1) + (info.title ? ' (' + info.title + ')' : '') + '?' + (info.interactive ? '\nיש בה הדגמה חיה. הסקריפט שלה נשאר בקובץ (הוא לא יפעל בלי השקופית), אבל אפשר לבטל את המחיקה עם Ctrl+Z.' : ''))) return;
    structural(d, function () { d.model.units.splice(i, 1); }, Math.min(i, d.model.units.length - 2));
  }
  function insertUnit(d, html, at) {
    structural(d, function () {
      var lead = d.kind === 'guide' ? '\n\n' : (d.model.units[Math.min(at, d.model.units.length - 1)] || {}).lead || '';
      d.model.units.splice(at, 0, { lead: lead, html: html });
    }, at);
  }
  function addUnitMenu(d, anchor) {
    closeMenus();
    var menu = h('div', { class: 'menu', role: 'menu' });
    var at = d.cur + 1;
    if (d.kind === 'deck') {
      M.LAYOUTS.forEach(function (l) {
        menu.appendChild(btn(l.name, function () { closeMenus(); insertUnit(d, M.newSlide(l.id, M.slideContext(d.model, at)), at); }));
      });
      menu.appendChild(btn('תמונה מקובץ…', function () {
        closeMenus();
        pickImage(function (src, name) { insertUnit(d, M.newSlide('image', M.slideContext(d.model, at), { imageSrc: src, imageAlt: name }), at); });
      }));
    } else {
      menu.appendChild(btn('עמוד ריק בתבנית דף ההנחיה', function () {
        closeMenus();
        insertUnit(d, '<div class="pg">\n  <div class="eyebrow">00 · פרק</div>\n  <h1>כותרת העמוד</h1><hr class="rule">\n  <h2>כותרת משנה</h2>\n  <p>טקסט.</p>\n</div>', at);
      }));
    }
    menu.appendChild(h('hr'));
    menu.appendChild(btn('שכפול ' + T(d).cur, function () { closeMenus(); duplicateUnit(d, d.cur); }));
    document.body.appendChild(menu);
    var r = anchor.getBoundingClientRect();
    menu.style.top = (r.bottom + 4) + 'px';
    menu.style.right = Math.max(8, innerWidth - r.right) + 'px';
    setTimeout(function () { document.addEventListener('click', closeMenus, { once: true }); }, 0);
  }
  function closeMenus() { document.querySelectorAll('.menu').forEach(function (m) { m.remove(); }); }

  /* ---------- side panel ---------- */
  var FIELD_LABELS = { eyebrow: 'כותרת-על', badge: 'תגית בשער', title: 'כותרת', subtitle: 'כותרת משנה', note: 'הערות מדריך (מקש N במצגת)' };
  var FIELD_SEL = { eyebrow: '.eyebrow', badge: '.badge', title: 'h1.title, h1', subtitle: 'p.subtitle, :scope > p', note: 'aside.speaker-note' };
  function renderProps(d) {
    if (!d.propsEl) return;
    var box = clear(d.propsEl);
    var i = d.cur, u = d.model.units[i];
    if (!u) return;
    var isDeck = d.kind === 'deck';
    box.appendChild(h('h3', { class: 'props-title' }, unitName(d) + ' ' + (i + 1) + ' מתוך ' + d.model.units.length));
    if (isDeck) {
      ['eyebrow', 'badge', 'title', 'subtitle', 'note'].forEach(function (f) {
        var v = M.getField(u.html, f);
        if (v == null) {
          if (f === 'note') box.appendChild(h('div', { class: 'field' }, h('label', null, FIELD_LABELS[f]), btn('+ הוספת הערות מדריך', function () { change(d, function () { d.model.units[i].html = M.setField(d.model.units[i].html, 'note', 'הערות למדריך.'); }); }, 'small')));
          return;
        }
        var multi = f === 'note';
        box.appendChild(h('div', { class: 'field' }, h('label', null, FIELD_LABELS[f]),
          richBox(v, function (val) { setUnitField(d, i, f, val); }, { multiline: multi, cls: multi ? 'tall' : '' })));
      });
    }
    var ta = h('textarea', { class: 'code', dir: 'ltr', spellcheck: 'false', rows: 14 });
    ta.value = u.html;
    var rawPanel = h('details', { class: 'panel', open: d.rawOpen != null ? d.rawOpen : !isDeck },
      h('summary', null, 'HTML של ' + T(d).the),
      ta,
      h('div', { class: 'row' },
        btn('החלה', function () { applyUnitHtml(d, i, ta.value); }, 'primary small'),
        btn('הוספת תמונה במקום הסמן…', function () { pickImage(function (src, name) { insertAtCursor(ta, '<img src="' + src + '" alt="' + S.escapeAttr(name) + '" style="max-width:100%;max-height:100%;object-fit:contain">'); }); }, 'small'),
        btn('ביטול שינויים בתיבה', function () { ta.value = d.model.units[i].html; }, 'small')),
      h('p', { class: 'muted small' }, 'כאן נערכים איורי SVG, טבלאות ותוכן שהעורך החזותי לא מגיע אליו. מזהים (id) של הדגמות חיות צריכים להישאר כמו שהם, אחרת הסקריפט לא ימצא אותם.'));
    rawPanel.addEventListener('toggle', function () { d.rawOpen = rawPanel.open; });
    box.appendChild(rawPanel);
    if (isDeck) box.appendChild(deckSettingsPanel(d));
  }
  function setUnitField(d, i, f, val) {
    var u = d.model.units[i];
    var changed = change(d, function () { u.html = M.setField(u.html, f, val); }, { keepProps: true });
    if (!changed) return;
    var n = M.fieldNode(u.html, f);
    if (n) sendPreview(d, { type: 'patch', unit: i, selector: FIELD_SEL[f], html: S.inner(u.html, n) });
    var sig = M.editableSignature(u.html, d.kind);
    if (sig !== (d.sigs && d.sigs[i])) reloadPreview(d);
  }
  function applyUnitHtml(d, i, html) {
    html = html.trim();
    var r = M.unitRoot(html);
    var ok = r && r.start === 0 && r.end === html.length && S.matches(r, M.KINDS[d.kind].unit);
    if (!ok) { toast('ה-HTML צריך להיות אלמנט ' + M.KINDS[d.kind].unit + ' אחד, סגור, בלי שום דבר לפניו או אחריו.', 'error', 9000); return; }
    var stray = [];
    S.walk(r, function (x) { if (x.implied && !/^(p|li|td|th|tr|dt|dd|option)$/.test(x.name)) stray.push(x.name); });
    if (stray.length) { toast('יש תגיות שלא נסגרו: ' + stray.slice(0, 5).join(', '), 'error', 9000); return; }
    if (S.qs(r, 'script')) toast('שימו לב: יש <script> בתוך ' + T(d).the + '. הוא ייבדק בשמירה.', 'warn');
    change(d, function () { d.model.units[i].html = html; if (d.kind === 'deck') M.renumberDeck(d.model); }, { reload: true });
  }
  function deckSettingsPanel(d) {
    var meta = M.deckMeta(serialize(d));
    var t = h('input', { type: 'text', value: meta.title, dir: 'rtl' });
    var f = h('input', { type: 'text', value: S.decodeEntities(meta.footerLabel), dir: 'rtl' });
    return h('details', { class: 'panel' }, h('summary', null, 'הגדרות המצגת'),
      h('div', { class: 'field' }, h('label', null, 'שם המצגת (כותרת הלשונית בדפדפן)'), t),
      h('div', { class: 'field' }, h('label', null, 'תווית התחתית (מופיעה בהדפסה)'), f),
      h('p', { class: 'muted small' }, 'התווית מוחלפת רק בשקופיות שבהן היא זהה לתווית הנפוצה (בקובץ ' + count(Object.keys(meta.footerLabels).length, 'תווית אחת', 'תוויות שונות') + ').'),
      btn('עדכון', function () {
        change(d, function () { M.setDeckMeta(d.model, { title: t.value.trim(), footerLabel: esc(f.value.trim()), oldFooterLabel: meta.footerLabel }); }, { reload: true });
      }, 'small primary'));
  }
  function insertAtCursor(ta, text) {
    var s = ta.selectionStart, e = ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
    ta.selectionStart = ta.selectionEnd = s + text.length; ta.focus();
  }
  /* image -> data: URI (house rule: decks are single self-contained files) */
  function pickImage(cb) {
    var inp = h('input', { type: 'file', accept: 'image/*' });
    inp.addEventListener('change', function () {
      var file = inp.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var max = 1600, w = img.naturalWidth, hh = img.naturalHeight;
          if ((w <= max && hh <= max && file.size < 350000) || file.type === 'image/svg+xml') { cb(reader.result, file.name.replace(/\.[^.]+$/, '')); return; }
          var k = Math.min(1, max / Math.max(w, hh));
          var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(hh * k);
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          var out = c.toDataURL('image/jpeg', 0.86);
          toast('התמונה הוקטנה ל-' + c.width + '×' + c.height + ' (' + fmtBytes(Math.round(out.length * 0.75)) + ') ונשמרת בתוך הקובץ.', 'ok');
          cb(out, file.name.replace(/\.[^.]+$/, ''));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
    inp.click();
  }

  /* ---------- lint ---------- */
  function scheduleLint(d, delay) {
    clearTimeout(d.lintTimer);
    d.lintTimer = setTimeout(function () { renderLint(d); }, delay == null ? 500 : delay);
  }
  function renderLint(d) {
    if (!d.lintEl) return;
    var list = clear(d.lintEl);
    var items = M.lintUnits(d.model);
    if (!items.length) { list.appendChild(h('li', { class: 'ok' }, 'אין ממצאים.')); return; }
    items.forEach(function (x) {
      list.appendChild(h('li', { class: x.level }, x.unit != null ? btn(unitName(d) + ' ' + (x.unit + 1), function () { gotoUnit(d, x.unit); }, 'link') : null, ' ', x.msg));
    });
  }

  /* ---------- preview ---------- */
  function buildPreview(d, withAgent) {
    var src = serialize(d);
    if (!withAgent) return src;
    var edits = [];
    d.sigs = [];
    if (d.kind === 'deck' || d.kind === 'guide') {
      d.model.units.forEach(function (u, i) {
        var off = M.unitOffset(d.model, i), r = M.unitRoot(u.html);
        if (!r) return;
        var list = M.editables(u.html, r, d.kind);
        d.sigs[i] = list.map(function (n) { return n.name; }).join(',');
        list.forEach(function (n, k) { var at = off + n.start + 1 + n.rawName.length; edits.push({ start: at, end: at, text: ' data-ib="' + i + ':' + k + '"' }); });
      });
    }
    var body = S.qs(S.scan(src), 'body');
    var at = body ? body.closeStart : src.length;
    var kind = d.kind === 'index' ? 'index' : d.kind === 'raw' ? 'raw' : d.kind;
    edits.push({ start: at, end: at, text: '<script>window.__IB_START=' + (d.cur | 0) + ';(' + window.IBPreviewAgent.toString() + ')(' + JSON.stringify(kind) + ');</' + 'script>' });
    return S.splice(src, edits);
  }
  function reloadPreview(d) {
    if (!d.frameWrap) return;
    var old = d.frame;
    var fr = h('iframe', { sandbox: 'allow-scripts allow-modals', allow: 'fullscreen', title: 'תצוגה מקדימה' });
    fr.srcdoc = buildPreview(d, true);
    d.frame = fr;
    d.draft = null;   // drafts belong to the old frame; change() applied them before the reload
    d.frameWrap.appendChild(fr);
    if (old) setTimeout(function () { old.remove(); }, 250);
    // in the full-source view the textarea is the only editor, so the preview is read-only
    fr.addEventListener('load', function () { sendPreview(d, { type: 'mode', editing: d.editing !== false && (d.kind === 'deck' || d.kind === 'guide') && d.view !== 'source' }); });
  }
  function sendPreview(d, msg) {
    if (!d.frame || !d.frame.contentWindow) return;
    msg.__ib = 2;
    d.frame.contentWindow.postMessage(msg, '*');
  }
  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || m.__ib !== 1) return;
    var d = state.docs.find(function (x) { return x.frame && x.frame.contentWindow === e.source; });
    if (!d) return;
    if (m.type === 'unit') {
      if ((d.kind === 'deck' || d.kind === 'guide') && m.index !== d.cur) { d.cur = m.index; renderRail(d); renderProps(d); }
    } else if (m.type === 'begin') onBegin(d, m);
    else if (m.type === 'draft') { if (m.id !== d.deniedId) d.draft = { id: m.id, html: m.html }; }
    else if (m.type === 'end') { if (d.draft && d.draft.id === m.id) d.draft = null; if (m.id === d.deniedId) d.deniedId = null; }
    else if (m.type === 'commit') onCommit(d, m);
    else if (m.type === 'hotkey') {
      if (m.key === 's') saveDoc(d);
      else if (m.key === 'z' && !m.shift) undo(d);
      else if (m.key === 'y' || (m.key === 'z' && m.shift)) redo(d);
    } else if (m.type === 'link') onPreviewLink(d, m.href);
  });
  function parseId(id) { var p = String(id).split(':'); return { unit: +p[0], k: +p[1] }; }
  function onBegin(d, m) {
    var id = parseId(m.id), u = d.model.units[id.unit];
    var srcInner = u && M.getEditableInner(u.html, d.kind, id.k);
    d.draft = null;
    if (srcInner == null || !sameHtml(srcInner, m.html, true)) {
      d.deniedId = m.id;
      sendPreview(d, { type: 'deny', id: m.id });
      toast('את הטקסט הזה ההדגמה כותבת בזמן ריצה, ולכן לא עורכים אותו בתצוגה. ערכו אותו ב"HTML של ' + T(d).the + '", או כבו את מצב העריכה כדי להפעיל את ההדגמה.', 'warn', 8000);
      return;
    }
    if (id.unit !== d.cur) { d.cur = id.unit; renderRail(d); renderProps(d); }
  }
  function onCommit(d, m) {
    if (d.draft && d.draft.id === m.id) d.draft = null;
    if (m.id === d.deniedId) return;
    applyEdit(d, m.id, m.html);
  }
  function applyEdit(d, rawId, html) {
    var id = parseId(rawId), u = d.model.units[id.unit];
    if (!u) return;
    var srcInner = M.getEditableInner(u.html, d.kind, id.k);
    if (srcInner == null) { toast('לא מצאתי את האלמנט שנערך; התצוגה תיטען מחדש.', 'error'); reloadPreview(d); return; }
    var v = sanitize(html, srcInner);
    if (sameHtml(v, srcInner)) return;
    var sigBefore = d.sigs && d.sigs[id.unit];
    change(d, function () { u.html = M.setEditableInner(u.html, d.kind, id.k, v); });
    if (M.editableSignature(u.html, d.kind) !== sigBefore) reloadPreview(d);
  }
  function onPreviewLink(d, href) {
    if (!href || !M.isLocalHref(href)) { if (href) toast('קישור חיצוני: ' + href); return; }
    // relative to the document that contains the link, not to the folder root
    var path;
    try { path = decodeURIComponent(new URL(href.split('#')[0], 'http://ib.invalid/' + d.path).pathname.slice(1)); }
    catch (e) { path = href.split('#')[0]; }
    if (/\.html?$/i.test(path) && state.lib && state.lib.files.has(path)) openDoc(path);
    else toast('הקישור מפנה אל ' + path + (state.lib && state.lib.files.has(path) ? '' : ' (לא נמצא בתיקייה)'), 'warn');
  }
  /* A new window that holds only a sandboxed iframe. The document runs in an
     opaque origin: it cannot reach the editor, its IndexedDB (where the folder
     handle is stored) or the folder. A blob: URL would run with the editor's
     origin, so it is not used here. */
  function openSandboxed(html, title) {
    var w = window.open('', '_blank');
    if (!w) { toast('הדפדפן חסם את החלון החדש. אפשרו חלונות קופצים לעורך ונסו שוב.', 'error'); return; }
    w.document.write('<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>' + esc(title || '') + '</title><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block}</style></head><body><iframe sandbox="allow-scripts allow-modals" allow="fullscreen"></iframe></body></html>');
    w.document.close();
    var fr = w.document.querySelector('iframe');
    fr.srcdoc = html;
    fr.addEventListener('load', function () { try { fr.focus(); } catch (e) { /* ignore */ } });
    try { w.opener = null; } catch (e) { /* ignore */ }
  }
  function presentDoc(d) { flushDraft(d); openSandboxed(serialize(d), M.deckMeta(serialize(d)).title); }
  function printHtml(html, target) {
    var t = S.qs(S.scan(html), 'body');
    var at = t ? t.closeStart : html.length;
    var withPrint = html.slice(0, at) + '<script>addEventListener("load",function(){setTimeout(function(){print()},500)})</' + 'script>' + html.slice(at);
    openSandboxed(withPrint, target ? target.split('/').pop().replace(/\.pdf$/, '') : '');
    toast('בחלון ההדפסה בחרו "שמירה כ-PDF"' + (target ? ' ושמרו בשם ' + target : '') + '. דפי ההנחיה נבדקו ב-Chrome; בדפדפן אחר המספור בתחתית עלול לא להופיע.', 'ok', 12000);
  }
  function printGuide(d) { flushDraft(d); printHtml(serialize(d), guidePdfTarget(d.path)); }
  async function printGuidePath(path, target) {
    var d = state.docs.find(function (x) { return x.path === path; });
    printHtml(d ? serialize(d) : await state.fs.readText(path), target);
  }
  function guidePdfTarget(path) {
    var m = /(\d+)_(?:(\w+)_)?guide_source\.html$/.exec(path);
    if (!m) return '';
    var x = libraryLessons();
    for (var t = 0; t < x.length; t++) for (var l = 0; l < x[t].lessons.length; l++) if (x[t].lessons[l].guideSource === path) return x[t].lessons[l].expectedPdf;
    return '';
  }

  /* ================================================================== */
  /* full-source editor (raw files, or a deck/guide in "קוד מלא")        */
  /* ================================================================== */
  function renderSourceEditor(d) {
    var main = clear($('#main'));
    main.className = 'editor';
    var ta = h('textarea', { class: 'code full', dir: 'ltr', spellcheck: 'false' });
    ta.value = serialize(d);
    d.frameWrap = h('div', { class: 'frame-wrap' + (d.kind === 'deck' || d.wantKind === 'deck' ? ' deck' : ' guide') });
    var back = (d.kind === 'deck' || d.kind === 'guide' || d.kind === 'index') ? btn('חזרה לעורך החזותי', function () { d.view = null; renderActive(); }, 'small') : null;
    main.appendChild(h('div', { class: 'src-grid' },
      h('section', { class: 'src-pane' },
        h('div', { class: 'toolbar' }, h('b', null, 'קוד המקור · ' + d.path), h('span', { class: 'grow' }),
          btn('החלה ותצוגה', function () { applySource(d, ta.value); }, 'primary small'), back),
        h('p', { class: 'warnline' }, 'עריכה כאן עוקפת את ההגנות של העורך החזותי. לפני שמירה כל סקריפט בקובץ עובר בדיקת תחביר, אבל לוגיקה שבורה לא תתגלה בה.'),
        ta),
      h('section', { class: 'center' }, d.frameWrap)));
    d.railEl = null; d.propsEl = null; d.lintEl = null;
    reloadPreview(d);
  }
  function applySource(d, text) {
    if (text === serialize(d)) return;
    var before = serialize(d);
    loadModel(d, text);
    d.undo.push(before); d.redo = [];
    d.dirty = text !== d.diskText;
    renderTabs();
    reloadPreview(d);
    if (d.kind === 'raw' && d.wantKind !== 'raw') toast('אחרי השינוי הקובץ כבר לא מזוהה כ' + ({ deck: 'מצגת', guide: 'מקור דף הנחיה', index: 'אינדקס' })[d.wantKind] + '. העורך החזותי והבדיקות שלו לא חלים עליו עד שהמבנה יחזור. אפשר לבטל עם Ctrl+Z.', 'warn', 10000);
    var fails = M.checkScripts(text, d.origText).filter(function (f) { return f.changed; });
    if (fails.length) toast('סקריפט ' + (fails[0].index + 1) + ' לא עובר בדיקת תחביר: ' + fails[0].message, 'error', 10000);
  }

  /* ================================================================== */
  /* index editor                                                        */
  /* ================================================================== */
  function renderIndexEditor(d) {
    var main = clear($('#main'));
    main.className = 'editor';
    d.formEl = h('div', { class: 'index-form' });
    d.frameWrap = h('div', { class: 'frame-wrap page' });
    main.appendChild(h('div', { class: 'idx-grid' },
      h('section', { class: 'idx-pane' },
        h('div', { class: 'toolbar' }, h('b', null, 'אינדקס השיעורים'), h('span', { class: 'grow' }),
          toolBtn('B', 'strong', 'הדגשה'), toolBtn('LTR', 'ltr', 'עטיפה ב-span.ltr'),
          btn('+ שיעור חדש', function () { newLessonDialog(); }, 'small primary'),
          btn('+ מסלול', function () { addTrack(d); }, 'small'),
          btn('קוד מלא', function () { d.view = 'source'; renderActive(); }, 'small')),
        d.formEl),
      h('section', { class: 'center' }, h('div', { class: 'toolbar' }, h('b', null, 'תצוגה מקדימה'), h('span', { class: 'muted small' }, 'לחיצה על קישור פותחת את הקובץ בעורך')), d.frameWrap)));
    renderIndexForm(d);
    refreshIndexPreview(d);
  }
  function refreshIndexPreview(d) {
    clearTimeout(d.previewTimer);
    d.previewTimer = setTimeout(function () { reloadPreview(d); }, 250);
  }
  function plainInput(value, onCommit, attrs) {
    var el = h('input', Object.assign({ type: 'text', value: value, dir: 'rtl' }, attrs || {}));
    el.addEventListener('change', function () { onCommit(el.value); });
    return el;
  }
  function renderIndexForm(d, keep) {
    if (!d.formEl || keep) return;
    var scrollTop = d.formEl.parentNode ? d.formEl.parentNode.scrollTop : 0;
    var form = clear(d.formEl), m = d.model;
    function fieldRow(label, key, multiline) {
      var v = M.getIndexField(m, key);
      if (v == null) return null;
      return h('div', { class: 'field' }, h('label', null, label),
        key === 'pageTitle' ? plainInput(S.decodeEntities(v), function (val) { change(d, function () { M.setIndexField(m, key, esc(val)); }); })
          : richBox(v, function (val) { change(d, function () { M.setIndexField(m, key, val); }, { keepForm: true }); }, { multiline: multiline }));
    }
    form.appendChild(h('details', { class: 'panel' }, h('summary', null, 'כותרת הדף, הסבר הניווט ותחתית'),
      fieldRow('כותרת הלשונית בדפדפן', 'pageTitle'), fieldRow('כותרת ראשית', 'h1'), fieldRow('שורת תיאור', 'sub'), fieldRow('שורת היחידה', 'unit'),
      fieldRow('הסבר הניווט', 'legend', true), fieldRow('תחתית הדף', 'footer', true)));
    m.tracks.forEach(function (tr, ti) {
      var lessons = M.trackLessons(tr);
      var card = h('section', { class: 'idx-track' });
      card.appendChild(h('div', { class: 'idx-track-head' },
        plainInput(S.decodeEntities(tr.name.trim()), function (val) { change(d, function () { tr.name = esc(val.trim()) + (tr.hasCnt ? ' ' : ''); tr.dirty = true; }); }, { class: 'track-name' }),
        tr.hasCnt ? h('span', { class: 'muted' }, M.cntText(lessons.length)) : h('span', { class: 'muted' }, 'ללא מונה'),
        h('span', { class: 'grow' }),
        btn('↑', function () { moveTrack(d, ti, ti - 1); }, 'icon', 'הזזת המסלול למעלה'),
        btn('↓', function () { moveTrack(d, ti, ti + 1); }, 'icon', 'הזזת המסלול למטה'),
        btn('🗑', function () { deleteTrack(d, ti); }, 'icon danger', 'מחיקת המסלול')));
      tr.items.forEach(function (it, ii) {
        if (it.kind === 'sub') {
          card.appendChild(h('div', { class: 'field' }, h('label', null, 'תיאור המסלול'),
            richBox(it.dirty ? it.html : rawInner(it.raw), function (val) { change(d, function () { it.html = val; it.dirty = true; }, { keepForm: true }); })));
        } else if (it.kind === 'order' || it.kind === 'raw') {
          var ta = h('textarea', { class: 'code', dir: 'ltr', rows: 3 }); ta.value = it.raw;
          card.appendChild(h('details', { class: 'panel' }, h('summary', null, it.kind === 'order' ? 'סדר העברה מומלץ (HTML)' : 'בלוק HTML'), ta,
            h('div', { class: 'row' }, btn('החלה', function () {
              var r = M.unitRoot(ta.value.trim());
              if (!r || r.end !== ta.value.trim().length) { toast('צריך אלמנט HTML אחד וסגור.', 'error'); return; }
              change(d, function () { it.raw = ta.value.trim(); });
            }, 'small primary'), btn('מחיקה', function () { change(d, function () { tr.items.splice(ii, 1); }); }, 'small danger'))));
        } else if (it.kind === 'lesson') card.appendChild(lessonRow(d, tr, ti, it, ii));
      });
      card.appendChild(h('div', { class: 'row' },
        btn('+ שיעור חדש במסלול', function () { newLessonDialog({ trackIndex: ti }); }, 'small'),
        btn('+ שורה ריקה', function () { change(d, function () { insertLessonItem(tr, M.newLessonItem({ num: M.pad(lessons.length + 1), title: 'שם השיעור', desc: 'תיאור קצר.' })); }); }, 'small'),
        orphanDecks().length ? btn('+ קישור למצגת קיימת…', function (e) { orphanMenu(d, tr, e.currentTarget); }, 'small') : null));
      form.appendChild(card);
    });
    if (d.formEl.parentNode) d.formEl.parentNode.scrollTop = scrollTop;
  }
  function rawInner(raw) { var r = M.unitRoot(raw); return r ? S.inner(raw, r) : raw; }
  function lessonRow(d, tr, ti, it, ii) {
    var L = it.lesson;
    function set(fn) { change(d, function () { fn(); L.dirty = true; }, { keepForm: true }); }
    var links = h('div', { class: 'links' });
    L.links.forEach(function (l, li) {
      var exists = !M.isLocalHref(l.href) || (state.lib && state.lib.files.has(l.href.split('#')[0]));
      links.appendChild(h('div', { class: 'link-row' + (exists ? '' : ' missing') },
        plainInput(S.decodeEntities(l.text.replace(/<[^>]+>/g, '')), function (v) { set(function () { l.text = esc(v); l.dirty = true; }); }, { class: 'lt', title: 'טקסט הכפתור' }),
        plainInput(l.href, function (v) { set(function () { l.href = v.trim(); l.dirty = true; }); renderIndexForm(d); }, { class: 'lh', dir: 'ltr', title: 'יעד הקישור (נתיב יחסי)' }),
        h('label', { class: 'small', title: 'עיצוב צהוב של קישור PDF' }, h('input', { type: 'checkbox', checked: /\bpdf\b/.test(l.cls), onchange: function (e) { set(function () { l.cls = e.target.checked ? 'pdf' : ''; l.dirty = true; }); } }), ' PDF'),
        exists ? null : h('span', { class: 'chip bad' }, 'הקובץ לא קיים'),
        btn('×', function () { set(function () { L.links.splice(li, 1); }); renderIndexForm(d); }, 'icon danger', 'הסרת הקישור')));
    });
    var deck = L.links.find(function (l) { return /-deck\.html$/.test(l.href); });
    return h('div', { class: 'idx-lesson' },
      h('div', { class: 'idx-lesson-head' },
        plainInput(S.decodeEntities(L.num), function (v) { set(function () { L.num = esc(v.trim()); }); }, { class: 'num-in', title: 'מספר' }),
        richBox(L.title, function (v) { set(function () { L.title = v; }); }, { cls: 'title-in' }),
        btn('↑', function () { moveLesson(d, ti, ii, -1); }, 'icon', 'למעלה'),
        btn('↓', function () { moveLesson(d, ti, ii, 1); }, 'icon', 'למטה'),
        deck && state.lib && state.lib.files.has(deck.href) ? btn('פתיחה', function () { openDoc(deck.href, { kind: 'deck' }); }, 'small') : null,
        btn('🗑', function () { if (confirm('להסיר את השורה מהאינדקס? הקבצים עצמם לא נמחקים.')) change(d, function () { tr.items.splice(ii, 1); }); }, 'icon danger', 'הסרה מהאינדקס')),
      richBox(L.desc, function (v) { set(function () { L.desc = v; }); }, { cls: 'desc-in', multiline: false }),
      links,
      btn('+ קישור', function () { set(function () { L.links.push({ href: '', cls: '', text: 'קישור', extra: '', dirty: true }); }); renderIndexForm(d); }, 'link small'));
  }
  function insertLessonItem(tr, item) {
    var lastLesson = -1, lastMeta = -1;
    tr.items.forEach(function (it, i) { if (it.kind === 'lesson') lastLesson = i; else if (it.kind === 'sub' || it.kind === 'order') lastMeta = i; });
    tr.items.splice((lastLesson >= 0 ? lastLesson : lastMeta) + 1, 0, item);
  }
  function moveLesson(d, ti, ii, dir) {
    var tr = d.model.tracks[ti];
    var j = ii + dir;
    while (j >= 0 && j < tr.items.length && tr.items[j].kind !== 'lesson') j += dir;
    if (j < 0 || j >= tr.items.length) return;
    change(d, function () { var a = tr.items[ii], b = tr.items[j]; var la = a.lead; a.lead = b.lead; b.lead = la; tr.items[ii] = b; tr.items[j] = a; });
  }
  function moveTrack(d, from, to) {
    if (to < 0 || to >= d.model.tracks.length) return;
    change(d, function () { var t = d.model.tracks.splice(from, 1)[0]; d.model.tracks.splice(to, 0, t); });
  }
  function deleteTrack(d, ti) {
    var tr = d.model.tracks[ti];
    if (M.trackLessons(tr).length) { toast('אפשר למחוק רק מסלול ריק. הסירו או העבירו קודם את השיעורים שלו.', 'warn'); return; }
    if (!confirm('למחוק את המסלול מהאינדקס?')) return;
    change(d, function () { d.model.tracks.splice(ti, 1); });
  }
  function trackInsertIndex(m) {
    var last = m.tracks[m.tracks.length - 1];
    return last && !last.hasCnt ? m.tracks.length - 1 : m.tracks.length;   // before "חומרי עזר"
  }
  function addTrack(d) {
    var name = prompt('שם המסלול (יופיע ככותרת באינדקס):');
    if (!name) return;
    change(d, function () { d.model.tracks.splice(trackInsertIndex(d.model), 0, M.newTrack(esc(name.trim()), 'תיאור קצר של המסלול.')); });
  }
  function orphanMenu(d, tr, anchor) {
    closeMenus();
    var menu = h('div', { class: 'menu' });
    orphanDecks().forEach(function (p) {
      menu.appendChild(btn(p, function () {
        closeMenus();
        var nn = (/\/(\d+)-[^/]*\/[^/]*$/.exec(p) || [])[1] || '00';
        var pdf = p.replace(/-deck\.html$/, '-guide.pdf');
        change(d, function () { insertLessonItem(tr, M.newLessonItem({ num: nn, title: 'שם השיעור', desc: 'תיאור קצר.', deck: p, guide: state.lib.files.has(pdf) ? pdf : null })); });
      }));
    });
    document.body.appendChild(menu);
    var r = anchor.getBoundingClientRect();
    menu.style.top = (r.bottom + 4) + 'px'; menu.style.right = Math.max(8, innerWidth - r.right) + 'px';
    setTimeout(function () { document.addEventListener('click', closeMenus, { once: true }); }, 0);
  }

  /* ================================================================== */
  /* dialogs                                                             */
  /* ================================================================== */
  function dialog(title, body, actions) {
    var dlg = h('dialog', { class: 'dlg' },
      h('form', { method: 'dialog' },
        h('h2', null, title), body,
        h('div', { class: 'dlg-actions' }, actions, btn('ביטול', function () { dlg.close(); }))));
    dlg.addEventListener('close', function () { setTimeout(function () { dlg.remove(); }, 0); });
    document.body.appendChild(dlg);
    dlg.showModal();
    return dlg;
  }
  function trackDirOf(tr) {
    for (var i = 0; i < tr.items.length; i++) {
      var it = tr.items[i];
      if (it.kind !== 'lesson') continue;
      for (var j = 0; j < it.lesson.links.length; j++) {
        var hr = it.lesson.links[j].href;
        if (/-deck\.html$/.test(hr)) return hr.split('/')[0];
      }
    }
    return '';
  }
  function nextNum(tr) {
    var max = 0;
    M.trackLessons(tr).forEach(function (it) { var n = parseInt(S.decodeEntities(it.lesson.num), 10); if (n > max) max = n; });
    return M.pad(max + 1);
  }

  async function newLessonDialog(opts) {
    opts = opts || {};
    if (!state.fs) { toast('קודם פותחים תיקייה.', 'warn'); return; }
    var m = currentIndexModel();
    var tracks = m ? m.tracks.map(function (tr, ti) { return { ti: ti, name: S.decodeEntities(tr.name.replace(/<[^>]+>/g, '')).trim(), dir: trackDirOf(tr), tr: tr }; }).filter(function (t) { return t.dir || t.tr.hasCnt; }) : [];
    var trackSel = h('select', null, tracks.map(function (t) { return h('option', { value: t.ti, selected: opts.trackIndex === t.ti }, t.name + (t.dir ? ' (' + t.dir + '/)' : '')); }), h('option', { value: 'new' }, 'מסלול חדש…'));
    var newName = h('input', { type: 'text', placeholder: 'שם המסלול בעברית' });
    var newDir = h('input', { type: 'text', dir: 'ltr', placeholder: 'folder-name' });
    var newSub = h('input', { type: 'text', placeholder: 'משפט שמתאר את המסלול' });
    var newTrackBox = h('fieldset', { class: 'sub', hidden: true }, h('legend', null, 'מסלול חדש'),
      h('label', null, 'שם', newName), h('label', null, 'תיאור', newSub));
    var dirBox = h('label', { hidden: true }, 'תיקיית המסלול (אותיות לטיניות קטנות, ספרות ומקפים)', newDir);
    var num = h('input', { type: 'text', dir: 'ltr', size: 4 });
    var slug = h('input', { type: 'text', dir: 'ltr', placeholder: 'radio-antenna-basics' });
    var title = h('input', { type: 'text', placeholder: 'שם השיעור', required: true });
    var desc = h('input', { type: 'text', placeholder: 'משפט או שניים לאינדקס' });
    var badge = h('input', { type: 'text', placeholder: 'למשל VHF, Windows, מכשירים' });
    var footer = h('input', { type: 'text' });
    var srcKind = 'template';
    var decks = (state.lib ? state.lib.decks : []);
    var dupSel = h('select', { disabled: true }, decks.map(function (p) { return h('option', { value: p }, p); }));
    var srcRadios = h('div', { class: 'radios' },
      h('label', null, h('input', { type: 'radio', name: 'src', checked: true, onchange: function () { srcKind = 'template'; dupSel.disabled = true; } }), ' תבנית הבית (שער, שקופית תוכן וסיכום)'),
      h('label', null, h('input', { type: 'radio', name: 'src', onchange: function () { srcKind = 'dup'; dupSel.disabled = false; } }), ' עותק של שיעור קיים, כולל ההדגמות שלו: '), dupSel);
    var withGuide = h('input', { type: 'checkbox', checked: true });
    var withIndex = h('input', { type: 'checkbox', checked: !!m });
    var paths = h('pre', { class: 'paths', dir: 'ltr' });
    var err = h('p', { class: 'err' });
    function curTrack() {
      if (trackSel.value === 'new') return { dir: newDir.value.trim(), name: newName.value.trim(), isNew: true };
      var t = tracks.find(function (x) { return String(x.ti) === trackSel.value; });
      return t ? { dir: t.dir || newDir.value.trim(), name: t.name, tr: t.tr, ti: t.ti, needsDir: !t.dir } : null;
    }
    function update() {
      var t = curTrack();
      newTrackBox.hidden = trackSel.value !== 'new';
      dirBox.hidden = !(t && (t.isNew || t.needsDir));
      if (!num.dataset.touched && t && t.tr) num.value = nextNum(t.tr);
      if (!num.dataset.touched && t && t.isNew) num.value = '01';
      if (!footer.dataset.touched) footer.value = 'שיעור ' + (parseInt(num.value, 10) || '') + ' · ' + (title.value || 'שם השיעור');
      var problems = [];
      if (!t || !t.dir) problems.push('צריך שם לתיקיית המסלול.');
      else if (!M.validSlug(t.dir)) problems.push('שם תיקיית המסלול: רק a-z, ספרות ומקפים.');
      if (!/^\d{1,3}$/.test(num.value.trim())) problems.push('מספר השיעור: ספרות בלבד.');
      if (!M.validSlug(slug.value.trim())) problems.push('המזהה באנגלית: אותיות לטיניות קטנות, ספרות ומקפים (הנתיבים בסט נשארים ASCII בגלל IIS).');
      if (!title.value.trim()) problems.push('חסר שם לשיעור.');
      err.textContent = problems.join(' ');
      if (t && t.dir && M.validSlug(slug.value.trim())) {
        var p = M.lessonPaths(t.dir, num.value, slug.value.trim());
        paths.textContent = p.deck + (withGuide.checked ? '\n' + p.guideSource : '');
      } else paths.textContent = '';
      return problems.length === 0;
    }
    [trackSel, newName, newDir, num, slug, title, desc, badge, footer, withGuide].forEach(function (el) { el.addEventListener('input', update); el.addEventListener('change', update); });
    num.addEventListener('input', function () { num.dataset.touched = '1'; });
    footer.addEventListener('input', function () { footer.dataset.touched = '1'; });
    if (opts.trackIndex != null) trackSel.value = String(opts.trackIndex);
    update();
    var body = h('div', { class: 'grid-form' },
      h('label', null, 'מסלול', trackSel), newTrackBox, dirBox,
      h('div', { class: 'two' }, h('label', null, 'מספר', num), h('label', null, 'מזהה באנגלית (לשמות הקבצים)', slug)),
      h('label', null, 'שם השיעור', title),
      h('label', null, 'תיאור לאינדקס', desc),
      h('div', { class: 'two' }, h('label', null, 'תגית בשער המצגת', badge), h('label', null, 'תווית התחתית', footer)),
      h('fieldset', null, h('legend', null, 'מקור המצגת'), srcRadios),
      h('label', { class: 'check' }, withGuide, ' ליצור גם מקור לדף הנחיה בתיקייה ', h('code', null, '.agents/guide-sources/')),
      h('label', { class: 'check' }, withIndex, ' להוסיף שורה לאינדקס (נפתח לבדיקה ולשמירה)'),
      h('div', null, h('b', null, 'קבצים שייווצרו:'), paths, h('p', { class: 'muted small' }, 'את ה-PDF של דף ההנחיה יוצרים אחר כך בהדפסה מהמקור, ושומרים אותו ליד המצגת בשם שמסתיים ב-', h('code', null, '-guide.pdf'), '.')), err);
    var createBtn = btn('יצירת השיעור', async function (e) {
      e.preventDefault();
      if (!update()) return;
      createBtn.disabled = true;
      try { if (await createLesson({ track: curTrack(), newTrackName: newName.value.trim(), newTrackSub: newSub.value.trim(), num: M.pad(parseInt(num.value, 10)), slug: slug.value.trim(), title: title.value.trim(), desc: desc.value.trim(), badge: badge.value.trim(), footer: footer.value.trim(), src: srcKind, dup: dupSel.value, withGuide: withGuide.checked, withIndex: withIndex.checked })) dlg.close(); }
      finally { createBtn.disabled = false; }
    }, 'primary');
    var dlg = dialog('שיעור חדש', body, createBtn);
  }

  async function readTemplate(path) {
    try { return await state.fs.readText(path); } catch (e) { return null; }
  }
  async function createLesson(o) {
    var fs = state.fs, t = o.track;
    var p = M.lessonPaths(t.dir, o.num, o.slug);
    if (await fs.dirExists(p.dir) || await fs.exists(p.deck)) { toast('התיקייה ' + p.dir + ' כבר קיימת. בחרו מספר או מזהה אחר.', 'error'); return false; }
    var src;
    if (o.src === 'dup') src = await fs.readText(o.dup);
    else {
      src = await readTemplate('editor/templates/deck-template.html');
      if (!src) { toast('לא מצאתי את editor/templates/deck-template.html בתיקייה. פתחו את שורש המאגר, או בחרו עותק של שיעור קיים.', 'error', 9000); return false; }
    }
    var deckText;
    try { deckText = M.instantiateDeck(src, { title: o.title, subtitle: o.desc || null, badge: o.badge || (t.isNew ? o.newTrackName : t.name) || null, footerLabel: esc(o.footer) }); }
    catch (e) { toast('יצירת המצגת נכשלה: ' + e.message, 'error'); return false; }
    await fs.write(p.deck, deckText);
    var made = [p.deck];
    if (o.withGuide) {
      if (await fs.exists(p.guideSource)) toast('מקור דף ההנחיה ' + p.guideSource + ' כבר קיים; לא דרסתי אותו.', 'warn', 8000);
      else {
        var gsrc = null;
        if (o.src === 'dup') {
          var parts = o.dup.split('/'), nn = (/(\d+)-/.exec(parts[1] || '') || [])[1];
          var cands = M.guideSourceCandidates(parts[0], nn);
          for (var i = 0; i < cands.length && !gsrc; i++) gsrc = await readTemplate(cands[i]);
        }
        if (!gsrc) gsrc = await readTemplate('editor/templates/guide-template.html');
        if (gsrc) {
          var trackName = t.isNew ? o.newTrackName : t.name;
          await fs.write(p.guideSource, M.instantiateGuide(gsrc, { title: o.title, footer: 'מחלקת תקשוב · ' + trackName + ' · שיעור ' + parseInt(o.num, 10), kick: 'מחלקת תקשוב · ' + trackName + ' · מדריך למעביר השיעור' }));
          made.push(p.guideSource);
        } else toast('לא נמצאה תבנית לדף ההנחיה (editor/templates/guide-template.html).', 'warn');
      }
    }
    if (o.withIndex) {
      var idx = await openDoc('index.html', { kind: 'index' });
      if (idx && idx.kind === 'index') {
        change(idx, function () {
          var tr;
          if (t.isNew) { tr = M.newTrack(esc(o.newTrackName || t.dir), esc(o.newTrackSub || 'תיאור קצר של המסלול.')); idx.model.tracks.splice(trackInsertIndex(idx.model), 0, tr); }
          else tr = idx.model.tracks[t.ti];
          insertLessonItem(tr, M.newLessonItem({ num: o.num, title: o.title, desc: o.desc, deck: p.deck, guide: null }));
        });
        toast('נוספה שורה לאינדקס (בלי קישור ל-PDF עד שיודפס). האינדקס עוד לא נשמר.', 'ok', 8000);
      }
    }
    await refreshLibrary(true);
    toast('נוצרו: ' + made.join(', '), 'ok', 8000);
    await openDoc(p.deck, { kind: 'deck' });
    return true;
  }

  function openFileDialog() {
    if (!state.lib) return;
    var filter = h('input', { type: 'search', placeholder: 'סינון…', dir: 'rtl' });
    var list = h('div', { class: 'filelist tall' });
    var files = state.lib.htmlFiles;
    function draw() {
      clear(list);
      var q = filter.value.trim().toLowerCase();
      files.filter(function (p) { return !q || p.toLowerCase().indexOf(q) >= 0; }).forEach(function (p) {
        list.appendChild(btn(p, function () { dlg.close(); openDoc(p); }, 'file'));
      });
    }
    filter.addEventListener('input', draw);
    var dlg = dialog('פתיחת קובץ HTML', h('div', null, filter, list, h('p', { class: 'muted small' }, 'מוצגים קובצי HTML עד עומק 3 תיקיות, בלי tmp, archive, techGame ו-.git. קובץ שאינו מצגת, מקור הנחיה או האינדקס נפתח לעריכת קוד.')), null);
    draw();
    filter.focus();
  }

  async function zipDialog() {
    if (!state.fs) return;
    var top = await state.fs.topLevel();
    var published = { 'index.html': 1, radio: 1, networks: 1, devices: 1, reference: 1 };
    var m = currentIndexModel();
    if (m) M.indexLinks(m).forEach(function (l) { if (M.isLocalHref(l.href)) published[l.href.split('/')[0]] = 1; });
    var never = { '.git': 1, '.editor-backups': 1, 'node_modules': 1 };
    var boxes = [];
    var list = h('div', { class: 'zip-list' }, top.filter(function (e) { return !never[e.name]; }).map(function (e) {
      var cb = h('input', { type: 'checkbox', value: e.name, checked: !!published[e.name] });
      boxes.push(cb);
      return h('label', null, cb, ' ', h('code', null, e.name + (e.kind === 'directory' ? '/' : '')), published[e.name] ? h('span', { class: 'chip ok' }, 'בסט המפורסם') : null, /^(\.agents|\.claude|tmp)$/.test(e.name) ? h('span', { class: 'chip warn' }, 'פנימי, לא לפרסום') : null);
    }));
    var onlyChanged = h('input', { type: 'checkbox' });
    var prog = h('progress', { max: 1, value: 0, hidden: true });
    var go = btn('יצירת ZIP', async function (e) {
      e.preventDefault();
      var picked = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
      go.disabled = true; prog.hidden = false;
      try {
        var files = [];
        if (onlyChanged.checked && state.fs.kind === 'memory') files = Array.from(state.fs.changed);
        else for (var i = 0; i < picked.length; i++) {
          var name = picked[i];
          if (await state.fs.exists(name)) files.push(name);
          else (await state.fs.list(name, { skip: never })).forEach(function (x) { files.push(x.path); });
        }
        if (!files.length) { toast('לא נבחרו קבצים.', 'warn'); return; }
        var entries = [];
        for (var k = 0; k < files.length; k++) {
          var f = await state.fs.file(files[k]);
          entries.push({ path: files[k], data: f, date: f.lastModified ? new Date(f.lastModified) : new Date() });
        }
        var blob = await Z.makeZip(entries, { onProgress: function (n, t) { prog.max = t; prog.value = n; } });
        download(blob, (state.fs.name || 'instructbase').replace(/[^\w.-]+/g, '-') + '-' + dateStr() + '.zip');
        toast('נוצר ZIP עם ' + count(files.length, 'קובץ אחד', 'קבצים') + ' (' + fmtBytes(blob.size) + ').', 'ok');
        dlg.close();
      } catch (err) { toast('יצירת ה-ZIP נכשלה: ' + (err && err.message || err), 'error'); }
      finally { go.disabled = false; }
    }, 'primary');
    var dlg = dialog('הורדת ZIP', h('div', null,
      h('p', { class: 'muted' }, 'הקבצים נקראים מהדיסק: שינויים שלא נשמרו לא ייכנסו. התיקיות שמסומנות מראש הן הסט שמתפרסם (מה שהאינדקס מקשר אליו).'),
      list,
      state.fs.kind === 'memory' ? h('label', { class: 'check' }, onlyChanged, ' רק הקבצים ששונו (' + state.fs.changed.size + ')') : null,
      h('p', { class: 'muted small' }, 'עותקים קפואים של החומר לפי תאריך, כולל ZIP מוכן, נמצאים ב-archive/.'),
      prog), go);
  }

  /* ================================================================== */
  /* boot                                                                */
  /* ================================================================== */
  function boot() {
    $('#btn-open').addEventListener('click', pickFolder);
    $('#btn-save').addEventListener('click', function () { saveDoc(activeDoc()); });
    $('#btn-undo').addEventListener('click', function () { undo(activeDoc()); });
    $('#btn-redo').addEventListener('click', function () { redo(activeDoc()); });
    $('#btn-zip').addEventListener('click', zipDialog);
    $('#btn-mem-zip').addEventListener('click', zipDialog);
    var bk = $('#opt-backup');
    bk.checked = pref('backup') !== '0';
    bk.addEventListener('change', function () { pref('backup', bk.checked ? '1' : '0'); });
    $('#fallback-input').addEventListener('change', function (e) { if (e.target.files.length) setFS(F.MemoryFS.fromFileList(e.target.files)); });
    document.addEventListener('keydown', function (e) {
      var mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      var k = e.key.toLowerCase();
      var inField = e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if (k === 's') { e.preventDefault(); if (e.shiftKey) saveAll(); else saveDoc(activeDoc()); }
      else if (!inField && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(activeDoc()); }
      else if (!inField && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(activeDoc()); }
    });
    window.addEventListener('beforeunload', function (e) { if (state.docs.some(function (d) { return d.dirty; })) { e.preventDefault(); e.returnValue = ''; } });
    renderTabs();
    renderHome();
  }

  window.IBApp = {
    state: state,
    openWithHandle: function (dir) { return setFS(new F.HandleFS(dir)); },
    openDoc: openDoc, saveDoc: saveDoc, openSlideEditor: openSlideEditor, serialize: serialize, activeDoc: activeDoc, createLesson: createLesson,
    change: change, gotoUnit: gotoUnit, insertUnit: insertUnit, moveUnit: moveUnit, deleteUnit: deleteUnit, refreshLibrary: refreshLibrary
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
