/* docmodel.js — document models for the editor.
 *
 *  - Unit documents: a deck is head + [slides] + tail, a guide source is
 *    head + [pages] + tail. Each unit keeps its own source string and the
 *    whitespace/comments in front of it ("lead"), so serialise(parse(x)) === x.
 *  - The index model keeps every block's raw source and regenerates only the
 *    blocks that were edited.
 *  - Lint follows the house rules recorded in agents.md and .agents/README.md.
 *
 * Pure string logic; runs in the browser and in Node (tests).
 */
(function (root) {
  'use strict';
  var S = root.IBScan || (typeof require === 'function' ? require('./htmlscan.js') : null);

  function set(words) { var o = Object.create(null); words.split(/\s+/).forEach(function (w) { if (w) o[w] = true; }); return o; }
  function pad(n, w) { var s = String(n); while (s.length < (w || 2)) s = '0' + s; return s; }
  function isWs(c) { return c === 32 || c === 9 || c === 10 || c === 13 || c === 12; }

  /* ------------------------------------------------------------------ */
  /* kinds                                                               */
  /* ------------------------------------------------------------------ */
  var KINDS = {
    deck: { unit: 'section.slide', label: 'מצגת', unitName: 'שקופית', t: { the: 'השקופית', plural: 'שקופיות', cur: 'השקופית הנוכחית', only: 'זו השקופית היחידה בקובץ' }, skip: set('speaker-note slide-mark footer eyebrow nav notes-panel kbd-hint motion-badge') },
    guide: { unit: 'div.pg', label: 'מקור דף הנחיה', unitName: 'עמוד', t: { the: 'העמוד', plural: 'עמודים', cur: 'העמוד הנוכחי', only: 'זה העמוד היחיד בקובץ' }, skip: set('') }
  };

  function detectKind(path, src) {
    if (/class="lesson"/.test(src) && /class="wrap"/.test(src) && /(^|\/)index\.html?$/i.test(path)) return 'index';
    if (/<section class="slide/.test(src) && /class="deck-root/.test(src)) return 'deck';
    if (/class="pg[ "]/.test(src)) return 'guide';
    return 'raw';
  }

  /* back over whitespace and comments, not below floor */
  function gapStart(src, pos, floor) {
    var p = pos;
    for (;;) {
      var q = p;
      while (q > floor && isWs(src.charCodeAt(q - 1))) q--;
      if (q - 3 >= floor && src.startsWith('-->', q - 3)) {
        var c = src.lastIndexOf('<!--', q - 3);
        if (c >= floor) { p = c; continue; }
      }
      return q;
    }
  }

  /* ------------------------------------------------------------------ */
  /* unit documents                                                      */
  /* ------------------------------------------------------------------ */
  function parseUnits(src, kind) {
    var conf = KINDS[kind];
    if (!conf) return null;
    var tree = S.scan(src);
    var all = S.qsa(tree, conf.unit);
    var units = all.filter(function (u) { for (var p = u.parent; p; p = p.parent) if (all.indexOf(p) >= 0) return false; return true; });
    if (!units.length) return null;
    var parent = units[0].parent;
    for (var k = 1; k < units.length; k++) if (units[k].parent !== parent) return null;
    units.sort(function (a, b) { return a.start - b.start; });
    var idx = parent.children.indexOf(units[0]);
    var floor0 = idx > 0 ? parent.children[idx - 1].end : parent.openEnd;
    var s0 = gapStart(src, units[0].start, floor0);
    var doc = { kind: kind, head: src.slice(0, s0), units: [], tail: src.slice(units[units.length - 1].end) };
    var prevEnd = s0;
    units.forEach(function (u) {
      doc.units.push({ lead: src.slice(prevEnd, u.start), html: src.slice(u.start, u.end) });
      prevEnd = u.end;
    });
    return doc;
  }
  function serializeUnits(doc) {
    var out = [doc.head];
    for (var k = 0; k < doc.units.length; k++) out.push(doc.units[k].lead, doc.units[k].html);
    out.push(doc.tail);
    return out.join('');
  }
  function unitRoot(html) {
    var t = S.scan(html);
    for (var k = 0; k < t.children.length; k++) if (t.children[k].name !== '#text') return t.children[k];
    return null;
  }
  /* absolute offset of unit k's html inside the serialised document */
  function unitOffset(doc, k) {
    var off = doc.head.length;
    for (var j = 0; j < k; j++) off += doc.units[j].lead.length + doc.units[j].html.length;
    return off + doc.units[k].lead.length;
  }

  /* ---------- editable text containers ---------- */
  var INLINE = set('a abbr b bdi bdo br cite code em i kbd mark q s samp small span strong sub sup time u var wbr');
  var CONTAINER = set('h1 h2 h3 h4 h5 h6 p li td th dt dd figcaption blockquote caption summary label legend div span b strong i em small a');
  /* headings and subtitles stay editable even when emptied, so they can be typed into again */
  function isTextField(node) {
    return /^h[1-6]$/.test(node.name) || (node.name === 'p' && S.hasClass(node, 'subtitle')) || S.hasClass(node, 'badge');
  }
  function qualifies(src, node) {
    if (node.foreign || !CONTAINER[node.name] || ('id' in node.attrs)) return false;
    var ok = true;
    S.walk(node, function (x) { if (!INLINE[x.name] || ('id' in x.attrs)) { ok = false; return false; } });
    if (!ok) return false;
    return isTextField(node) || S.text(src, node).trim() !== '';
  }
  function hasIds(html) {
    var r = unitRoot(html), found = false;
    if (r) S.walk({ children: [r] }, function (x) { if ('id' in x.attrs) found = true; });
    return found;
  }
  /* a duplicated slide must not repeat the ids its demo script binds to */
  function stripIds(html) {
    var r = unitRoot(html), edits = [];
    if (!r) return html;
    S.walk({ children: [r] }, function (x) { if ('id' in x.attrs) { var e = S.attrEdit(html, x, 'id', null); if (e) edits.push(e); } });
    return S.splice(html, edits);
  }
  function editables(src, unitNode, kind) {
    var skip = (KINDS[kind] || KINDS.deck).skip, out = [];
    (function rec(x) {
      for (var k = 0; k < x.children.length; k++) {
        var ch = x.children[k];
        if (ch.name === 'script' || ch.name === 'style' || ch.foreign) continue;
        var cls = S.classes(ch), skipped = false;
        for (var c = 0; c < cls.length; c++) if (skip[cls[c]]) { skipped = true; break; }
        if (skipped) continue;
        if (qualifies(src, ch)) { out.push(ch); continue; }
        rec(ch);
      }
    })(unitNode);
    return out;
  }
  function editableSignature(html, kind) {
    var u = unitRoot(html);
    return u ? editables(html, u, kind).map(function (n) { return n.name; }).join(',') : '';
  }
  function setEditableInner(html, kind, k, newInner) {
    var u = unitRoot(html);
    var list = editables(html, u, kind);
    var node = list[k];
    if (!node) throw new Error('editable ' + k + ' not found');
    return S.splice(html, [{ start: node.openEnd, end: node.closeStart, text: newInner }]);
  }
  function getEditableInner(html, kind, k) {
    var u = unitRoot(html);
    var node = editables(html, u, kind)[k];
    return node ? S.inner(html, node) : null;
  }

  /* ---------- named fields of a slide ---------- */
  function fieldNode(html, field) {
    var sec = unitRoot(html);
    if (!sec) return null;
    switch (field) {
      case 'title': return S.qs(sec, 'h1.title') || (S.hasClass(sec, 'title-slide') ? S.qs(sec, 'h1') : null);
      case 'subtitle': return S.qs(sec, 'p.subtitle') || (S.hasClass(sec, 'title-slide') ? S.childrenMatching(sec, 'p')[0] || null : null);
      case 'note': return S.qs(sec, 'aside.speaker-note');
      case 'eyebrow': return S.qs(sec, 'div.eyebrow');
      case 'badge': return S.hasClass(sec, 'title-slide') ? S.qs(sec, 'div.badge') : null;
    }
    return null;
  }
  function getField(html, field) {
    var n = fieldNode(html, field);
    if (!n) return null;
    if (field === 'eyebrow') {
      var num = S.childrenMatching(n, 'span.num')[0];
      if (num) return html.slice(num.end, n.closeStart);
    }
    return S.inner(html, n);
  }
  function setField(html, field, value) {
    var n = fieldNode(html, field);
    var sec = unitRoot(html);
    if (!n) {
      if (field === 'note') {
        var foot = S.childrenMatching(sec, 'div.footer')[0];
        var at = foot ? foot.start : sec.closeStart;
        return S.splice(html, [{ start: at, end: at, text: '<aside class="speaker-note">' + value + '</aside>' }]);
      }
      throw new Error('no field ' + field);
    }
    if (field === 'eyebrow') {
      var num = S.childrenMatching(n, 'span.num')[0];
      if (num) return S.splice(html, [{ start: num.end, end: n.closeStart, text: value }]);
    }
    return S.splice(html, [{ start: n.openEnd, end: n.closeStart, text: value }]);
  }
  /* index (in editables()) of a named field, or -1 */
  function fieldEditableIndex(html, kind, field) {
    var n = fieldNode(html, field);
    if (!n) return -1;
    var list = editables(html, unitRoot(html), kind);
    for (var k = 0; k < list.length; k++) if (list[k].start === n.start) return k;
    return -1;
  }

  function slideInfo(html) {
    var sec = unitRoot(html);
    if (!sec) return { title: '(שקופית לא תקינה)', eyebrow: '', isTitle: false, hasNote: false, interactive: false };
    var eb = fieldNode(html, 'eyebrow'), num = eb && S.childrenMatching(eb, 'span.num')[0];
    var t = fieldNode(html, 'title'), note = fieldNode(html, 'note');
    var ebText = '';
    if (eb) { ebText = S.textCompact(html, eb); if (num) ebText = ebText.replace(S.textCompact(html, num), '').trim(); }
    if (!ebText && S.hasClass(sec, 'title-slide')) { var bd = S.qs(sec, 'div.badge'); if (bd) ebText = S.textCompact(html, bd); }
    return {
      isTitle: S.hasClass(sec, 'title-slide'),
      num: num ? S.textCompact(html, num) : '',
      eyebrow: ebText,
      title: t ? S.textCompact(html, t) : '',
      hasNote: !!note && S.textCompact(html, note) !== '',
      interactive: !!S.qs(sec, 'button,input,select,canvas,textarea')
    };
  }
  function pageInfo(html) {
    var pg = unitRoot(html);
    if (!pg) return { title: '(עמוד לא תקין)', eyebrow: '' };
    var h1 = S.qs(pg, 'h1'), eb = S.qs(pg, 'div.eyebrow') || S.qs(pg, 'div.kick');
    return { isTitle: S.hasClass(pg, 'title-pg'), eyebrow: eb ? S.textCompact(html, eb) : '', title: h1 ? S.textCompact(html, h1) : (S.textCompact(html, pg).slice(0, 60)), hasNote: true, interactive: false };
  }

  /* ---------- deck numbering ---------- */
  /* footer "NN / total", eyebrow number = slide position counting the title
     slide as 0 (that is how all 16 shipped decks number them, including the
     part-2 slides of n08 and r06), and the no-JS active state */
  function renumberDeck(doc, dry) {
    var N = doc.units.length, changed = [];
    doc.units.forEach(function (u, i) {
      var html = u.html, sec = unitRoot(html), edits = [];
      if (!sec) return;
      var foot = S.childrenMatching(sec, 'div.footer')[0];
      if (foot) {
        var spans = S.childrenMatching(foot, 'span');
        var last = spans[spans.length - 1];
        if (last && /^\s*\d+\s*\/\s*\d+\s*$/.test(S.inner(html, last))) {
          var cur = S.inner(html, last), m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(cur);
          var want = pad(i + 1, Math.max(2, m[1].length)) + ' / ' + pad(N, Math.max(2, m[2].length));
          if (cur !== want) edits.push({ start: last.openEnd, end: last.closeStart, text: want });
        }
      }
      var eb = S.qs(sec, 'div.eyebrow');
      var num = eb && S.childrenMatching(eb, 'span.num')[0];
      if (num) {
        var w = S.inner(html, num);
        var want2 = pad(i, Math.max(2, w.trim().length));
        if (w !== want2) edits.push({ start: num.openEnd, end: num.closeStart, text: want2 });
      }
      var cls = S.classes(sec), isActive = cls.indexOf('active') >= 0, shouldBe = i === 0;
      if (isActive !== shouldBe) {
        var ncls = shouldBe ? cls.concat(['active']) : cls.filter(function (x) { return x !== 'active'; });
        edits.push(S.attrEdit(html, sec, 'class', ncls.join(' ')));
      }
      if ('aria-hidden' in sec.attrs && sec.attrs['aria-hidden'] !== String(!shouldBe)) edits.push(S.attrEdit(html, sec, 'aria-hidden', String(!shouldBe)));
      if (edits.length) {
        changed.push(i);
        if (!dry) u.html = S.splice(html, edits);
      }
    });
    return changed;
  }

  /* context for a new slide: slide-mark and footer copied from a neighbour */
  function slideContext(doc, at) {
    var order = [];
    for (var d = 0; d < doc.units.length; d++) { if (at - 1 - d >= 0) order.push(at - 1 - d); if (at + d < doc.units.length) order.push(at + d); }
    var ctx = { mark: '', footer: '' };
    for (var k = 0; k < order.length && (!ctx.mark || !ctx.footer); k++) {
      var html = doc.units[order[k]].html, sec = unitRoot(html);
      if (!sec || S.hasClass(sec, 'title-slide')) continue;
      var mk = S.childrenMatching(sec, 'div.slide-mark')[0];
      var ft = S.childrenMatching(sec, 'div.footer')[0];
      if (mk && !ctx.mark) ctx.mark = S.outer(html, mk);
      if (ft && !ctx.footer) ctx.footer = S.outer(html, ft);
    }
    if (!ctx.footer) ctx.footer = '<div class="footer"><span></span><span class="ltr">00 / 00</span></div>';
    return ctx;
  }

  var LAYOUTS = [
    { id: 'bullets', name: 'כותרת ותבליטים' },
    { id: 'cards2', name: 'שני כרטיסים' },
    { id: 'cards3', name: 'שלושה כרטיסים' },
    { id: 'split', name: 'טקסט ותמונה' },
    { id: 'table', name: 'טבלה' },
    { id: 'steps', name: 'שלבים בתהליך' },
    { id: 'key', name: 'מסר מרכזי' },
    { id: 'question', name: 'שאלה לכיתה' },
    { id: 'limits', name: 'מה ההדגמה לא אומרת' },
    { id: 'section', name: 'פתיחת חלק' },
    { id: 'blank', name: 'ריקה' }
  ];
  function card(tag, h, p, cls) { return '<div class="card' + (cls ? ' ' + cls : '') + '"><div class="tag">' + tag + '</div><h3>' + h + '</h3><p>' + p + '</p></div>'; }
  function newSlide(layout, ctx, opts) {
    opts = opts || {};
    var img = opts.imageSrc ? '<img src="' + S.escapeAttr(opts.imageSrc) + '" alt="' + S.escapeAttr(opts.imageAlt || '') + '" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:10px">' : '';
    if (layout === 'section') {
      return '<section class="slide title-slide p2" aria-hidden="true"><div class="badge">חלק ב׳</div><h1>כותרת החלק</h1><p>משפט שמסביר מה מגיע בחלק הזה.</p><aside class="speaker-note">מה אומרים במעבר בין החלקים.</aside>' + ctx.footer + '</section>';
    }
    var eyebrow = { limits: 'מגבלות', question: 'שאלה', key: 'מסר', steps: 'תהליך', table: 'השוואה' }[layout] || 'נושא';
    var title = { limits: 'מה ההדגמה לא אומרת', question: 'שאלה לכיתה', blank: 'כותרת השקופית' }[layout] || 'כותרת השקופית';
    var body;
    switch (layout) {
      case 'bullets': body = '<ul class="checklist"><li>נקודה ראשונה</li><li>נקודה שנייה</li><li>נקודה שלישית</li></ul>'; break;
      case 'cards2': body = '<div class="grid2">' + card('תגית', 'כותרת', 'הסבר קצר.') + card('תגית', 'כותרת', 'הסבר קצר.', 'amber') + '</div>'; break;
      case 'cards3': body = '<div class="grid3">' + card('תגית', 'כותרת', 'הסבר קצר.') + card('תגית', 'כותרת', 'הסבר קצר.', 'amber') + card('תגית', 'כותרת', 'הסבר קצר.', 'green') + '</div>'; break;
      case 'split': body = '<div class="split"><div class="stack"><p class="copy">פסקת הסבר. <strong>מה חשוב לזכור</strong> מודגש.</p><div class="key">המסר שהחניך צריך לקחת מהשקופית.</div></div><div class="visual">' + (img || '<div class="visual-label">כאן תמונה או תרשים</div>') + '</div></div>'; break;
      case 'table': body = '<table class="table"><tr><th>עמודה</th><th>עמודה</th><th>עמודה</th></tr><tr><td>שורה</td><td>ערך</td><td>ערך</td></tr><tr><td>שורה</td><td>ערך</td><td>ערך</td></tr><tr><td>שורה</td><td>ערך</td><td>ערך</td></tr></table>'; break;
      case 'steps': body = '<div class="steps"><div class="step"><strong>שלב</strong><span>מה עושים</span></div><div class="step"><strong>שלב</strong><span>מה עושים</span></div><div class="step"><strong>שלב</strong><span>מה עושים</span></div><div class="step"><strong>שלב</strong><span>מה עושים</span></div></div>'; break;
      case 'key': body = '<p class="copy">פסקת הסבר קצרה.</p><div class="key" style="margin-top:18px">המסר המרכזי של השקופית.</div>'; break;
      case 'question': body = '<div class="question">השאלה שמציגים לכיתה</div><div class="answer-row"><div class="answer"><strong>א</strong>תשובה אפשרית</div><div class="answer"><strong>ב</strong>תשובה אפשרית</div><div class="answer"><strong>ג</strong>תשובה אפשרית</div></div>'; break;
      case 'limits': body = '<table class="table"><tr><th>ההדגמה מראה</th><th>מה היא לא אומרת</th></tr><tr><td>מה המודל מחשב</td><td>מה הוא מזניח, ומה זה אומר בשטח</td></tr><tr><td>מה המודל מחשב</td><td>מה הוא מזניח, ומה זה אומר בשטח</td></tr></table>'; break;
      case 'image': body = '<div class="visual" style="flex:1">' + (img || '<div class="visual-label">כאן תמונה</div>') + '</div>'; break;
      default: body = '';
    }
    return '<section class="slide" aria-hidden="true">' + ctx.mark +
      '<div class="eyebrow"><span class="num">00</span>' + eyebrow + '</div>' +
      '<h1 class="title">' + title + '</h1>' +
      '<p class="subtitle">משפט אחד שמסביר מה רואים בשקופית.</p>' +
      '<div class="body">' + body + '</div>' +
      '<aside class="speaker-note">הערות למדריך: מה מסבירים ומה שואלים.</aside>' +
      ctx.footer + '</section>';
  }

  /* ---------- deck metadata ---------- */
  function deckMeta(src) {
    var t = S.scan(src);
    var title = S.qs(t, 'title'), stage = S.qs(t, 'main.stage');
    var labels = {};
    S.qsa(t, 'section.slide > div.footer').forEach(function (f) {
      var sp = S.childrenMatching(f, 'span')[0];
      if (sp) { var v = S.inner(src, sp); labels[v] = (labels[v] || 0) + 1; }
    });
    var common = Object.keys(labels).sort(function (a, b) { return labels[b] - labels[a]; })[0] || '';
    return {
      title: title ? S.decodeEntities(S.inner(src, title)) : '',
      stageLabel: stage ? (stage.attrs['aria-label'] || '') : '',
      footerLabels: labels,
      footerLabel: common
    };
  }
  /* rename a deck: <title>, stage aria-label, and footer labels equal to oldLabel */
  function setDeckMeta(doc, meta) {
    var head = S.scan(doc.head), edits = [];
    var title = S.qs(head, 'title');
    if (title && meta.title != null) edits.push({ start: title.openEnd, end: title.closeStart, text: S.escapeText(meta.title) });
    var stage = S.qs(head, 'main.stage');
    if (stage && meta.title != null && 'aria-label' in stage.attrs) edits.push(S.attrEdit(doc.head, stage, 'aria-label', meta.title));
    doc.head = S.splice(doc.head, edits);
    var n = 0;
    if (meta.footerLabel != null && meta.oldFooterLabel != null && meta.footerLabel !== meta.oldFooterLabel) {
      doc.units.forEach(function (u) {
        var sec = unitRoot(u.html); if (!sec) return;
        var f = S.childrenMatching(sec, 'div.footer')[0]; if (!f) return;
        var sp = S.childrenMatching(f, 'span')[0];
        if (sp && S.inner(u.html, sp) === meta.oldFooterLabel) { u.html = S.splice(u.html, [{ start: sp.openEnd, end: sp.closeStart, text: meta.footerLabel }]); n++; }
      });
    }
    return n;
  }
  /* turn a deck (template or an existing lesson) into a new lesson */
  function instantiateDeck(src, o) {
    var doc = parseUnits(src, 'deck');
    if (!doc) throw new Error('המקור אינו מצגת בתבנית הבית');
    var meta = deckMeta(src);
    setDeckMeta(doc, { title: o.title, footerLabel: o.footerLabel, oldFooterLabel: meta.footerLabel });
    if (o.keepSlides === false) {
      // keep the title slide only, plus one empty content slide and a summary slide
      var ctx = slideContext(doc, 1);
      doc.units = [doc.units[0],
        { lead: doc.units[1] ? doc.units[1].lead : '', html: newSlide('bullets', ctx) },
        { lead: doc.units[1] ? doc.units[1].lead : '', html: setField(setField(newSlide('steps', ctx), 'title', 'סיכום'), 'eyebrow', 'סיכום') }];
    }
    var t0 = doc.units[0].html;
    if (fieldNode(t0, 'title') && o.title != null) t0 = setField(t0, 'title', S.escapeText(o.title));
    if (fieldNode(t0, 'subtitle') && o.subtitle != null) t0 = setField(t0, 'subtitle', S.escapeText(o.subtitle));
    if (fieldNode(t0, 'badge') && o.badge != null) t0 = setField(t0, 'badge', S.escapeText(o.badge));
    doc.units[0].html = t0;
    renumberDeck(doc);
    return serializeUnits(doc);
  }
  /* guide source: retitle the <title>, the title page, and the @page footer string */
  function instantiateGuide(src, o) {
    var t = S.scan(src), edits = [];
    var title = S.qs(t, 'title');
    if (title) edits.push({ start: title.openEnd, end: title.closeStart, text: S.escapeText(o.title) });
    var style = S.qs(t, 'style');
    if (style && o.footer) {
      var css = S.inner(src, style);
      var m = /(@bottom-right\s*\{\s*content\s*:\s*")([^"]*)(")/.exec(css);
      if (m) { var at = style.openEnd + m.index + m[1].length; edits.push({ start: at, end: at + m[2].length, text: o.footer.replace(/["\\]/g, '') }); }
    }
    var tp = S.qs(t, 'div.title-pg');
    if (tp) {
      var h1 = S.qs(tp, 'h1'); if (h1) edits.push({ start: h1.openEnd, end: h1.closeStart, text: S.escapeText(o.title) });
      var kick = S.qs(tp, 'div.kick'); if (kick && o.kick) edits.push({ start: kick.openEnd, end: kick.closeStart, text: S.escapeText(o.kick) });
    }
    return S.splice(src, edits);
  }

  /* ------------------------------------------------------------------ */
  /* index.html model                                                    */
  /* ------------------------------------------------------------------ */
  function attrsExcept(src, node, names) {
    return node.attrList.filter(function (a) { return names.indexOf(a.name) < 0; })
      .map(function (a) { return ' ' + src.slice(a.start, a.end); }).join('');
  }
  function parseLesson(src, node) {
    var num = S.qs(node, 'div.num'), meta = S.qs(node, 'div.meta');
    var b = meta && S.childrenMatching(meta, 'b')[0], desc = meta && S.qs(meta, 'span.desc');
    var links = S.qs(node, 'div.links');
    if (!num || !meta || !b || !desc || !links) return null;
    return {
      num: S.inner(src, num), title: S.inner(src, b), desc: S.inner(src, desc),
      links: S.childrenMatching(links, 'a').map(function (a) {
        return { raw: S.outer(src, a), href: a.attrs.href || '', cls: a.attrs['class'] || '', text: S.inner(src, a), extra: attrsExcept(src, a, ['href', 'class']), dirty: false };
      })
    };
  }
  function linkHtml(l) {
    if (!l.dirty && l.raw) return l.raw;
    return '<a' + (l.cls ? ' class="' + S.escapeAttr(l.cls) + '"' : '') + ' href="' + S.escapeAttr(l.href) + '"' + (l.extra || '') + '>' + l.text + '</a>';
  }
  function lessonHtml(L) {
    if (!L.dirty && L.raw) return L.raw;
    return '<div class="lesson"><div class="num">' + L.num + '</div><div class="meta"><b>' + L.title + '</b><span class="desc">' + L.desc + '</span></div><div class="links">' + L.links.map(linkHtml).join('') + '</div></div>';
  }
  function cntText(n) { return n === 1 ? 'שיעור אחד' : n === 0 ? 'אין שיעורים' : n + ' שיעורים'; }

  function parseIndex(src) {
    var t = S.scan(src);
    var wrap = S.qs(t, 'div.wrap');
    if (!wrap) return null;
    var kids = wrap.children;
    var firstH2 = -1, footer = -1;
    for (var k = 0; k < kids.length; k++) {
      if (kids[k].name === 'h2' && firstH2 < 0) firstH2 = k;
      if (kids[k].name === 'footer') footer = k;
    }
    if (firstH2 < 0) return null;
    var endIdx = footer >= 0 ? footer : kids.length;
    var tailStart = footer >= 0 ? gapStart(src, kids[footer].start, kids[footer - 1].end) : gapStart(src, wrap.closeStart, kids[kids.length - 1].end);
    var headEnd = gapStart(src, kids[firstH2].start, firstH2 > 0 ? kids[firstH2 - 1].end : wrap.openEnd);
    var model = { head: src.slice(0, headEnd), tracks: [], tail: src.slice(tailStart) };
    var prevEnd = headEnd, tr = null;
    for (k = firstH2; k < endIdx; k++) {
      var node = kids[k], lead = src.slice(prevEnd, node.start), raw = S.outer(src, node);
      prevEnd = node.end;
      if (node.name === 'h2') {
        var cnt = S.childrenMatching(node, 'span.cnt')[0];
        tr = {
          lead: lead, raw: raw, dirty: false,
          name: cnt ? src.slice(node.openEnd, cnt.start) : S.inner(src, node),
          hasCnt: !!cnt, cntRaw: cnt ? S.inner(src, cnt) : '', items: []
        };
        model.tracks.push(tr);
        continue;
      }
      var item = { lead: lead, raw: raw, kind: 'raw', dirty: false };
      if (node.name === 'div' && S.hasClass(node, 'lesson')) {
        var L = parseLesson(src, node);
        if (L) { item.kind = 'lesson'; L.raw = raw; L.dirty = false; item.lesson = L; }
      } else if (node.name === 'p' && S.hasClass(node, 'track-sub')) { item.kind = 'sub'; item.html = S.inner(src, node); }
      else if (node.name === 'div' && S.hasClass(node, 'order')) item.kind = 'order';
      tr.items.push(item);
    }
    return model;
  }
  function trackLessons(tr) { return tr.items.filter(function (it) { return it.kind === 'lesson'; }); }
  function h2Html(tr) {
    var n = trackLessons(tr).length;
    var cnt = tr.hasCnt ? (tr.cntOverride != null ? tr.cntOverride : cntText(n)) : '';
    if (!tr.dirty && (!tr.hasCnt || cnt === tr.cntRaw)) return tr.raw;
    return '<h2>' + tr.name + (tr.hasCnt ? '<span class="cnt">' + cnt + '</span>' : '') + '</h2>';
  }
  function itemHtml(it) {
    if (it.kind === 'lesson') return lessonHtml(it.lesson);
    if (it.kind === 'sub' && it.dirty) return '<p class="track-sub">' + it.html + '</p>';
    return it.raw;
  }
  function serializeIndex(model) {
    var out = [model.head];
    model.tracks.forEach(function (tr) {
      out.push(tr.lead, h2Html(tr));
      tr.items.forEach(function (it) { out.push(it.lead, itemHtml(it)); });
    });
    out.push(model.tail);
    return out.join('');
  }
  function newTrack(name, sub) {
    return { lead: '\n\n', raw: '', dirty: true, name: name + ' ', hasCnt: true, cntRaw: '', items: [{ lead: '\n', raw: '', kind: 'sub', dirty: true, html: sub }] };
  }
  function newLessonItem(o) {
    var links = [];
    if (o.deck) links.push({ href: o.deck, cls: '', text: 'מצגת', extra: '', dirty: true });
    if (o.guide) links.push({ href: o.guide, cls: 'pdf', text: 'דף הנחיה', extra: '', dirty: true });
    return { lead: '\n', raw: '', kind: 'lesson', dirty: true, lesson: { num: S.escapeText(o.num), title: S.escapeText(o.title), desc: S.escapeText(o.desc || ''), links: links, dirty: true, raw: '' } };
  }
  /* header/footer fields of the index live inside head/tail */
  var INDEX_FIELDS = { h1: ['head', 'header h1'], sub: ['head', 'p.sub'], unit: ['head', 'p.unit'], legend: ['head', 'div.legend'], pageTitle: ['head', 'title'], footer: ['tail', 'footer'] };
  function getIndexField(model, f) {
    var d = INDEX_FIELDS[f]; var src = model[d[0]]; var n = S.qs(S.scan(src), d[1]);
    return n ? S.inner(src, n) : null;
  }
  function setIndexField(model, f, html) {
    var d = INDEX_FIELDS[f]; var src = model[d[0]]; var n = S.qs(S.scan(src), d[1]);
    if (!n) return false;
    model[d[0]] = S.splice(src, [{ start: n.openEnd, end: n.closeStart, text: html }]);
    return true;
  }
  function indexLinks(model) {
    var out = [];
    model.tracks.forEach(function (tr, ti) {
      tr.items.forEach(function (it, ii) {
        if (it.kind !== 'lesson') return;
        it.lesson.links.forEach(function (l) { out.push({ track: ti, item: ii, href: l.href, text: l.text, cls: l.cls }); });
      });
    });
    return out;
  }
  function isLocalHref(h) { return !!h && !/^[a-z][a-z0-9+.-]*:/i.test(h) && h[0] !== '#' && h.slice(0, 2) !== '//'; }

  /* ------------------------------------------------------------------ */
  /* lint                                                                */
  /* ------------------------------------------------------------------ */
  /* text segments with an "inside LTR" flag; skips script/style/svg */
  function textSegments(src, node, cb, inLtr) {
    var pos = node.openEnd;
    for (var k = 0; k < node.children.length; k++) {
      var ch = node.children[k];
      if (ch.start > pos) cb(src.slice(pos, ch.start), inLtr, node);
      pos = ch.end;
      if (ch.name === 'script' || ch.name === 'style' || ch.foreign) continue;
      var st = ch.attrs.style || '';
      var ltr = inLtr || S.hasClass(ch, 'ltr') || S.hasClass(ch, 'n') || S.hasClass(ch, 'fx') || /direction\s*:\s*ltr/i.test(st) || ch.attrs.dir === 'ltr' || ch.name === 'code' || ch.name === 'kbd';
      textSegments(src, ch, cb, ltr);
    }
    if (node.closeStart > pos) cb(src.slice(pos, node.closeStart), inLtr, node);
  }
  function lintUnits(doc) {
    var out = [];
    var isDeck = doc.kind === 'deck';
    doc.units.forEach(function (u, i) {
      var sec = unitRoot(u.html);
      if (!sec) { out.push({ level: 'error', unit: i, msg: isDeck ? 'מבנה ה-HTML של השקופית לא תקין' : 'מבנה ה-HTML של העמוד לא תקין' }); return; }
      if (isDeck) {
        var note = S.qs(sec, 'aside.speaker-note');
        if (!note || !S.textCompact(u.html, note)) out.push({ level: 'warn', unit: i, msg: 'אין הערות מדריך (aside.speaker-note)' });
      }
      var dashes = 0, ranges = [];
      textSegments(u.html, sec, function (txt, ltr) {
        var t = S.decodeEntities(txt);
        dashes += (t.match(/\u2014/g) || []).length;
        if (!ltr) {
          var re = /\d[\u2013-]\d/g, m;
          while ((m = re.exec(t))) ranges.push(t.slice(Math.max(0, m.index - 6), m.index + 8).trim());
        }
      }, false);
      if (dashes) out.push({ level: 'warn', unit: i, msg: (dashes === 1 ? 'קו ארוך אחד (—)' : dashes + ' קווים ארוכים (—)') + ' בטקסט. בסט לא משתמשים בקו ארוך.' });
      if (ranges.length) out.push({ level: 'warn', unit: i, msg: 'טווח מספרים בלי <span class="ltr"> עלול להתהפך: ' + ranges.slice(0, 3).join(' · ') });
    });
    if (isDeck) {
      var r = renumberDeck({ units: doc.units.map(function (u) { return { html: u.html }; }) }, true);
      if (r.length) out.push({ level: 'info', unit: null, msg: 'מספור השקופיות לא עדכני ' + (r.length === 1 ? 'בשקופית אחת' : 'ב-' + r.length + ' שקופיות') + '. הוספה, הזזה או מחיקה של שקופית מעדכנת אותו.' });
    }
    return out;
  }
  /* every inline classic script must still parse. Returns failures. */
  function checkScripts(src, origSrc) {
    var fails = [];
    var origTexts = {};
    if (origSrc) S.qsa(S.scan(origSrc), 'script').forEach(function (n) { origTexts[S.inner(origSrc, n)] = true; });
    S.qsa(S.scan(src), 'script').forEach(function (n, k) {
      var type = (n.attrs.type || '').toLowerCase();
      if (n.attrs.src || (type && !/^(text|application)\/(java|ecma)script$|^module$/.test(type))) return;
      var code = S.inner(src, n);
      if (type === 'module') return;
      try { new Function(code); } // parses without running
      catch (e) { fails.push({ index: k, message: String(e && e.message || e), changed: !origTexts[code] }); }
    });
    return fails;
  }

  /* ------------------------------------------------------------------ */
  /* naming                                                              */
  /* ------------------------------------------------------------------ */
  var TRACK_CODES = { radio: 'radio', networks: 'net', devices: 'devices' };
  function guideSourceCandidates(trackDir, num) {
    var code = TRACK_CODES[trackDir] || trackDir;
    var nn = pad(parseInt(num, 10) || 0);
    var c = ['.agents/guide-sources/' + nn + '_' + code + '_guide_source.html'];
    if (trackDir === 'radio') c.push('.agents/guide-sources/' + nn + '_guide_source.html');
    return c;
  }
  function validSlug(s) { return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s); }
  function lessonPaths(trackDir, num, slug) {
    var base = pad(parseInt(num, 10) || 0) + '-' + slug;
    return { dir: trackDir + '/' + base, deck: trackDir + '/' + base + '/' + base + '-deck.html', guide: trackDir + '/' + base + '/' + base + '-guide.pdf', guideSource: guideSourceCandidates(trackDir, num)[0] };
  }

  var api = {
    KINDS: KINDS, LAYOUTS: LAYOUTS, detectKind: detectKind, pad: pad,
    parseUnits: parseUnits, serializeUnits: serializeUnits, unitRoot: unitRoot, unitOffset: unitOffset,
    editables: editables, editableSignature: editableSignature, hasIds: hasIds, stripIds: stripIds, setEditableInner: setEditableInner, getEditableInner: getEditableInner,
    fieldNode: fieldNode, getField: getField, setField: setField, fieldEditableIndex: fieldEditableIndex,
    slideInfo: slideInfo, pageInfo: pageInfo, renumberDeck: renumberDeck, slideContext: slideContext, newSlide: newSlide,
    deckMeta: deckMeta, setDeckMeta: setDeckMeta, instantiateDeck: instantiateDeck, instantiateGuide: instantiateGuide,
    parseIndex: parseIndex, serializeIndex: serializeIndex, trackLessons: trackLessons, newTrack: newTrack, newLessonItem: newLessonItem,
    lessonHtml: lessonHtml, linkHtml: linkHtml, cntText: cntText, getIndexField: getIndexField, setIndexField: setIndexField,
    indexLinks: indexLinks, isLocalHref: isLocalHref,
    lintUnits: lintUnits, checkScripts: checkScripts, textSegments: textSegments,
    guideSourceCandidates: guideSourceCandidates, validSlug: validSlug, lessonPaths: lessonPaths, TRACK_CODES: TRACK_CODES
  };
  root.IBModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
