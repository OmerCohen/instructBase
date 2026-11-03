/* preview-agent.js — runs INSIDE the sandboxed preview iframe.
 *
 * The editor serialises this function with Function.prototype.toString and
 * injects it at the end of the previewed document, so it must be fully
 * self-contained (no references to anything outside its own body).
 *
 * It never writes the document back: it only reports the innerHTML of the
 * element that was edited (data-ib="unit:index"); the editor splices that into
 * the source. Elements are marked editable by the editor, not here.
 */
function IBPreviewAgent(KIND) {
  'use strict';
  var editing = true, cur = null, orig = null, saved = null;
  var docEl = document.documentElement;
  function post(m) { m.__ib = 1; parent.postMessage(m, '*'); }

  var css = document.createElement('style');
  css.textContent =
    'html.ib-edit [data-ib]{cursor:text}' +
    'html.ib-edit [data-ib]:hover{outline:2px dashed rgba(251,191,36,.8);outline-offset:3px}' +
    '[data-ib][contenteditable="true"]{outline:2px solid #fbbf24!important;outline-offset:3px;background:rgba(251,191,36,.07)}' +
    '[data-ib].ib-flash{outline:2px solid #22d3ee!important;outline-offset:3px}';
  if (KIND === 'guide') {
    // screen-only page look for A4 guide sources; never saved to the file
    css.textContent += '@media screen{html{background:#e9eef3}body{max-width:794px;margin:18px auto!important;background:#fff;padding:56px 60px!important;box-shadow:0 2px 18px rgba(15,39,64,.18)}.pg{border-bottom:2px dashed #cbd5e1;padding-bottom:28px;margin-bottom:28px}.pg:last-child{border-bottom:0}.title-pg{height:auto!important;min-height:520px}}';
  }
  (document.head || docEl).appendChild(css);
  docEl.classList.add('ib-edit');
  try { document.execCommand('styleWithCSS', false, false); } catch (e) { /* ignore */ }

  function units() { return document.querySelectorAll(KIND === 'deck' ? 'section.slide' : 'div.pg'); }
  function activeIndex() {
    var u = units();
    if (KIND === 'deck') {
      for (var i = 0; i < u.length; i++) if (u[i].classList.contains('active')) return i;
      return 0;
    }
    for (var j = 0; j < u.length; j++) { var r = u[j].getBoundingClientRect(); if (r.bottom > 40) return j; }
    return 0;
  }
  function key(k) { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }
  function goTo(i) {
    if (KIND === 'deck') {
      if (activeIndex() === i) return;
      key('Home');
      for (var k = 0; k < i; k++) key('ArrowRight');
    } else {
      var u = units()[i];
      if (u) u.scrollIntoView({ block: 'start' });
    }
  }

  /* report the visible unit */
  var last = -1;
  function report() { var i = activeIndex(); if (i !== last) { last = i; post({ type: 'unit', index: i }); } }
  if (KIND === 'deck') {
    var mo = new MutationObserver(report);
    Array.prototype.forEach.call(units(), function (s) { mo.observe(s, { attributes: true, attributeFilter: ['class'] }); });
  } else {
    addEventListener('scroll', function () { report(); }, { passive: true });
  }

  /* ---------- editing ---------- */
  function begin(el, ev) {
    if (cur === el) return;
    if (cur) commit();
    cur = el; orig = el.innerHTML;
    el.setAttribute('contenteditable', 'true');
    el.focus();
    if (ev && document.caretRangeFromPoint) {
      var r = document.caretRangeFromPoint(ev.clientX, ev.clientY);
      if (r) { var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    }
    post({ type: 'begin', id: el.getAttribute('data-ib'), html: orig });
  }
  function finish(keep) {
    if (!cur) return;
    var el = cur; cur = null; saved = null;
    if (!keep) el.innerHTML = orig;
    el.removeAttribute('contenteditable');
    var html = el.innerHTML;
    if (keep && html !== orig) post({ type: 'commit', id: el.getAttribute('data-ib'), html: html });
    else post({ type: 'end', id: el.getAttribute('data-ib') });
  }
  function commit() { finish(true); }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!editing) {
      if (a) { e.preventDefault(); post({ type: 'link', href: a.getAttribute('href') }); }
      return;
    }
    var el = e.target.closest && e.target.closest('[data-ib]');
    if (a && (!el || !cur)) { e.preventDefault(); }
    if (!el) return;
    if (el === cur) return;
    e.preventDefault(); e.stopPropagation();
    begin(el, e);
  }, true);
  document.addEventListener('dblclick', function (e) {
    if (editing) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (a) post({ type: 'link', href: a.getAttribute('href') });
  }, true);

  // Window capture listener: runs before the deck's own keydown handler, so
  // typing inside an edited element never changes slide or toggles notes.
  window.addEventListener('keydown', function (e) {
    if (!cur) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'z' || e.key === 'y')) { e.preventDefault(); post({ type: 'hotkey', key: e.key, shift: e.shiftKey }); }
      return;
    }
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); return; }
    if (e.key === 'Escape') { e.preventDefault(); commit(); return; }
    if (e.key === 'Tab') { e.preventDefault(); commit(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); wrap('strong', ''); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') { e.preventDefault(); wrap('span', 'ltr'); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); commit(); post({ type: 'hotkey', key: 's' }); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'u')) { e.preventDefault(); }
  }, true);
  window.addEventListener('keyup', function (e) { if (cur) e.stopPropagation(); }, true);
  document.addEventListener('paste', function (e) {
    if (!cur) return;
    e.preventDefault();
    var t = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, t.replace(/\r?\n/g, ' '));
  }, true);
  document.addEventListener('drop', function (e) { if (cur) e.preventDefault(); }, true);
  // Focus moving anywhere else (another element, or out to the editor) ends the
  // edit. A window switch (Alt+Tab) keeps activeElement and does not commit.
  document.addEventListener('focusout', function (e) {
    if (!cur || e.target !== cur) return;
    setTimeout(function () { if (cur && document.activeElement !== cur && !cur.contains(document.activeElement)) commit(); }, 0);
  }, true);
  document.addEventListener('selectionchange', function () {
    if (!cur) return;
    var s = getSelection();
    if (s.rangeCount && cur.contains(s.getRangeAt(0).commonAncestorContainer)) saved = s.getRangeAt(0).cloneRange();
  });

  function restore() {
    var s = getSelection();
    if (s.rangeCount && cur.contains(s.getRangeAt(0).commonAncestorContainer)) return s.getRangeAt(0);
    if (saved) { s.removeAllRanges(); s.addRange(saved); return saved; }
    return null;
  }
  function unwrap(el) { var p = el.parentNode; while (el.firstChild) p.insertBefore(el.firstChild, el); p.removeChild(el); p.normalize(); }
  function wrap(tag, cls) {
    if (!cur) return;
    cur.focus();
    var r = restore(); if (!r) return;
    var anc = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode;
    var sel = cls ? tag + '.' + cls : (tag === 'strong' ? 'strong,b' : tag);
    var hit = anc.closest(sel);
    if (hit && hit !== cur && cur.contains(hit)) { unwrap(hit); return; }
    if (r.collapsed) return;
    var w = document.createElement(tag);
    if (cls) w.className = cls;
    w.appendChild(r.extractContents());
    r.insertNode(w);
    var s = getSelection(), nr = document.createRange();
    nr.selectNodeContents(w); s.removeAllRanges(); s.addRange(nr);
  }
  function clearFormat() {
    if (!cur) return;
    cur.focus();
    var r = restore(); if (!r || r.collapsed) return;
    var t = r.toString();
    r.deleteContents();
    r.insertNode(document.createTextNode(t));
    cur.normalize();
  }

  addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.__ib !== 2) return;
    if (d.type === 'goto') goTo(d.index);
    else if (d.type === 'mode') {
      editing = !!d.editing;
      docEl.classList.toggle('ib-edit', editing);
      if (!editing && cur) commit();
    } else if (d.type === 'cmd') {
      if (d.cmd === 'strong') wrap('strong', '');
      else if (d.cmd === 'ltr') wrap('span', 'ltr');
      else if (d.cmd === 'clear') clearFormat();
      else if (d.cmd === 'commit') commit();
    } else if (d.type === 'deny') {
      if (cur && cur.getAttribute('data-ib') === d.id) finish(false);
    } else if (d.type === 'set') {
      var el = document.querySelector('[data-ib="' + d.id + '"]');
      if (el && el !== cur) { el.innerHTML = d.html; el.classList.add('ib-flash'); setTimeout(function () { el.classList.remove('ib-flash'); }, 600); }
    } else if (d.type === 'patch') {
      var unit = units()[d.unit], tgt = null;
      if (unit) { try { tgt = unit.querySelector(d.selector); } catch (err) { tgt = null; } }
      if (tgt && tgt !== cur) tgt.innerHTML = d.html;
    } else if (d.type === 'flash') {
      var f = document.querySelector('[data-ib="' + d.id + '"]');
      if (f) { f.classList.add('ib-flash'); setTimeout(function () { f.classList.remove('ib-flash'); }, 900); }
    }
  });

  function ready() { goTo(START); report(); post({ type: 'ready', count: units().length }); }
  var START = (window.__IB_START | 0);
  if (document.readyState === 'complete') setTimeout(ready, 0);
  else addEventListener('load', function () { setTimeout(ready, 0); });
}
if (typeof module !== 'undefined' && module.exports) module.exports = IBPreviewAgent;
