/* slide-editor.js — full-size visual editor for one slide (deck) or one page
 * (guide source), opened in a modal.
 *
 * The slide is rendered WITHOUT the deck's scripts, in an iframe with
 * sandbox="allow-same-origin" (no allow-scripts) and a CSP that forbids every
 * script. Nothing from the file can run; the editor manipulates the DOM
 * directly. Demos therefore show their initial, static state.
 *
 * Saving does not re-serialise the slide. Every start tag is annotated with
 * data-ibsrc="<base>.<index>" pointing back at its source; on apply,
 * IBMin.serialize emits the original bytes for every element that did not
 * change, the original start/end tags for changed elements whose attributes
 * are the same, and fresh markup only for new elements.
 */
(function (root) {
  'use strict';
  var S = root.IBScan, M = root.IBModel, R = root.IBRich;
  var ATTR = 'data-ibsrc';
  var HTMLNS = 'http://www.w3.org/1999/xhtml';
  var SKIP_ATTRS = { 'data-ibsrc': 1, contenteditable: 1, spellcheck: 1 };

  /* ================================================================== */
  /* minimal serializer                                                  */
  /* ================================================================== */
  function Registry() { this.bases = []; }
  /* register a source string; returns the annotated html to load into the DOM */
  Registry.prototype.add = function (html, doc) {
    var id = this.bases.length, t = S.scan(html), nodes = [], edits = [];
    S.walk(t, function (n) {
      var at = n.start + 1 + n.rawName.length;
      edits.push({ start: at, end: at, text: ' ' + ATTR + '="' + id + '.' + nodes.length + '"' });
      nodes.push(n);
    });
    var annotated = S.splice(html, edits);
    var b = { id: id, html: html, nodes: nodes, annotated: annotated, pristine: {} };
    var tpl = (doc || document).createElement('template');
    tpl.innerHTML = annotated;
    tpl.content.querySelectorAll('[' + ATTR + ']').forEach(function (el) { b.pristine[el.getAttribute(ATTR)] = el; });
    this.bases.push(b);
    return annotated;
  };
  Registry.prototype.lookup = function (el) {
    var k = el.getAttribute && el.getAttribute(ATTR);
    if (k == null) return null;
    var dot = k.indexOf('.'), b = this.bases[+k.slice(0, dot)];
    if (!b) return null;
    var sn = b.nodes[+k.slice(dot + 1)], p = b.pristine[k];
    return sn && p ? { base: b, sn: sn, p: p } : null;
  };

  function cleanAttrs(el) { return Array.prototype.filter.call(el.attributes, function (a) { return !SKIP_ATTRS[a.name]; }); }
  function attrsEqual(a, b) {
    var x = cleanAttrs(a), y = cleanAttrs(b);
    if (x.length !== y.length) return false;
    for (var i = 0; i < x.length; i++) if (b.getAttribute(x[i].name) !== x[i].value) return false;
    return true;
  }
  function nodesEqual(a, b) {
    if (a.nodeType !== b.nodeType) return false;
    if (a.nodeType === 3 || a.nodeType === 8) return a.data === b.data;
    if (a.nodeType !== 1) return true;
    if (a.namespaceURI !== b.namespaceURI || a.localName !== b.localName || !attrsEqual(a, b)) return false;
    var ac = a.childNodes, bc = b.childNodes;
    if (ac.length !== bc.length) return false;
    for (var i = 0; i < ac.length; i++) if (!nodesEqual(ac[i], bc[i])) return false;
    return true;
  }
  function escText(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;'); }
  function escAttr(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
  function startTag(el, selfClose) {
    var html = el.namespaceURI === HTMLNS;
    return '<' + el.localName + cleanAttrs(el).map(function (a) {
      return ' ' + a.name + (a.value === '' && html ? '' : '="' + escAttr(a.value) + '"');
    }).join('') + (selfClose ? '/>' : '>');
  }
  function isVoid(el) { return el.namespaceURI === HTMLNS && !!S.VOID[el.localName]; }
  function kids(el, reg, force) {
    var out = '';
    for (var c = el.firstChild; c; c = c.nextSibling) out += ser(c, reg, force);
    return out;
  }
  function ser(n, reg, force) {
    if (n.nodeType === 3) {
      var pn = n.parentNode && n.parentNode.localName;
      return pn === 'style' || pn === 'script' ? n.data : escText(n.data);
    }
    if (n.nodeType === 8) return '<!--' + n.data + '-->';
    if (n.nodeType !== 1) return '';
    var m = reg.lookup(n);
    if (m) {
      var sn = m.sn, src = m.base.html;
      if (!force && nodesEqual(n, m.p)) return src.slice(sn.start, sn.end);      // untouched: original bytes
      var same = attrsEqual(n, m.p);
      if (isVoid(n)) return same ? src.slice(sn.start, sn.openEnd) : startTag(n);
      if (sn.selfClosing && !n.firstChild) return same ? src.slice(sn.start, sn.openEnd) : startTag(n, true);
      var st = same && !sn.selfClosing ? src.slice(sn.start, sn.openEnd) : startTag(n);
      var en = sn.selfClosing ? '</' + n.localName + '>' : sn.end > sn.closeStart ? src.slice(sn.closeStart, sn.end) : '';
      return st + kids(n, reg, force) + en;
    }
    // a <tbody> the parser implied: no annotation, no attributes, no tags in the source
    if (n.localName === 'tbody' && n.namespaceURI === HTMLNS && !cleanAttrs(n).length) return kids(n, reg, force);
    if (isVoid(n)) return startTag(n);
    if (n.namespaceURI !== HTMLNS && !n.firstChild) return startTag(n, true);
    return startTag(n) + kids(n, reg, force) + '</' + n.localName + '>';
  }
  function serialize(el, reg, force) { return ser(el, reg, force); }

  /* test helper: identical bytes when untouched, and a forced full walk that
     must parse back to the same DOM */
  function selfCheck(html, doc) {
    doc = doc || document;
    var reg = new Registry(), ann = reg.add(html, doc);
    var tpl = doc.createElement('template'); tpl.innerHTML = ann;
    var el = tpl.content.firstElementChild;
    var identical = serialize(el, reg) === html;
    var forced = serialize(el, reg, true);
    var a = doc.createElement('template'); a.innerHTML = forced;
    var b = doc.createElement('template'); b.innerHTML = html;
    var semantic = a.content.firstElementChild && nodesEqual(a.content.firstElementChild, b.content.firstElementChild);
    return { identical: identical, semantic: !!semantic, forced: forced };
  }

  root.IBMin = { Registry: Registry, serialize: serialize, nodesEqual: nodesEqual, selfCheck: selfCheck, ATTR: ATTR };

  /* ================================================================== */
  /* editor                                                              */
  /* ================================================================== */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  function btn(label, fn, cls, title) {
    return h('button', { type: 'button', class: cls || '', title: title || null, onmousedown: function (e) { e.preventDefault(); }, onclick: fn }, label);
  }

  var CONTAINER = { h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, p: 1, li: 1, td: 1, th: 1, dt: 1, dd: 1, figcaption: 1, blockquote: 1, caption: 1, summary: 1, label: 1, legend: 1, div: 1, span: 1, b: 1, strong: 1, i: 1, em: 1, small: 1, a: 1 };
  var NO_TEXT_CLASSES = { 'slide-mark': 1, footer: 1, 'speaker-note': 1 };

  var DECK_COLORS = [
    { name: 'תכלת', style: 'color:var(--cyan)', sw: '#22d3ee' },
    { name: 'ענבר', style: 'color:var(--amber)', sw: '#fbbf24' },
    { name: 'אדום', style: 'color:var(--red)', sw: '#fb7185' },
    { name: 'ירוק', style: 'color:var(--green)', sw: '#4ade80' },
    { name: 'לבן', style: 'color:var(--ink)', sw: '#f1f5f9' }
  ];
  var GUIDE_COLORS = [
    { name: 'טורקיז', style: 'color:#0f6f7a', sw: '#0f6f7a' },
    { name: 'ענבר', style: 'color:#a8701a', sw: '#a8701a' },
    { name: 'אדום', style: 'color:#a83a4c', sw: '#a83a4c' },
    { name: 'ירוק', style: 'color:#2f7546', sw: '#2f7546' }
  ];

  function card(tag, title, text, v) { return '<div class="card' + (v ? ' ' + v : '') + '"><div class="tag">' + tag + '</div><h3>' + title + '</h3><p>' + text + '</p></div>'; }
  var DECK_BLOCKS = [
    { id: 'p', label: 'פסקה', scope: 'flow', html: '<p class="copy">טקסט חדש.</p>' },
    { id: 'list', label: 'תבליטים', scope: 'flow', html: '<ul class="checklist"><li>נקודה</li><li>נקודה</li></ul>' },
    { id: 'key', label: 'מסר מודגש', scope: 'flow', html: '<div class="key">המסר שהחניך לוקח מהשקופית.</div>' },
    { id: 'img', label: 'תמונה…', scope: 'flow', image: true },
    { id: 'split', label: 'טקסט ותמונה', scope: 'body', html: '<div class="split"><div class="stack"><p class="copy">טקסט.</p><div class="key">המסר.</div></div><div class="visual"><div class="visual-label">גררו לכאן תמונה, או בחרו את המסגרת ולחצו "תמונה…"</div></div></div>' },
    { id: 'cards', label: 'כרטיסים', scope: 'body', html: '<div class="grid3">' + card('תגית', 'כותרת', 'הסבר קצר.') + card('תגית', 'כותרת', 'הסבר קצר.', 'amber') + card('תגית', 'כותרת', 'הסבר קצר.', 'green') + '</div>' },
    { id: 'card', label: 'כרטיס נוסף', scope: 'grid', html: card('תגית', 'כותרת', 'הסבר קצר.') },
    { id: 'table', label: 'טבלה', scope: 'body', html: '<table class="table"><tr><th>עמודה</th><th>עמודה</th><th>עמודה</th></tr><tr><td>שורה</td><td>ערך</td><td>ערך</td></tr><tr><td>שורה</td><td>ערך</td><td>ערך</td></tr></table>' },
    { id: 'steps', label: 'שלבים', scope: 'body', html: '<div class="steps"><div class="step"><strong>שלב</strong><span>מה עושים</span></div><div class="step"><strong>שלב</strong><span>מה עושים</span></div><div class="step"><strong>שלב</strong><span>מה עושים</span></div></div>' },
    { id: 'formula', label: 'נוסחה', scope: 'flow', html: '<div class="formula"><span class="accent">P</span><span>=</span><span>V × I</span></div>' },
    { id: 'metric', label: 'מספר גדול', scope: 'flow', html: '<div class="metric"><span class="value">42</span><span class="unit">dB</span></div>' },
    { id: 'question', label: 'שאלה לכיתה', scope: 'body', html: '<div class="question">השאלה שמציגים לכיתה</div><div class="answer-row"><div class="answer"><strong>א</strong>תשובה אפשרית</div><div class="answer"><strong>ב</strong>תשובה אפשרית</div><div class="answer"><strong>ג</strong>תשובה אפשרית</div></div>' }
  ];
  var GUIDE_BLOCKS = [
    { id: 'p', label: 'פסקה', scope: 'flow', html: '<p>טקסט.</p>' },
    { id: 'h2', label: 'כותרת משנה', scope: 'body', html: '<h2>כותרת</h2>' },
    { id: 'list', label: 'תבליטים', scope: 'flow', html: '<ul><li>נקודה</li><li>נקודה</li></ul>' },
    { id: 'img', label: 'תמונה…', scope: 'flow', image: true },
    { id: 'note', label: 'הערה צבעונית', scope: 'body', html: '<div class="note teal"><h3>כותרת</h3><p>טקסט.</p></div>' },
    { id: 'band', label: 'פס מודגש', scope: 'body', html: '<div class="band sm">משפט מרכזי</div>' },
    { id: 'cards', label: 'כרטיסים', scope: 'body', html: '<div class="cards"><div class="pc teal"><h3>כותרת</h3><p>טקסט.</p></div><div class="pc amber"><h3>כותרת</h3><p>טקסט.</p></div></div>' },
    { id: 'table', label: 'טבלה', scope: 'body', html: '<table><tr><th>עמודה</th><th>עמודה</th></tr><tr><td class="k">שורה</td><td>ערך</td></tr></table>' }
  ];
  var VARIANTS = {
    deck: [
      { cls: 'key', opts: [['', 'תכלת'], ['amber', 'ענבר'], ['red', 'אדום']] },
      { cls: 'card', opts: [['', 'רגיל'], ['amber', 'ענבר'], ['red', 'אדום'], ['green', 'ירוק']] }
    ],
    guide: [
      { cls: 'note', opts: [['teal', 'טורקיז'], ['amber', 'ענבר'], ['red', 'אדום'], ['green', 'ירוק']] },
      { cls: 'pc', opts: [['teal', 'טורקיז'], ['amber', 'ענבר'], ['red', 'אדום'], ['green', 'ירוק']] },
      { cls: 'band', opts: [['', 'גדול'], ['sm', 'קטן']] }
    ]
  };
  var NAMES_BY_CLASS = [
    ['body', 'גוף השקופית'], ['split', 'טקסט ותמונה'], ['stack', 'עמודה'], ['visual', 'מסגרת'], ['key', 'מסר'], ['card', 'כרטיס'],
    ['grid2', 'כרטיסים'], ['grid3', 'כרטיסים'], ['grid4', 'כרטיסים'], ['steps', 'שלבים'], ['step', 'שלב'], ['checklist', 'תבליטים'],
    ['table', 'טבלה'], ['formula', 'נוסחה'], ['metric', 'מספר גדול'], ['question', 'שאלה'], ['answer-row', 'תשובות'], ['answer', 'תשובה'],
    ['eyebrow', 'כותרת-על'], ['title', 'כותרת'], ['subtitle', 'כותרת משנה'], ['slide-mark', 'סמל'], ['badge', 'תגית'], ['brand', 'סמל ושם'],
    ['note', 'הערה'], ['band', 'פס'], ['pc', 'כרטיס'], ['cards', 'כרטיסים'], ['copy', 'פסקה'], ['tag', 'תגית'], ['visual-label', 'כיתוב'],
    ['pg', 'עמוד'], ['title-pg', 'שער']
  ];
  var NAMES_BY_TAG = { p: 'פסקה', ul: 'רשימה', ol: 'רשימה', li: 'פריט', table: 'טבלה', tr: 'שורה', td: 'תא', th: 'תא כותרת', h1: 'כותרת', h2: 'כותרת משנה', h3: 'כותרת משנה', h4: 'כותרת משנה', img: 'תמונה', svg: 'איור', strong: 'הדגשה', b: 'הדגשה', span: 'קטע', div: 'מקטע', section: 'שקופית', aside: 'הערות', hr: 'קו', canvas: 'הדגמה', button: 'כפתור' };
  function blockName(el) {
    for (var i = 0; i < NAMES_BY_CLASS.length; i++) if (el.classList && el.classList.contains(NAMES_BY_CLASS[i][0])) return NAMES_BY_CLASS[i][1];
    return NAMES_BY_TAG[el.localName] || el.localName;
  }

  /* image file -> data: URI. Template rule: photos at most ~1280px, JPEG ~80, embedded. */
  function processImage(file, maxSide) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('הקובץ אינו תמונה')); return; }
      var rd = new FileReader();
      rd.onerror = function () { reject(rd.error); };
      rd.onload = function () {
        var data = rd.result;
        if (file.type === 'image/svg+xml') { resolve({ src: data, note: 'SVG נשמר כמו שהוא' }); return; }
        var img = new Image();
        img.onerror = function () { reject(new Error('לא הצלחתי לקרוא את התמונה')); };
        img.onload = function () {
          var w = img.naturalWidth, hh = img.naturalHeight, k = Math.min(1, maxSide / Math.max(w, hh));
          if (k === 1 && file.type === 'image/jpeg' && file.size <= 400000) { resolve({ src: data, w: w, h: hh }); return; }
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(hh * k));
          var g = c.getContext('2d');
          g.drawImage(img, 0, 0, c.width, c.height);
          var alpha = false;
          if (file.type !== 'image/jpeg') {
            var px = g.getImageData(0, 0, c.width, c.height).data, step = Math.max(4, Math.floor(px.length / 4 / 40000) * 4);
            for (var i = 3; i < px.length; i += step) if (px[i] < 250) { alpha = true; break; }
          }
          var out;
          if (alpha) out = c.toDataURL('image/png');
          else {
            var c2 = document.createElement('canvas'); c2.width = c.width; c2.height = c.height;
            var g2 = c2.getContext('2d'); g2.fillStyle = '#fff'; g2.fillRect(0, 0, c2.width, c2.height); g2.drawImage(c, 0, 0);
            out = c2.toDataURL('image/jpeg', 0.8);
          }
          resolve({ src: out, w: c.width, h: c.height, resized: k < 1 });
        };
        img.src = data;
      };
      rd.readAsDataURL(file);
    });
  }

  var DECK_CANVAS_CSS =
    'html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#04070d}' +
    '.deck-root{position:fixed;inset:0}' +
    '.stage{transform-origin:center center}' +
    '.stage>section.slide{opacity:1!important;transform:none!important;pointer-events:auto!important;transition:none!important}' +
    '.ib-navzone{position:absolute;left:0;right:0;bottom:0;height:70px;pointer-events:none;z-index:40;background:repeating-linear-gradient(135deg,rgba(251,191,36,.06) 0 10px,transparent 10px 20px);border-top:1px dashed rgba(251,191,36,.35)}' +
    '[contenteditable="true"]{outline:none;caret-color:#fbbf24;cursor:text}' +
    'img{-webkit-user-drag:none}' +
    'section.slide :is(h1,h2,h3,p,li,.key,.step,.answer):empty{min-height:1em;min-width:3em}' +
    'section.slide :is(h1,h2,h3,p,li,.key):empty:not([contenteditable="true"])::before{content:"(ריק)";opacity:.4;font-weight:400}';
  var GUIDE_CANVAS_CSS =
    '@media screen{html{background:#e9eef3}body{max-width:794px;margin:18px auto!important;background:#fff;padding:56px 60px!important;box-shadow:0 2px 18px rgba(15,39,64,.18)}.title-pg{height:auto!important;min-height:520px}}' +
    '[contenteditable="true"]{outline:none;caret-color:#0f8793;cursor:text}' +
    'img{-webkit-user-drag:none}' +
    '.pg :is(h1,h2,h3,p,li):empty{min-height:1em;min-width:3em}' +
    '.pg :is(h1,h2,h3,p,li):empty:not([contenteditable="true"])::before{content:"(ריק)";opacity:.4}';
  var CSP = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob:; style-src \'unsafe-inline\'; font-src data:">';

  /* ---------------------------------------------------------------- */
  function open(o) {
    var kind = o.kind, isDeck = kind === 'deck';
    var reg = new Registry();
    var doc = null, sec = null, stage = null, selected = null, hovered = null, editing = null, editOrig = '', editSnap = null, saved = null;
    var undoStack = [], redoStack = [], codeMode = false, closed = false;
    var COLORS = isDeck ? DECK_COLORS : GUIDE_COLORS;
    var colorStyles = COLORS.map(function (c) { return c.style; });

    /* ---------- chrome ---------- */
    var titleEl = h('b', { class: 'se-title' }, o.title || '', o.file ? h('bdi', { dir: 'ltr', class: 'muted' }, ' ' + o.file) : null);
    var warnEl = h('span', { class: 'se-warn', hidden: true });
    var undoB = btn('↶', function () { doUndo(); }, 'icon', 'ביטול (Ctrl+Z)');
    var redoB = btn('↷', function () { doRedo(); }, 'icon', 'חזרה (Ctrl+Y)');
    var codeB = btn('קוד', function () { toggleCode(); }, 'small', 'עריכת ה-HTML של ' + (isDeck ? 'השקופית' : 'העמוד'));
    var textTools = h('span', { class: 'se-texttools' },
      btn('B', function () { textCmd('strong'); }, 'tb', 'הדגשה (Ctrl+B)'),
      btn('LTR', function () { textCmd('ltr'); }, 'tb', 'עטיפה ב-<span class="ltr"> לאנגלית, פקודות ומספרים (Ctrl+L)'),
      COLORS.map(function (c) { return h('button', { type: 'button', class: 'swatch', title: 'צבע: ' + c.name, style: 'background:' + c.sw, onmousedown: function (e) { e.preventDefault(); }, onclick: function () { textCmd('color', c.style); } }); }),
      btn('ניקוי עיצוב', function () { textCmd('clear'); }, 'tb small'));
    var navPrev = o.onNav ? btn(isDeck ? '‹ הקודמת' : '‹ הקודם', function () { nav(-1); }, 'small', isDeck ? 'החלה ומעבר לשקופית הקודמת' : 'החלה ומעבר לעמוד הקודם') : null;
    var navNext = o.onNav ? btn(isDeck ? 'הבאה ›' : 'הבא ›', function () { nav(1); }, 'small', isDeck ? 'החלה ומעבר לשקופית הבאה' : 'החלה ומעבר לעמוד הבא') : null;
    if (navPrev) navPrev.disabled = !o.hasPrev;
    if (navNext) navNext.disabled = !o.hasNext;
    var top = h('div', { class: 'se-top' },
      titleEl, navPrev, navNext, h('span', { class: 'sep' }), textTools, h('span', { class: 'sep' }), undoB, redoB, codeB,
      h('span', { class: 'grow' }), warnEl,
      btn('ביטול', function () { cancel(); }, 'small'),
      btn('החלה', function () { apply(false); }, 'small', 'החלת השינויים על המסמך והמשך עריכה'),
      btn('החלה וסגירה', function () { apply(true); }, 'primary small', 'Ctrl+Enter'));
    var frame = h('iframe', { class: 'se-frame', sandbox: 'allow-same-origin', title: 'עריכת ' + (isDeck ? 'שקופית' : 'עמוד') });
    var overlay = h('div', { class: 'se-overlay' });
    var hoverBox = h('div', { class: 'se-hover', hidden: true });
    var selBox = h('div', { class: 'se-sel', hidden: true }, h('span', { class: 'se-sel-name' }));
    var blockBar = h('div', { class: 'se-bar', hidden: true },
      btn('↑', function () { moveSel(-1); }, 'icon', 'הזזה לפני הבלוק הקודם (Alt+↑)'),
      btn('↓', function () { moveSel(1); }, 'icon', 'הזזה אחרי הבלוק הבא (Alt+↓)'),
      btn('⧉', function () { duplicateSel(); }, 'icon', 'שכפול'),
      btn('⤴', function () { selectParent(); }, 'icon', 'בחירת הבלוק שמכיל אותו (Esc)'),
      btn('🗑', function () { deleteSel(); }, 'icon danger', 'מחיקה (Delete)'));
    overlay.append(hoverBox, selBox, blockBar);
    var warnLayer = h('div', { class: 'se-warnlayer' });
    overlay.appendChild(warnLayer);
    var code = h('textarea', { class: 'code se-code', dir: 'ltr', spellcheck: 'false', hidden: true });
    var canvasWrap = h('section', { class: 'se-canvas' + (isDeck ? '' : ' guide') }, frame, overlay, code);
    var palette = h('div', { class: 'se-palette' }, (isDeck ? DECK_BLOCKS : GUIDE_BLOCKS).map(function (b) {
      return btn(b.label, function () { insertBlock(b); }, 'tile', b.scope === 'body' ? 'נוסף אחרי הבלוק הנבחר ברמת ' + (isDeck ? 'גוף השקופית' : 'העמוד') : 'נוסף אחרי הבלוק הנבחר');
    }));
    var selPanel = h('div', { class: 'se-selpanel' });
    var notesBox = null;
    var side = h('aside', { class: 'se-side' },
      h('h4', null, 'הוספה'), palette,
      h('p', { class: 'muted small' }, 'נוסף אחרי הבלוק הנבחר. תמונה אפשר גם לגרור לשקופית או להדביק (Ctrl+V).'),
      h('h4', null, 'בלוק נבחר'), selPanel);
    if (isDeck) {
      notesBox = h('div', { class: 'rich tall', contenteditable: 'true', dir: 'rtl', 'data-placeholder': 'מה עושים, מה מדגישים, טעות נפוצה, תשובות.' });
      side.append(h('h4', null, 'הערות מדריך'), notesBox);
    }
    side.append(h('h4', null, 'בדיקות'), h('ul', { class: 'lint se-checks' }));
    var hint = h('p', { class: 'se-hint' }, 'לחיצה על טקסט: עריכה. לחיצה על מסגרת או רווח: בחירת בלוק. Enter בתבליט: תבליט חדש. Tab בטבלה: התא הבא. Esc: יציאה מעריכה ובחירת הבלוק שמעל. ' +
      (isDeck ? 'הדגמות חיות מוצגות כאן במצב ההתחלתי שלהן, בלי הסקריפט. הפס המקווקו בתחתית הוא אזור סרגל הניווט.' : ''));
    var dlg = h('dialog', { class: 'se-dlg' }, top, h('div', { class: 'se-main' }, h('div', { class: 'se-left' }, canvasWrap, hint), side));
    document.body.appendChild(dlg);
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); cancel(); });
    dlg.showModal();

    /* ---------- canvas document ---------- */
    var annotated = reg.add(o.html);
    var styles = o.styles || '';
    frame.srcdoc = isDeck
      ? '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">' + CSP + styles + '<style>' + DECK_CANVAS_CSS + '</style></head><body><div class="deck-root" dir="rtl"><div class="stage-shell"><main class="stage">' + annotated + '<div class="ib-navzone"></div></main></div></div></body></html>'
      : '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">' + CSP + styles + '<style>' + GUIDE_CANVAS_CSS + '</style></head><body>' + annotated + '</body></html>';
    var ready = new Promise(function (res) { frame.addEventListener('load', res, { once: true }); });
    var api = {
      ready: ready, get doc() { return doc; }, get section() { return sec; }, get selected() { return selected; },
      serialize: function () { return serializeNow(); }, select: function (el) { select(el); }, insert: function (id) { var b = (isDeck ? DECK_BLOCKS : GUIDE_BLOCKS).find(function (x) { return x.id === id; }); return insertBlock(b); },
      edit: function (el) { startEditing(el); }, stopEditing: function () { stopEditing(); }, apply: apply, cancel: cancel, close: close,
      insertImageFile: function (f) { return insertImageFile(f); }, tableOp: function (op) { tableOp(op); }, checks: function () { return runChecks(); },
      dirty: function () { return serializeNow() !== o.html; }
    };
    ready.then(function () {
      doc = frame.contentDocument;
      sec = findSection();
      stage = isDeck ? doc.querySelector('main.stage') : null;
      bindCanvas();
      fit();
      if (notesBox) bindNotes();
      renderSel();
      runChecks();
      if (o.onReady) o.onReady(api);
    });
    var ro = new ResizeObserver(function () { fit(); place(); });
    ro.observe(canvasWrap);

    function findSection() { return isDeck ? doc.querySelector('main.stage > section') : doc.querySelector('body > div.pg'); }
    function mainContainer() { return isDeck ? (sec.querySelector(':scope > .body') || sec) : sec; }
    function fit() {
      if (!doc || !isDeck || !stage) return;
      var w = frame.clientWidth, hh = frame.clientHeight;
      var k = Math.min((w - 24) / 1280, (hh - 24) / 720);
      stage.style.transform = 'scale(' + Math.max(0.2, k) + ')';
      place();
    }

    /* ---------- serialisation, undo ---------- */
    function cleanForSnap() {
      // contenteditable is transient; never let it into a snapshot or the file
      var ce = sec.querySelectorAll('[contenteditable]');
      var keep = Array.prototype.map.call(ce, function (n) { return [n, n.getAttribute('contenteditable')]; });
      ce.forEach(function (n) { n.removeAttribute('contenteditable'); });
      return function () { keep.forEach(function (x) { x[0].setAttribute('contenteditable', x[1]); }); };
    }
    function snapshot() { var undoCE = cleanForSnap(); var s = sec.outerHTML; undoCE(); return s; }
    function serializeNow() {
      if (codeMode) return code.value;
      if (!sec) return o.html;
      var undoCE = cleanForSnap();
      sec.normalize();
      var out = serialize(sec, reg);
      undoCE();
      return out;
    }
    function replaceSection(html) {
      var t = doc.createElement('template');
      t.innerHTML = html;
      var nsec = t.content.firstElementChild;
      sec.replaceWith(nsec);
      sec = nsec;
    }
    function pushUndo(s) { undoStack.push(s); if (undoStack.length > 100) undoStack.shift(); redoStack = []; updateUndo(); }
    function updateUndo() { undoB.disabled = !undoStack.length; redoB.disabled = !redoStack.length; }
    function doUndo() {
      if (codeMode) return;
      stopEditing();
      if (!undoStack.length) return;
      redoStack.push(snapshot()); replaceSection(undoStack.pop()); afterRestore();
    }
    function doRedo() {
      if (codeMode) return;
      stopEditing();
      if (!redoStack.length) return;
      undoStack.push(snapshot()); replaceSection(redoStack.pop()); afterRestore();
    }
    function afterRestore() { select(null); updateUndo(); if (notesBox) loadNotes(); changed(); }
    /* every structural change: commit text first, snapshot, mutate, record */
    function mutate(fn) {
      stopEditing();
      var s = snapshot();
      var r = fn();
      if (snapshot() !== s) pushUndo(s);
      changed();
      return r;
    }
    var checkTimer = null;
    function changed() { place(); renderSel(); clearTimeout(checkTimer); checkTimer = setTimeout(runChecks, 150); }

    /* ---------- selection ---------- */
    function inSec(el) { return el && sec && el !== sec && sec.contains(el); }
    function selectableFrom(t) {
      var el = t && (t.nodeType === 1 ? t : t.parentNode);
      if (!el || !el.closest) return null;
      var svg = el.closest('svg');
      if (svg && sec.contains(svg)) el = svg;
      return inSec(el) ? el : null;
    }
    function isTextContainer(el) {
      if (!el || el.nodeType !== 1 || !CONTAINER[el.localName] || el.closest('svg') || el.hasAttribute('id')) return false;
      for (var c = el; c && c !== sec; c = c.parentElement) if (c.classList && Object.keys(NO_TEXT_CLASSES).some(function (k) { return c.classList.contains(k); })) return false;
      if (el.querySelector('.crest')) return false;   // the unit crest is never part of an edit
      var all = el.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) if (!R.INLINE_OK[all[i].localName] || all[i].hasAttribute('id')) return false;
      return true;
    }
    function textContainerFrom(t) {
      var el = t && (t.nodeType === 1 ? t : t.parentNode), best = null;
      for (; el && el !== sec && el.nodeType === 1; el = el.parentElement) { if (isTextContainer(el)) best = el; else if (best) break; }
      return best && inSec(best) ? best : null;
    }
    function isFixed(el) {
      if (!isDeck || !el || el.parentElement !== sec) return false;
      var c = el.classList;
      return c.contains('slide-mark') || c.contains('eyebrow') || c.contains('title') || c.contains('subtitle') || c.contains('body') || c.contains('speaker-note') || c.contains('footer') || c.contains('brand') || el.localName === 'h1';
    }
    function select(el) {
      selected = el && inSec(el) ? el : null;
      place(); renderSel();
    }
    function selectParent() {
      if (editing) { stopEditing(); place(); return; }
      if (!selected) return;
      var p = selected.parentElement;
      select(p && inSec(p) ? p : null);
    }

    /* ---------- text editing ---------- */
    function startEditing(el, ev) {
      if (editing === el) return;
      stopEditing();
      editSnap = snapshot();
      editing = el; editOrig = el.innerHTML; saved = null;
      el.setAttribute('contenteditable', 'true');
      el.querySelectorAll('.num').forEach(function (n) { n.setAttribute('contenteditable', 'false'); });
      el.focus({ preventScroll: true });
      if (ev && doc.caretRangeFromPoint) {
        var r = doc.caretRangeFromPoint(ev.clientX, ev.clientY);
        if (r && el.contains(r.startContainer)) { var s = doc.getSelection(); s.removeAllRanges(); s.addRange(r); }
      }
      textTools.classList.add('on');
      place();
    }
    function stopEditing() {
      if (!editing) return;
      var el = editing; editing = null;
      el.removeAttribute('contenteditable');
      el.querySelectorAll('[contenteditable]').forEach(function (n) { n.removeAttribute('contenteditable'); });
      if (el.innerHTML === '<br>') el.innerHTML = '';
      var clean = R.sanitize(el.innerHTML, editOrig, colorStyles);
      if (clean !== el.innerHTML) el.innerHTML = clean;
      if (!R.sameHtml(el.innerHTML, editOrig)) { pushUndo(editSnap); changed(); }
      editSnap = null;
      textTools.classList.remove('on');
      place();
    }
    function textCmd(cmd, style) {
      if (!editing) { toast('קודם לוחצים על טקסט בשקופית ומסמנים חלק ממנו.'); return; }
      editing.focus({ preventScroll: true });
      if (cmd === 'strong') R.wrapIn(editing, 'strong', '', saved);
      else if (cmd === 'ltr') R.wrapIn(editing, 'span', 'ltr', saved);
      else if (cmd === 'color') R.wrapIn(editing, 'span', '', saved, style);
      else if (cmd === 'clear') R.clearIn(editing, saved);
      place();
    }
    function caretToStart(el) { var r = doc.createRange(); r.selectNodeContents(el); r.collapse(true); var s = doc.getSelection(); s.removeAllRanges(); s.addRange(r); }
    function caretToEnd(el) { var r = doc.createRange(); r.selectNodeContents(el); r.collapse(false); var s = doc.getSelection(); s.removeAllRanges(); s.addRange(r); }
    function enterInList(li) {
      var s = doc.getSelection(); if (!s.rangeCount) return;
      var r = s.getRangeAt(0); r.deleteContents();
      var tail = doc.createRange(); tail.setStart(r.endContainer, r.endOffset); tail.setEnd(li, li.childNodes.length);
      var rest = tail.extractContents();
      var nli = doc.createElement('li');
      nli.appendChild(rest);
      li.after(nli);
      stopEditing();
      select(nli); startEditing(nli); caretToStart(nli);
    }
    function backspaceInEmptyItem(li) {
      var prev = li.previousElementSibling;
      if (!prev || prev.localName !== 'li' || li.textContent.trim() !== '') return false;
      var snap = editSnap;
      editing = null; li.remove();
      pushUndo(snap);
      select(prev); startEditing(prev); caretToEnd(prev);
      changed();
      return true;
    }
    function nextCell(cell, dir) {
      var table = cell.closest('table'), cells = Array.prototype.slice.call(table.querySelectorAll('td,th'));
      var i = cells.indexOf(cell) + dir;
      if (i >= cells.length) { stopEditing(); select(cell); tableOp('rowAfter'); cells = Array.prototype.slice.call(table.querySelectorAll('td,th')); }
      var n = cells[Math.max(0, Math.min(cells.length - 1, i))];
      if (!n || n === cell) return;
      stopEditing(); select(n); startEditing(n); caretToEnd(n);
    }

    /* ---------- canvas events ---------- */
    function bindCanvas() {
      doc.addEventListener('mousemove', function (e) {
        var el = selectableFrom(e.target);
        if (el !== hovered) { hovered = el; place(); }
      });
      doc.addEventListener('mouseleave', function () { hovered = null; place(); });
      doc.addEventListener('mousedown', function (e) {
        if (editing && editing.contains(e.target)) return;      // caret moves inside the edited text
        var tc = textContainerFrom(e.target), el = selectableFrom(e.target);
        stopEditing();
        if (tc) { select(tc); startEditing(tc); return; }      // default action places the caret
        e.preventDefault();
        frame.contentWindow.focus();          // keys (Delete, Alt+arrows, Esc) go to the canvas
        select(el);
      }, true);
      doc.addEventListener('mouseup', function (e) {
        if (!editing) return;
        var s = doc.getSelection();
        if (!s.rangeCount || !editing.contains(s.getRangeAt(0).startContainer)) {
          var r = doc.caretRangeFromPoint && doc.caretRangeFromPoint(e.clientX, e.clientY);
          if (r && editing.contains(r.startContainer)) { s.removeAllRanges(); s.addRange(r); } else caretToEnd(editing);
        }
      });
      doc.addEventListener('dblclick', function (e) {
        if (e.target.localName === 'img' && inSec(e.target)) { select(e.target); pickImage(); }
      });
      doc.addEventListener('selectionchange', function () {
        if (!editing) return;
        var s = doc.getSelection();
        if (s.rangeCount && editing.contains(s.getRangeAt(0).commonAncestorContainer)) saved = s.getRangeAt(0).cloneRange();
      });
      doc.addEventListener('input', function () { place(); clearTimeout(checkTimer); checkTimer = setTimeout(runChecks, 300); });
      doc.addEventListener('keydown', onKey, true);
      doc.addEventListener('paste', function (e) {
        var files = e.clipboardData && e.clipboardData.files;
        if (files && files.length && /^image\//.test(files[0].type)) { e.preventDefault(); insertImageFile(files[0]); return; }
        if (!editing) return;
        e.preventDefault();
        doc.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\r?\n/g, ' '));
      }, true);
      doc.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
      doc.addEventListener('drop', function (e) {
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        e.preventDefault();
        if (!f) return;
        var t = selectableFrom(e.target);
        if (t) select(t);
        insertImageFile(f);
      });
      doc.addEventListener('scroll', function () { place(); }, { passive: true });
      // images change the layout when they finish decoding
      doc.addEventListener('load', function () { place(); clearTimeout(checkTimer); checkTimer = setTimeout(runChecks, 100); }, true);
      doc.defaultView.addEventListener('resize', function () { fit(); });
    }
    function onKey(e) {
      var mod = e.ctrlKey || e.metaKey, k = e.key;
      if (mod && k === 'Enter') { e.preventDefault(); apply(true); return; }
      if (mod && (k === 's' || k === 'S')) { e.preventDefault(); apply(false, true); return; }
      if (editing) {
        var li = editing.localName === 'li' ? editing : null;
        var cell = /^t[dh]$/.test(editing.localName) ? editing : null;
        if (k === 'Enter' && li && !e.shiftKey) { e.preventDefault(); enterInList(li); return; }
        if (k === 'Enter') { e.preventDefault(); doc.execCommand('insertLineBreak'); return; }
        if (k === 'Backspace' && li && backspaceInEmptyItem(li)) { e.preventDefault(); return; }
        if (k === 'Tab' && cell) { e.preventDefault(); nextCell(cell, e.shiftKey ? -1 : 1); return; }
        if (k === 'Escape') { e.preventDefault(); var el = editing; stopEditing(); select(el); return; }
        if (mod && (k === 'b' || k === 'B')) { e.preventDefault(); textCmd('strong'); return; }
        if (mod && (k === 'l' || k === 'L')) { e.preventDefault(); textCmd('ltr'); return; }
        if (mod && /^[iuIU]$/.test(k)) { e.preventDefault(); return; }
        return;                                                  // typing, native undo inside the text
      }
      if (mod && (k === 'z' || k === 'Z') && !e.shiftKey) { e.preventDefault(); doUndo(); return; }
      if (mod && (k === 'y' || k === 'Y' || ((k === 'z' || k === 'Z') && e.shiftKey))) { e.preventDefault(); doRedo(); return; }
      if (!selected) return;
      if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); deleteSel(); return; }
      if (k === 'Escape') { e.preventDefault(); selectParent(); return; }
      if (e.altKey && k === 'ArrowUp') { e.preventDefault(); moveSel(-1); return; }
      if (e.altKey && k === 'ArrowDown') { e.preventDefault(); moveSel(1); return; }
      if (k === 'Enter' && isTextContainer(selected)) { e.preventDefault(); startEditing(selected); caretToEnd(selected); }
    }

    /* ---------- block operations ---------- */
    function hasDemo(el) { return el.hasAttribute('id') || !!el.querySelector('[id],button,input,select,canvas,textarea'); }
    function moveSel(dir) {
      var el = selected;
      if (!el || isFixed(el)) return;
      var sib = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
      if (!sib || isFixed(sib)) return;
      mutate(function () { if (dir < 0) sib.before(el); else sib.after(el); });
      select(el);
    }
    function deleteSel() {
      var el = selected;
      if (!el) return;
      if (isFixed(el)) { toast('את ' + blockName(el) + ' לא מוחקים; אפשר לרוקן את הטקסט.'); return; }
      if (hasDemo(el) && !confirm('בבלוק הזה יש חלק מהדגמה חיה (מזהים, כפתורים או שדות). הסקריפט של ההדגמה עלול להפסיק לעבוד. למחוק בכל זאת?')) return;
      var next = el.nextElementSibling || el.previousElementSibling || el.parentElement;
      mutate(function () { el.remove(); });
      select(next && inSec(next) ? next : null);
    }
    /* new markup keeps its exact source text: it becomes a base of its own */
    function nodesFrom(html) {
      var t = doc.createElement('template');
      t.innerHTML = reg.add(html, doc);
      return Array.prototype.slice.call(t.content.childNodes);
    }
    function duplicateSel() {
      var el = selected;
      if (!el || isFixed(el)) return;
      var html = serialize(el, reg);
      if (hasDemo(el)) {
        if (!confirm('בבלוק יש חלק מהדגמה חיה. בעותק המזהים (id) יוסרו, וההדגמה לא תפעל בו. לשכפל?')) return;
        html = M.stripIds(html);
      }
      var nodes = nodesFrom(html);
      mutate(function () { el.after.apply(el, nodes); });
      select(nodes.find(function (n) { return n.nodeType === 1; }) || el);
    }
    function isFlow(el) {
      if (!el || !el.classList) return false;
      if (!isDeck) return el === sec || el.classList.contains('note') || el.classList.contains('pc');
      return ['body', 'stack', 'card', 'answer'].some(function (c) { return el.classList.contains(c); });
    }
    function endRef(container) {
      if (container !== sec) return null;
      return sec.querySelector(':scope > aside.speaker-note') || sec.querySelector(':scope > .footer');
    }
    function anchorFor(scope) {
      var main = mainContainer(), s = selected;
      if (scope === 'grid') {
        if (!s) return null;
        var cardEl = s.closest('.card');
        if (cardEl && inSec(cardEl)) return { parent: cardEl.parentElement, before: cardEl.nextSibling };
        var grid = s.closest('.grid2,.grid3,.grid4');
        if (grid && inSec(grid)) return { parent: grid, before: null };
        return null;
      }
      if (!s || !inSec(s)) return { parent: main, before: endRef(main) };
      if (scope === 'flow') {
        if (isFlow(s)) return { parent: s, before: endRef(s) };
        var a = s;
        while (a.parentElement && a.parentElement !== sec && !isFlow(a.parentElement)) a = a.parentElement;
        if (a.parentElement === sec && !isFlow(sec)) return { parent: main, before: endRef(main) };
        return { parent: a.parentElement, before: a.nextSibling };
      }
      if (s === main) return { parent: main, before: endRef(main) };
      var b = s;
      while (b.parentElement && b.parentElement !== main && b.parentElement !== sec) b = b.parentElement;
      if (b.parentElement === main) return { parent: main, before: b.nextSibling };
      return { parent: main, before: endRef(main) };
    }
    function insertBlock(b) {
      if (!b || !sec) return null;
      if (b.image) { pickImage(); return null; }
      var a = anchorFor(b.scope);
      if (!a) { toast('כדי להוסיף כרטיס, בחרו קודם כרטיס או רשת כרטיסים.'); return null; }
      var nodes = nodesFrom(b.html);
      mutate(function () { nodes.forEach(function (n) { a.parent.insertBefore(n, a.before); }); });
      var first = nodes.find(function (n) { return n.nodeType === 1; });
      select(first);
      if (first && first.scrollIntoView && !isDeck) first.scrollIntoView({ block: 'nearest' });
      return first;
    }

    /* ---------- images ---------- */
    var fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true });
    dlg.appendChild(fileInput);
    fileInput.addEventListener('change', function () { var f = fileInput.files[0]; fileInput.value = ''; if (f) insertImageFile(f); });
    function pickImage() { fileInput.click(); }
    function imgHtml(src, alt) {
      return isDeck
        ? '<img src="' + escAttr(src) + '" alt="' + escAttr(alt) + '" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:10px">'
        : '<img src="' + escAttr(src) + '" alt="' + escAttr(alt) + '" style="display:block;max-width:100%;max-height:300pt;margin:0 auto 10pt;border-radius:6pt">';
    }
    function insertImageFile(file) {
      return processImage(file, isDeck ? 1280 : 1200).then(function (r) {
        var alt = (file.name || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
        var kb = Math.round(r.src.length * 0.75 / 1024);
        var s = selected;
        if (s && s.localName === 'img') {
          mutate(function () { s.setAttribute('src', r.src); });
          select(s);
        } else {
          var vis = s && (s.classList && s.classList.contains('visual') ? s : s.closest && s.closest('.visual'));
          if (isDeck && vis && inSec(vis) && !vis.querySelector('img,svg,canvas,[id]')) {
            var nodes = nodesFrom(imgHtml(r.src, alt));
            mutate(function () { vis.querySelectorAll('.visual-label').forEach(function (n) { n.remove(); }); vis.appendChild(nodes[0]); });
            select(nodes[0]);
          } else {
            var a = anchorFor('flow');
            var inVisual = a.parent.classList && a.parent.classList.contains('visual');
            var html = isDeck && !inVisual ? '<div class="visual" style="flex:1">' + imgHtml(r.src, alt) + '</div>' : imgHtml(r.src, alt);
            var ns = nodesFrom(html);
            mutate(function () { ns.forEach(function (n) { a.parent.insertBefore(n, a.before); }); });
            select(ns[0].localName === 'img' ? ns[0] : ns[0].querySelector('img'));
          }
        }
        toast('התמונה נוספה' + (r.resized ? ' (הוקטנה ל-' + r.w + '×' + r.h + ')' : '') + ', כ-' + kb + ' KB בתוך הקובץ.' + (kb > 600 ? ' זו תמונה כבדה; כדאי לחתוך אותה.' : ''), kb > 600 ? 'warn' : 'ok');
      }).catch(function (err) { toast('הוספת התמונה נכשלה: ' + err.message, 'error'); });
    }

    /* ---------- tables, lists, variants ---------- */
    function tableOp(op) {
      var s = selected; if (!s) return;
      var table = s.closest('table'); if (!table || !inSec(table)) return;
      var cell = s.closest('td,th'), row = s.closest('tr') || (cell && cell.parentElement);
      var rows = Array.prototype.slice.call(table.querySelectorAll('tr'));
      var ci = cell ? Array.prototype.indexOf.call(cell.parentElement.children, cell) : 0;
      mutate(function () {
        if (op === 'rowAfter') {
          var ref = row || rows[rows.length - 1];
          var tr = doc.createElement('tr');
          Array.prototype.forEach.call(ref.children, function (c) {
            var n = doc.createElement(c.localName === 'th' && ref === rows[0] ? 'td' : c.localName);
            if (c.className && c.localName !== 'th') n.className = c.className;
            tr.appendChild(n);
          });
          ref.after(tr);
        } else if (op === 'rowDel') {
          if (row && rows.length > 2) row.remove();
        } else if (op === 'colAfter') {
          rows.forEach(function (tr) {
            var ref = tr.children[ci] || tr.lastElementChild;
            var n = doc.createElement(ref ? ref.localName : 'td');
            if (ref && ref.className) n.className = ref.className.replace(/\bk\b/, '').trim() || '';
            if (!n.className) n.removeAttribute('class');
            if (ref) ref.after(n); else tr.appendChild(n);
          });
        } else if (op === 'colDel') {
          if (rows[0] && rows[0].children.length > 1) rows.forEach(function (tr) { var c = tr.children[ci]; if (c) c.remove(); });
        }
      });
      select(table);
    }
    function listAdd() {
      var s = selected; if (!s) return;
      var li = s.closest('li'), list = s.closest('ul,ol');
      if (!list || !inSec(list)) return;
      var n = doc.createElement('li'); n.textContent = 'נקודה';
      mutate(function () { if (li) li.after(n); else list.appendChild(n); });
      select(n);
    }
    function setVariant(el, base, cls, opts) {
      mutate(function () {
        opts.forEach(function (o2) { if (o2[0]) el.classList.remove(o2[0]); });
        if (cls) el.classList.add(cls);
      });
      select(el);
    }

    /* ---------- side panel: selected block ---------- */
    function renderSel() {
      selPanel.textContent = '';
      var el = selected;
      if (!el || !inSec(el)) { selPanel.appendChild(h('p', { class: 'muted small' }, 'לחצו על בלוק בשקופית כדי לבחור אותו.')); return; }
      var crumbs = h('div', { class: 'se-crumbs' });
      var chain = [];
      for (var c = el; c && c !== sec; c = c.parentElement) chain.unshift(c);
      chain.forEach(function (x, i) {
        if (i) crumbs.appendChild(h('span', { class: 'muted' }, '›'));
        crumbs.appendChild(btn(blockName(x), function () { stopEditing(); select(x); }, 'crumb' + (x === el ? ' on' : '')));
      });
      selPanel.appendChild(crumbs);
      var fixed = isFixed(el);
      var acts = h('div', { class: 'row' },
        btn('↑ למעלה', function () { moveSel(-1); }, 'small', null),
        btn('↓ למטה', function () { moveSel(1); }, 'small', null),
        btn('שכפול', function () { duplicateSel(); }, 'small', null),
        btn('מחיקה', function () { deleteSel(); }, 'small danger', null));
      if (fixed) Array.prototype.forEach.call(acts.children, function (b) { b.disabled = true; });
      selPanel.appendChild(acts);
      if (fixed) selPanel.appendChild(h('p', { class: 'muted small' }, blockName(el) + ' הוא חלק קבוע בתבנית: עורכים את הטקסט שלו, לא מזיזים ולא מוחקים.'));
      (VARIANTS[kind] || []).forEach(function (v) {
        var target = el.classList.contains(v.cls) ? el : el.closest('.' + v.cls);
        if (!target || !inSec(target)) return;
        var cur = v.opts.find(function (o2) { return o2[0] && target.classList.contains(o2[0]); });
        selPanel.appendChild(h('div', { class: 'row' }, h('span', { class: 'muted small' }, 'צבע ' + blockName(target) + ':'),
          v.opts.map(function (o2) { return btn(o2[1], function () { setVariant(target, v.cls, o2[0], v.opts); }, 'small' + ((cur ? cur[0] === o2[0] : !o2[0]) ? ' on' : '')); })));
      });
      if (el.closest('table') && inSec(el.closest('table'))) {
        selPanel.appendChild(h('div', { class: 'row' }, h('span', { class: 'muted small' }, 'טבלה:'),
          btn('+ שורה', function () { tableOp('rowAfter'); }, 'small'), btn('− שורה', function () { tableOp('rowDel'); }, 'small'),
          btn('+ עמודה', function () { tableOp('colAfter'); }, 'small'), btn('− עמודה', function () { tableOp('colDel'); }, 'small')));
      }
      if (el.closest('ul,ol') && inSec(el.closest('ul,ol'))) selPanel.appendChild(h('div', { class: 'row' }, h('span', { class: 'muted small' }, 'רשימה:'), btn('+ פריט', listAdd, 'small')));
      var img = el.localName === 'img' ? el : null;
      if (img) {
        var alt = h('input', { type: 'text', value: img.getAttribute('alt') || '', dir: 'rtl' });
        alt.addEventListener('change', function () { mutate(function () { img.setAttribute('alt', alt.value); }); });
        selPanel.appendChild(h('div', { class: 'row' }, btn('החלפת תמונה…', pickImage, 'small'),
          [['25%', 'רבע'], ['50%', 'חצי'], ['75%', 'שלושה רבעים'], ['', 'מלא']].map(function (w) {
            return btn(w[1], function () { mutate(function () { img.style.width = w[0]; if (!img.getAttribute('style')) img.removeAttribute('style'); }); select(img); }, 'small');
          })));
        selPanel.appendChild(h('label', { class: 'field' }, h('span', { class: 'muted small' }, 'תיאור התמונה (alt)'), alt));
      }
      var ta = h('textarea', { class: 'code', dir: 'ltr', rows: 6, spellcheck: 'false' });
      ta.value = serialize(el, reg);
      var orig = ta.value;
      selPanel.appendChild(h('details', { class: 'panel' }, h('summary', null, 'HTML של הבלוק'), ta,
        h('div', { class: 'row' }, btn('החלה', function () {
          var v = ta.value.trim();
          if (v === orig) return;
          var probe = doc.createElement('template'); probe.innerHTML = v;
          var els = Array.prototype.filter.call(probe.content.childNodes, function (n) { return n.nodeType === 1 || (n.nodeType === 3 && n.data.trim()); });
          if (els.length !== 1 || els[0].nodeType !== 1) { toast('צריך אלמנט HTML אחד בדיוק.', 'error'); return; }
          var nodes = nodesFrom(v);
          var nel = nodes.find(function (n) { return n.nodeType === 1; });
          mutate(function () { el.replaceWith(nel); });
          select(nel);
        }, 'small primary'))));
    }

    /* ---------- notes ---------- */
    var notesOrig = '', notesSnap = null;
    function noteEl() { return sec.querySelector(':scope > aside.speaker-note'); }
    function loadNotes() { var n = noteEl(); notesBox.innerHTML = n ? n.innerHTML : ''; notesOrig = notesBox.innerHTML; }
    function bindNotes() {
      loadNotes();
      notesBox.addEventListener('focus', function () { stopEditing(); notesSnap = snapshot(); notesOrig = (noteEl() || {}).innerHTML || ''; });
      notesBox.addEventListener('input', function () {
        var v = R.sanitize(notesBox.innerHTML, notesOrig);
        var n = noteEl();
        if (!n) { n = doc.createElement('aside'); n.className = 'speaker-note'; var f = sec.querySelector(':scope > .footer'); sec.insertBefore(n, f); }
        if (n.innerHTML !== v) n.innerHTML = v;
      });
      notesBox.addEventListener('blur', function () { if (notesSnap && snapshot() !== notesSnap) { pushUndo(notesSnap); changed(); } notesSnap = null; });
      notesBox.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); R.wrapIn(notesBox, 'strong'); }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); R.wrapIn(notesBox, 'span', 'ltr'); }
      });
      notesBox.addEventListener('paste', function (e) { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\r?\n/g, ' ')); });
    }

    /* ---------- overlays ---------- */
    function rectOf(el) { return el && el.getBoundingClientRect ? el.getBoundingClientRect() : null; }
    function box(div, r, pad) {
      if (!r) { div.hidden = true; return; }
      pad = pad || 0;
      div.hidden = false;
      div.style.left = (r.left - pad) + 'px'; div.style.top = (r.top - pad) + 'px';
      div.style.width = (r.width + 2 * pad) + 'px'; div.style.height = (r.height + 2 * pad) + 'px';
    }
    function place() {
      if (closed || !doc || !doc.defaultView || codeMode) { hoverBox.hidden = selBox.hidden = blockBar.hidden = true; return; }
      box(hoverBox, hovered && hovered !== selected && inSec(hovered) ? rectOf(hovered) : null, 2);
      var r = selected && inSec(selected) ? rectOf(selected) : null;
      box(selBox, r, 3);
      selBox.firstChild.textContent = selected ? blockName(selected) + (editing === selected ? ' · עריכת טקסט' : '') : '';
      selBox.classList.toggle('editing', !!editing && editing === selected);
      if (!r) { blockBar.hidden = true; return; }
      blockBar.hidden = false;
      var fixed = isFixed(selected);
      Array.prototype.forEach.call(blockBar.children, function (b, i) { b.disabled = fixed && i !== 3; });
      var bw = blockBar.offsetWidth || 150, bh = blockBar.offsetHeight || 28;
      // the block's name sits on the right edge (RTL); the bar goes on the left so neither hides the other
      var left = Math.max(4, Math.min(r.left - 3, frame.clientWidth - bw - 4));
      var topPx = r.top - bh - 6;
      if (topPx < 4) topPx = Math.min(r.bottom + 6, frame.clientHeight - bh - 4);
      blockBar.style.left = left + 'px'; blockBar.style.top = topPx + 'px';
    }

    /* ---------- checks (template rules) ---------- */
    /* Elements that leave the slide, enter the nav-bar zone, are cut off by a
       clipping parent, or are squeezed so that their content spills over.
       The canvas runs no scripts, so a demo slide can look different from the
       live deck; only elements that were fine when the modal opened and broke
       through the edit are reported as errors (baseline comparison). */
    var baseline = null;
    function measure() {
      var st = stage.getBoundingClientRect(), k = st.width / 1280, tol = 6 * k, win = doc.defaultView;
      var body = sec.querySelector(':scope > .body');
      var limit = body ? body.getBoundingClientRect().bottom : st.top + 650 * k;
      var flagged = [], below = false;
      function clipBox(el) {
        for (var a = el.parentElement; a && a !== sec; a = a.parentElement) {
          var o = win.getComputedStyle(a);
          if (o.overflowX !== 'visible' || o.overflowY !== 'visible') return a.getBoundingClientRect();
        }
        return null;
      }
      sec.querySelectorAll('*').forEach(function (el) {
        if (el.closest('aside,.footer,.slide-mark,svg') && el.localName !== 'svg') return;
        if (/^(input|select|textarea|button|option)$/.test(el.localName)) return;
        if (flagged.some(function (f) { return f.contains(el); })) return;
        var r = el.getBoundingClientRect();
        if (!r.width && !r.height) return;
        var cs = win.getComputedStyle(el);
        if (cs.position === 'absolute' || cs.position === 'fixed' || cs.visibility === 'hidden') return;
        if (r.bottom > limit + tol) { flagged.push(el); below = true; return; }
        if (r.right > st.right + tol || r.left < st.left - tol) { flagged.push(el); return; }
        if (el.firstElementChild && el.localName !== 'svg' && cs.overflowY === 'visible' && el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 8) { flagged.push(el); return; }
        var cb = clipBox(el);
        if (cb && (r.bottom > cb.bottom + tol || r.top < cb.top - tol || r.right > cb.right + tol || r.left < cb.left - tol)) flagged.push(el);
      });
      return { flagged: flagged, below: below };
    }
    function keyOf(el) { return el.getAttribute(ATTR) || ''; }
    function runChecks() {
      var list = side.querySelector('.se-checks');
      if (closed || !doc || !doc.defaultView || !sec || !list) return [];
      warnLayer.textContent = '';
      var out = [];
      if (isDeck && stage) {
        var m = measure();
        if (!baseline) baseline = new Set(m.flagged.map(keyOf).filter(Boolean));
        var fresh = m.flagged.filter(function (el) { var kk = keyOf(el); return !kk || !baseline.has(kk); });
        if (fresh.length) {
          out.push({ level: 'error', msg: 'אחרי העריכה תוכן נחתך, נדחס או יוצא מגבולות השקופית' + (m.below ? ' ונכנס לאזור סרגל הניווט' : '') + ' (מסומן באדום). מקצרים טקסט או מפצלים לשתי שקופיות; לא מקטינים גופן.' });
          fresh.forEach(function (f) { var d = h('div', { class: 'se-overflow' }); box(d, f.getBoundingClientRect(), 1); warnLayer.appendChild(d); });
        }
        var t = sec.querySelector(':scope > h1.title');
        var k = stage.getBoundingClientRect().width / 1280;
        if (t && t.textContent.trim()) {
          var lh = parseFloat(doc.defaultView.getComputedStyle(t).lineHeight) || 47;
          var lines = Math.round(t.getBoundingClientRect().height / k / lh);
          if (lines > 2) out.push({ level: 'warn', msg: 'הכותרת נפרשת על ' + lines + ' שורות; לפי התבנית עד שתיים.' });
        }
        var note = sec.querySelector(':scope > aside.speaker-note');
        if (!note || !note.textContent.trim()) out.push({ level: 'warn', msg: 'אין הערות מדריך.' });
      }
      if (/[–—]/.test(sec.textContent)) out.push({ level: 'warn', msg: 'יש קו מפריד ארוך (– או —) בטקסט; בסט לא משתמשים בו.' });
      list.textContent = '';
      if (!out.length) list.appendChild(h('li', { class: 'ok' }, 'אין ממצאים.'));
      out.forEach(function (x) { list.appendChild(h('li', { class: x.level }, x.msg)); });
      warnEl.hidden = !out.some(function (x) { return x.level === 'error'; });
      warnEl.textContent = 'תוכן חורג';
      return out;
    }
    api.layout = function () { return measure().flagged.length; };

    /* ---------- code view ---------- */
    function toggleCode() {
      if (!codeMode) {
        stopEditing();
        code.value = serializeNow();
        codeMode = true;
        code.hidden = false; frame.style.visibility = 'hidden';
        codeB.classList.add('on'); codeB.textContent = 'תצוגה';
        place(); code.focus();
        return;
      }
      var v = code.value.trim();
      var r = M.unitRoot(v);
      if (!r || r.start !== 0 || r.end !== v.length || !S.matches(r, isDeck ? 'section.slide' : 'div.pg')) {
        toast('ה-HTML צריך להיות ' + (isDeck ? '<section class="slide">' : '<div class="pg">') + ' אחד, סגור, בלי שום דבר לפניו או אחריו.', 'error');
        return;
      }
      codeMode = false;
      code.hidden = true; frame.style.visibility = '';
      codeB.classList.remove('on'); codeB.textContent = 'קוד';
      if (v !== serializeNow()) {
        var s = snapshot();
        replaceSection(reg.add(v, doc));
        pushUndo(s);
        if (notesBox) loadNotes();
      }
      select(null); changed();
    }

    /* ---------- apply / cancel / navigation ---------- */
    function result() {
      stopEditing();
      if (codeMode) toggleCode();
      if (codeMode) return null;
      var html = serializeNow();
      var r = M.unitRoot(html);
      if (!r || r.start !== 0 || r.end !== html.length) { toast('המבנה של ' + (isDeck ? 'השקופית' : 'העמוד') + ' לא תקין; השינויים לא הוחלו.', 'error'); return null; }
      return html;
    }
    function apply(andClose, andSave) {
      var html = result();
      if (html == null) return false;
      if (html !== o.html) { o.onApply(html); o.html = html; }
      if (andSave && o.onSave) o.onSave();
      if (andClose) close();
      return true;
    }
    function cancel() {
      stopEditing();
      if (serializeNow() !== o.html && !confirm('לבטל את השינויים ב' + (isDeck ? 'שקופית' : 'עמוד') + ' ולסגור?')) return;
      close();
    }
    function nav(dir) { if (apply(false)) { close(); o.onNav(dir); } }
    function close() {
      if (closed) return;
      closed = true;
      ro.disconnect();
      dlg.close(); dlg.remove();
      if (root.IBSlideEditor.current === api) root.IBSlideEditor.current = null;
      if (o.onClose) o.onClose();
    }
    function toast(msg, kind2) { if (o.toast) o.toast(msg, kind2); }
    root.IBSlideEditor.current = api;
    return api;
  }

  root.IBSlideEditor = { open: open, processImage: processImage, current: null, DECK_BLOCKS: DECK_BLOCKS, GUIDE_BLOCKS: GUIDE_BLOCKS };
})(typeof window !== 'undefined' ? window : globalThis);
