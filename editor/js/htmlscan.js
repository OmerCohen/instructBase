/* htmlscan.js — offset-preserving HTML scanner.
 *
 * The editor never re-serialises a whole document. It scans the source into a
 * light tree whose nodes remember their exact byte offsets, then edits the
 * source by splicing only the ranges that changed. Everything that was not
 * touched stays byte-identical, including every <script> block.
 *
 * Node fields: name (lower-case), rawName, attrs {name: value}, attrList
 * [{name, value, start, end}], start (at '<'), openEnd (after '>'),
 * closeStart (at '</', or where the element was implicitly closed),
 * end (after the closing '>'), children, parent, selfClosing, foreign.
 */
(function (root) {
  'use strict';

  function set(words) { var o = Object.create(null); words.split(/\s+/).forEach(function (w) { if (w) o[w] = true; }); return o; }

  var VOID = set('area base br col embed hr img input link meta param source track wbr');
  var RAW = set('script style textarea title xmp');
  var P_CLOSERS = set('address article aside blockquote details dialog div dl fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr main menu nav ol p pre section table ul');
  var FOREIGN = set('svg math');

  var reName = /[A-Za-z][^\s\/>]*/y;
  var reWs = /\s*/y;
  var reAttrName = /[^\s"'>\/=]+/y;
  var reUnquoted = /[^\s>]+/y;
  var reEndTag = /<\/([A-Za-z][^\s\/>]*)[^>]*>/y;

  function scan(src) {
    var rootNode = { name: '#root', rawName: '#root', attrs: {}, attrList: [], start: 0, openEnd: 0, closeStart: src.length, end: src.length, children: [], parent: null, foreign: false };
    var stack = [rootNode];
    var n = src.length;
    var i = 0;

    function top() { return stack[stack.length - 1]; }
    function closeTop(pos) { var t = stack.pop(); t.closeStart = pos; t.end = pos; t.implied = true; }
    function inForeign() { return top().foreign; }

    while (i < n) {
      var lt = src.indexOf('<', i);
      if (lt < 0) break;
      var c1 = src.charCodeAt(lt + 1);
      // comment
      if (src.startsWith('<!--', lt)) { var ce = src.indexOf('-->', lt + 4); i = ce < 0 ? n : ce + 3; continue; }
      // doctype / processing instruction / CDATA
      if (c1 === 33 /* ! */ || c1 === 63 /* ? */) {
        if (src.startsWith('<![CDATA[', lt)) { var cd = src.indexOf(']]>', lt); i = cd < 0 ? n : cd + 3; continue; }
        var ge = src.indexOf('>', lt); i = ge < 0 ? n : ge + 1; continue;
      }
      // end tag
      if (c1 === 47 /* / */) {
        reEndTag.lastIndex = lt;
        var em = reEndTag.exec(src);
        if (!em) { i = lt + 2; continue; }
        var ename = em[1].toLowerCase();
        var endPos = lt + em[0].length;
        for (var k = stack.length - 1; k > 0; k--) {
          if (stack[k].name === ename) {
            while (stack.length - 1 > k) closeTop(lt);
            var el = stack.pop(); el.closeStart = lt; el.end = endPos;
            break;
          }
        }
        i = endPos;
        continue;
      }
      // start tag
      reName.lastIndex = lt + 1;
      var nm = reName.exec(src);
      if (!nm || nm.index !== lt + 1) { i = lt + 1; continue; }
      var rawName = nm[0];
      var name = rawName.toLowerCase();
      var p = lt + 1 + rawName.length;
      var attrs = Object.create(null), attrList = [];
      var selfClosing = false, closed = false;
      while (p < n) {
        reWs.lastIndex = p; reWs.exec(src); p = reWs.lastIndex;
        var ch = src.charCodeAt(p);
        if (ch === 62 /* > */) { p++; closed = true; break; }
        if (ch === 47 /* / */) {
          if (src.charCodeAt(p + 1) === 62) { selfClosing = true; p += 2; closed = true; break; }
          p++; continue;
        }
        reAttrName.lastIndex = p;
        var an = reAttrName.exec(src);
        if (!an || an.index !== p) { p++; continue; }
        var aStart = p;
        p += an[0].length;
        var value = '';
        reWs.lastIndex = p; reWs.exec(src); var q = reWs.lastIndex;
        if (src.charCodeAt(q) === 61 /* = */) {
          reWs.lastIndex = q + 1; reWs.exec(src); q = reWs.lastIndex;
          var qc = src.charCodeAt(q);
          if (qc === 34 || qc === 39) {
            var qe = src.indexOf(String.fromCharCode(qc), q + 1);
            if (qe < 0) qe = n - 1;
            value = src.slice(q + 1, qe);
            p = qe + 1;
          } else {
            reUnquoted.lastIndex = q;
            var uv = reUnquoted.exec(src);
            value = uv && uv.index === q ? uv[0] : '';
            p = q + value.length;
          }
        }
        var aname = an[0].toLowerCase();
        if (!(aname in attrs)) attrs[aname] = decodeEntities(value);
        attrList.push({ name: aname, value: value, start: aStart, end: p });
      }
      if (!closed) p = n;

      var parentForeign = inForeign();
      // implied end tags (HTML only)
      if (!parentForeign) {
        var t = top().name;
        if (name === 'li' && t === 'li') closeTop(lt);
        else if ((name === 'dt' || name === 'dd') && (t === 'dt' || t === 'dd')) closeTop(lt);
        else if ((name === 'td' || name === 'th') && (t === 'td' || t === 'th')) closeTop(lt);
        else if (name === 'tr') { if (t === 'td' || t === 'th') { closeTop(lt); t = top().name; } if (t === 'tr') closeTop(lt); }
        else if (name === 'thead' || name === 'tbody' || name === 'tfoot') { if (t === 'td' || t === 'th') { closeTop(lt); t = top().name; } if (t === 'tr') closeTop(lt); }
        else if (name === 'option' && t === 'option') closeTop(lt);
        else if (P_CLOSERS[name] && t === 'p') closeTop(lt);
      }

      var parent = top();
      var node = {
        name: name, rawName: rawName, attrs: attrs, attrList: attrList,
        start: lt, openEnd: p, closeStart: p, end: p,
        children: [], parent: parent, selfClosing: selfClosing,
        foreign: parentForeign || !!FOREIGN[name]
      };
      parent.children.push(node);

      if (VOID[name] && !parentForeign) { i = p; continue; }
      if (selfClosing && node.foreign) { i = p; continue; }
      if (RAW[name] && !(parentForeign && name === 'title')) {
        var re = new RegExp('</' + name + '[\\s>/]', 'ig');
        re.lastIndex = p;
        var rm = re.exec(src);
        if (!rm) { node.closeStart = n; node.end = n; i = n; continue; }
        node.closeStart = rm.index;
        var gt = src.indexOf('>', rm.index);
        node.end = gt < 0 ? n : gt + 1;
        i = node.end;
        continue;
      }
      stack.push(node);
      i = p;
    }
    while (stack.length > 1) closeTop(n);
    return rootNode;
  }

  /* ---------- entities ---------- */
  var NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rlm: '‏', lrm: '‎', mdash: '—', ndash: '–', larr: '←', rarr: '→', middot: '·', hellip: '…', times: '×', deg: '°', shy: '­', zwj: '‍', zwnj: '‌' };
  function decodeEntities(s) {
    if (s.indexOf('&') < 0) return s;
    return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, function (m, e) {
      if (e[0] === '#') {
        var cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        try { return String.fromCodePoint(cp); } catch (err) { return m; }
      }
      var v = NAMED[e.toLowerCase()];
      return v === undefined ? m : v;
    });
  }
  function escapeText(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;'); }
  function escapeAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---------- traversal and simple selectors ---------- */
  function walk(node, fn) {
    var stack = node.children.slice().reverse();
    while (stack.length) {
      var x = stack.pop();
      if (fn(x) === false) continue;            // false = do not descend
      for (var k = x.children.length - 1; k >= 0; k--) stack.push(x.children[k]);
    }
  }
  function classes(node) { var c = node.attrs && node.attrs['class']; return c ? c.trim().split(/\s+/) : []; }
  function hasClass(node, c) { return classes(node).indexOf(c) >= 0; }

  // compound selector: tag.cls.cls[attr][attr=value]
  function parseCompound(s) {
    var m = /^([a-z0-9*-]*)/i.exec(s);
    var o = { tag: m[1] ? m[1].toLowerCase() : '', cls: [], attrs: [] };
    var rest = s.slice(m[1].length);
    var re = /\.([\w-]+)|\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]/g, mm;
    while ((mm = re.exec(rest))) {
      if (mm[1]) o.cls.push(mm[1]);
      else o.attrs.push({ name: mm[2].toLowerCase(), value: mm[3] });
    }
    return o;
  }
  function matchCompound(node, c) {
    if (!node || node.name === '#root') return false;
    if (c.tag && c.tag !== '*' && node.name !== c.tag) return false;
    for (var k = 0; k < c.cls.length; k++) if (!hasClass(node, c.cls[k])) return false;
    for (var a = 0; a < c.attrs.length; a++) {
      var at = c.attrs[a];
      if (!(at.name in node.attrs)) return false;
      if (at.value !== undefined && node.attrs[at.name] !== at.value) return false;
    }
    return true;
  }
  // supports descendant (space) and child (>) combinators, and comma lists
  function compile(selector) {
    return selector.split(',').map(function (part) {
      var toks = part.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/);
      var seq = [];
      for (var k = 0; k < toks.length; k++) {
        if (toks[k] === '>') continue;
        seq.push({ comb: toks[k - 1] === '>' ? '>' : ' ', c: parseCompound(toks[k]) });
      }
      return seq;
    });
  }
  function matchSeq(node, seq, idx, scope) {
    if (!matchCompound(node, seq[idx].c)) return false;
    if (idx === 0) return true;
    var comb = seq[idx].comb;
    var p = node.parent;
    if (comb === '>') return p && p !== scope && matchSeq(p, seq, idx - 1, scope);
    while (p && p !== scope && p.name !== '#root') {
      if (matchSeq(p, seq, idx - 1, scope)) return true;
      p = p.parent;
    }
    return false;
  }
  function matches(node, selector, scope) {
    var seqs = typeof selector === 'string' ? compile(selector) : selector;
    for (var k = 0; k < seqs.length; k++) if (matchSeq(node, seqs[k], seqs[k].length - 1, scope)) return true;
    return false;
  }
  function qsa(node, selector) {
    var seqs = compile(selector), out = [];
    walk(node, function (x) { if (matches(x, seqs, node)) out.push(x); });
    return out;
  }
  function qs(node, selector) { var r = qsa(node, selector); return r.length ? r[0] : null; }
  function childrenMatching(node, selector) {
    var seqs = compile(selector);
    return node.children.filter(function (x) { return matches(x, seqs, node); });
  }

  /* ---------- source helpers ---------- */
  function inner(src, node) { return src.slice(node.openEnd, node.closeStart); }
  function outer(src, node) { return src.slice(node.start, node.end); }
  function text(src, node) {
    var parts = [];
    var pos = node.openEnd;
    function emit(a, b) { if (b > a) parts.push(src.slice(a, b)); }
    (function rec(x) {
      for (var k = 0; k < x.children.length; k++) {
        var ch = x.children[k];
        emit(pos, ch.start);
        if (ch.name === 'script' || ch.name === 'style') { pos = ch.end; continue; }
        if (ch.name === 'br') parts.push('\n');
        pos = ch.openEnd;
        rec(ch);
        pos = ch.end;
      }
      emit(pos, x.closeStart);
    })(node);
    return decodeEntities(parts.join('').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ''));
  }
  function textCompact(src, node) { return text(src, node).replace(/\s+/g, ' ').trim(); }

  /* edits: [{start, end, text}] — non-overlapping */
  function splice(src, edits) {
    if (!edits.length) return src;
    var sorted = edits.slice().sort(function (a, b) { return a.start - b.start || a.end - b.end; });
    var out = [], pos = 0;
    for (var k = 0; k < sorted.length; k++) {
      var e = sorted[k];
      if (e.start < pos) throw new Error('overlapping edits at ' + e.start);
      out.push(src.slice(pos, e.start), e.text);
      pos = e.end;
    }
    out.push(src.slice(pos));
    return out.join('');
  }

  /* edit that sets (or adds, or with value === null removes) one attribute */
  function attrEdit(src, node, name, value) {
    name = name.toLowerCase();
    for (var k = 0; k < node.attrList.length; k++) {
      var a = node.attrList[k];
      if (a.name !== name) continue;
      if (value === null) {
        var s = a.start;
        while (s > node.start && /\s/.test(src[s - 1])) s--;
        return { start: s, end: a.end, text: '' };
      }
      return { start: a.start, end: a.end, text: name + '="' + escapeAttr(value) + '"' };
    }
    if (value === null) return null;
    var at = node.start + 1 + node.rawName.length;
    return { start: at, end: at, text: ' ' + name + '="' + escapeAttr(value) + '"' };
  }

  var api = {
    scan: scan, walk: walk, qs: qs, qsa: qsa, matches: matches, childrenMatching: childrenMatching,
    classes: classes, hasClass: hasClass, inner: inner, outer: outer, text: text, textCompact: textCompact,
    splice: splice, attrEdit: attrEdit, decodeEntities: decodeEntities, escapeText: escapeText, escapeAttr: escapeAttr,
    VOID: VOID
  };
  root.IBScan = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
