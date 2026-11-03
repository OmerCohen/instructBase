(function () {
  'use strict';
  var root = document.querySelector('.deck-root');
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, text) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function motionOK() {
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return !reduce || (root && root.classList.contains('motion-on'));
  }
  function activeSlideOf(node) { var s = node && node.closest('.slide'); return !!(s && s.classList.contains('active')); }
  function onInput(node, fn) { node.addEventListener('input', fn); }
  function L(s) { return '<span class="ltr">' + s + '</span>'; }
  function safe(name, fn) { try { fn(); } catch (err) { if (window.console) console.error('[net08] ' + name, err); } }

  /* typing inside a field must not drive the deck (space, n, a, f, arrows) */
  document.querySelectorAll('.deck-root input:not([type=range]), .deck-root textarea, .deck-root select').forEach(function (f) {
    f.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Escape') f.blur(); });
  });

  /* ================= title hero: Atbash letter flip ================= */
  safe('hero', function () {
    var box = $('c8hero'); if (!box) return;
    var spans = [].slice.call(box.querySelectorAll('span:not(.sp)'));
    var plain = spans.map(function (s) { return s.textContent; });
    /* encrypt whole words so final letter forms land only at word ends */
    var ciph = [], kids = [].slice.call(box.children), word = [];
    function flush() { var w = C8.atbash(word.map(function (s) { return s.textContent; }).join('')); for (var q = 0; q < word.length; q++) ciph.push(w[q]); word = []; }
    kids.forEach(function (s) { if (s.classList.contains('sp')) flush(); else word.push(s); }); flush();
    var i = 0, dir = 1, hold = 0;
    setInterval(function () {
      if (!motionOK() || !activeSlideOf(box)) return;
      if (hold > 0) { hold--; return; }
      var s = spans[i];
      if (dir > 0) { s.textContent = ciph[i]; s.classList.add('x'); } else { s.textContent = plain[i]; s.classList.remove('x'); }
      i++;
      if (i >= spans.length) { i = 0; dir = -dir; hold = 12; }
    }, 130);
  });

  /* ================= Base64 is not encryption ================= */
  safe('b64', function () {
    var inp = $('b64-in'); if (!inp) return;
    function run() {
      var bytes = C8.utf8(inp.value), bin = '';
      bytes.forEach(function (b) { bin += String.fromCharCode(b); });
      var b64 = btoa(bin);
      $('b64-out').textContent = b64 || ' ';
      var back = atob(b64), arr = new Uint8Array(back.length);
      for (var i = 0; i < back.length; i++) arr[i] = back.charCodeAt(i);
      $('b64-back').textContent = new TextDecoder().decode(arr) || ' ';
      $('b64-len').innerHTML = L(bytes.length) + ' בתים, ' + L(b64.length) + ' תווי Base64';
    }
    onInput(inp, run); run();
  });

  /* ================= steganography: LSB ================= */
  safe('stego', function () {
    var ca = $('st-a'), cb = $('st-b'); if (!ca) return;
    var W = ca.width, H = ca.height, xa = ca.getContext('2d'), xb = cb.getContext('2d');
    var cover = xa.createImageData(W, H), d = cover.data;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var p = 4 * (y * W + x), hill = Math.round(H * 0.6 + 4 * Math.sin(x / 7) + 2 * Math.sin(x / 3.1 + 1));
      var r, g, b, dx = x - 46, dy = y - 9;
      /* flat colour areas, like a logo or a screenshot: the lowest bit is constant inside each area */
      if (y < hill) { var band = Math.min(3, y / 6 | 0); r = 61 + 23 * band; g = 121 + 17 * band; b = 203 + 11 * band; if (dx * dx + dy * dy < 30) { r = 251; g = 207; b = 85; } }
      else { r = 59; g = 138; b = 67; if ((y - hill) > 6) { r = 46; g = 113; b = 53; } }
      d[p] = Math.round(r); d[p + 1] = Math.round(g); d[p + 2] = Math.round(b); d[p + 3] = 255;
    }
    var amp = false, stego = null;
    function lsbView(img) {
      var o = new ImageData(new Uint8ClampedArray(img.data), W, H);
      for (var i = 0; i < o.data.length; i += 4) { o.data[i] = (o.data[i] & 1) * 255; o.data[i + 1] = (o.data[i + 1] & 1) * 255; o.data[i + 2] = (o.data[i + 2] & 1) * 255; }
      return o;
    }
    function embed(msg) {
      var bytes = C8.utf8(msg).slice(0, 255), bits = [], i;
      for (i = 7; i >= 0; i--) bits.push((bytes.length >> i) & 1);
      bytes.forEach(function (b) { for (var k = 7; k >= 0; k--) bits.push((b >> k) & 1); });
      var img = new ImageData(new Uint8ClampedArray(cover.data), W, H);
      /* one bit per pixel, written into the lowest bit of R, G and B together: maximum change 1/255 per channel */
      for (i = 0; i < bits.length && i < W * H; i++) { var q = 4 * i; for (var c = 0; c < 3; c++) img.data[q + c] = (img.data[q + c] & 254) | bits[i]; }
      return { img: img, nbits: bits.length, nbytes: bytes.length };
    }
    function extract(img) {
      function bit(i) { return img.data[4 * i] & 1; }
      var n = 0, i, out = [];
      for (i = 0; i < 8; i++) n = (n << 1) | bit(i);
      for (var j = 0; j < n; j++) { var b = 0; for (i = 0; i < 8; i++) b = (b << 1) | bit(8 + 8 * j + i); out.push(b); }
      return new TextDecoder().decode(new Uint8Array(out));
    }
    function maxDiff(a, b) { var m = 0; for (var i = 0; i < a.data.length; i++) m = Math.max(m, Math.abs(a.data[i] - b.data[i])); return m; }
    function draw() {
      stego = embed($('st-msg').value);
      xa.putImageData(amp ? lsbView(cover) : cover, 0, 0);
      xb.putImageData(amp ? lsbView(stego.img) : stego.img, 0, 0);
      $('st-blbl').textContent = amp ? 'ביט אחרון בלבד · עם מסר' : 'עם מסר מוסתר';
      $('st-amp').classList.toggle('on', amp);
      $('st-amp').textContent = amp ? 'חזרה לתמונה' : 'הגבר ביט אחרון';
      var rows = Math.ceil(stego.nbits / W);
      $('st-stat').innerHTML = L(stego.nbytes) + ' בתים · ' + L(stego.nbits) + ' ביטים · ' + L(rows) + ' שורות פיקסלים · שינוי מרבי ' + L(maxDiff(cover, stego.img) + '/255');
      $('st-out').textContent = 'חולץ: ' + extract(stego.img);
    }
    $('st-amp').addEventListener('click', function () { amp = !amp; draw(); });
    onInput($('st-msg'), draw); draw();
  });

  /* ================= substitution wheel ================= */
  safe('wheel', function () {
    var svg = $('wh-svg'); if (!svg) return;
    var NS = 22, TH = 360 / NS, CX = 220, CY = 220, mode = 'atb', shift = 3;
    svg.appendChild(el('circle', { cx: CX, cy: CY, r: 208, fill: '#0a1426', stroke: 'rgba(255,255,255,.14)', 'stroke-width': 1.5 }));
    svg.appendChild(el('circle', { cx: CX, cy: CY, r: 160, fill: '#101b30', stroke: 'rgba(34,211,238,.45)', 'stroke-width': 1.5 }));
    svg.appendChild(el('circle', { cx: CX, cy: CY, r: 100, fill: '#0b1220', stroke: 'rgba(251,191,36,.45)', 'stroke-width': 1.5 }));
    var hl = el('g', {}); svg.appendChild(hl);
    var hlO = el('circle', { r: 17, fill: 'rgba(34,211,238,.25)', stroke: '#22d3ee', 'stroke-width': 2, opacity: 0 });
    var hlI = el('circle', { r: 17, fill: 'rgba(251,191,36,.25)', stroke: '#fbbf24', 'stroke-width': 2, opacity: 0 });
    hl.appendChild(hlO); hl.appendChild(hlI);
    var outer = el('g', {}); svg.appendChild(outer);
    var ring = el('g', { 'class': 'c8-ring' }); ring.style.transformOrigin = CX + 'px ' + CY + 'px'; svg.appendChild(ring);
    var inner = [];
    function pos(i, r) { var a = (i * TH - 90) * Math.PI / 180; return [CX + r * Math.cos(a), CY + r * Math.sin(a)]; }
    for (var i = 0; i < NS; i++) {
      var po = pos(i, 184), pi = pos(i, 130);
      outer.appendChild(el('text', { x: po[0], y: po[1] + 7, 'text-anchor': 'middle', fill: '#f1f5f9', 'font-size': 21, 'font-weight': 700 }, C8.HEB[i]));
      var t = el('text', { x: pi[0], y: pi[1] + 7, 'text-anchor': 'middle', fill: '#fbbf24', 'font-size': 21, 'font-weight': 700, 'class': 'c8-ring' }, '');
      t.style.transformBox = 'fill-box'; t.style.transformOrigin = 'center';
      ring.appendChild(t); inner.push(t);
      var s1 = pos(i + 0.5, 160), s2 = pos(i + 0.5, 208);
      outer.appendChild(el('line', { x1: s1[0], y1: s1[1], x2: s2[0], y2: s2[1], stroke: 'rgba(255,255,255,.1)' }));
    }
    var centre = el('text', { x: CX, y: CY - 4, 'text-anchor': 'middle', fill: '#f1f5f9', 'font-size': 24, 'font-weight': 800 }, '');
    var centre2 = el('text', { x: CX, y: CY + 24, 'text-anchor': 'middle', fill: '#8ba0b5', 'font-size': 14 }, 'חוץ: גלוי · פנים: מוצפן');
    svg.appendChild(centre); svg.appendChild(centre2);
    function layoutInner() {
      for (var j = 0; j < NS; j++) inner[j].textContent = mode === 'atb' ? C8.HEB[NS - 1 - j] : C8.HEB[j];
      var rot = mode === 'atb' ? 0 : -shift * TH;
      ring.style.transform = 'rotate(' + rot + 'deg)';
      /* keep every inner letter upright while the ring turns */
      for (var u = 0; u < NS; u++) inner[u].style.transform = 'rotate(' + (-rot) + 'deg)';
    }
    function run() {
      var txt = $('wh-in').value;
      $('wh-out').textContent = (mode === 'atb' ? C8.atbash(txt) : C8.caesarHeb(txt, shift)) || ' ';
      centre.textContent = mode === 'atb' ? 'אתב״ש' : 'קיסר · הזזה ' + shift;
      $('wh-sv').textContent = shift;
      $('wh-shift').disabled = mode === 'atb';
      $('wh-atb').classList.toggle('on', mode === 'atb'); $('wh-cae').classList.toggle('on', mode === 'cae');
      var last = null, norm = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
      for (var k = txt.length - 1; k >= 0; k--) { var ch = norm[txt[k]] || txt[k]; if (C8.HEB.indexOf(ch) >= 0) { last = C8.HEB.indexOf(ch); break; } }
      if (last == null) { hlO.setAttribute('opacity', 0); hlI.setAttribute('opacity', 0); return; }
      var a = pos(last, 184), b = pos(last, 130);
      hlO.setAttribute('cx', a[0]); hlO.setAttribute('cy', a[1]); hlI.setAttribute('cx', b[0]); hlI.setAttribute('cy', b[1]);
      hlO.setAttribute('opacity', 1); hlI.setAttribute('opacity', 1);
    }
    $('wh-atb').addEventListener('click', function () { mode = 'atb'; layoutInner(); run(); });
    $('wh-cae').addEventListener('click', function () { mode = 'cae'; layoutInner(); run(); });
    onInput($('wh-shift'), function () { shift = +$('wh-shift').value; mode = 'cae'; layoutInner(); run(); });
    onInput($('wh-in'), run);
    layoutInner(); run();
  });

  /* ================= hash avalanche (part A) ================= */
  function hexDiff(a, b) {
    var out = '';
    for (var i = 0; i < a.length; i++) out += a[i] !== b[i] ? '<b>' + a[i] + '</b>' : a[i];
    return out;
  }
  safe('hash6', function () {
    var a = $('h6-a'); if (!a) return;
    function run() {
      var ha = C8.sha256(C8.utf8(a.value)), hb = C8.sha256(C8.utf8($('h6-b').value));
      var xa = C8.hex(ha), xb = C8.hex(hb);
      $('h6-ha').innerHTML = xa.slice(0, 32) + '<br>' + xa.slice(32);
      $('h6-hb').innerHTML = hexDiff(xb.slice(0, 32), xa.slice(0, 32)) + '<br>' + hexDiff(xb.slice(32), xa.slice(32));
      var n = C8.bitsDiff(ha, hb);
      $('h6-n').textContent = n; $('h6-bar').style.width = (n / 256 * 100) + '%';
    }
    onInput(a, run); onInput($('h6-b'), run); run();
  });

  /* ================= symmetric key mesh ================= */
  safe('mesh', function () {
    var svg = $('sy-svg'); if (!svg) return;
    function run() {
      var n = +$('sy-n').value, k = n * (n - 1) / 2;
      $('sy-nv').textContent = n; $('sy-k').textContent = k.toLocaleString('en-US');
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var pts = [], R = n > 20 ? 148 : 140;
      for (var i = 0; i < n; i++) { var a = (i / n) * 2 * Math.PI - Math.PI / 2; pts.push([210 + R * Math.cos(a), 165 + R * Math.sin(a)]); }
      var op = Math.max(0.07, Math.min(0.75, 6 / n)), g = el('g', { 'class': 'c8-fade' });
      for (var p = 0; p < n; p++) for (var q = p + 1; q < n; q++) g.appendChild(el('line', { x1: pts[p][0], y1: pts[p][1], x2: pts[q][0], y2: pts[q][1], stroke: '#fbbf24', 'stroke-width': n > 20 ? 0.8 : 1.6, opacity: op }));
      svg.appendChild(g);
      pts.forEach(function (pt) { svg.appendChild(el('circle', { cx: pt[0], cy: pt[1], r: n > 20 ? 5 : 9, fill: '#22d3ee', stroke: '#04070d', 'stroke-width': 2 })); });
    }
    onInput($('sy-n'), run); run();
  });

  /* ================= signature (part A, toy RSA n=3233) ================= */
  var TOY = { n: 3233n, e: 17n, d: 2753n };
  function hModN(text) { var h = C8.sha256(C8.utf8(text)); return { hex: C8.hex(h), v: BigInt('0x' + C8.hex(h)) % TOY.n }; }
  safe('sign', function () {
    var doc = $('sg-doc'); if (!doc) return;
    var signed = null;
    function setLink(id, cls) { var e = $(id); e.classList.remove('ok', 'bad', 'chk'); if (cls) e.classList.add(cls); }
    function reset() {
      setLink('sg-l3', null);
      $('sg-res').textContent = signed ? 'המסמך נחתם' : 'עוד לא נחתם';
      $('sg-why').textContent = signed ? 'שנו משהו במסמך (או לא), ולחצו ״בדוק״.' : 'לחצו ״חתום״.';
    }
    $('sg-sign').addEventListener('click', function () {
      var h = hModN(doc.value), s = C8.modpow(h.v, TOY.d, TOY.n);
      signed = { hex: h.hex, h: h.v, s: s };
      $('sg-h0').textContent = h.hex.slice(0, 12) + '…';
      $('sg-s').textContent = String(s);
      setLink('sg-l1', 'ok'); setLink('sg-l2', 'ok');
      reset();
    });
    $('sg-verify').addEventListener('click', function () {
      if (!signed) { setLink('sg-l3', 'bad'); $('sg-res').textContent = 'אין חתימה לבדוק'; $('sg-why').textContent = 'קודם לחצו ״חתום״.'; return; }
      var now = hModN(doc.value), rec = C8.modpow(signed.s, TOY.e, TOY.n);
      setLink('sg-l3', 'chk'); $('sg-res').textContent = 'בודק…';
      setTimeout(function () {
        var ok = rec === now.v;
        setLink('sg-l3', ok ? 'ok' : 'bad');
        $('sg-res').textContent = ok ? '✓ החתימה תקינה: המסמך שלם ונחתם במפתח הפרטי' : '✗ החתימה לא תקינה: המסמך השתנה אחרי החתימה';
        $('sg-why').innerHTML = ok
          ? 'החתימה נפתחה במפתח הציבורי ל-' + L(String(rec)) + ', וזה בדיוק ה-Hash של המסמך שלפניכם.'
          : 'מהחתימה יוצא ' + L(String(rec)) + ', אבל ה-Hash של המסמך הנוכחי הוא ' + L(String(now.v)) + ' (' + L(now.hex.slice(0, 8) + '…') + ').';
      }, 450);
    });
    onInput(doc, function () { if (signed) reset(); });
    reset();
  });

  /* ================= certificate chain validator ================= */
  safe('chain', function () {
    var run = $('ch-run'); if (!run) return;
    var Y = new Date().getFullYear(), scn = 'ok', timer = null;
    var LINKS = ['ch-root', 'ch-int', 'ch-leaf', 'ch-clock'];
    function mark(id, cls) { var e = $(id); e.classList.remove('ok', 'bad', 'chk'); if (cls) e.classList.add(cls); }
    function leafText() {
      if (scn === 'exp') return 'בתוקף עד ' + L('15/07/' + (Y - 1)) + ' · מוצג לדפדפן.';
      if (scn === 'name') return 'הונפקה ל-' + L('portal.unit.local') + ' · המשתמש גלש ל-' + L('https://10.20.0.15');
      return 'בתוקף עד ' + L('15/07/' + (Y + 1)) + ' · מוצג לדפדפן.';
    }
    function prep() {
      if (timer) { clearTimeout(timer); timer = null; }
      LINKS.forEach(function (id) { mark(id, null); });
      $('ch-leafsub').innerHTML = leafText();
      $('ch-clocksub').innerHTML = scn === 'clock' ? 'התחנה מציגה ' + L('03/01/' + (Y + 3)) + ' (סוללת שעון או סנכרון זמן)' : 'מסונכרן לשעון הדומיין.';
      $('ch-int').style.opacity = scn === 'mid' ? '.35' : '1';
      $('ch-h').textContent = 'מה הדפדפן בודק';
      $('ch-log').innerHTML = 'בחרו תרחיש ולחצו ״הרץ בדיקה״.';
      [].forEach.call($('ch-scn').querySelectorAll('button'), function (b) { b.classList.toggle('on', b.dataset.s === scn); });
    }
    var STEPS = [
      { ids: ['ch-leaf'], txt: 'השם בשורת הכתובת מופיע בתעודה (SAN)', fail: 'name', code: 'ERR_CERT_COMMON_NAME_INVALID', why: 'התעודה תקינה, אבל לא לשם שהוקלד. גולשים בשם המלא שבתעודה, או שמוסיפים את השם ל-SAN בהנפקה הבאה.' },
      { ids: ['ch-leaf', 'ch-clock'], txt: 'התעודה בתוקף לפי השעון של התחנה', fail: ['exp', 'clock'], code: 'ERR_CERT_DATE_INVALID' },
      { ids: ['ch-int'], txt: 'תעודת הביניים קיימת וחתימתה על תעודת השרת תקינה', fail: 'mid', code: 'ERR_CERT_AUTHORITY_INVALID', why: 'השרת שולח רק את התעודה שלו. חלק מהלקוחות מורידים את תעודת הביניים בעצמם (AIA) ולכן ״אצלי זה עובד״. התיקון בשרת: להגדיר את השרשרת המלאה.' },
      { ids: ['ch-root'], txt: 'חתימת השורש על הביניים תקינה, והשורש במאגר האמון של התחנה', fail: 'root', code: 'ERR_CERT_AUTHORITY_INVALID', why: 'השורש של היחידה לא מותקן בתחנה הזו. בודקים ב-certlm.msc ומתקינים לפי המדיניות (בדרך כלל GPO). ״המשך״ בדפדפן לא מתקן את זה.' }
    ];
    function go() {
      prep();
      var log = $('ch-log'); log.innerHTML = ''; var k = 0;
      function step() {
        if (k > 0) STEPS[k - 1].ids.forEach(function (id) { if (!$(id).classList.contains('bad')) mark(id, 'ok'); });
        if (k >= STEPS.length) {
          $('ch-h').innerHTML = '<span class="c8-ok">✓ חיבור מאובטח</span>';
          log.insertAdjacentHTML('beforeend', '<div class="c8-ok">כל החוליות עברו. המנעול מוצג, בלי שגיאה.</div>');
          return;
        }
        var s = STEPS[k];
        s.ids.forEach(function (id) { mark(id, 'chk'); });
        timer = setTimeout(function () {
          var fails = [].concat(s.fail).indexOf(scn) >= 0;
          log.insertAdjacentHTML('beforeend', '<div>' + (fails ? '<span class="c8-bad">✗</span> ' : '<span class="c8-ok">✓</span> ') + (k + 1) + ' · ' + s.txt + '</div>');
          if (fails) {
            if (scn === 'clock') { mark('ch-leaf', 'bad'); mark('ch-clock', 'bad'); }
            else if (scn === 'exp') { mark('ch-leaf', 'bad'); mark('ch-clock', 'ok'); }
            else s.ids.forEach(function (id) { mark(id, 'bad'); });
            var why = s.why;
            if (scn === 'exp') why = 'התעודה פגה. מחדשים אותה בשרת. כל התחנות יראו את אותה שגיאה.';
            if (scn === 'clock') why = 'השרת תקין. לפי השעון השגוי התעודה נראית פגה, ולכן רק התחנה הזו נכשלת. התיקון בתחנה: <span class="c8-mono">w32tm /resync</span> ובדיקת סוללת השעון.';
            $('ch-h').innerHTML = '<span class="c8-bad ltr">' + s.code + '</span>';
            log.insertAdjacentHTML('beforeend', '<div style="margin-top:6px;color:var(--ink)">' + why + '</div><div class="c8-lbl" style="margin-top:4px">הבדיקה נעצרת בחוליה הראשונה שנכשלת.</div>');
            return;
          }
          k++; step();
        }, 700);
      }
      step();
    }
    [].forEach.call($('ch-scn').querySelectorAll('button'), function (b) { b.addEventListener('click', function () { scn = b.dataset.s; prep(); }); });
    run.addEventListener('click', go);
    prep();
  });

  /* ================= PIN keypad with retry counter ================= */
  safe('pin', function () {
    var pad = $('pn-pad'); if (!pad) return;
    var PIN = '2580', MAX = 3, entry = '', left = MAX, state = 'locked';
    function paint(msg, cls) {
      var dots = $('pn-dots').children; for (var i = 0; i < 4; i++) dots[i].classList.toggle('f', i < entry.length);
      var t = $('pn-tries').children; for (var j = 0; j < MAX; j++) t[j].classList.toggle('used', j >= left);
      var st = $('pn-state'); st.classList.remove('c8-ok', 'c8-bad', 'c8-warn'); if (cls) st.classList.add(cls);
      if (msg) st.textContent = msg;
    }
    pad.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (state === 'blocked') { entry = ''; paint('הכרטיס חסום, וגם PIN נכון לא יפתח אותו. נדרש תהליך שחרור לפי הנוהל.', 'c8-bad'); return; }
      if (state === 'open') { entry = ''; state = 'locked'; }
      var k = b.dataset.k;
      if (k === 'c') { entry = entry.slice(0, -1); paint('הכרטיס נעול · הזינו PIN', null); return; }
      if (k === 'ok') {
        if (entry.length < 4) { paint('הזינו 4 ספרות', 'c8-warn'); return; }
        if (entry === PIN) { left = MAX; entry = ''; state = 'open'; paint('✓ PIN נכון. הכרטיס פתוח וחותם על האתגר. המונה התאפס.', 'c8-ok'); return; }
        left--; entry = '';
        if (left <= 0) { state = 'blocked'; paint('✗ הכרטיס חסום. המונה בתוך השבב הגיע לאפס.', 'c8-bad'); return; }
        paint('✗ PIN שגוי · נותרו ' + left + ' ניסיונות', 'c8-bad'); return;
      }
      if (entry.length < 4) entry += b.textContent.trim();
      paint('הכרטיס נעול · הזינו PIN', null);
    });
    $('pn-reset').addEventListener('click', function () { entry = ''; left = MAX; state = 'locked'; paint('הכרטיס נעול · הזינו PIN', null); });
    paint(null, null);
  });

  /* ================= part B divider: drifting hex ================= */
  safe('bitsbg', function () {
    var bg = $('c8bg'); if (!bg) return;
    var H = '0123456789abcdef', rows = [];
    function rnd(n) { var s = ''; for (var i = 0; i < n; i++) s += H[Math.random() * 16 | 0]; return s; }
    for (var r = 0; r < 30; r++) rows.push(rnd(140));
    function paint(hiRow, hiCol) {
      bg.innerHTML = rows.map(function (s, i) { return i === hiRow ? esc(s.slice(0, hiCol)) + '<b>' + s.slice(hiCol, hiCol + 8) + '</b>' + esc(s.slice(hiCol + 8)) : s; }).join('\n');
    }
    paint(-1, 0);
    setInterval(function () {
      if (!motionOK() || !activeSlideOf(bg)) return;
      var r = Math.random() * rows.length | 0, c = Math.random() * 130 | 0;
      rows[r] = rows[r].slice(0, c) + rnd(8) + rows[r].slice(c + 8);
      paint(r, c);
    }, 140);
  });

  /* ================= frequency analysis ================= */
  safe('freq', function () {
    var ta = $('fq-ct'); if (!ta) return;
    var LONG = 'THE CONVOY WILL LEAVE THE NORTHERN GATE AT FIVE IN THE MORNING. EVERY VEHICLE MUST CARRY WATER, FUEL AND A WORKING RADIO. THE SIGNAL TEAM WILL TEST ALL THE NETWORKS BEFORE THE START AND REPORT ANY FAULT TO THE OPERATIONS ROOM. KEEP THE RADIO SILENT UNTIL THE SECOND CHECKPOINT, THEN SEND A SHORT STATUS REPORT EVERY THIRTY MINUTES.';
    var SHORT = 'FLY BY NIGHT';
    var bars = $('fq-bars'), cols = [], best = -1, sweep = null, MAXP = 14;
    for (var i = 0; i < 26; i++) {
      var c = document.createElement('div'); c.className = 'col';
      c.innerHTML = '<div class="ref"></div><div class="bar"></div><div class="lt">' + String.fromCharCode(65 + i) + '</div>';
      bars.appendChild(c); cols.push(c);
      c.querySelector('.ref').style.bottom = (16 + Math.min(1, C8.EN[i] / MAXP) * 128) + 'px';
    }
    var chi = $('fq-chi');
    function drawChi(scores, s) {
      while (chi.firstChild) chi.removeChild(chi.firstChild);
      var mx = Math.max.apply(null, scores.map(function (v) { return Math.sqrt(v); })) || 1;
      for (var k = 0; k < 26; k++) {
        var h = Math.max(2, Math.sqrt(scores[k]) / mx * 78), x = 6 + k * 19.7;
        var fill = k === s ? '#22d3ee' : k === best ? '#4ade80' : 'rgba(167,139,250,.45)';
        chi.appendChild(el('rect', { x: x, y: 92 - h, width: 14, height: h, rx: 2, fill: fill }));
        chi.appendChild(el('text', { x: x + 7, y: 106, 'text-anchor': 'middle', fill: '#8ba0b5', 'font-size': 9, 'class': 'ltrtx nohalo' }, k));
      }
      chi.appendChild(el('text', { x: 514, y: 11, 'text-anchor': 'start', fill: '#8ba0b5', 'font-size': 11, 'class': 'nohalo' }, 'ציון לכל הזזה: עמודה נמוכה = דומה לאנגלית'));
    }
    function show() {
      var ct = ta.value, s = +$('fq-s').value, sc = [];
      for (var k = 0; k < 26; k++) sc.push(C8.chi2ForShift(ct, k));
      var cnt = C8.counts(C8.caesarEn(ct, -s)), N = cnt.reduce(function (a, b) { return a + b; }, 0) || 1;
      cols.forEach(function (c, j) { c.querySelector('.bar').style.height = (Math.min(1, cnt[j] / N * 100 / MAXP) * 128) + 'px'; });
      $('fq-sv').textContent = s;
      $('fq-score').textContent = Math.round(sc[s]).toLocaleString('en-US');
      $('fq-pt').textContent = C8.caesarEn(ct, -s) || ' ';
      drawChi(sc, s);
    }
    function load(txt, key) { if (sweep) { clearInterval(sweep); sweep = null; } best = -1; ta.value = C8.caesarEn(txt, key); $('fq-s').value = 0; show(); }
    $('fq-long').addEventListener('click', function () { load(LONG, 7); });
    $('fq-short').addEventListener('click', function () { load(SHORT, 11); });
    $('fq-go').addEventListener('click', function () {
      if (sweep) clearInterval(sweep);
      var r = C8.crackCaesar(ta.value), k = 0; best = -1;
      if (!motionOK()) { best = r.shift; $('fq-s').value = r.shift; show(); return; }
      sweep = setInterval(function () {
        if (k <= 25) { $('fq-s').value = k++; show(); return; }
        clearInterval(sweep); sweep = null; best = r.shift; $('fq-s').value = r.shift; show();
      }, 90);
    });
    onInput($('fq-s'), function () { show(); });
    onInput(ta, function () { best = -1; show(); });
    load(LONG, 7);
  });

  /* ================= SHA-256 bit grid ================= */
  safe('sha', function () {
    var inp = $('sh-in'); if (!inp) return;
    var grid = $('sh-bits'), cells = [], prev = null;
    for (var i = 0; i < 256; i++) { var c = document.createElement('i'); grid.appendChild(c); cells.push(c); }
    function run() {
      var bytes = C8.utf8(inp.value), h = C8.sha256(bytes), flips = 0;
      for (var b = 0; b < 256; b++) {
        var bit = (h[b >> 3] >> (7 - (b & 7))) & 1, was = prev ? (prev[b >> 3] >> (7 - (b & 7))) & 1 : bit;
        cells[b].className = (bit ? 'one' : '') + (bit !== was ? ' flip' : '');
        if (bit !== was) flips++;
      }
      $('sh-hex').textContent = C8.hex(h);
      $('sh-n').textContent = flips;
      var blocks = Math.floor((bytes.length + 8) / 64) + 1;
      $('sh-blk').innerHTML = L(bytes.length) + ' בתים · ' + L(blocks) + (blocks === 1 ? ' בלוק' : ' בלוקים');
      prev = h;
    }
    onInput(inp, run); run();
  });

  /* ================= XOR ================= */
  safe('xor', function () {
    var inp = $('xr-in'); if (!inp) return;
    var key = [0x5a, 0xc3, 0x1e], timer = null;
    function bytesOf() { var s = inp.value.slice(0, 3), o = []; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); o.push(c < 128 ? c : 63); } return o; }
    function row(id, bytes, upto) {
      var h = '';
      bytes.forEach(function (b, i) {
        if (i) h += '<span class="sep"></span>';
        for (var k = 7; k >= 0; k--) { var idx = i * 8 + (7 - k), on = idx < upto, v = (b >> k) & 1; h += '<span class="' + (on && v ? 'b1' : '') + '">' + (on ? v : '·') + '</span>'; }
      });
      $(id).innerHTML = h;
    }
    function hexs(a) { return a.map(function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join(' '); }
    function render(upto) {
      var p = bytesOf(), k = key.slice(0, p.length), c = p.map(function (b, i) { return b ^ k[i]; }), d = c.map(function (b, i) { return b ^ k[i]; });
      var all = p.length * 8;
      row('xr-p', p, all); row('xr-k', k, all); row('xr-c', c, upto); row('xr-k2', k, upto >= all ? all : 0); row('xr-d', d, upto >= all ? upto - all : 0);
      $('xr-cs').textContent = upto >= all ? hexs(c) : '…';
      $('xr-ds').textContent = upto >= 2 * all ? String.fromCharCode.apply(null, d) : '…';
      return all;
    }
    function full() { if (timer) { clearInterval(timer); timer = null; } render(1e9); }
    $('xr-run').addEventListener('click', function () {
      if (timer) clearInterval(timer);
      if (!motionOK()) { full(); return; }
      var u = 0, all = render(0);
      timer = setInterval(function () { u++; render(u); if (u >= 2 * all) { clearInterval(timer); timer = null; } }, 70);
    });
    $('xr-key').addEventListener('click', function () { key = [0, 0, 0].map(function () { return Math.random() * 256 | 0; }); full(); });
    onInput(inp, full); full();
  });

  /* ================= AES-128 step-through ================= */
  safe('aes', function () {
    var grid = $('ae-grid'); if (!grid) return;
    var KEY = C8.fromHex('2b7e151628aed2a6abf7158809cf4f3c'), PT = C8.fromHex('3243f6a8885a308d313198a2e0370734');
    var T = C8.aesTrace(KEY, PT), pos = 0, timer = null, flipBit = 0, cells = [];
    var BASE = C8.aes128(KEY, PT);
    for (var i = 0; i < 16; i++) { var c = document.createElement('div'); grid.appendChild(c); cells.push(c); }
    var TXT = {
      AddRoundKey: 'XOR של כל 16 הבתים עם מפתח הסבב. מפתח הסבב נגזר מהמפתח הראשי, ושונה בכל סבב. זה הצעד היחיד שמשתמש במפתח; שאר הצעדים ידועים לכולם והפיכים.',
      SubBytes: 'כל בית מוחלף לפי טבלה קבועה (S-Box). זה הצעד הלא-ליניארי: בלעדיו כל AES היה משוואה ליניארית אחת שאפשר לפתור.',
      ShiftRows: 'שורה 0 נשארת, שורה 1 זזה מקום אחד, שורה 2 שני מקומות, שורה 3 שלושה. כך בתים מעמודה אחת עוברים לעמודות אחרות.',
      MixColumns: 'כל עמודה של 4 בתים מוכפלת במטריצה קבועה: כל בית בעמודה תלוי עכשיו בכל ארבעת הבתים שלה. בסבב האחרון הצעד הזה מושמט.'
    };
    function show(p) {
      pos = Math.max(0, Math.min(T.length - 1, p));
      var cur = T[pos], prv = pos > 0 ? T[pos - 1].state : PT;
      for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) {
        var v = cur.state[r + 4 * c], cell = cells[r * 4 + c];
        cell.textContent = (v < 16 ? '0' : '') + v.toString(16);
        cell.className = v !== prv[r + 4 * c] ? 'chg' : '';
      }
      $('ae-rd').textContent = 'סבב ' + cur.round + ' מתוך 10';
      $('ae-st').textContent = cur.step;
      $('ae-txt').textContent = (pos === 0 ? 'לפני הסבב הראשון: ' : '') + TXT[cur.step] + (pos === T.length - 1 ? ' זה הצעד האחרון: הפלט שווה לערך בתקן.' : '');
      $('ae-pos').value = pos;
      $('ae-out').textContent = C8.hex(cur.state);
      $('ae-out').style.color = pos === T.length - 1 ? 'var(--green)' : 'var(--amber)';
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } $('ae-play').textContent = '▶ נגן'; }
    $('ae-prev').addEventListener('click', function () { stop(); show(pos - 1); });
    $('ae-next').addEventListener('click', function () { stop(); show(pos + 1); });
    $('ae-reset').addEventListener('click', function () { stop(); show(0); });
    onInput($('ae-pos'), function () { stop(); show(+$('ae-pos').value); });
    $('ae-play').addEventListener('click', function () {
      if (timer) { stop(); return; }
      if (pos >= T.length - 1) show(0);
      $('ae-play').textContent = '⏸ עצור';
      timer = setInterval(function () { if (pos >= T.length - 1 || !activeSlideOf(grid)) { stop(); return; } show(pos + 1); }, 650);
    });
    $('ae-key').textContent = C8.hex(KEY);
    $('ae-flip').addEventListener('click', function () {
      var k2 = KEY.slice(); k2[flipBit >> 3] ^= 1 << (7 - (flipBit & 7));
      var n = C8.bitsDiff(BASE, C8.aes128(k2, PT));
      $('ae-diff').textContent = n;
      $('ae-flip').textContent = 'הפוך ביט אחר (ביט ' + flipBit + ')';
      flipBit = (flipBit + 37) % 128;
    });
    show(0);
  });

  /* ================= RSA ================= */
  safe('rsa', function () {
    var sp = $('rs-p'); if (!sp) return;
    var PR = [11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
    [sp, $('rs-q')].forEach(function (s, j) { PR.forEach(function (p) { var o = document.createElement('option'); o.textContent = p; if (p === (j ? 53 : 61)) o.selected = true; s.appendChild(o); }); });
    var keys = null;
    function run() {
      var p = +sp.value, q = +$('rs-q').value, e = +$('rs-e').value;
      $('rs-facr').textContent = '';
      if (p === q) {
        keys = null;
        $('rs-n').textContent = $('rs-phi').textContent = '-'; $('rs-d').innerHTML = '<span class="c8-bad">-</span>';
        $('rs-mr').textContent = ''; $('rs-enc').innerHTML = '<span class="c8-bad">p ו-q חייבים להיות שונים.</span>'; $('rs-enc').style.direction = 'rtl'; $('rs-dec').textContent = '';
        return;
      }
      $('rs-enc').style.direction = '';
      keys = C8.rsaKeys(p, q, e);
      $('rs-n').textContent = String(keys.n); $('rs-phi').textContent = String(keys.phi);
      $('rs-d').innerHTML = keys.d == null ? '<span class="c8-bad">אין</span>' : String(keys.d);
      $('rs-mr').innerHTML = '(' + L('0 ≤ m < ' + keys.n) + ')';
      var mv = $('rs-m').value.trim();
      if (!/^\d+$/.test(mv) || BigInt(mv) >= keys.n) {
        $('rs-enc').innerHTML = '<span class="c8-bad">m חייב להיות מספר שלם קטן מ-n</span>'; $('rs-enc').style.direction = 'rtl'; $('rs-dec').textContent = ''; return;
      }
      var m = BigInt(mv), c = C8.modpow(m, keys.e, keys.n);
      $('rs-enc').textContent = 'c = ' + m + '^' + keys.e + ' mod ' + keys.n + ' = ' + c;
      if (keys.d == null) { $('rs-dec').innerHTML = '<span class="c8-bad">gcd(e, φ) = ' + C8.gcd(keys.e, keys.phi) + ' ≠ 1</span>'; return; }
      var back = C8.modpow(c, keys.d, keys.n);
      $('rs-dec').innerHTML = 'm = ' + c + '^' + keys.d + ' mod ' + keys.n + ' = <span class="' + (back === m ? 'c8-ok' : 'c8-bad') + '">' + back + '</span>';
    }
    [sp, $('rs-q'), $('rs-e')].forEach(function (s) { s.addEventListener('change', run); });
    onInput($('rs-m'), run);
    $('rs-fac').addEventListener('click', function () {
      if (!keys) return;
      var n = Number(keys.n), tries = 0, f = 0;
      for (var i = 2; i * i <= n; i++) { tries++; if (n % i === 0) { f = i; break; } }
      var g = n / f, r = C8.rsaKeys(f, g, keys.e);
      $('rs-facr').style.whiteSpace = 'normal';
      $('rs-facr').innerHTML = L(tries) + ' חלוקות: ' + L(n + ' = ' + f + ' × ' + g) + (r.d == null ? '' : ' · <span class="c8-bad">' + L('d = ' + r.d) + ' נחשף</span>');
    });
    run();
  });

  /* ================= Diffie-Hellman numbers ================= */
  safe('dh', function () {
    var a = $('dh-a'); if (!a) return;
    function run() {
      var av = +a.value, bv = +$('dh-b').value, P = 23n, G = 5n;
      var A = C8.modpow(G, av, P), B = C8.modpow(G, bv, P), s1 = C8.modpow(B, av, P), s2 = C8.modpow(A, bv, P);
      $('dh-av').textContent = av; $('dh-bv').textContent = bv;
      var ok = s1 === s2 ? 'c8-ok' : 'c8-bad';
      $('dh-calc').innerHTML =
        '<div>דנה שולחת ' + L('A = 5<sup>' + av + '</sup> mod 23 = <b>' + A + '</b>') + '</div>' +
        '<div>יוסי שולח ' + L('B = 5<sup>' + bv + '</sup> mod 23 = <b>' + B + '</b>') + '</div>' +
        '<div>דנה מחשבת ' + L('B<sup>a</sup> = ' + B + '<sup>' + av + '</sup> mod 23 = <b class="' + ok + '">' + s1 + '</b>') + '</div>' +
        '<div>יוסי מחשב ' + L('A<sup>b</sup> = ' + A + '<sup>' + bv + '</sup> mod 23 = <b class="' + ok + '">' + s2 + '</b>') + '</div>';
    }
    onInput(a, run); onInput($('dh-b'), run); run();
  });

  /* ================= signature math (part B) ================= */
  safe('sigmath', function () {
    var doc = $('sm-doc'); if (!doc) return;
    var signed = null;
    function run() {
      var h = hModN(doc.value);
      $('sm-1').textContent = 'SHA-256(m) = ' + h.hex.slice(0, 24) + '…';
      $('sm-2').textContent = 'h = SHA-256(m) mod 3233 = ' + h.v;
      var res = $('sm-res'); res.classList.remove('ok', 'bad');
      if (!signed) { $('sm-3').textContent = 's = ?'; $('sm-4').textContent = 's^17 mod 3233 = ?'; $('sm-rt').textContent = 'עוד לא נחתם'; $('sm-rw').textContent = 'לחצו ״חתום״: החתימה מחושבת מה-h הנוכחי במפתח הפרטי d = 2753.'; return; }
      var rec = C8.modpow(signed.s, TOY.e, TOY.n), ok = rec === h.v;
      $('sm-3').textContent = 's = ' + signed.h + '^2753 mod 3233 = ' + signed.s;
      $('sm-4').textContent = 's^17 mod 3233 = ' + rec + (ok ? '  =  ' : '  ≠  ') + 'h = ' + h.v;
      res.classList.add(ok ? 'ok' : 'bad');
      $('sm-rt').textContent = ok ? '✓ החתימה תקינה' : '✗ החתימה לא תקינה';
      $('sm-rw').textContent = ok ? 'מה שיצא מהחתימה במפתח הציבורי שווה ל-h של המסמך הנוכחי.' : 'המסמך השתנה: h חדש, והחתימה הישנה כבר לא מתאימה לו.';
    }
    $('sm-sign').addEventListener('click', function () { var h = hModN(doc.value); signed = { h: h.v, s: C8.modpow(h.v, TOY.d, TOY.n) }; run(); });
    onInput(doc, run); run();
  });

  /* ================= TLS 1.3 handshake stepper ================= */
  safe('tls', function () {
    var svg = $('tl-svg'); if (!svg) return;
    var CX = 120, SX = 520, GRAY = '#cbd5e1', AMB = '#fbbf24', GRN = '#4ade80';
    var PROT = { p: ['גלוי', ''], h: ['מוצפן · מפתחות לחיצת יד', 'c8-warn'], a: ['מוצפן · מפתחות יישום', 'ok'], k: ['חישוב מקומי · אין הודעה', ''], s: ['סיכום', ''] };
    var S = [
      { y: 88, dir: 1, lbl: 'ClientHello + key_share', col: GRAY, p: 'p', h: 'ClientHello',
        t: 'הלקוח פותח: גרסאות וצפנים שהוא תומך בהם, מספר אקראי ושם האתר (SNI). ובנוסף key_share: החצי הציבורי שלו של דיפי-הלמן, כבר בהודעה הראשונה.',
        e: 'הכול: הגרסאות, רשימת הצפנים, שם האתר והחצי הציבורי של דיפי-הלמן. החצי הציבורי לא מגלה את הסוד.' },
      { y: 124, dir: -1, lbl: 'ServerHello + key_share', col: GRAY, p: 'p', h: 'ServerHello',
        t: 'השרת בוחר צופן ושולח את החצי הציבורי שלו של דיפי-הלמן.',
        e: 'את הצופן שנבחר ואת החצי של השרת. עכשיו יש לו את שני החצאים הציבוריים, אבל לא את הסוד.' },
      { y: 156, key: 'h', p: 'k', h: 'שני הצדדים מחשבים סוד משותף',
        t: 'כל צד משלב את החצי שקיבל עם הסוד הפרטי שלו ומגיע לאותו סוד, כמו בהדגמת דיפי-הלמן. ממנו נגזרים מפתחות לחיצת היד, כך שהמפתחות עצמם לא עוברים ברשת.',
        e: 'שום דבר חדש. מכאן והלאה הוא רואה רק בתים מוצפנים.' },
      { y: 192, dir: -1, lbl: '{EncryptedExtensions}', col: AMB, p: 'h', h: 'EncryptedExtensions',
        t: 'שאר הגדרות החיבור. מההודעה הזו כל מה שהשרת שולח מוצפן.', e: 'רק את גודל ההודעה.' },
      { y: 224, dir: -1, lbl: '{Certificate}', col: AMB, p: 'h', h: 'Certificate',
        t: 'שרשרת התעודות של השרת. ב-TLS 1.3 היא עוברת מוצפנת; ב-TLS 1.2 היא עברה גלויה.', e: 'רק את הגודל, לא את התעודה ולא את שם הבעלים שלה.' },
      { y: 256, dir: -1, lbl: '{CertificateVerify}', col: AMB, p: 'h', h: 'CertificateVerify',
        t: 'השרת חותם במפתח הפרטי של התעודה על Hash של כל ההודעות עד כה. כך הוא מוכיח שהוא מחזיק את המפתח, ושאף אחד באמצע לא החליף את ה-key_share.',
        e: 'שום דבר חדש. תוקף שהיה מחליף את ה-key_share בדרך נכשל כאן, כי החתימה לא מתאימה.' },
      { y: 288, dir: -1, lbl: '{Finished}', col: AMB, p: 'h', h: 'Finished (שרת)',
        t: 'קוד אימות (HMAC) על כל לחיצת היד: השרת מאשר שראה בדיוק את אותן הודעות כמו הלקוח.', e: 'רק גודל ותזמון.' },
      { y: 324, dir: 1, lbl: '{Finished}', col: AMB, p: 'h', h: 'הלקוח בודק ושולח Finished',
        t: 'הלקוח בודק את שרשרת התעודה (שם, תוקף, חתימות, שורש - כמו בחלק א׳) ואת CertificateVerify. רק אם הכול תקין הוא שולח Finished משלו. אחרת: הודעת שגיאה בדפדפן.',
        e: 'רק גודל ותזמון.' },
      { y: 384, dir: 0, lbl: '[Application Data]', col: GRN, key: 'a', p: 'a', h: 'מידע היישום',
        t: 'מאותו סוד נגזרים מפתחות יישום, ובהם מוצפן המידע עצמו (AES-GCM או ChaCha20). הבקשה הראשונה יוצאת מיד אחרי ה-Finished של הלקוח.',
        e: 'כמות המידע ותזמון. לא את כתובת הדף, לא תוכן ולא עוגיות.' },
      { y: 0, sum: true, p: 's', h: 'סבב הודעות אחד: ' + L('1-RTT'),
        t: 'אחרי סבב אחד (הלקוח שלח, השרת ענה) המידע כבר עובר מוצפן. את המפתח קובעים בדיפי-הלמן, והשרת מוכיח את זהותו בתעודה ובחתימה. Hash ו-HMAC מאמתים את כל לחיצת היד, ואת המידע עצמו מצפינה הצפנה סימטרית.',
        e: 'כתובות IP, פורטים, שם האתר (SNI), גדלים ותזמון. כל השאר מוצפן.' }
    ];
    var defs = el('defs', {});
    [['g', GRAY], ['a', AMB], ['n', GRN]].forEach(function (m) {
      var mk = el('marker', { id: 'tl-m' + m[0], viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
      mk.appendChild(el('path', { d: 'M0 0 L10 5 L0 10 z', fill: m[1] })); defs.appendChild(mk);
    });
    function mid(col) { return col === GRAY ? 'g' : col === AMB ? 'a' : 'n'; }
    var n = 1, timer = null;
    function draw() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(defs);
      [[CX, 'לקוח · דפדפן', '#22d3ee'], [SX, 'שרת', '#4ade80']].forEach(function (b) {
        svg.appendChild(el('rect', { x: b[0] - 80, y: 8, width: 160, height: 40, rx: 10, fill: '#101b30', stroke: b[2], 'stroke-width': 2 }));
        svg.appendChild(el('text', { x: b[0], y: 34, 'text-anchor': 'middle', fill: '#f1f5f9', 'font-size': 16, 'font-weight': 700 }, b[1]));
        svg.appendChild(el('line', { x1: b[0], y1: 48, x2: b[0], y2: 400, stroke: 'rgba(255,255,255,.22)', 'stroke-dasharray': '4 6' }));
      });
      var all = n >= S.length;
      S.forEach(function (s, i) {
        if (s.sum || i + 1 > n) return;
        var g = el('g', { opacity: all || i + 1 === n ? 1 : 0.5 });
        if (i + 1 === n && !all && motionOK()) g.setAttribute('class', 'tl-new');
        if (s.key) {
          var ky = s.key === 'a' ? 352 : s.y, kc = s.key === 'a' ? GRN : AMB;
          [CX, SX].forEach(function (x) { g.appendChild(el('circle', { cx: x, cy: ky, r: 8, fill: kc, stroke: '#04070d', 'stroke-width': 2 })); });
          g.appendChild(el('text', { x: 320, y: ky + 5, 'text-anchor': 'middle', fill: kc, 'font-size': 13.5 }, s.key === 'a' ? 'מפתחות יישום (מאותו סוד)' : 'אותו סוד בשני הצדדים · מפתחות לחיצת יד'));
        }
        if (s.lbl) {
          var x1 = s.dir >= 0 ? CX + 6 : SX - 6, x2 = s.dir >= 0 ? SX - 6 : CX + 6;
          var ln = el('line', { x1: x1, y1: s.y, x2: x2, y2: s.y, stroke: s.col, 'stroke-width': 2.5, 'marker-end': 'url(#tl-m' + mid(s.col) + ')' });
          if (s.dir === 0) ln.setAttribute('marker-start', 'url(#tl-m' + mid(s.col) + ')');
          g.appendChild(ln);
          g.appendChild(el('text', { x: 320, y: s.y - 7, 'text-anchor': 'middle', fill: s.col, 'font-size': 14.5, 'font-weight': 700, 'class': 'ltrtx' }, s.lbl));
        }
        svg.appendChild(g);
      });
      if (all) {
        var b = el('g', { 'class': motionOK() ? 'c8-fade' : '' });
        b.appendChild(el('path', { d: 'M48 82 H38 V292 H48', fill: 'none', stroke: '#22d3ee', 'stroke-width': 2.5 }));
        b.appendChild(el('text', { x: 30, y: 192, 'text-anchor': 'middle', fill: '#22d3ee', 'font-size': 14, 'font-weight': 800, 'class': 'ltrtx', transform: 'rotate(-90 30 192)' }, '1-RTT'));
        svg.appendChild(b);
      }
      [[GRAY, 'גלוי', 600], [AMB, '{ } לחיצת יד', 440], [GRN, '[ ] יישום', 260]].forEach(function (l) {
        svg.appendChild(el('rect', { x: l[2] - 14, y: 410, width: 14, height: 10, rx: 2, fill: l[0] }));
        svg.appendChild(el('text', { x: l[2] - 22, y: 420, 'text-anchor': 'start', fill: '#a7b7c9', 'font-size': 12.5 }, l[1]));
      });
      var cur = S[n - 1], pr = PROT[cur.p];
      $('tl-h').innerHTML = cur.h; $('tl-t').textContent = cur.t; $('tl-eve').textContent = cur.e;
      var pill = $('tl-prot'); pill.className = 'c8-pill' + (pr[1] === 'ok' ? ' ok' : ''); pill.textContent = pr[0];
      pill.style.color = pr[1] === 'c8-warn' ? 'var(--amber)' : ''; pill.style.borderColor = pr[1] === 'c8-warn' ? 'rgba(251,191,36,.5)' : '';
      $('tl-n').textContent = n + ' / ' + S.length;
      $('tl-prev').disabled = n <= 1; $('tl-next').disabled = n >= S.length;
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } $('tl-play').textContent = '▶ נגן'; }
    $('tl-next').addEventListener('click', function () { stop(); n = Math.min(S.length, n + 1); draw(); });
    $('tl-prev').addEventListener('click', function () { stop(); n = Math.max(1, n - 1); draw(); });
    $('tl-reset').addEventListener('click', function () { stop(); n = 1; draw(); });
    $('tl-play').addEventListener('click', function () {
      if (timer) { stop(); return; }
      if (n >= S.length) n = 1, draw();
      $('tl-play').textContent = '⏸ עצור';
      timer = setInterval(function () { if (n >= S.length || !activeSlideOf(svg)) { stop(); return; } n++; draw(); }, 2800);
    });
    draw();
  });

  /* ================= TLS 1.2 vs 1.3: what the eavesdropper sees ================= */
  safe('tlsv', function () {
    var tbl = $('tv-tbl'); if (!tbl) return;
    var ROWS = [
      ['כתובות IP ופורטים', 'גלוי', 'גלוי'],
      ['שם האתר (SNI)', 'גלוי', 'גלוי (אלא אם ECH)'],
      ['גרסה ורשימת צפנים', 'גלוי', 'גלוי'],
      ['תעודת השרת', 'גלויה', 'מוצפנת'],
      ['החלפת מפתחות', 'מותר גם RSA ישיר, בלי סודיות קדימה', 'רק דיפי-הלמן זמני: תמיד סודיות קדימה'],
      ['כתובת הדף, תוכן, עוגיות', 'מוצפן', 'מוצפן'],
      ['גודל ותזמון', 'גלוי', 'גלוי']
    ];
    var NOTE = {
      '12': 'ב-TLS 1.2 התעודה עוברת גלויה, וכל מי שמקליט רואה לאיזה שרת היא שייכת. ואם השתמשו בהחלפת מפתחות RSA ישירה, מי שישיג פעם את מפתח השרת יפענח גם הקלטות ישנות.',
      '13': 'ב-TLS 1.3 התעודה מוצפנת, החלפת המפתחות תמיד עם דיפי-הלמן זמני, ולחיצת היד קצרה בסבב שלם.'
    };
    var ver = '13';
    function run(flash) {
      while (tbl.rows.length > 1) tbl.deleteRow(1);
      ROWS.forEach(function (r) {
        var tr = tbl.insertRow(), changed = r[1] !== r[2];
        tr.insertCell().textContent = r[0];
        var td = tr.insertCell(); td.textContent = ver === '12' ? r[1] : r[2];
        if (changed && ver === '13') tr.className = 'tv-chg';
        if (changed && flash) td.className = 'c8-flash';
      });
      $('tv-12').classList.toggle('on', ver === '12'); $('tv-13').classList.toggle('on', ver === '13');
      $('tv-rtt').textContent = ver === '12' ? '2' : '1';
      $('tv-rttl').innerHTML = ver === '12' ? 'שני סבבים (' + L('2-RTT') + ')' : 'סבב אחד (' + L('1-RTT') + ')';
      $('tv-rttbar').style.width = ver === '12' ? '100%' : '50%';
      $('tv-note').textContent = NOTE[ver];
    }
    $('tv-12').addEventListener('click', function () { ver = '12'; run(true); });
    $('tv-13').addEventListener('click', function () { ver = '13'; run(true); });
    run(false);
  });
})();
