/* richtext.js — inline rich-text helpers shared by the side panel, the
 * preview edits and the slide edit modal. Every function works on the
 * document that owns the element it is given, so it also works inside the
 * modal's iframe.
 */
(function (root) {
  'use strict';
  var INLINE_OK = { a: 1, abbr: 1, b: 1, bdi: 1, bdo: 1, br: 1, cite: 1, code: 1, em: 1, i: 1, kbd: 1, mark: 1, q: 1, s: 1, samp: 1, small: 1, span: 1, strong: 1, sub: 1, sup: 1, time: 1, u: 1, 'var': 1, wbr: 1 };
  var EDITOR_ATTRS = ['contenteditable', 'data-ib', 'spellcheck'];

  function frag(html) { var t = document.createElement('template'); t.innerHTML = html || ''; return t; }
  function unwrapNode(el) { var p = el.parentNode; while (el.firstChild) p.insertBefore(el.firstChild, el); p.removeChild(el); }

  /* keep only inline markup; drop browser-added styles the original did not have */
  function sanitize(html, origHtml, allowStyles) {
    var t = frag(html), styles = new Set(allowStyles || []);
    if (origHtml) frag(origHtml).content.querySelectorAll('[style]').forEach(function (n) { styles.add(n.getAttribute('style')); });
    (function clean(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType !== 1) return;          // text and comments stay as they are
        clean(ch);
        EDITOR_ATTRS.forEach(function (a) { ch.removeAttribute(a); });
        if (ch.hasAttribute('style') && !styles.has(ch.getAttribute('style'))) ch.removeAttribute('style');
        var tag = ch.tagName.toLowerCase();
        if (tag === 'div' || tag === 'p') {
          // a browser block is one line: one <br> before it, and an empty <div><br></div> adds nothing more
          if (ch.childNodes.length === 1 && ch.firstChild.nodeName === 'BR') ch.removeChild(ch.firstChild);
          if (ch.previousSibling) ch.parentNode.insertBefore(document.createElement('br'), ch);
          unwrapNode(ch); return;
        }
        if (!INLINE_OK[tag] || (tag === 'span' && !ch.attributes.length)) unwrapNode(ch);
      });
    })(t.content);
    // a line break typed at the very end renders nothing; keep only as many trailing <br> as the original had
    var keep = 0, om = /((?:<br\s*\/?>\s*)+)$/i.exec(origHtml || '');
    if (om) keep = (om[1].match(/<br/gi) || []).length;
    function trailingBrs() {
      var n = 0;
      for (var c = t.content.lastChild; c; c = c.previousSibling) {
        if (c.nodeName === 'BR') n++;
        else if (!(c.nodeType === 3 && !c.data.trim())) break;
      }
      return n;
    }
    while (trailingBrs() > keep) {
      var c = t.content.lastChild;
      while (c && c.nodeName !== 'BR') c = c.previousSibling;
      if (!c) break;
      c.remove();
    }
    // Chrome types U+00A0 for a space at a line end or next to another space.
    // If the original had none, they are typing artefacts: make them plain spaces.
    if (!/&nbsp;| /.test(origHtml || '')) {
      var tw = document.createTreeWalker(t.content, NodeFilter.SHOW_TEXT), tn;
      while ((tn = tw.nextNode())) if (tn.data.indexOf(' ') >= 0) tn.data = tn.data.replace(/ /g, ' ').replace(/ {2,}/g, ' ');
    }
    return t.innerHTML;
  }

  /* loose: ignore trailing <br> and whitespace (Chrome leaves a placeholder <br> in an emptied element) */
  function sameHtml(a, b, loose) {
    var x = frag(a).content, y = frag(b).content;
    [x, y].forEach(function (f) {
      f.querySelectorAll('[data-ib],[contenteditable]').forEach(function (n) { n.removeAttribute('data-ib'); n.removeAttribute('contenteditable'); });
      if (loose) while (f.lastChild && (f.lastChild.nodeName === 'BR' || (f.lastChild.nodeType === 3 && !f.lastChild.data.trim()))) f.removeChild(f.lastChild);
      f.normalize();
    });
    return x.isEqualNode(y);
  }

  function selOf(el) { return el.ownerDocument.getSelection(); }
  /* range inside box, from the live selection or a saved one */
  function rangeIn(box, saved) {
    var sel = selOf(box);
    if (sel.rangeCount && box.contains(sel.getRangeAt(0).commonAncestorContainer)) return sel.getRangeAt(0);
    if (saved && box.contains(saved.commonAncestorContainer)) { sel.removeAllRanges(); sel.addRange(saved); return saved; }
    return null;
  }
  function fire(box) { box.dispatchEvent(new Event('input', { bubbles: true })); }

  /* wrap the selection in <tag class=cls style=style>, or unwrap if already inside one */
  function wrapIn(box, tag, cls, saved, style) {
    var r = rangeIn(box, saved);
    if (!r) return false;
    var doc = box.ownerDocument;
    var anc = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode;
    var sel = style ? tag + '[style]' : cls ? tag + '.' + cls : (tag === 'strong' ? 'strong,b' : tag);
    var hit = anc.closest(sel);
    if (hit && hit !== box && box.contains(hit) && (!style || hit.getAttribute('style') === style)) { unwrapNode(hit); box.normalize(); fire(box); return true; }
    if (r.collapsed) return false;
    var w = doc.createElement(tag);
    if (cls) w.className = cls;
    if (style) w.setAttribute('style', style);
    w.appendChild(r.extractContents()); r.insertNode(w);
    var nr = doc.createRange(); nr.selectNodeContents(w);
    var s = selOf(box); s.removeAllRanges(); s.addRange(nr);
    fire(box);
    return true;
  }
  function clearIn(box, saved) {
    var r = rangeIn(box, saved);
    if (!r || r.collapsed) return false;
    var t = r.toString(); r.deleteContents(); r.insertNode(box.ownerDocument.createTextNode(t)); box.normalize();
    fire(box);
    return true;
  }

  var api = { INLINE_OK: INLINE_OK, frag: frag, unwrapNode: unwrapNode, sanitize: sanitize, sameHtml: sameHtml, wrapIn: wrapIn, clearIn: clearIn, rangeIn: rangeIn };
  root.IBRich = api;
})(typeof window !== 'undefined' ? window : globalThis);
