/*
 * TriClick: OCR language data. Eight languages ship in the package (the interface languages). The rest download once, on first use,
 * from a pinned commit of tessdata_fast (Apache-2.0), are checked against a SHA-256, and are kept on the device.
 * Used by the popup (download when a language is picked) and by the OCR worker (download if still missing).
 */
var OCRDATA = (function () {
  var BASE = "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/" + OCR_COMMIT + "/";
  var NAME = "tc-ocr-data";
  var bundled = new Set(OCR_BUNDLED);

  function hex(buf) {
    return crypto.subtle.digest("SHA-256", buf).then(function (d) {
      return Array.from(new Uint8Array(d), function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    });
  }
  function url(l) { return BASE + l + ".traineddata"; }

  // names of the downloaded languages that are on the device
  function cached() {
    return caches.open(NAME).then(function (c) { return c.keys(); }).then(function (ks) {
      var out = new Set();
      ks.forEach(function (r) { var m = /\/([^/]+)\.traineddata$/.exec(r.url); if (m) out.add(m[1]); });
      return out;
    }).catch(function () { return new Set(); });
  }

  function remote(l, onProgress) {
    var meta = OCR_DATA[l];
    if (!meta) return Promise.reject(new Error("lang-data unknown " + l));
    // give up if nothing arrives for 20 seconds (a slow download is fine, a stalled one is not)
    var ac = new AbortController(), timer = 0;
    function idle() { clearTimeout(timer); timer = setTimeout(function () { ac.abort(); }, 20000); }
    idle();
    return fetch(url(l), { signal: ac.signal }).then(function (r) {
      if (!r.ok) throw new Error("lang-data http " + r.status);
      if (!r.body || !r.body.getReader) return r.arrayBuffer();
      var rd = r.body.getReader(), parts = [], got = 0;
      return (function pump() {
        return rd.read().then(function (x) {
          idle();
          if (x.done) {
            var all = new Uint8Array(got), o = 0;
            parts.forEach(function (p) { all.set(p, o); o += p.length; });
            return all.buffer;
          }
          parts.push(x.value); got += x.value.length;
          if (onProgress) onProgress(Math.min(1, got / meta[0]));
          return pump();
        });
      })();
    }).then(function (buf) {
      clearTimeout(timer);
      return hex(buf).then(function (h) {
        if (h !== meta[1]) throw new Error("lang-data hash " + l);
        return caches.open(NAME).then(function (c) { return c.put(url(l), new Response(buf.slice(0))); }).catch(function () {}).then(function () { return buf; });
      });
    }, function (err) {
      clearTimeout(timer);
      throw ac.signal.aborted ? new Error("lang-data timeout " + l) : err;
    });
  }

  // the bytes of one language: from the package, else from the device, else downloaded
  function load(l, onProgress, local) {
    if (bundled.has(l)) {
      return fetch((local || "data/") + l + ".traineddata").then(function (r) {
        if (!r.ok) throw new Error("missing language data: " + l);
        return r.arrayBuffer();
      });
    }
    return caches.open(NAME).then(function (c) { return c.match(url(l)); }).catch(function () { return null; }).then(function (hit) {
      return hit ? hit.arrayBuffer() : remote(l, onProgress);
    });
  }

  function ready(l, onProgress) {
    if (bundled.has(l)) return Promise.resolve();
    return caches.open(NAME).then(function (c) { return c.match(url(l)); }).catch(function () { return null; }).then(function (hit) {
      return hit ? undefined : remote(l, onProgress).then(function () {});
    });
  }

  return { cached: cached, load: load, ready: ready, bundled: bundled };
})();
