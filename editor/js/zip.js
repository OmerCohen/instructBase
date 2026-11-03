/* zip.js — minimal ZIP writer (no dependencies).
 * DEFLATE through the browser's CompressionStream('deflate-raw') when it exists,
 * otherwise STORE. UTF-8 file names (flag bit 11). No ZIP64: refuses > 4 GB.
 */
(function (root) {
  'use strict';
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function dosTime(d) {
    return {
      time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31),
      date: (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31)
    };
  }
  var STORED_EXT = /\.(zip|png|jpe?g|gif|webp|mp4|webm|mp3|gz|7z|woff2?|bin)$/i;
  /* 'deflate-raw' exists from Chrome/Edge 103; older versions have CompressionStream
     but throw on that format, so test it once and fall back to STORE */
  var deflateOK = null;
  function canDeflate() {
    if (deflateOK === null) {
      try { new CompressionStream('deflate-raw'); deflateOK = true; } catch (e) { deflateOK = false; }
    }
    return deflateOK;
  }
  async function deflateRaw(bytes) {
    var cs = new CompressionStream('deflate-raw');
    var stream = new Blob([bytes]).stream().pipeThrough(cs);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (typeof data === 'string') return new TextEncoder().encode(data);
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (data && typeof data.arrayBuffer === 'function') return new Uint8Array(await data.arrayBuffer());
    throw new Error('unsupported zip entry data');
  }

  /* entries: [{path, data: Uint8Array|string|Blob|ArrayBuffer, date?}] -> Blob */
  async function makeZip(entries, opts) {
    opts = opts || {};
    var enc = new TextEncoder();
    var parts = [], central = [], offset = 0, deflate = opts.compress !== false && canDeflate();
    if (entries.length > 65535) throw new Error('יותר מדי קבצים לקובץ ZIP אחד (מעל 65535)');
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var name = enc.encode(String(e.path).replace(/\\/g, '/').replace(/^\/+/, ''));
      var raw = await toBytes(e.data);
      var crc = crc32(raw), method = 0, body = raw;
      if (deflate && raw.length > 64 && !STORED_EXT.test(e.path)) {
        var z = await deflateRaw(raw);
        if (z.length < raw.length) { body = z; method = 8; }
      }
      var dt = dosTime(e.date || new Date());
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, method, true); lh.setUint16(10, dt.time, true); lh.setUint16(12, dt.date, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, body.length, true); lh.setUint32(22, raw.length, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, body);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 0x031E, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, method, true); ch.setUint16(12, dt.time, true); ch.setUint16(14, dt.date, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, body.length, true); ch.setUint32(24, raw.length, true);
      ch.setUint16(28, name.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true);
      ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, (0o100644 << 16) >>> 0, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + body.length;
      if (offset > 0xFFFFFFFF) throw new Error('הקובץ גדול מ-4GB; צריך לבחור פחות תיקיות');
      if (opts.onProgress) opts.onProgress(i + 1, entries.length, e.path);
    }
    var cdSize = 0;
    central.forEach(function (c) { cdSize += c.length; });
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true);
    end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
  }

  var api = { makeZip: makeZip, crc32: crc32, canDeflate: canDeflate };
  root.IBZip = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
