/*
 * TriClick (c) 2026 TriClick. MIT License, see LICENSE.
 * File: background.js
 * Contact: chromedeveloper1@gmail.com
 * Build ID: 98c76752-c731-4cf8-b7a4-b81f0646db2e
 */
const OCR_LANGS = { en: "eng", ar: "ara+eng", es: "eng+spa", in: "eng+hin", ur: "urd+eng", pt: "eng+por", ru: "rus+eng", zh: "chi_sim+eng" };
const OCR_MAX = 1000;
importScripts("ocrlangs.js");
const TR_MAX = 5000;
const TR_URL = "https://translate.googleapis.com/translate_a/single";
// Auto-detect: the area is read once per script group and the read with the best confidence wins (a read in the wrong script comes out around 35 to 75, a right one 82 and up).
// The first groups ship in the package; the last three download on first use and are only tried when nothing reads well.
const AUTO_GROUPS = ["eng+spa+por", "ara+eng", "urd+eng", "hin+eng", "rus+eng", "chi_sim+eng"];
const AUTO_OWN = { ar: "ara+eng", ur: "urd+eng", in: "hin+eng", ru: "rus+eng", zh: "chi_sim+eng" }; // the interface language's own script goes right after Latin
const AUTO_DL = ["jpn+eng", "kor+eng", "ben+eng"];
const AUTO_MIN = 68;
const AUTO_OK = 82;
const OCR_BY = {};
OCR_TABLE.forEach((r) => (OCR_BY[r[0]] = r));
const G_ALIAS = { jv: "jw", fil: "tl", zh: "zh-CN", "zh-Hans": "zh-CN", "zh-Hant": "zh-TW", nb: "no", nn: "no" };

chrome.runtime.onMessage.addListener((m, sender) => {
  if (m && m.type === "ocr-retr" && typeof m.to === "string") retrFlow(m.to);
  else if (m && m.type === "reopen") chrome.action.openPopup().catch(() => {});
  else if (m && m.type === "tc-relay" && sender.tab && m.msg) chrome.tabs.sendMessage(sender.tab.id, m.msg).catch(() => {});
  else if (m && m.type === "ocr-start" && Number.isInteger(m.tabId)) ocrStart(m);
  else if (m && m.type === "ocr-rect" && sender.tab) ocrRect(sender.tab, m);
  else if (m && m.type === "col-start" && Number.isInteger(m.tabId)) colStart(m);
  else if (m && m.type === "col-pt" && sender.tab) colPt(sender.tab, m);
  else if (m && m.type === "rl-arm" && sender.tab) rlArm(sender);
  else if (m && m.type === "rl-off" && sender.tab) rlOff(sender.tab.id);
});

// Scalping reload: after the page reloads, put the clicker back on it and start again
async function rlArm(sender) {
  let path = "";
  try {
    const u = new URL(sender.url || sender.tab.url);
    path = u.origin + u.pathname;
  } catch {
    return;
  }
  await chrome.storage.session.set({ rl: { tabId: sender.tab.id, path, at: Date.now() } });
}

async function rlOff(tabId) {
  const { rl } = await chrome.storage.session.get("rl");
  if (rl && rl.tabId === tabId) await chrome.storage.session.remove("rl");
}

async function rlResume(tabId) {
  const { rl } = await chrome.storage.session.get("rl");
  if (!rl || rl.tabId !== tabId) return;
  await chrome.storage.session.remove("rl");
  if (Date.now() - rl.at > 120000) return;
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: () => location.origin + location.pathname });
    if (!r || r.result !== rl.path) return;
    await chrome.scripting.executeScript({ target: { tabId }, files: ["i18n.js", "content.js"] });
    await chrome.tabs.sendMessage(tabId, { type: "start" });
  } catch {}
}

async function ocrStart(m) {
  const key = "ocr" + m.tabId;
  const S = m.strs || {};
  await chrome.storage.session.set({ [key]: { idx: m.idx, lang: m.lang, strs: S, mode: m.mode, from: m.from, to: m.to } });
  try {
    await chrome.scripting.executeScript({
      target: { tabId: m.tabId },
      func: (cfg) => {
        window.__tcOcrCfg = cfg;
      },
      args: [{ label: S.label || "", cancel: S.cancel || "" }],
    });
    await chrome.scripting.executeScript({ target: { tabId: m.tabId }, files: ["ocr-select.js"] });
  } catch (e) {
    /* the page cannot be scripted */
  }
}

function toast(tabId, text, ms, prog) {
  return chrome.scripting
    .executeScript({
      target: { tabId },
      func: (txt, hold, prog) => {
        const id = "__tc_ocr_toast";
        let h = document.getElementById(id);
        if (h) h.remove();
        window.__tcToastPct = null;
        if (!txt) return;
        h = document.createElement("div");
        h.id = id;
        h.style.cssText = "all:initial;position:fixed;left:0;right:0;bottom:24px;display:flex;justify-content:center;z-index:2147483647;pointer-events:none";
        const r = h.attachShadow({ mode: "closed" });
        const d = document.createElement("div");
        d.textContent = txt;
        d.dir = "auto";
        d.style.cssText = "max-width:min(80vw,520px);background:#121c3a;color:#eef2fb;font:600 13px/1.4 Inter,system-ui,sans-serif;padding:10px 16px;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.45);border:1px solid #27314c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
        r.appendChild(d);
        document.documentElement.appendChild(h);
        if (hold > 0) setTimeout(() => h.remove(), hold);
        if (!prog) return;
        // percentage after the text: it counts up one step at a time toward the latest value from the background
        const n = document.createElement("span");
        n.style.cssText = "display:inline-block;min-width:3.6ch;text-align:end;font-variant-numeric:tabular-nums";
        d.append(" ", n);
        let shown = 0, target = 0, iv = 0;
        const draw = () => (n.textContent = shown + "%");
        draw();
        window.__tcToastPct = (p) => {
          target = Math.max(target, Math.min(99, Math.round(p)));
          if (iv) return;
          iv = setInterval(() => {
            if (!h.isConnected || shown >= target) {
              clearInterval(iv);
              iv = 0;
              return;
            }
            shown += Math.max(1, Math.ceil((target - shown) / 6));
            draw();
          }, 45);
        };
      },
      args: [text, ms || 0, !!prog],
    })
    .catch(() => {});
}

// progress shown in the toast while reading and translating (sent at most every 120 ms).
// While a step is waiting (on Google, say) the number creeps up slowly, never past the end of that step.
function toastPct(tabId) {
  let last = -1, at = 0, timer = 0, want = 0, cap = 0;
  const send = () => {
    timer = 0;
    at = Date.now();
    last = want;
    chrome.scripting
      .executeScript({ target: { tabId }, func: (p) => window.__tcToastPct && window.__tcToastPct(p), args: [want] })
      .catch(() => {});
  };
  const set = (p) => {
    want = Math.max(want, Math.min(99, Math.round(p)));
    if (want === last || timer) return;
    const wait = 120 - (Date.now() - at);
    if (wait <= 0) send();
    else timer = setTimeout(send, wait);
  };
  const creep = setInterval(() => {
    if (want < cap - 1) set(want + 1);
  }, 350);
  set.cap = (c) => (cap = Math.max(cap, c));
  set.stop = () => {
    clearInterval(creep);
    clearTimeout(timer);
  };
  setTimeout(set.stop, 120000);
  return set;
}

// the OCR worker reports its progress here: { rec: 0..100 } while recognizing, { dl: 0..1 } while downloading language data
let ocrProg = null;
chrome.runtime.onMessage.addListener((m) => {
  if (m && m.type === "ocr-prog" && ocrProg) ocrProg(m);
});

function b64(buf) {
  const u = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}

async function cropPng(dataUrl, r, vw) {
  const bmp = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const s = bmp.width / vw;
  const pad = 4;
  const sx = Math.max(0, Math.floor((r.x - pad) * s));
  const sy = Math.max(0, Math.floor((r.y - pad) * s));
  const sw = Math.min(bmp.width - sx, Math.ceil((r.w + pad * 2) * s));
  const sh = Math.min(bmp.height - sy, Math.ceil((r.h + pad * 2) * s));
  if (sw < 1 || sh < 1) throw new Error("empty area");
  // small text reads better when enlarged
  const f = sh < 70 ? 3 : sh < 150 ? 2 : 1;
  const m = 24;
  const w = Math.min(4000, sw * f);
  const h = Math.round((sh * w) / sw);
  const cv = new OffscreenCanvas(w + m * 2, h + m * 2);
  const g = cv.getContext("2d");
  // margin in the colour of the region's corner: the engine reads text better with a border
  const px = new OffscreenCanvas(1, 1).getContext("2d");
  px.drawImage(bmp, sx, sy, 1, 1, 0, 0, 1, 1);
  const c = px.getImageData(0, 0, 1, 1).data;
  g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
  g.fillRect(0, 0, cv.width, cv.height);
  g.imageSmoothingQuality = "high";
  g.drawImage(bmp, sx, sy, sw, sh, m, m, w, h);
  bmp.close();
  return cv.convertToBlob({ type: "image/png" }).then((b) => b.arrayBuffer());
}

let offBusy = null;
function ensureOffscreen() {
  if (offBusy) return offBusy;
  offBusy = (async () => {
    try {
      const has = chrome.offscreen.hasDocument ? await chrome.offscreen.hasDocument() : (await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] })).length > 0;
      if (!has) await chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["WORKERS"], justification: "Read text from a screenshot on the device" });
    } finally {
      offBusy = null;
    }
  })();
  return offBusy;
}

async function ocrRect(tab, m) {
  let pct = null;
  const key = "ocr" + tab.id;
  const got = (await chrome.storage.session.get(key))[key];
  if (!got) return;
  await chrome.storage.session.remove(key);
  const S = got.strs;
  try {
    await toast(tab.id, S.reading || "…", 0, true);
    const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const png = await cropPng(shot, m.rect, m.vw);
    if (got.mode === "tr") return await trFlow(tab, got, png);
    pct = toastPct(tab.id);
    pct.cap(95);
    let dl = false;
    ocrProg = (p) => {
      if (typeof p.dl === "number") (dl = true), pct(40 * p.dl);
      else if (typeof p.rec === "number") pct((dl ? 40 : 0) + (dl ? 0.6 : 1) * p.rec);
    };
    await ensureOffscreen();
    const out = await chrome.runtime.sendMessage({ type: "ocr-run", target: "offscreen", png: "data:image/png;base64," + b64(png), langs: OCR_LANGS[got.lang] || "eng" });
    chrome.offscreen.closeDocument().catch(() => {});
    if (!out || !out.ok) throw new Error((out && out.error) || "ocr failed");
    const text = out.text.replace(/\s+/g, " ").trim().slice(0, OCR_MAX);
    if (!text) {
      await toast(tab.id, S.none || "", 3000);
      return;
    }
    const { ktents = [] } = await chrome.storage.local.get("ktents");
    const list = (Array.isArray(ktents) ? ktents : []).filter((e) => e && e.i !== got.idx);
    list.push({ i: got.idx, text });
    list.sort((a, b) => a.i - b.i);
    await chrome.storage.local.set({ ktents: list });
    await toast(tab.id, `${S.saved || ""} ${text}`.trim(), 3500);
    // bring the popup back so the new text is right there
    chrome.action.openPopup().catch(() => {});
  } catch (e) {
    chrome.offscreen.closeDocument().catch(() => {});
    await toast(tab.id, S.fail || "", 3500);
  } finally {
    ocrProg = null;
    if (pct) pct.stop();
  }
}

chrome.tabs.onRemoved.addListener((id) => {
  rlOff(id);
});
chrome.tabs.onUpdated.addListener((id, info) => {
  if (info.status === "complete") rlResume(id);
});

// OCR tab: read the area (on the device), then translate the text with Google Translate
function tessOf(g) {
  const r = OCR_BY[g];
  if (!r || !r[1]) return "eng";
  return r[1] === "eng" ? "eng" : r[1] + "+eng";
}

// Text goes to Google inside the URL, so chunks are measured in encoded bytes: an Arabic or Chinese character takes 6 to 9.
const TR_CHUNK = 6000;
const encLen = (s) => encodeURIComponent(s).length;
function chunks(text, max) {
  const out = [];
  let cur = "";
  let n = 0;
  const add = (piece, len, sep) => {
    const sl = cur ? encLen(sep) : 0;
    if (cur && n + sl + len > max) {
      out.push(cur);
      cur = piece;
      n = len;
      return;
    }
    cur += (cur ? sep : "") + piece;
    n += sl + len;
  };
  for (const line of text.split("\n")) {
    const len = encLen(line);
    if (len <= max) {
      add(line, len, "\n");
      continue;
    }
    // a line too long for one request: break it between words (or between characters if a word is too long)
    let first = true;
    for (const w of line.split(/(?<= )/)) {
      const wl = encLen(w);
      if (wl <= max) add(w, wl, first ? "\n" : "");
      else for (const ch of w) add(ch, encLen(ch), "");
      first = false;
    }
  }
  if (cur) out.push(cur);
  return out;
}

async function gTranslate(text, to, from, onProg) {
  const tr = [];
  let src = "";
  const parts = chunks(text, TR_CHUNK);
  for (const part of parts) {
    const u = `${TR_URL}?client=gtx&sl=${encodeURIComponent(from || "auto")}&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(part)}`;
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error("translate " + r.status);
    const j = await r.json();
    if (!Array.isArray(j) || !Array.isArray(j[0])) throw new Error("translate format");
    tr.push(j[0].map((x) => (x && x[0]) || "").join(""));
    if (!src && typeof j[2] === "string") src = j[2];
    if (onProg) onProg(tr.length, parts.length);
  }
  return { tr: tr.join("\n"), src: G_ALIAS[src] || src };
}

async function trFlow(tab, got, png) {
  const S = got.strs;
  let pct = null;
  await chrome.storage.local.set({ ocrBusy: Date.now() });
  try {
    await ensureOffscreen();
    const data = "data:image/png;base64," + b64(png);
    // progress: reading fills up to 80% (each extra read in Auto-detect gets a share of what is left), translating the rest
    pct = toastPct(tab.id);
    let now = 0;
    const read = async (langs, end) => {
      const lo = now, hi = end != null ? end : now + (80 - now) * 0.45;
      pct.cap(hi);
      let dl = false;
      ocrProg = (p) => {
        let f = -1;
        if (typeof p.dl === "number") (dl = true), (f = 0.4 * p.dl);
        else if (typeof p.rec === "number") f = (dl ? 0.4 : 0) + ((dl ? 0.6 : 1) * Math.max(0, Math.min(100, p.rec))) / 100;
        if (f >= 0) pct(lo + (hi - lo) * f);
      };
      const out = await chrome.runtime.sendMessage({ type: "ocr-run", target: "offscreen", png: data, langs });
      now = hi;
      pct(now);
      if (!out || !out.ok) throw new Error((out && out.error) || "ocr failed");
      const clean = out.text.replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, TR_MAX);
      return { text: clean, conf: typeof out.conf === "number" ? out.conf : -1, langs };
    };
    const auto = got.from === "auto";
    let first;
    if (!auto) first = await read(tessOf(got.from), 80);
    else {
      const order = AUTO_GROUPS.slice();
      const own = AUTO_OWN[got.lang];
      if (own) order.splice(order.indexOf(own), 1), order.splice(1, 0, own);
      for (const g of order) {
        const r = await read(g);
        if (!first || r.conf > first.conf) first = r;
        if (first.conf >= AUTO_OK) break;
      }
      if (first.conf >= 0 && first.conf < AUTO_MIN) {
        // nothing built in read this well: the text is probably in another script
        for (const g of AUTO_DL) {
          try {
            const r = await read(g);
            if (r.text && r.conf > first.conf) first = r;
          } catch {
            /* the language data could not be fetched: try the next one */
          }
          if (first.conf >= AUTO_OK) break;
        }
      }
    }
    let text = first.text;
    if (!text) {
      await toast(tab.id, S.none || "", 3000);
      return;
    }
    let src = auto ? "" : got.from;
    let tr = "";
    let err = false;
    try {
      now = Math.max(now, 80);
      pct(now);
      const trProg = (a, b2) => (pct.cap(b2), (done, total) => pct(a + ((b2 - a) * done) / total));
      let r = await gTranslate(text, got.to, auto ? "auto" : got.from, trProg(now, auto ? 88 : 99));
      tr = r.tr;
      if (auto) {
        src = r.src;
        // the language is known now: read the area again with that language's own data
        const row = OCR_BY[src];
        const own = row && row[1] ? tessOf(src) : "";
        if (own && own !== first.langs && src !== "en") {
          try {
            now = 88;
            const r2 = await read(own, 95);
            if (r2.text && r2.text !== text && (r2.conf < 0 || r2.conf >= first.conf - 5)) {
              const t2 = await gTranslate(r2.text, got.to, src, trProg(95, 99));
              text = r2.text;
              tr = t2.tr;
            }
          } catch {
            /* keep the first read if the language data could not be fetched */
          }
        }
      }
    } catch {
      err = true;
    }
    chrome.offscreen.closeDocument().catch(() => {});
    const res = { orig: text, tr, src, auto, to: got.to, ts: Date.now(), err };
    const { ocrHist = [] } = await chrome.storage.local.get("ocrHist");
    const hist = [res, ...(Array.isArray(ocrHist) ? ocrHist : [])].slice(0, 20);
    await chrome.storage.local.set({ ocrRes: res, ocrHist: hist });
    await toast(tab.id, err ? S.netfail || "" : tr, 3500);
    chrome.action.openPopup().catch(() => {});
  } catch (e) {
    chrome.offscreen.closeDocument().catch(() => {});
    await toast(tab.id, /lang-data/.test(String((e && e.message) || e)) ? S.netfail || S.fail || "" : S.fail || "", 3500);
  } finally {
    ocrProg = null;
    if (pct) pct.stop();
    await chrome.storage.local.remove("ocrBusy");
  }
}

// Sketch tab: pick a color from the page (the point is read from a screenshot of the visible tab)
async function colStart(m) {
  const S = m.strs || {};
  await chrome.storage.session.set({ ["col" + m.tabId]: { strs: S } });
  // a screenshot of the tab, taken before the overlay goes on, feeds the magnifier around the mouse
  let shot = "";
  try {
    const tab = await chrome.tabs.get(m.tabId);
    shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  } catch {
    /* no magnifier: the picker still works */
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: m.tabId },
      func: (cfg) => {
        window.__tcOcrCfg = cfg;
      },
      args: [{ label: S.label || "", cancel: S.cancel || "", shot }],
    });
    await chrome.scripting.executeScript({ target: { tabId: m.tabId }, files: ["col-pick.js"] });
  } catch (e) {
    /* the page cannot be scripted */
  }
}

async function colPt(tab, m) {
  const key = "col" + tab.id;
  const got = (await chrome.storage.session.get(key))[key];
  if (!got) return;
  await chrome.storage.session.remove(key);
  try {
    let r, gr, b;
    if (Array.isArray(m.px) && m.px.length === 3 && m.px.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) {
      // the color shown in the magnifier when the click happened
      [r, gr, b] = m.px;
    } else {
      const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
      const bmp = await createImageBitmap(await (await fetch(shot)).blob());
      const k = bmp.width / m.vw;
      const x = Math.max(0, Math.min(bmp.width - 1, Math.floor(m.x * k)));
      const y = Math.max(0, Math.min(bmp.height - 1, Math.floor(m.y * k)));
      const cv = new OffscreenCanvas(1, 1);
      const g = cv.getContext("2d");
      g.drawImage(bmp, x, y, 1, 1, 0, 0, 1, 1);
      bmp.close();
      [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
    }
    const hex = "#" + [r, gr, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
    const rgb = `rgb(${r}, ${gr}, ${b})`;
    await chrome.storage.local.set({ pcol: { hex, rgb, ts: Date.now() } });
    await toast(tab.id, `${hex}  ${rgb}`, 3000);
    chrome.action.openPopup().catch(() => {});
  } catch (e) {
    await toast(tab.id, (got.strs && got.strs.fail) || "", 3000);
  }
}

// OCR tab: the same scanned text, translated again into another language (no new scan)
let retrGen = 0;
async function retrFlow(to) {
  const { ocrRes: res, ocrHist = [] } = await chrome.storage.local.get(["ocrRes", "ocrHist"]);
  if (!res || !res.orig || !OCR_BY[to]) return;
  const gen = ++retrGen;
  await chrome.storage.local.set({ ocrRetr: { to, done: 0, total: chunks(res.orig, TR_CHUNK).length, ts: Date.now() } });
  let out;
  try {
    const r = await gTranslate(res.orig, to, res.src || "auto", (done, total) => {
      if (gen === retrGen) chrome.storage.local.set({ ocrRetr: { to, done, total, ts: Date.now() } });
    });
    out = { ...res, tr: r.tr, to, err: false };
  } catch {
    out = { ...res, tr: "", to, err: true };
  }
  if (gen !== retrGen) return;
  const hist = (Array.isArray(ocrHist) ? ocrHist : []).slice();
  const i = hist.findIndex((h) => h && h.ts === res.ts);
  if (i >= 0) hist[i] = out;
  else hist.unshift(out);
  await chrome.storage.local.set({ ocrRes: out, ocrHist: hist.slice(0, 20) });
  await chrome.storage.local.remove("ocrRetr");
}
