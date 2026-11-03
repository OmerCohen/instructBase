/* ===== net-08 crypto engines: pure JS, no SubtleCrypto (IIS may serve over plain HTTP,
   where crypto.subtle is undefined). Every engine is verified against an external oracle
   in test_engines.js before it is allowed into the deck. ===== */
var C8 = (function () {
  'use strict';
  /* ---------- UTF-8 / hex ---------- */
  function utf8(str) { return Array.from(new TextEncoder().encode(str)); }
  function hex(bytes) { return bytes.map(function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join(''); }
  function fromHex(h) { var o = []; for (var i = 0; i < h.length; i += 2) o.push(parseInt(h.substr(i, 2), 16)); return o; }
  function bitsDiff(a, b) { var n = 0; for (var i = 0; i < a.length; i++) { var x = a[i] ^ b[i]; while (x) { n += x & 1; x >>>= 1; } } return n; }

  /* ---------- SHA-256 (FIPS 180-4) ---------- */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
  function sha256(bytes) {
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var l = bytes.length, m = bytes.slice();
    m.push(0x80);
    while (m.length % 64 !== 56) m.push(0);
    var bitLen = l * 8, hi = Math.floor(bitLen / 0x100000000), lo = bitLen >>> 0;
    m.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    var W = new Array(64);
    for (var off = 0; off < m.length; off += 64) {
      for (var t = 0; t < 16; t++) W[t] = (m[off + 4 * t] << 24) | (m[off + 4 * t + 1] << 16) | (m[off + 4 * t + 2] << 8) | m[off + 4 * t + 3];
      for (t = 16; t < 64; t++) {
        var s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
        var s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g);
        var T1 = (h + S1 + ch + K[t] + W[t]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c);
        var T2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + T1) | 0; d = c; c = b; b = a; a = (T1 + T2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = [];
    H.forEach(function (w) { out.push((w >>> 24) & 255, (w >>> 16) & 255, (w >>> 8) & 255, w & 255); });
    return out;
  }

  /* ---------- AES-128 (FIPS 197), single block, with per-step trace for the animation ---------- */
  var SBOX = (function () {
    var s = new Array(256), p = 1, q = 1;
    do {
      p = p ^ ((p << 1) & 0xff) ^ (p & 0x80 ? 0x1b : 0);
      q ^= q << 1; q ^= q << 2; q ^= q << 4; q &= 0xff; if (q & 0x80) q ^= 0x09;
      var x = q ^ ((q << 1 | q >>> 7) & 0xff) ^ ((q << 2 | q >>> 6) & 0xff) ^ ((q << 3 | q >>> 5) & 0xff) ^ ((q << 4 | q >>> 4) & 0xff);
      s[p] = (x ^ 0x63) & 0xff;
    } while (p !== 1);
    s[0] = 0x63; return s;
  })();
  function xt(b) { return ((b << 1) ^ (b & 0x80 ? 0x1b : 0)) & 0xff; }
  function expandKey(key) {
    var w = key.slice(), rcon = 1;
    for (var i = 16; i < 176; i += 4) {
      var t = w.slice(i - 4, i);
      if (i % 16 === 0) {
        t = [SBOX[t[1]] ^ rcon, SBOX[t[2]], SBOX[t[3]], SBOX[t[0]]];
        rcon = xt(rcon);
      }
      for (var j = 0; j < 4; j++) w.push(w[i - 16 + j] ^ t[j]);
    }
    return w;
  }
  /* state is column-major: s[r + 4c] */
  function subBytes(s) { return s.map(function (b) { return SBOX[b]; }); }
  function shiftRows(s) { var o = s.slice(); for (var r = 1; r < 4; r++) for (var c = 0; c < 4; c++) o[r + 4 * c] = s[r + 4 * ((c + r) % 4)]; return o; }
  function mixColumns(s) {
    var o = s.slice();
    for (var c = 0; c < 4; c++) {
      var a0 = s[4 * c], a1 = s[4 * c + 1], a2 = s[4 * c + 2], a3 = s[4 * c + 3];
      o[4 * c] = xt(a0) ^ xt(a1) ^ a1 ^ a2 ^ a3;
      o[4 * c + 1] = a0 ^ xt(a1) ^ xt(a2) ^ a2 ^ a3;
      o[4 * c + 2] = a0 ^ a1 ^ xt(a2) ^ xt(a3) ^ a3;
      o[4 * c + 3] = xt(a0) ^ a0 ^ a1 ^ a2 ^ xt(a3);
    }
    return o;
  }
  function addKey(s, w, r) { return s.map(function (b, i) { return b ^ w[16 * r + i]; }); }
  function aesTrace(key, pt) {
    var w = expandKey(key), trace = [], s = addKey(pt, w, 0);
    trace.push({ round: 0, step: 'AddRoundKey', state: s });
    for (var r = 1; r <= 10; r++) {
      s = subBytes(s); trace.push({ round: r, step: 'SubBytes', state: s });
      s = shiftRows(s); trace.push({ round: r, step: 'ShiftRows', state: s });
      if (r < 10) { s = mixColumns(s); trace.push({ round: r, step: 'MixColumns', state: s }); }
      s = addKey(s, w, r); trace.push({ round: r, step: 'AddRoundKey', state: s });
    }
    return trace;
  }
  function aes128(key, pt) { var t = aesTrace(key, pt); return t[t.length - 1].state; }

  /* ---------- number theory on BigInt (RSA, DH) ---------- */
  function modpow(b, e, m) { b = BigInt(b) % BigInt(m); e = BigInt(e); m = BigInt(m); var r = 1n; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; }
  function egcd(a, b) { a = BigInt(a); b = BigInt(b); var x0 = 1n, x1 = 0n; while (b) { var q = a / b; var t = a - q * b; a = b; b = t; t = x0 - q * x1; x0 = x1; x1 = t; } return [a, x0]; }
  function modinv(a, m) { var r = egcd(a, m); if (r[0] !== 1n) return null; var x = r[1] % BigInt(m); return x < 0n ? x + BigInt(m) : x; }
  function gcd(a, b) { return egcd(a, b)[0]; }
  function isPrime(n) { n = Number(n); if (n < 2) return false; for (var i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; }
  function rsaKeys(p, q, e) {
    p = BigInt(p); q = BigInt(q); e = BigInt(e);
    var n = p * q, phi = (p - 1n) * (q - 1n);
    if (gcd(e, phi) !== 1n) return { n: n, phi: phi, e: e, d: null };
    return { n: n, phi: phi, e: e, d: modinv(e, phi) };
  }

  /* ---------- classical ciphers ---------- */
  var HEB = 'אבגדהוזחטיכלמנסעפצקרשת';
  var FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
  var TOFINAL = { 'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ' };
  function hebNorm(ch) { return FINALS[ch] || ch; }
  function hebFinals(s) { /* restore final letter forms at word ends */
    return s.replace(/([כמנפצ])(?=$|[^א-ת])/g, function (m) { return TOFINAL[m]; });
  }
  function hebMap(text, fn) {
    var out = '';
    for (var i = 0; i < text.length; i++) {
      var ch = hebNorm(text[i]), k = HEB.indexOf(ch);
      out += k < 0 ? text[i] : HEB[fn(k)];
    }
    return hebFinals(out);
  }
  function atbash(text) { return hebMap(text, function (k) { return 21 - k; }); }
  function caesarHeb(text, s) { return hebMap(text, function (k) { return ((k + s) % 22 + 22) % 22; }); }
  function caesarEn(text, s) {
    return text.replace(/[a-z]/gi, function (ch) {
      var base = ch <= 'Z' ? 65 : 97;
      return String.fromCharCode((((ch.charCodeAt(0) - base + s) % 26) + 26) % 26 + base);
    });
  }
  /* English letter frequencies (%), standard reference table */
  var EN = [8.167, 1.492, 2.782, 4.253, 12.702, 2.228, 2.015, 6.094, 6.966, 0.153, 0.772, 4.025, 2.406,
    6.749, 7.507, 1.929, 0.095, 5.987, 6.327, 9.056, 2.758, 0.978, 2.360, 0.150, 1.974, 0.074];
  function counts(text) { var c = new Array(26).fill(0); text.toLowerCase().replace(/[a-z]/g, function (ch) { c[ch.charCodeAt(0) - 97]++; return ch; }); return c; }
  function chi2ForShift(ct, s) { /* score of decrypting ct with shift s */
    var c = counts(caesarEn(ct, -s)), N = c.reduce(function (a, b) { return a + b; }, 0) || 1, x = 0;
    for (var i = 0; i < 26; i++) { var exp = EN[i] / 100 * N; x += (c[i] - exp) * (c[i] - exp) / exp; }
    return x;
  }
  function crackCaesar(ct) {
    var best = 0, scores = [];
    for (var s = 0; s < 26; s++) { scores.push(chi2ForShift(ct, s)); if (scores[s] < scores[best]) best = s; }
    return { shift: best, scores: scores };
  }

  return {
    utf8: utf8, hex: hex, fromHex: fromHex, bitsDiff: bitsDiff, sha256: sha256,
    SBOX: SBOX, aesTrace: aesTrace, aes128: aes128, expandKey: expandKey,
    modpow: modpow, modinv: modinv, gcd: gcd, isPrime: isPrime, rsaKeys: rsaKeys,
    HEB: HEB, atbash: atbash, caesarHeb: caesarHeb, caesarEn: caesarEn, counts: counts, EN: EN,
    chi2ForShift: chi2ForShift, crackCaesar: crackCaesar
  };
})();
if (typeof module !== 'undefined') module.exports = C8;
