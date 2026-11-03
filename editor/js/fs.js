/* fs.js — the folder the editor works on.
 *
 *  HandleFS: File System Access API (Chrome / Edge). Reads and writes in place.
 *  MemoryFS: any browser, from <input type=file webkitdirectory>. Read in, edits
 *            stay in memory and leave as a ZIP of the changed files.
 *  Both expose the same async interface; paths are '/'-separated and relative.
 */
(function (root) {
  'use strict';

  function split(path) { return String(path).split('/').filter(function (p) { return p && p !== '.'; }); }
  var DEFAULT_SKIP = { '.git': 1, 'node_modules': 1, '.editor-backups': 1 };

  function HandleFS(dir) {
    this.dir = dir;
    this.name = dir.name;
    this.canWrite = true;
    this.kind = 'handle';
  }
  HandleFS.prototype.permission = async function (ask) {
    var opts = { mode: 'readwrite' };
    if (!this.dir.queryPermission) return 'granted';
    var p = await this.dir.queryPermission(opts);
    if (p === 'granted' || !ask) return p;
    return this.dir.requestPermission(opts);
  };
  HandleFS.prototype._dir = async function (parts, create) {
    var d = this.dir;
    for (var i = 0; i < parts.length; i++) d = await d.getDirectoryHandle(parts[i], { create: !!create });
    return d;
  };
  HandleFS.prototype._file = async function (path, create) {
    var parts = split(path), name = parts.pop();
    var d = await this._dir(parts, create);
    return d.getFileHandle(name, { create: !!create });
  };
  HandleFS.prototype.exists = async function (path) {
    try { await this._file(path, false); return true; } catch (e) { return false; }
  };
  HandleFS.prototype.dirExists = async function (path) {
    try { await this._dir(split(path), false); return true; } catch (e) { return false; }
  };
  HandleFS.prototype.file = async function (path) { return (await this._file(path, false)).getFile(); };
  HandleFS.prototype.readText = async function (path) { return (await this.file(path)).text(); };
  HandleFS.prototype.readBytes = async function (path) { return new Uint8Array(await (await this.file(path)).arrayBuffer()); };
  HandleFS.prototype.write = async function (path, data) {
    var fh = await this._file(path, true);
    var w = await fh.createWritable();
    await w.write(data);
    await w.close();
  };
  HandleFS.prototype.remove = async function (path) {
    var parts = split(path), name = parts.pop();
    var d = await this._dir(parts, false);
    await d.removeEntry(name);
  };
  /* recursive listing: [{path, size}] for files. opts.skip: {name:1}, opts.maxDepth */
  HandleFS.prototype.list = async function (prefix, opts) {
    opts = opts || {};
    var skip = opts.skip || DEFAULT_SKIP, maxDepth = opts.maxDepth == null ? 32 : opts.maxDepth;
    var out = [];
    var start;
    try { start = await this._dir(split(prefix || ''), false); } catch (e) { return out; }
    async function rec(d, base, depth) {
      for await (var entry of d.values()) {
        var p = base ? base + '/' + entry.name : entry.name;
        if (entry.kind === 'directory') {
          if (skip[entry.name] || depth >= maxDepth) continue;
          await rec(entry, p, depth + 1);
        } else {
          var size = 0;
          if (opts.sizes) { try { size = (await entry.getFile()).size; } catch (e) { size = 0; } }
          out.push({ path: p, size: size });
        }
      }
    }
    await rec(start, prefix ? split(prefix).join('/') : '', 0);
    return out;
  };
  HandleFS.prototype.topLevel = async function () {
    var out = [];
    for await (var entry of this.dir.values()) out.push({ name: entry.name, kind: entry.kind });
    return out.sort(function (a, b) { return a.name.localeCompare(b.name); });
  };

  /* ---------------------------------------------------------------- */
  function MemoryFS(name, files) {
    this.name = name;
    this.canWrite = false;   // writes stay in memory
    this.kind = 'memory';
    this.files = files;      // Map path -> Blob/File
    this.changed = new Set();
  }
  MemoryFS.fromFileList = function (list) {
    var files = new Map(), name = 'תיקייה';
    Array.prototype.forEach.call(list, function (f) {
      var rp = f.webkitRelativePath || f.name;
      var parts = split(rp);
      if (parts.length > 1) { name = parts[0]; parts.shift(); }
      if (parts.some(function (p) { return DEFAULT_SKIP[p]; })) return;
      files.set(parts.join('/'), f);
    });
    return new MemoryFS(name, files);
  };
  MemoryFS.prototype.permission = async function () { return 'granted'; };
  MemoryFS.prototype.exists = async function (path) { return this.files.has(split(path).join('/')); };
  MemoryFS.prototype.dirExists = async function (path) {
    var p = split(path).join('/') + '/';
    for (var k of this.files.keys()) if (k.startsWith(p)) return true;
    return false;
  };
  MemoryFS.prototype.file = async function (path) {
    var f = this.files.get(split(path).join('/'));
    if (!f) throw new Error('not found: ' + path);
    return f;
  };
  MemoryFS.prototype.readText = async function (path) { return (await this.file(path)).text(); };
  MemoryFS.prototype.readBytes = async function (path) { return new Uint8Array(await (await this.file(path)).arrayBuffer()); };
  MemoryFS.prototype.write = async function (path, data) {
    var p = split(path).join('/');
    this.files.set(p, data instanceof Blob ? data : new Blob([data]));
    this.changed.add(p);
  };
  MemoryFS.prototype.remove = async function (path) { var p = split(path).join('/'); this.files.delete(p); this.changed.delete(p); };
  MemoryFS.prototype.list = async function (prefix, opts) {
    opts = opts || {};
    var skip = opts.skip || DEFAULT_SKIP, maxDepth = opts.maxDepth == null ? 32 : opts.maxDepth;
    var pre = prefix ? split(prefix).join('/') + '/' : '', out = [];
    this.files.forEach(function (f, p) {
      if (pre && !p.startsWith(pre)) return;
      var parts = p.slice(pre.length).split('/');
      if (parts.length - 1 > maxDepth) return;
      for (var i = 0; i < parts.length - 1; i++) if (skip[parts[i]]) return;
      out.push({ path: p, size: f.size || 0 });
    });
    return out;
  };
  MemoryFS.prototype.topLevel = async function () {
    var seen = new Map();
    this.files.forEach(function (f, p) {
      var parts = p.split('/');
      if (!seen.has(parts[0])) seen.set(parts[0], parts.length > 1 ? 'directory' : 'file');
    });
    return Array.from(seen, function (e) { return { name: e[0], kind: e[1] }; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  };

  /* ---------------------------------------------------------------- */
  /* remember the last folder handle (IndexedDB; handles are cloneable) */
  var DB = 'instructbase-editor', STORE = 'kv';
  function idb() {
    return new Promise(function (res, rej) {
      if (!root.indexedDB) return rej(new Error('no indexedDB'));
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  async function kvSet(key, value) {
    var db = await idb();
    return new Promise(function (res, rej) {
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = function () { res(); }; tx.onerror = function () { rej(tx.error); };
    });
  }
  async function kvGet(key) {
    var db = await idb();
    return new Promise(function (res, rej) {
      var tx = db.transaction(STORE, 'readonly');
      var r = tx.objectStore(STORE).get(key);
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }

  var api = { HandleFS: HandleFS, MemoryFS: MemoryFS, kvSet: kvSet, kvGet: kvGet, split: split, supported: typeof root.showDirectoryPicker === 'function' };
  root.IBFS = api;
})(typeof window !== 'undefined' ? window : globalThis);
