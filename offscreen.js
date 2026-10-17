/*
 * TriClick (c) 2026 TriClick. MIT License, see LICENSE.
 * File: offscreen.js
 * Hosts the on-device OCR worker for the background service worker (which cannot start workers itself).
 */
let worker = null;
let seq = 0;
const waiting = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker("ocr/worker.js");
  worker.onmessage = (e) => {
    if (e.data.prog) {
      // progress for the background, which shows it as a percentage
      if (waiting.has(e.data.id)) chrome.runtime.sendMessage({ type: "ocr-prog", ...e.data.prog }).catch(() => {});
      return;
    }
    const w = waiting.get(e.data.id);
    if (!w) return;
    waiting.delete(e.data.id);
    if (e.data.ok) w.res({ text: e.data.text, conf: e.data.conf });
    else w.rej(new Error(e.data.error));
  };
  worker.onerror = (e) => {
    for (const w of waiting.values()) w.rej(new Error(e.message || "worker error"));
    waiting.clear();
    worker = null;
  };
  return worker;
}

chrome.runtime.onMessage.addListener((m, _s, reply) => {
  if (!m || m.type !== "ocr-run" || m.target !== "offscreen") return;
  (async () => {
    try {
      const image = new Uint8Array(await (await fetch(m.png)).arrayBuffer());
      const id = ++seq;
      const out = await new Promise((res, rej) => {
        waiting.set(id, { res, rej });
        getWorker().postMessage({ id, langs: m.langs, image });
      });
      reply({ ok: true, text: out.text, conf: out.conf });
    } catch (err) {
      reply({ ok: false, error: String((err && err.message) || err) });
    }
  })();
  return true;
});
