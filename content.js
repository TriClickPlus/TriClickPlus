/*
 * TriClick (c) 2026 TriClick. MIT License, see LICENSE.
 * File: content.js
 * Contact: chromedeveloper1@gmail.com
 * Build ID: 98c76752-c731-4cf8-b7a4-b81f0646db2e
 */
(() => {
  if (window.__autoClicker) return;
  window.__autoClicker = true;

  const SLOTS = 10;
  const DEFAULT_DELAYS = Array(10).fill(3);
  const PAGE = location.origin + location.pathname;
  const KEY = "pts:" + PAGE;
  const RKEY = "rp:" + PAGE;
  const KKEY = "kp:" + PAGE;
  const PKEY = "mp:" + PAGE;

  let points = Array(SLOTS).fill(null);
  let kpoints = Array(SLOTS).fill(null);
  let keys = [];
  let rapid = null;
  let pattern = null;
  let running = false;
  let runVals = null;
  let mode = "seq";
  let timer = null;
  let runId = 0;
  let phase = null;
  let reps = 0;
  let repsMode = "";
  let overlay = null;
  let layer = null;

  function save() {
    chrome.storage.local.set({ [KEY]: points, [RKEY]: rapid, [KKEY]: kpoints });
  }

  function dot(p, label) {
    const d = document.createElement("div");
    if (label === "mouse") {
      const NS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", "12");
      svg.setAttribute("height", "12");
      svg.style.cssText = "display:block;margin:3px 0 0 4px;transform:translate(.225px,-.2px);";
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", "M5 3v16l4.3-4.2 3 6.4 2.4-1.1-3-6.3 6.1-.5z");
      path.setAttribute("fill", "#fff");
      svg.appendChild(path);
      d.appendChild(svg);
    } else {
      d.textContent = label;
    }
    d.style.cssText =
      `position:absolute;left:${p.x}px;top:${p.y}px;width:18px;height:18px;` +
      "margin:-9px 0 0 -9px;border-radius:50%;background:#e11d1d;color:#fff;" +
      "font:700 11px/18px system-ui,sans-serif;text-align:center;" +
      "box-shadow:0 0 0 2px #fff,0 1px 4px rgba(0,0,0,.5);";
    layer.appendChild(d);
  }

  const KEYGLYPH = {
    Space: "\u2423", Enter: "\u23CE", Backspace: "\u232B", Tab: "\u21E5", CapsLock: "\u21EA",
    ShiftLeft: "\u21E7", ShiftRight: "\u21E7", ControlLeft: "\u2303", ControlRight: "\u2303",
    AltLeft: "\u2325", AltRight: "\u2325", ArrowLeft: "\u2190", ArrowUp: "\u2191", ArrowDown: "\u2193", ArrowRight: "\u2192",
    Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\",
    Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/",
    Escape: "Esc", MetaLeft: "\u2318",
  };

  function keyLabel(code) {
    if (!code) return "";
    if (KEYGLYPH[code]) return KEYGLYPH[code];
    if (/^F([1-9]|1[0-2])$/.test(code)) return code;
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    return "";
  }

  function render() {
    if (!layer) {
      layer = document.createElement("div");
      layer.style.cssText =
        "position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;";
      document.documentElement.appendChild(layer);
    }
    layer.textContent = "";
    points.forEach((p, i) => {
      if (p) dot(p, i + 1);
    });
    kpoints.forEach((p, i) => {
      if (p) dot(p, keyLabel(keys[i]) || i + 1);
    });
    if (rapid) dot(rapid, "mouse");
  }

  function cancelPick() {
    if (overlay) overlay.remove();
    overlay = null;
  }

  async function pick(slot, kb, kind) {
    stop();
    cancelPick();
    const { lang = "en" } = await chrome.storage.local.get("lang");
    const L = I18N[lang] || I18N.en;
    overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(225,29,29,.06);";
    const tip = document.createElement("div");
    tip.textContent = slot === "rapid" ? L.pickPoint : L.pickN.replace("{n}", slot + 1);
    if (lang === "ar" || lang === "ur") tip.dir = "rtl";
    tip.style.cssText =
      "position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#111;color:#fff;" +
      "padding:8px 14px;border-radius:8px;font:600 13px system-ui,sans-serif;pointer-events:none;";
    overlay.appendChild(tip);
    overlay.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        const p = { x: e.pageX, y: e.pageY };
        if ((kind === "el" || kind === "tx") && typeof slot === "number" && !kb) {
          overlay.style.display = "none";
          const t = describe(hitAt(document, e.clientX, e.clientY), kind, e.clientX, e.clientY);
          overlay.style.display = "";
          if (t) p.t = t;
        }
        if (slot === "rapid") rapid = p;
        else if (kb) kpoints[slot] = p;
        else points[slot] = p;
        save();
        cancelPick();
        render();
        chrome.runtime.sendMessage({ type: "reopen" });
      },
      true
    );
    document.documentElement.appendChild(overlay);
  }

  // a click the way a real mouse makes it: hover first, then press, release, click
  const HOVER = ["pointerover", "pointerenter", "mouseover", "mouseenter", "pointermove", "mousemove"];
  const PRESS = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"];

  let lastMv = null;
  function fireMouse(el, type, x, y, held) {
    const down = type === "pointerdown" || type === "mousedown" || (!!held && /move$/.test(type));
    const flat = /enter|leave/.test(type);
    const o = {
      bubbles: !flat, cancelable: !flat, composed: true, view: window,
      clientX: x, clientY: y, screenX: x + (window.screenX || 0), screenY: y + (window.screenY || 0),
      button: 0, buttons: down ? 1 : 0, detail: /down|up|click/.test(type) ? 1 : 0,
    };
    // pages that draw from movementX / movementY need the step since the previous move
    const isMove = /move$/.test(type);
    if (isMove) Object.assign(o, { movementX: lastMv ? x - lastMv[0] : 0, movementY: lastMv ? y - lastMv[1] : 0 });
    if (type.startsWith("pointer")) {
      Object.assign(o, { pointerId: 1, pointerType: "mouse", isPrimary: true, width: 1, height: 1, pressure: down ? 0.5 : 0 });
      el.dispatchEvent(new PointerEvent(type, o));
    } else {
      el.dispatchEvent(new MouseEvent(type, o));
    }
    if (type === "mousemove") lastMv = [x, y];
  }

  // shadow DOM support: games, players and web components keep their real elements inside shadow roots
  function shadowOf(el) {
    try {
      return (chrome.dom && chrome.dom.openOrClosedShadowRoot && chrome.dom.openOrClosedShadowRoot(el)) || el.shadowRoot || null;
    } catch {
      return el && el.shadowRoot ? el.shadowRoot : null;
    }
  }

  // the real element under a point, looking inside shadow roots at any depth
  function hitAt(doc, x, y) {
    let el = doc.elementFromPoint(x, y);
    for (let guard = 0; el && guard < 20; guard++) {
      const sr = shadowOf(el);
      const inner = sr && sr.elementFromPoint(x, y);
      if (!inner || inner === el) break;
      el = inner;
    }
    return el;
  }

  // the focused element, looking inside shadow roots at any depth
  function deepActive() {
    let el = document.activeElement;
    for (let guard = 0; el && guard < 20; guard++) {
      const sr = shadowOf(el);
      if (!sr || !sr.activeElement) break;
      el = sr.activeElement;
    }
    return el;
  }

  // parent that also steps out of a shadow root to its host
  function upFrom(el) {
    if (!el) return null;
    if (el.parentElement) return el.parentElement;
    const root = el.getRootNode && el.getRootNode();
    return root && root.host ? root.host : null;
  }

  function closestDeep(el, sel) {
    for (let guard = 0; el && guard < 200; guard++) {
      if (el.matches && el.matches(sel)) return el;
      el = upFrom(el);
    }
    return null;
  }

  function synth(x, y, types, held) {
    const el = hitAt(document, x, y);
    if (!el) return;
    const list = types || PRESS;
    if (list[0] === "pointerdown") HOVER.forEach((type) => fireMouse(el, type, x, y));
    list.forEach((type) => fireMouse(el, type, x, y, held));
  }

  // when the point sits on an embedded frame (a game or app inside an iframe), hand the click to that frame
  function tap(x, y, types, n, held) {
    const el = hitAt(document, x, y);
    if (el && /^(IFRAME|FRAME)$/.test(el.tagName)) {
      const r = el.getBoundingClientRect();
      const sx = el.offsetWidth ? r.width / el.offsetWidth : 1;
      const sy = el.offsetHeight ? r.height / el.offsetHeight : 1;
      chrome.runtime
        .sendMessage({
          type: "tc-relay",
          msg: { type: "tc-click", x: (x - r.left) / sx - el.clientLeft, y: (y - r.top) / sy - el.clientTop, w: Math.round(el.clientWidth), h: Math.round(el.clientHeight), types, n: n || 1, held: !!held },
        })
        .catch(() => {});
      return;
    }
    for (let k = 0; k < (n || 1); k++) synth(x, y, k ? PRESS : types, held);
  }

  function locate(p) {
    let x = p.x - window.scrollX;
    let y = p.y - window.scrollY;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
      window.scrollTo(p.x - window.innerWidth / 2, p.y - window.innerHeight / 2);
      x = p.x - window.scrollX;
      y = p.y - window.scrollY;
    }
    return { x, y };
  }

  // clicks land a random few pixels off the target, inside a small circle, never the same pixel twice
  const CLICK_R = 3;
  function jitter(x, y) {
    const a = Math.random() * 2 * Math.PI;
    const r = CLICK_R * Math.sqrt(Math.random());
    return {
      x: Math.min(window.innerWidth - 1, Math.max(0, Math.round(x + Math.cos(a) * r))),
      y: Math.min(window.innerHeight - 1, Math.max(0, Math.round(y + Math.sin(a) * r))),
    };
  }

  async function holdAt(p0, ms, id) {
    const p = aim(p0);
    if (!p) {
      await new Promise((r) => setTimeout(r, Math.min(ms, 50)));
      return;
    }
    const l = locate(p);
    const { x, y } = jitter(l.x, l.y);
    tap(x, y, ["pointerdown", "mousedown"]);
    const t0 = performance.now();
    while (id === runId && performance.now() - t0 < ms) {
      await new Promise((r) => setTimeout(r, Math.max(1, Math.min(50, ms - (performance.now() - t0)))));
    }
    tap(x, y, ["pointerup", "mouseup", "click"]);
  }

  // advanced clicks: a point can carry a target (an element or some text) that is looked up again at every click
  let advOn = false;
  const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();

  function shown(el) {
    if (!el || !el.getBoundingClientRect) return false;
    if (layer && layer.contains(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    return el.checkVisibility ? el.checkVisibility() : true;
  }

  function textOf(el) {
    if (!el) return "";
    const own = el.value && /^(button|submit|reset)$/i.test(el.type || "") ? el.value : "";
    const line = String(own || el.innerText || el.getAttribute("aria-label") || el.getAttribute("alt") || el.getAttribute("title") || "")
      .split("\n")
      .map((x) => x.trim())
      .find((x) => x) || "";
    return line.replace(/\s+/g, " ").slice(0, 40);
  }

  function pathOf(el) {
    if (!el || el.getRootNode() !== document) return "";
    const parts = [];
    for (let n = el, g = 0; n && n.nodeType === 1 && n !== document.documentElement && g < 10; n = n.parentElement, g++) {
      if (n.id) {
        const id = "#" + CSS.escape(n.id);
        if (document.querySelectorAll(id).length === 1) {
          parts.unshift(id);
          break;
        }
      }
      let s = n.tagName.toLowerCase();
      const par = n.parentElement;
      if (par) {
        const sib = [...par.children].filter((c) => c.tagName === n.tagName);
        if (sib.length > 1) s += ":nth-of-type(" + (sib.indexOf(n) + 1) + ")";
      }
      parts.unshift(s);
    }
    return parts.join(">");
  }

  // what to remember about the thing that was picked: the element itself, or the words on it
  function describe(el, kind, vx, vy) {
    if (!el) return null;
    const text = textOf(el);
    if (kind === "tx") return text ? { k: "tx", text } : null;
    const r = el.getBoundingClientRect();
    const f = (v, a, b) => (b > 0 ? Math.min(1, Math.max(0, (v - a) / b)) : 0.5);
    return { k: "el", sel: pathOf(el), tag: el.tagName.toLowerCase(), text, ox: f(vx, r.left, r.width), oy: f(vy, r.top, r.height) };
  }

  function findByText(text) {
    const want = norm(text);
    if (!want) return null;
    let part = null;
    const w = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode()); ) {
      const v = norm(n.nodeValue);
      if (!v) continue;
      if (v.indexOf(want) < 0) {
        // the words may be split over inline tags ("Add to <b>cart</b>"): climb from a piece of them
        if (want.indexOf(v) >= 0) {
          let up = n.parentElement;
          for (let k = 0; up && k < 4; k++, up = up.parentElement) {
            const tv = norm(up.textContent);
            if (tv === want) {
              if (shown(up)) return up;
              break;
            }
            if (tv.length > want.length + 20) break;
          }
        }
        continue;
      }
      const e = n.parentElement;
      if (!e || !shown(e)) continue;
      if (v === want) return e;
      if (!part) part = e;
    }
    // words split over several tags, or kept in a button's value / label
    for (const e of document.querySelectorAll('a,button,[role="button"],input[type="button"],input[type="submit"],label,summary,[aria-label]')) {
      if (!shown(e)) continue;
      const v = norm(e.value && /^(button|submit)$/i.test(e.type || "") ? e.value : e.innerText || e.getAttribute("aria-label"));
      if (v === want) return e;
      if (!part && v.indexOf(want) >= 0) part = e;
    }
    return part;
  }

  function findTarget(t) {
    if (t.k === "tx") return findByText(t.text);
    let el = null;
    if (t.sel) {
      try {
        el = document.querySelector(t.sel);
      } catch {}
      if (el && (el.tagName.toLowerCase() !== t.tag || !shown(el))) el = null;
    }
    return el || (t.text ? findByText(t.text) : null);
  }

  // where to click, in page coordinates, or null when the target is not on the page right now
  function aim(p) {
    if (!advOn || !p || !p.t) return p;
    const el = findTarget(p.t);
    if (!el) return null;
    let r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) {
      el.scrollIntoView({ block: "center", inline: "center" });
      r = el.getBoundingClientRect();
    }
    const ox = Number.isFinite(p.t.ox) ? p.t.ox : 0.5;
    const oy = Number.isFinite(p.t.oy) ? p.t.oy : 0.5;
    return { x: r.left + window.scrollX + r.width * ox, y: r.top + window.scrollY + r.height * oy };
  }

  async function clickAt(p0) {
    const p = aim(p0);
    if (!p) return;
    const l = locate(p);
    const { x, y } = jitter(l.x, l.y);
    tap(x, y);
  }

  // while a drawing plays, the real mouse is ignored by the page (otherwise moving it onto the board drags the stroke to it);
  // pressing on the page, or Stop, gives it back
  const GUARD_MOVES = ["pointermove", "pointerrawupdate", "pointerover", "pointerout", "pointerenter", "pointerleave", "mousemove", "mouseover", "mouseout", "mouseenter", "mouseleave"];
  const GUARD_DOWNS = ["pointerdown", "mousedown", "touchstart"];
  let guardOn = false;
  let kAnchor = null;
  function guardEv(e) {
    if (!guardOn || !e.isTrusted) return;
    if (GUARD_DOWNS.includes(e.type)) {
      if (mode === "pattern") stop();
      return;
    }
    e.stopImmediatePropagation();
  }
  for (const t of GUARD_MOVES.concat(GUARD_DOWNS)) window.addEventListener(t, guardEv, { capture: true, passive: true });
  function setGuard(on) {
    if (guardOn === on) return;
    guardOn = on;
    chrome.runtime.sendMessage({ type: "tc-relay", msg: { type: "tc-guard", on } }).catch(() => {});
  }

  function stop() {
    chrome.runtime.sendMessage({ type: "rl-off" }).catch(() => {});
    setGuard(false);
    running = false;
    runId++;
    hidePlayback(mode === "pattern");
    if (frameText) {
      frameText = false;
      chrome.runtime.sendMessage({ type: "tc-relay", msg: { type: "tc-text-stop" } }).catch(() => {});
    }
    phase = null;
    clearTimeout(timer);
    timer = null;
    kAnchor = null;
    returnFocus();
  }

  async function start(from) {
    stop();
    const { delays2: delays = [], loop = false, holdOn = false, holds3: holds = [], rlSec = 0, advOn: adv = false } = await chrome.storage.local.get(["delays2", "loop", "holdOn", "holds3", "rlSec", "advOn"]);
    advOn = !!adv;
    runVals = { delays2: delays, loop, holdOn, holds3: holds };
    const queue = points
      .map((p, i) => ({
        p,
        n: i,
        d: Number.isFinite(delays[i]) ? delays[i] : DEFAULT_DELAYS[i],
        h: holdOn ? (Number.isFinite(holds[i]) && holds[i] >= 0 ? holds[i] : 0) : 0,
      }))
      .filter((s) => s.p);
    if (!queue.length) return false;
    let i = from == null ? 0 : Math.max(0, queue.findIndex((q) => q.n === from));
    let now = from != null;
    running = true;
    mode = "seq";
    const id = ++runId;
    seqQueue = queue;
    retimeSeq = null;
    reps = 0;
    repsMode = "seq";
    const step = () => {
      const s = queue[i];
      // starting from a chosen click: that click goes first, without its delay
      const wait = now ? 1 : Math.max(50, s.d * 1000);
      now = false;
      phase = { kind: "delay", n: s.n, t0: Date.now(), dur: wait };
      let fired = false;
      const fire = async () => {
        fired = true;
        if (s.h > 0) {
          phase = { kind: "hold", n: s.n, t0: Date.now(), dur: s.h * 1000 };
          await holdAt(s.p, s.h * 1000, id);
        } else {
          await clickAt(s.p);
        }
        if (id !== runId) return;
        i++;
        if (i >= queue.length) {
          reps++;
          if (!loop) return stop();
          i = 0;
        }
        step();
      };
      timer = setTimeout(fire, wait);
      // a delay edited while this one is counting down: keep the time already spent, count the rest on the new value
      retimeSeq = () => {
        if (fired) return;
        clearTimeout(timer);
        const nw = Math.max(50, s.d * 1000);
        phase.dur = nw;
        timer = setTimeout(fire, Math.max(1, nw - (Date.now() - phase.t0)));
      };
    };
    const go = () => {
      step();
    };
    // Scalping: when the first targeted click is not on the page yet, reload the page every few seconds until it shows up
    const watch = advOn && rlSec > 0 && from == null ? queue.find((q) => q.p && q.p.t) : null;
    if (watch && !findTarget(watch.p.t)) {
      const dur = Math.max(1, Math.floor(rlSec)) * 1000;
      const t0 = Date.now();
      phase = { kind: "watch", n: -1, t0, dur };
      const tick = () => {
        if (id !== runId) return;
        if (findTarget(watch.p.t)) {
          phase = null;
          return go();
        }
        if (Date.now() - t0 >= dur) {
          chrome.runtime.sendMessage({ type: "rl-arm" }).catch(() => {});
          setTimeout(() => location.reload(), 80);
          return;
        }
        timer = setTimeout(tick, 200);
      };
      timer = setTimeout(tick, 200);
    } else go();
    return true;
  }

  // times edited while a sequence runs: take them over right away
  let seqQueue = null;
  let retimeSeq = null;
  let kSteps = null;
  const okT = (v, d) => (Number.isFinite(v) && v >= 0 ? v : d);
  function applyLive(m) {
    if (!running) return;
    if (mode === "seq" && seqQueue) {
      const delays = m.delays2 || [], holds = m.holds3 || [];
      seqQueue.forEach((q) => {
        q.d = okT(delays[q.n], DEFAULT_DELAYS[q.n]);
        q.h = runVals.holdOn ? okT(holds[q.n], 0) : 0;
      });
      runVals = { ...runVals, delays2: delays, holds3: holds };
      if (retimeSeq) retimeSeq();
    } else if (mode === "kseq" && kSteps) {
      const kd = m.kdelays || [], kh = m.kholds || [];
      kSteps.forEach((s) => {
        s.d = okT(kd[s.row], 3);
        s.h = okT(kh[s.row], 0);
      });
      runVals = { ...runVals, kdelays: kd, kholds: kh };
      const cur = phase && phase.kind === "delay" && kSteps.find((s) => s.row === phase.n);
      if (cur) phase.dur = cur.d * 1000;
    }
  }

  const KEYMAP = {
    Space: [" ", 32], Enter: ["Enter", 13], Backspace: ["Backspace", 8], Tab: ["Tab", 9], CapsLock: ["CapsLock", 20],
    ShiftLeft: ["Shift", 16], ShiftRight: ["Shift", 16], ControlLeft: ["Control", 17], ControlRight: ["Control", 17],
    AltLeft: ["Alt", 18], AltRight: ["Alt", 18], ArrowLeft: ["ArrowLeft", 37], ArrowUp: ["ArrowUp", 38],
    ArrowRight: ["ArrowRight", 39], ArrowDown: ["ArrowDown", 40], Backquote: ["`", 192], Minus: ["-", 189],
    Equal: ["=", 187], BracketLeft: ["[", 219], BracketRight: ["]", 221], Backslash: ["\\", 220],
    Semicolon: [";", 186], Quote: ["'", 222], Comma: [",", 188], Period: [".", 190], Slash: ["/", 191],
    Escape: ["Escape", 27], MetaLeft: ["Meta", 91],
  };

  function keyInfo(code) {
    if (/^Key[A-Z]$/.test(code)) return [code[3].toLowerCase(), code.charCodeAt(3)];
    if (/^Digit[0-9]$/.test(code)) return [code[5], code.charCodeAt(5)];
    if (/^F([1-9]|1[0-2])$/.test(code)) return [code, 111 + Number(code.slice(1))];
    return KEYMAP[code] || null;
  }

  function isEditable(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
    if (el instanceof HTMLInputElement) {
      return !el.readOnly && !el.disabled && /^(text|search|url|tel|email|password|number)$/.test(el.type);
    }
    return false;
  }

  function focusAt(x, y) {
    const el = hitAt(document, x, y);
    const f = closestDeep(el, "input,textarea,select,[contenteditable],[tabindex],button,a[href]");
    if (f && f.focus) f.focus();
  }

  // type into the focused field. execCommand is the natural way, but it can refuse while the window is not focused
  // (for example while the popup is open), so fall back to writing the text in directly
  // rich editors (Slate, Lexical, Draft, ProseMirror) do their own typing from the beforeinput event; Chrome does not send it
  // for execCommand, so send it first, and stay out of the way when the editor takes it
  function beforeInput(el, inputType, data) {
    if (!el) return true;
    try {
      return el.dispatchEvent(new InputEvent("beforeinput", { inputType, data: data == null ? null : data, bubbles: true, cancelable: true, composed: true }));
    } catch {
      return true;
    }
  }

  function editText(text, noGate) {
    const el = deepActive();
    if (!noGate && !beforeInput(el, "insertText", text)) return;
    let ok = false;
    try { ok = document.execCommand("insertText", false, text); } catch {}
    if (ok || !el) return;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      try {
        const s = el.selectionStart == null ? el.value.length : el.selectionStart;
        const e = el.selectionEnd == null ? s : el.selectionEnd;
        el.setRangeText(text, s, e, "end");
      } catch {
        el.value += text;
      }
    } else if (el.isContentEditable) {
      const sel = window.getSelection && window.getSelection();
      if (sel && sel.rangeCount && el.contains(sel.anchorNode)) {
        const r = sel.getRangeAt(0);
        r.deleteContents();
        const n = document.createTextNode(text);
        r.insertNode(n);
        r.setStartAfter(n);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      } else el.append(text);
    } else return;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, data: text, inputType: "insertText" }));
  }

  function editDelete() {
    const el = deepActive();
    if (!beforeInput(el, "deleteContentBackward", null)) return;
    let ok = false;
    try { ok = document.execCommand("delete"); } catch {}
    if (ok || !el) return;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      try {
        const s = el.selectionStart, e = el.selectionEnd;
        if (s === e && s > 0) el.setRangeText("", s - 1, e, "end");
        else if (s !== e) el.setRangeText("", s, e, "end");
        else return;
      } catch {
        el.value = el.value.slice(0, -1);
      }
      el.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "deleteContentBackward" }));
    }
  }

  // while the popup is open the page window is not focused, and pages often ignore keys then (games, editors, typing sites);
  // tell the page it has focus again for as long as a key sequence runs
  let focusLent = false;
  function lendFocus() {
    if (focusLent || document.hasFocus()) return;
    focusLent = true;
    chrome.runtime.sendMessage({ type: "tc-relay", msg: { type: "tc-focus", on: true } }).catch(() => {});
    window.dispatchEvent(new Event("tc-focus-on"));
    const el = deepActive();
    try {
      window.dispatchEvent(new FocusEvent("focus"));
      if (el && el !== document.body && el !== document.documentElement) {
        el.dispatchEvent(new FocusEvent("focus", { composed: true }));
        el.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
      }
    } catch {}
  }
  // opening the popup mid-run blurs the page again: hand focus back right after the page has reacted to the blur
  window.addEventListener(
    "blur",
    (e) => {
      if (e.target !== window || !running || mode !== "kseq") return;
      setTimeout(() => {
        if (!running || mode !== "kseq") return;
        focusLent = false;
        lendFocus();
      }, 0);
    },
    true
  );
  function returnFocus() {
    if (!focusLent) return;
    focusLent = false;
    chrome.runtime.sendMessage({ type: "tc-relay", msg: { type: "tc-focus", on: false } }).catch(() => {});
    window.dispatchEvent(new Event("tc-focus-off"));
  }

  // a key event that carries keyCode / which / charCode in every browser (some ignore them in the constructor)
  function mkKey(type, init) {
    const ev = new KeyboardEvent(type, init);
    for (const k of ["keyCode", "which", "charCode"]) {
      if (init[k] != null && ev[k] !== init[k]) {
        try { Object.defineProperty(ev, k, { get: () => init[k] }); } catch {}
      }
    }
    return ev;
  }

  // nothing focused: games listen on their canvas or player, so send the key to the biggest one on screen
  function gameSurface() {
    let best = null, area = 0;
    for (const el of document.querySelectorAll("canvas, ruffle-player, ruffle-embed, embed, object")) {
      const r = el.getBoundingClientRect();
      const a = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      if (a > area) { area = a; best = el; }
    }
    return area >= 0.2 * innerWidth * innerHeight ? best : null;
  }

  function keyTarget() {
    const a = deepActive();
    if (a && a !== document.body && a !== document.documentElement) return a;
    return gameSurface() || a || document.body;
  }

  // a key press as a real keyboard makes it: down, a repeat every ~33 ms once held for half a second, up.
  // Games that read the key state once per frame need it held for a few frames, so a tap is never shorter than 70 ms.
  const KEY_MIN_MS = 70;
  async function pressKey(code, ms, id) {
    const info = keyInfo(code);
    if (!info) return;
    const [key, kc] = info;
    const loc = /Left$/.test(code) && /^(Shift|Control|Alt)/.test(code) ? 1 : /Right$/.test(code) && /^(Shift|Control|Alt)/.test(code) ? 2 : 0;
    const init = { key, code, keyCode: kc, which: kc, location: loc, bubbles: true, cancelable: true, composed: true, view: window };
    const hold = Math.max(ms, KEY_MIN_MS);
    const inFrame = () => /^(IFRAME|FRAME)$/.test((deepActive() || {}).tagName || "");
    const heldFor = async (send) => {
      const t0 = performance.now();
      let nextRep = 500;
      while (id === runId && performance.now() - t0 < hold) {
        const el = performance.now() - t0;
        if (el >= nextRep) { send("keydown", true); nextRep += 33; }
        await sleepMs(Math.max(1, Math.min(nextRep > el ? nextRep - el : 33, 50, hold - el)));
      }
    };
    if (inFrame()) {
      // the page is a game or app inside an embedded frame: hand the key to the frame that has focus
      const { view, ...plain } = init;
      const fe = deepActive();
      const relay = (ev, repeat) => chrome.runtime.sendMessage({ type: "tc-relay", msg: { type: "tc-key", ev, init: { ...plain, repeat: !!repeat }, w: Math.round(fe.clientWidth), h: Math.round(fe.clientHeight) } }).catch(() => {});
      relay("keydown");
      await heldFor(relay);
      relay("keyup");
      return;
    }
    const target = keyTarget;
    const down = mkKey("keydown", init);
    target().dispatchEvent(down);
    if (!down.defaultPrevented) {
      const el = target();
      if (isEditable(el)) {
        if (key.length === 1) editText(key);
        else if (code === "Backspace") editDelete();
        else if (key === "Enter") {
          if (el instanceof HTMLInputElement) {
            if (el.form && el.form.requestSubmit) {
              try { el.form.requestSubmit(); } catch {}
            }
          } else if (beforeInput(el, el.isContentEditable ? "insertParagraph" : "insertLineBreak", null)) editText("\n", true);
        }
      } else if (key.length === 1 || key === "Enter") {
        // older games still listen for keypress
        const cc = key === "Enter" ? 13 : key.charCodeAt(0);
        target().dispatchEvent(mkKey("keypress", { ...init, charCode: cc, keyCode: cc, which: cc }));
      }
    }
    await heldFor((ev, repeat) => target().dispatchEvent(mkKey(ev, { ...init, repeat: !!repeat })));
    target().dispatchEvent(mkKey("keyup", init));
  }

  let frameText = false;

  // typing goes to the field it started in: clicking blank space on the page must not drop it, clicking another field moves it there
  function setAnchor() {
    const el = deepActive();
    if (isEditable(el)) kAnchor = el;
  }
  function restoreAnchor() {
    if (isEditable(deepActive()) || !kAnchor || !kAnchor.isConnected) return;
    try {
      kAnchor.focus({ preventScroll: true });
      if (kAnchor.isContentEditable) {
        const sel = window.getSelection && window.getSelection();
        if (sel && !(sel.rangeCount && kAnchor.contains(sel.anchorNode))) {
          const r = document.createRange();
          r.selectNodeContents(kAnchor);
          r.collapse(false);
          sel.removeAllRanges();
          sel.addRange(r);
        }
      }
    } catch {}
  }
  window.addEventListener(
    "focusin",
    (e) => {
      if (!running || mode !== "kseq" || !e.isTrusted) return;
      const el = e.composedPath ? e.composedPath()[0] : e.target;
      if (isEditable(el)) kAnchor = el;
    },
    true
  );

  async function typeText(text, id, normal) {
    restoreAnchor();
    if (/^(IFRAME|FRAME)$/.test((deepActive() || {}).tagName || "")) {
      // the page is an editor inside an embedded frame: type into the frame that has focus
      const fe = deepActive();
      const relay = (msg) => chrome.runtime.sendMessage({ type: "tc-relay", msg: { ...msg, w: Math.round(fe.clientWidth), h: Math.round(fe.clientHeight) } }).catch(() => {});
      frameText = true;
      if (!normal) {
        relay({ type: "tc-text", text, normal: false });
        await sleepMs(60);
        return;
      }
      for (const ch of text) {
        if (id !== runId) return;
        relay({ type: "tc-text", text: ch, normal: true });
        await sleepMs(40);
      }
      return;
    }
    if (!normal) {
      const el = deepActive();
      if (isEditable(el)) {
        editText(text);
        return;
      }
    }
    for (const ch of text) {
      if (id !== runId) return;
      restoreAnchor();
      const el = deepActive();
      const t = el || document.body;
      const init = { key: ch, bubbles: true, cancelable: true, composed: true, view: window };
      const down = new KeyboardEvent("keydown", init);
      t.dispatchEvent(down);
      if (normal && !down.defaultPrevented && isEditable(el)) {
        editText(ch);
      } else {
        t.dispatchEvent(new KeyboardEvent("keypress", init));
      }
      t.dispatchEvent(new KeyboardEvent("keyup", init));
      await sleepMs(normal ? 40 : 15);
    }
  }

  async function startKb() {
    stop();
    const { keys: kb = [], kholds = [], krows = 3, ktents = [], kloop = false, kdelays = [], ktype = "instant" } = await chrome.storage.local.get(["keys", "kholds", "krows", "ktents", "kloop", "kdelays", "ktype"]);
    runVals = { krows, keys: kb, kholds, ktents, kloop, kdelays };
    const ktexts = [];
    for (const e of Array.isArray(ktents) ? ktents : []) {
      if (e && Number.isInteger(e.i) && typeof e.text === "string") ktexts[e.i] = e.text;
    }
    const steps = [];
    for (let i = 0; i < Math.min(SLOTS, krows); i++) {
      const p = kpoints[i];
      const code = typeof kb[i] === "string" ? kb[i] : null;
      const text = typeof ktexts[i] === "string" ? ktexts[i].slice(0, 1000) : "";
      if (!p && !code && !text) continue;
      steps.push({ row: i, d: Number.isFinite(kdelays[i]) && kdelays[i] >= 0 ? kdelays[i] : 3, p, code, text, h: Number.isFinite(kholds[i]) && kholds[i] >= 0 ? kholds[i] : 0 });
    }
    if (!steps.length) return false;
    kSteps = steps;
    running = true;
    mode = "kseq";
    kAnchor = null;
    setAnchor();
    lendFocus();
    const id = ++runId;
    reps = 0;
    repsMode = "kseq";
    (async () => {
      do {
        for (const s of steps) {
          if (id !== runId) return;
          if (s.d > 0) {
            phase = { kind: "delay", n: s.row, t0: Date.now(), dur: s.d * 1000 };
            const w0 = performance.now();
            while (id === runId && performance.now() - w0 < s.d * 1000) {
              await sleepMs(Math.max(1, Math.min(50, s.d * 1000 - (performance.now() - w0))));
            }
            phase = null;
            if (id !== runId) return;
          }
          if (s.p) {
            const { x, y } = locate(s.p);
            const fr = hitAt(document, x, y);
            if (fr && /^(IFRAME|FRAME)$/.test(fr.tagName)) {
              fr.focus();
              tap(x, y);
              await sleepMs(30);
            } else {
              synth(x, y);
              focusAt(x, y);
            }
          }
          setAnchor();
          if (s.code) {
            phase = s.h > 0 ? { kind: "hold", n: s.row, t0: Date.now(), dur: s.h * 1000 } : null;
            await pressKey(s.code, s.h * 1000, id);
            phase = null;
          }
          if (s.text) await typeText(s.text, id, ktype === "normal");
          if (s.d <= 0.02) await sleepMs(20);
        }
        if (id === runId) reps++;
      } while (kloop && id === runId);
      if (id === runId) stop();
    })();
    return true;
  }

  async function startRapid() {
    stop();
    if (!rapid) return false;
    const { cps = 5 } = await chrome.storage.local.get("cps");
    runVals = { cps };
    const perSec = Number(cps);
    if (!(perSec > 0)) return false;
    running = true;
    mode = "rapid";
    const id = ++runId;
    const period = 1000 / perSec;
    phase = { kind: "rapid", t0: Date.now(), sent: 0 };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      const t0 = performance.now();
      let sent = 0;
      while (id === runId) {
        const due = Math.floor((performance.now() - t0) / period) + 1 - sent;
        if (due > 0) {
          const { x, y } = locate(rapid);
          for (let k = 0; k < Math.min(due, 200); k++) {
            const j = jitter(x, y);
            tap(j.x, j.y);
          }
          sent += due;
          if (phase && phase.kind === "rapid") phase.sent = sent;
        }
        const wait = t0 + sent * period - performance.now();
        await sleep(wait > 1 ? wait : 0);
      }
    })();
    return true;
  }

  // pattern: record a hold-and-move with the mouse, then play it back
  function recordPattern() {
    stop();
    cancelPick();
    chrome.storage.local.get("lang").then(({ lang = "en" }) => {
      const L = I18N[lang] || I18N.en;
      overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(225,29,29,.06);touch-action:none;";
      const tip = document.createElement("div");
      tip.textContent = L.patternRec;
      if (lang === "ar" || lang === "ur") tip.dir = "rtl";
      tip.style.cssText =
        "position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#111;color:#fff;" +
        "padding:8px 14px;border-radius:8px;font:600 13px system-ui,sans-serif;pointer-events:none;";
      overlay.appendChild(tip);
      // live red dots while you draw
      const live = document.createElementNS(SVGNS, "svg");
      live.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;";
      overlay.appendChild(live);
      let lastDot = null;
      const addDot = (x, y, r) => {
        const c = document.createElementNS(SVGNS, "circle");
        c.setAttribute("cx", x);
        c.setAttribute("cy", y);
        c.setAttribute("r", r);
        c.setAttribute("fill", "#ff4a4a");
        live.appendChild(c);
      };
      let pts = null;
      let t0 = 0;
      const add = (e) => {
        pts.push([Math.round(performance.now() - t0), Math.round(e.pageX), Math.round(e.pageY)]);
        if (!lastDot) {
          addDot(e.clientX, e.clientY, 5);
          lastDot = [e.clientX, e.clientY];
        } else if (Math.hypot(e.clientX - lastDot[0], e.clientY - lastDot[1]) >= 8) {
          addDot(e.clientX, e.clientY, 2.6);
          lastDot = [e.clientX, e.clientY];
        }
      };
      const stopEv = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };
      overlay.addEventListener("pointerdown", (e) => {
        stopEv(e);
        try { overlay.setPointerCapture(e.pointerId); } catch {}
        pts = [];
        t0 = performance.now();
        add(e);
      }, true);
      overlay.addEventListener("pointermove", (e) => {
        stopEv(e);
        if (pts) add(e);
      }, true);
      overlay.addEventListener("pointerup", (e) => {
        stopEv(e);
        if (!pts) return;
        add(e);
        const got = pts;
        pts = null;
        if (got.length < 2 || got[got.length - 1][0] < 80) return;
        const max = 600;
        const keep = got.length > max ? got.filter((_, i) => i === got.length - 1 || i % Math.ceil(got.length / max) === 0) : got;
        pattern = { pts: keep, ms: keep[keep.length - 1][0], dx: 0, dy: 0 };
        chrome.storage.local.set({ [PKEY]: pattern });
        addDot(e.clientX, e.clientY, 5);
        const ghost = document.createElement("div");
        ghost.style.cssText = "position:fixed;inset:0;z-index:2147483646;pointer-events:none;transition:opacity .6s .5s;";
        ghost.appendChild(live);
        document.documentElement.appendChild(ghost);
        requestAnimationFrame(() => { ghost.style.opacity = "0"; });
        setTimeout(() => ghost.remove(), 1300);
        cancelPick();
        chrome.runtime.sendMessage({ type: "reopen" });
      }, true);
      document.documentElement.appendChild(overlay);
    });
  }

  // dots along a polyline: [x, y, ms] about every `gap` px
  function dotsAlong(pts, gap) {
    const out = [[pts[0][1], pts[0][2], pts[0][0]]];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const seg = Math.hypot(b[1] - a[1], b[2] - a[2]);
      let d = gap - acc;
      while (d <= seg) {
        const f = seg ? d / seg : 0;
        out.push([a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[0] + (b[0] - a[0]) * f]);
        d += gap;
      }
      acc = (acc + seg) % gap;
    }
    return out;
  }

  const SVGNS = "http://www.w3.org/2000/svg";
  let playBox = null;
  function hidePlayback(fade) {
    const el = playBox;
    playBox = null;
    if (!el) return;
    if (fade) {
      el.style.transition = "opacity .5s";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 550);
    } else el.remove();
  }
  // a pattern is either one recorded stroke (pts) or many traced strokes
  function strokesOf(p) {
    if (p.strokes && p.strokes.length) {
      let off = 0;
      return p.strokes.map((s) => {
        const o = { pts: s.pts, off };
        off += s.pts[s.pts.length - 1][0] + 60;
        return o;
      });
    }
    return [{ pts: p.pts, off: 0 }];
  }
  // true when the sketch sits on an embedded frame: only then does Start need site access (a board on the page itself needs none)
  function patternInFrame() {
    try {
      if (!pattern) return false;
      const l = strokesOf(pattern);
      const q = l[0].pts[0];
      const el = hitAt(document, q[1] + (pattern.dx || 0) - window.scrollX, q[2] + (pattern.dy || 0) - window.scrollY);
      return !!el && /^(IFRAME|FRAME)$/.test(el.tagName);
    } catch {
      return false;
    }
  }

  function patternStats(p) {
    const l = strokesOf(p);
    const last = l[l.length - 1];
    return { n: l.reduce((a, s) => a + s.pts.length, 0), ms: Math.round(last.off + last.pts[last.pts.length - 1][0]) };
  }

  // red dots over the page that light up in the order they were drawn (not clickable, not movable)
  function showPlayback(list, k, dx, dy, from = 0) {
    hidePlayback();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of list) {
      for (const q of s.pts) {
        x0 = Math.min(x0, q[1]); x1 = Math.max(x1, q[1]);
        y0 = Math.min(y0, q[2]); y1 = Math.max(y1, q[2]);
      }
    }
    const pad = 12;
    const ox = x0 + dx - pad, oy = y0 + dy - pad;
    const box = document.createElement("div");
    box.style.cssText = "position:absolute;left:" + ox + "px;top:" + oy + "px;width:" + (x1 - x0 + pad * 2) + "px;height:" + (y1 - y0 + pad * 2) +
      "px;z-index:2147483646;pointer-events:none;user-select:none;margin:0;padding:0;";
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("width", x1 - x0 + pad * 2);
    svg.setAttribute("height", y1 - y0 + pad * 2);
    svg.style.cssText = "display:block;overflow:visible;pointer-events:none;";
    const st = document.createElementNS(SVGNS, "style");
    st.textContent = "@keyframes tcl{0%{fill:#ffb0b0;opacity:1}100%{fill:#ff4a4a;opacity:1}}";
    svg.appendChild(st);
    const mk = (x, y, r, delay, dim) => {
      const c = document.createElementNS(SVGNS, "circle");
      c.setAttribute("cx", x + dx - ox);
      c.setAttribute("cy", y + dy - oy);
      c.setAttribute("r", r);
      c.setAttribute("fill", "#ff4a4a");
      if (dim) {
        c.setAttribute("opacity", ".28");
        c.style.animation = "tcl .3s linear forwards";
        c.style.animationDelay = ((delay - from) / k / 1000).toFixed(3) + "s";
      }
      svg.appendChild(c);
    };
    for (const s of list) {
      dotsAlong(s.pts, 8).forEach((q, i) => {
        if (i) mk(q[0], q[1], 2.6, s.off + q[2], true);
      });
    }
    if (list.length === 1) {
      const pts = list[0].pts;
      mk(pts[0][1], pts[0][2], 5, 0, false);
      const l = pts[pts.length - 1];
      mk(l[1], l[2], 5, 0, false);
    }
    box.appendChild(svg);
    document.documentElement.appendChild(box);
    playBox = box;
  }


  // ---- draw from an image: trace its edges and play them back as pen strokes ----
  let traceCap = 680;
  function imageToStrokes(bmp, W, H) {
    const sc = traceCap / Math.max(W, H);
    const w = Math.max(24, Math.round(W * sc)), h = Math.max(24, Math.round(H * sc));
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    cx.fillStyle = "#fff";
    cx.fillRect(0, 0, w, h);
    cx.drawImage(bmp, 0, 0, w, h);
    const px = cx.getImageData(0, 0, w, h).data;
    const n = w * h;
    const g = new Float32Array(n);
    for (let i = 0; i < n; i++) g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    const gl = g;
    // thin dark strokes (line-art icons): reduce each stroke to one centre line instead of tracing both of its sides
    const ink = new Uint8Array(n);
    let inkN = 0, midN = 0, inkSum = 0;
    for (let i = 0; i < n; i++) {
      if (gl[i] < 140) { ink[i] = 1; inkN++; inkSum += gl[i]; }
      if (gl[i] < 225) midN++;
    }
    // widest stroke: how many one-pixel erosions the dark area survives
    let maxR = 0;
    {
      let cur = ink, cnt = inkN;
      while (cnt > 0 && maxR < 60) {
        const nx = new Uint8Array(n);
        cnt = 0;
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (cur[i] && cur[i - 1] && cur[i + 1] && cur[i - w] && cur[i + w]) { nx[i] = 1; cnt++; }
        }
        cur = nx;
        if (cnt) maxR++;
      }
    }
    // dark thin strokes on white = line art; coloured or solid pictures keep the edge tracer
    // (strokes are near black; a mid-dark flat colour, such as a purple body, is a filled area and goes through the edge tracer)
    const lineArt = inkN > n * 0.01 && inkN >= midN * 0.6 && maxR <= 0.06 * Math.max(w, h) && inkSum / Math.max(1, inkN) < 95;
    const dots = [];
    let skel = null;
    if (lineArt) {
      const m = Uint8Array.from(ink), del = [];
      for (let x = 0; x < w; x++) { m[x] = 0; m[(h - 1) * w + x] = 0; }
      for (let y = 0; y < h; y++) { m[y * w] = 0; m[y * w + w - 1] = 0; }
      // tiny blobs (eyes, nose dots) would thin down to nothing: keep them as small circles
      {
        const seen = new Uint8Array(n), st = [], lim = 0.17 * Math.max(w, h);
        for (let i0 = 0; i0 < n; i0++) {
          if (!m[i0] || seen[i0]) continue;
          let x0 = w, y0 = h, x1 = 0, y1 = 0;
          const comp = [];
          st.push(i0);
          seen[i0] = 1;
          while (st.length) {
            const p = st.pop(), cx0 = p % w, cy0 = (p / w) | 0;
            comp.push(p);
            if (cx0 < x0) x0 = cx0;
            if (cx0 > x1) x1 = cx0;
            if (cy0 < y0) y0 = cy0;
            if (cy0 > y1) y1 = cy0;
            for (const q of [p - 1, p + 1, p - w, p + w]) if (q >= 0 && q < n && m[q] && !seen[q]) { seen[q] = 1; st.push(q); }
          }
          if (x1 - x0 < lim && y1 - y0 < lim) {
            for (const p of comp) m[p] = 0;
            dots.push([(x0 + x1) / 2, (y0 + y1) / 2, Math.max(2, 0.28 * ((x1 - x0 + y1 - y0) / 2))]);
          }
        }
      }
      let ch = true;
      while (ch) {
        ch = false;
        for (let pass = 0; pass < 2; pass++) {
          del.length = 0;
          for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            if (!m[i]) continue;
            const p2 = m[i - w], p3 = m[i - w + 1], p4 = m[i + 1], p5 = m[i + w + 1], p6 = m[i + w], p7 = m[i + w - 1], p8 = m[i - 1], p9 = m[i - w - 1];
            const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
            if (B < 2 || B > 6) continue;
            const A = (!p2 && p3 ? 1 : 0) + (!p3 && p4 ? 1 : 0) + (!p4 && p5 ? 1 : 0) + (!p5 && p6 ? 1 : 0) + (!p6 && p7 ? 1 : 0) + (!p7 && p8 ? 1 : 0) + (!p8 && p9 ? 1 : 0) + (!p9 && p2 ? 1 : 0);
            if (A !== 1) continue;
            if (pass === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
            del.push(i);
          }
          if (del.length) { ch = true; for (const i of del) m[i] = 0; }
        }
      }
      skel = m;
    }
    const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    let E = null;
    if (!skel) {
    // light blur (5 tap, once) of each colour channel: keeps small details such as eyes, collar studs and whiskers
    const kr = [1, 4, 6, 4, 1];
    const blur = (src) => {
      const t = new Float32Array(n), o = new Float32Array(n);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let s = 0;
        for (let k = -2; k <= 2; k++) s += src[y * w + Math.min(w - 1, Math.max(0, x + k))] * kr[k + 2];
        t[y * w + x] = s / 16;
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let s = 0;
        for (let k = -2; k <= 2; k++) s += t[Math.min(h - 1, Math.max(0, y + k)) * w + x] * kr[k + 2];
        o[y * w + x] = s / 16;
      }
      return o;
    };
    // an edge is wherever ANY colour channel jumps: orange feet on a pink ground differ in blue and green even though their brightness is alike
    const chans = [0, 1, 2].map((c) => {
      const a = new Float32Array(n);
      for (let i = 0; i < n; i++) a[i] = px[i * 4 + c];
      return blur(a);
    });
    // sobel + non-maximum suppression (thin edges)
    const mag = new Float32Array(n), sec = new Uint8Array(n);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      let bm = -1, bx = 0, by = 0;
      for (const g2 of chans) {
        const a = g2[i - w - 1], b = g2[i - w], c2 = g2[i - w + 1], d = g2[i - 1], f = g2[i + 1], gg = g2[i + w - 1], hh = g2[i + w], ii = g2[i + w + 1];
        const gx = -a - 2 * d - gg + c2 + 2 * f + ii, gy = -a - 2 * b - c2 + gg + 2 * hh + ii;
        const m = gx * gx + gy * gy;
        if (m > bm) { bm = m; bx = gx; by = gy; }
      }
      mag[i] = Math.sqrt(bm);
      const deg = ((Math.atan2(by, bx) * 180) / Math.PI + 180) % 180;
      sec[i] = deg < 22.5 || deg >= 157.5 ? 0 : deg < 67.5 ? 1 : deg < 112.5 ? 2 : 3;
    }
    const nm = new Float32Array(n);
    const cand = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, m = mag[i];
      if (m < 4 || x < 4 || y < 4 || x >= w - 4 || y >= h - 4) continue; // ignore a picture's own frame / edge artefacts
      const s = sec[i];
      const p = s === 0 ? [i - 1, i + 1] : s === 1 ? [i - w - 1, i + w + 1] : s === 2 ? [i - w, i + w] : [i - w + 1, i + w - 1];
      if (m >= mag[p[0]] && m >= mag[p[1]]) {
        nm[i] = m;
        cand.push(m);
      }
    }
    if (cand.length < 20) return [];
    cand.sort((p, q) => p - q);
    // seeds are capped at a fixed, small colour step, so pale or similar-brightness colours are traced next to very strong edges too
    const hi = Math.min(cand[Math.floor(cand.length * 0.18)], 40), lo = hi * 0.25;
    E = new Uint8Array(n);
    const stack = [];
    for (let i = 0; i < n; i++) if (nm[i] >= hi) { E[i] = 1; stack.push(i); }
    while (stack.length) {
      const p = stack.pop(), px0 = p % w, py0 = (p / w) | 0;
      for (const [ox, oy] of NB) {
        const x = px0 + ox, y = py0 + oy;
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
        const q = y * w + x;
        if (!E[q] && nm[q] >= lo) { E[q] = 1; stack.push(q); }
      }
    }
    }
    if (skel) E = skel;
    // trace connected edge pixels into polylines
    const vis = new Uint8Array(n);
    const extend = (p, pdx, pdy) => {
      const out = [];
      for (;;) {
        const x0 = p % w, y0 = (p / w) | 0;
        let best = -1, bs = -9, bx = 0, by = 0;
        for (const [ox, oy] of NB) {
          const q = (y0 + oy) * w + x0 + ox;
          if (x0 + ox < 0 || y0 + oy < 0 || x0 + ox >= w || y0 + oy >= h || !E[q] || vis[q]) continue;
          const sc2 = (ox * pdx + oy * pdy) / Math.hypot(ox, oy) - (ox && oy ? 0.05 : 0);
          if (sc2 > bs) { bs = sc2; best = q; bx = ox; by = oy; }
        }
        if (best < 0) return out;
        vis[best] = 1;
        out.push([best % w, (best / w) | 0]);
        p = best; pdx = bx; pdy = by;
      }
    };
    const degOf = (i) => {
      let d = 0;
      const x0 = i % w, y0 = (i / w) | 0;
      for (const [ox, oy] of NB) {
        const x = x0 + ox, y = y0 + oy;
        if (x >= 0 && y >= 0 && x < w && y < h && E[y * w + x]) d++;
      }
      return d;
    };
    const raw = [];
    const run = (i) => {
      vis[i] = 1;
      const fwd = extend(i, 0, 0);
      const back = extend(i, 0, 0);
      raw.push(back.reverse().concat([[i % w, (i / w) | 0]], fwd));
    };
    for (let i = 0; i < n; i++) if (E[i] && !vis[i] && degOf(i) === 1) run(i);
    for (let i = 0; i < n; i++) if (E[i] && !vis[i]) run(i);
    for (const [dx0, dy0, dr] of dots) {
      const c = [];
      for (let k = 0; k <= 8; k++) c.push([dx0 + dr * Math.cos((k * Math.PI) / 4.5), dy0 + dr * Math.sin((k * Math.PI) / 4.5)]);
      raw.push(c);
    }
    // simplify, scale to the target size, resample, order
    const dp = (pts, eps) => {
      if (pts.length < 3) return pts;
      const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
      const dl = Math.hypot(bx - ax, by - ay) || 1;
      let md = 0, mi = 0;
      for (let i = 1; i < pts.length - 1; i++) {
        const d = Math.abs((by - ay) * pts[i][0] - (bx - ax) * pts[i][1] + bx * ay - by * ax) / dl;
        if (d > md) { md = d; mi = i; }
      }
      if (md <= eps) return [pts[0], pts[pts.length - 1]];
      return dp(pts.slice(0, mi + 1), eps).slice(0, -1).concat(dp(pts.slice(mi), eps));
    };
    const sx = W / w, sy = H / h;
    const build = (eps) => {
      const list = [];
      for (const r of raw) {
        const sm = r.length > 4 ? r.map((q, i) => (i === 0 || i === r.length - 1 ? q : [(r[i - 1][0] + q[0] + r[i + 1][0]) / 3, (r[i - 1][1] + q[1] + r[i + 1][1]) / 3])) : r;
        const s = dp(sm, eps).map((q) => [q[0] * sx, q[1] * sy]);
        let len = 0;
        for (let i = 1; i < s.length; i++) len += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
        if (len < 5) continue;
        const out = [s[0]];
        for (let i = 1; i < s.length; i++) {
          const a = s[i - 1], b = s[i], segs = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4));
          for (let k = 1; k <= segs; k++) out.push([a[0] + ((b[0] - a[0]) * k) / segs, a[1] + ((b[1] - a[1]) * k) / segs]);
        }
        list.push(out);
      }
      return list;
    };
    let list = build(0.6), eps = 0.6;
    while (list.reduce((a, s) => a + s.length, 0) > 4800 && eps < 6) { eps += 0.75; list = build(eps); }
    // still too many points (busy photos): keep the longest strokes, which carry the outline and the main details
    {
      let tot = list.reduce((x, s) => x + s.length, 0);
      if (tot > 4800) {
        list.sort((p, q) => q.length - p.length);
        const keep = [];
        tot = 0;
        for (const st of list) if (tot + st.length <= 4800) { keep.push(st); tot += st.length; }
        list = keep;
      }
    }
    // outline first (the biggest strokes), then the details; nearest-first inside each group, flipping a stroke when its end is closer
    const ordered = [];
    let cur = [0, 0];
    const span = (s) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of s) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
      return Math.max(x1 - x0, y1 - y0);
    };
    const big = list.reduce((a, s) => Math.max(a, span(s)), 0);
    const outline = list.filter((s) => span(s) >= big * 0.45);
    const detail = list.filter((s) => span(s) < big * 0.45);
    for (const group of [outline, detail]) {
    list = group;
    while (list.length) {
      let bi = 0, bd = Infinity, bf = false;
      list.forEach((s, i) => {
        const d1 = Math.hypot(s[0][0] - cur[0], s[0][1] - cur[1]);
        const e = s[s.length - 1], d2 = Math.hypot(e[0] - cur[0], e[1] - cur[1]);
        if (d1 < bd) { bd = d1; bi = i; bf = false; }
        if (d2 < bd) { bd = d2; bi = i; bf = true; }
      });
      let s = list.splice(bi, 1)[0];
      if (bf) s = s.reverse();
      ordered.push(s);
      cur = s[s.length - 1];
    }
    }
    return ordered;
  }

  // an invisible click in the middle of the chosen box, so the page under it (a drawing canvas, a board) is the active one;
  // links, buttons and fields are left alone so nothing gets triggered by accident
  function hiddenClick(x, y) {
    try {
      const el = hitAt(document, x, y);
      if (!el || closestDeep(el, "a[href],button,input,select,textarea,summary,label,[role=button],[role=link]")) return;
      tap(x, y);
      focusAt(x, y);
    } catch {}
  }

  async function pickImage(pre, parts) {
    stop();
    cancelPick();
    const { lang = "en" } = await chrome.storage.local.get("lang");
    const L = I18N[lang] || I18N.en;
    const rtl = lang === "ar" || lang === "ur";
    const ov = document.createElement("div");
    overlay = ov;
    ov.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;background:rgba(10,12,16,.66);display:flex;align-items:center;justify-content:center;" +
      "font:600 14px system-ui,sans-serif;color:#fff;touch-action:none;";
    const card = document.createElement("div");
    card.style.cssText = "background:#1b1e26;border:1px solid #2e333d;border-radius:12px;padding:20px 24px;display:flex;flex-direction:column;align-items:center;gap:12px;";
    if (rtl) card.dir = "rtl";
    const ttl = document.createElement("div");
    ttl.textContent = L.imgFromFile || L.imgTitle;
    ttl.style.cssText = "font-size:16px;";
    const btn = document.createElement("button");
    btn.textContent = L.imgChoose;
    btn.style.cssText = "background:#e11d1d;color:#fff;border:0;border-radius:8px;padding:9px 20px;font:700 14px system-ui,sans-serif;cursor:pointer;";
    const hint = document.createElement("div");
    hint.textContent = "Esc";
    hint.style.cssText = "font-size:11px;color:#9aa1ae;font-weight:500;";
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.style.display = "none";
    card.append(ttl, btn, hint, inp);
    ov.appendChild(card);
    btn.addEventListener("click", () => inp.click());
    inp.addEventListener("change", async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      let bmp;
      try { bmp = await createImageBitmap(f); } catch { hint.textContent = L.imgNone; return; }
      region(bmp);
    });
    const region = (bmp) => {
      ov.replaceChildren();
      ov.style.cursor = "crosshair";
      ov.style.background = "rgba(225,29,29,.06)";
      const tip = document.createElement("div");
      tip.textContent = L.imgDrag;
      if (rtl) tip.dir = "rtl";
      tip.style.cssText =
        "position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:8px 14px;border-radius:8px;font:600 13px system-ui,sans-serif;pointer-events:none;";
      const box = document.createElement("div");
      box.style.cssText = "position:fixed;border:2px dashed #ff4a4a;background:rgba(0,0,0,.2);display:none;pointer-events:none;";
      const pv = document.createElement("canvas");
      const r0 = Math.min(1, 320 / Math.max(bmp.width, bmp.height));
      pv.width = Math.max(1, Math.round(bmp.width * r0));
      pv.height = Math.max(1, Math.round(bmp.height * r0));
      pv.getContext("2d").drawImage(bmp, 0, 0, pv.width, pv.height);
      pv.style.cssText = "width:100%;height:100%;object-fit:contain;opacity:.55;display:block;";
      box.appendChild(pv);
      ov.append(tip, box);
      let s0 = null;
      const upd = (e) => {
        const x = Math.min(s0[0], e.clientX), y = Math.min(s0[1], e.clientY);
        box.style.cssText += "display:block;left:" + x + "px;top:" + y + "px;width:" + Math.abs(e.clientX - s0[0]) + "px;height:" + Math.abs(e.clientY - s0[1]) + "px;";
      };
      ov.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        try { ov.setPointerCapture(e.pointerId); } catch {}
        s0 = [e.clientX, e.clientY];
        upd(e);
      }, true);
      ov.addEventListener("pointermove", (e) => { if (s0) upd(e); }, true);
      ov.addEventListener("pointerup", (e) => {
        if (!s0) return;
        const rx = Math.min(s0[0], e.clientX), ry = Math.min(s0[1], e.clientY), rw = Math.abs(e.clientX - s0[0]), rh = Math.abs(e.clientY - s0[1]);
        s0 = null;
        if (rw < 60 || rh < 60) { box.style.display = "none"; return; }
        const ar = bmp.width / bmp.height;
        const fw = rw / rh > ar ? rh * ar : rw, fh = rw / rh > ar ? rh : rw / ar;
        const fx = rx + (rw - fw) / 2, fy = ry + (rh - fh) / 2;
        tip.textContent = L.imgWorking;
        setTimeout(() => {
          let sk;
          if (parts) {
            sk = [];
            const kx = fw / bmp.width, ky = fh / bmp.height;
            for (const q of parts) {
              const ox = q.x * kx, oy = q.y * ky;
              for (const s of imageToStrokes(q.bmp, Math.max(8, Math.round(q.w * kx)), Math.max(8, Math.round(q.h * ky)))) sk.push(s.map((pt) => [pt[0] + ox, pt[1] + oy]));
            }
          } else sk = imageToStrokes(bmp, Math.round(fw), Math.round(fh));
          if (!sk.length) { tip.textContent = L.imgNone; setTimeout(cancelPick, 1800); return; }
          const strokes = sk.map((s) => ({ pts: s.map((q, i) => [i * 7, Math.round(fx + q[0] + window.scrollX), Math.round(fy + q[1] + window.scrollY)]) }));
          pattern = { strokes, dx: 0, dy: 0 };
          chrome.storage.local.set({ [PKEY]: pattern });
          cancelPick();
          hiddenClick(rx + rw / 2, ry + rh / 2);
          showPlayback(strokesOf(pattern), 2, 0, 0);
          setTimeout(() => hidePlayback(true), 2200);
          chrome.runtime.sendMessage({ type: "reopen" });
        }, 30);
      }, true);
    };
    if (pre) region(pre);
    document.documentElement.appendChild(ov);
  }

  // the speed can change while it draws: time runs on a virtual clock that advances at the current speed
  const SPD = { slow: 0.25, normal: 0.5, fast: 2 };
  let patK = 0.5, patVt = 0, patList = null, patDx = 0, patDy = 0;

  async function vsleep(vms, id, base) {
    let v = 0;
    let last = performance.now();
    while (v < vms && id === runId) {
      await sleepMs(8);
      const now = performance.now();
      v += (now - last) * patK;
      last = now;
      patVt = base + Math.min(v, vms);
    }
  }

  async function playPattern(pts, id, dx = 0, dy = 0, base = 0) {
    const first = locate({ x: pts[0][1] + dx, y: pts[0][2] + dy });
    tap(first.x, first.y, ["pointerdown", "mousedown"]);
    let v = 0;
    let last = performance.now();
    let i = 1;
    let lx = first.x;
    let ly = first.y;
    while (i < pts.length && id === runId) {
      const now = performance.now();
      v += (now - last) * patK;
      last = now;
      patVt = base + v;
      if (pts[i][0] > v) {
        await sleepMs(Math.min((pts[i][0] - v) / patK, 8));
        continue;
      }
      lx = pts[i][1] + dx - window.scrollX;
      ly = pts[i][2] + dy - window.scrollY;
      tap(lx, ly, ["pointermove", "mousemove"], 1, true);
      i++;
    }
    tap(lx, ly, ["pointerup", "mouseup"]);
  }

  async function startPattern() {
    stop();
    await ready;
    if (!pattern || !(pattern.strokes ? pattern.strokes.length : pattern.pts && pattern.pts.length > 1)) return false;
    const { pspeed = "normal", pinf = false } = await chrome.storage.local.get(["pspeed", "pinf"]);
    runVals = { pspeed, pinf };
    patK = SPD[pspeed] || 0.5;
    running = true;
    mode = "pattern";
    setGuard(true);
    phase = null;
    const id = ++runId;
    (async () => {
      do {
        const list = strokesOf(pattern);
        const dx = pattern.dx || 0, dy = pattern.dy || 0;
        patList = list; patDx = dx; patDy = dy; patVt = 0;
        showPlayback(list, patK, dx, dy);
        for (let j = 0; j < list.length && id === runId; j++) {
          await playPattern(list[j].pts, id, dx, dy, list[j].off);
          if (list.length > 1) await vsleep(60, id, patVt);
        }
        if (id !== runId) return;
        await sleepMs(150);
      } while (pinf && id === runId);
      if (id === runId) stop();
    })();
    return true;
  }

  const SPEEDS = { slow: 20, normal: 200, fast: 800 };
  const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

  let scrollAcc = 0;

  function scrollTarget(dy) {
    let el = hitAt(document, Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2));
    while (el && el !== document.body && el !== document.documentElement) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) {
        const atTop = el.scrollTop <= 0;
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
        if ((dy < 0 && !atTop) || (dy > 0 && !atBottom)) return el;
      }
      el = upFrom(el);
    }
    return window;
  }

  async function wheel(dy) {
    scrollAcc += dy;
    const n = Math.trunc(scrollAcc);
    if (!n) return;
    scrollAcc -= n;
    scrollTarget(n).scrollBy(0, n);
  }

  async function startScroll() {
    stop();
    const { up5: upS = 3, down5: downS = 3, upInf = false, downInf = false, sloop = false, sspeed2 = "normal" } = await chrome.storage.local.get(["up5", "down5", "upInf", "downInf", "sloop", "sspeed2"]);
    runVals = { up5: upS, down5: downS, upInf, downInf, sloop, sspeed2 };
    const speed = SPEEDS[sspeed2] || SPEEDS.normal;
    const phases = [
      { dir: -1, ms: upInf ? Infinity : Number(upS) * 1000 },
      { dir: 1, ms: downInf ? Infinity : Number(downS) * 1000 },
    ].filter((p) => p.ms > 0);
    if (!phases.length) return false;
    running = true;
    mode = "scroll";
    scrollAcc = 0;
    const id = ++runId;
    (async () => {
      do {
        for (const ph of phases) {
          let last = performance.now();
          const end = last + ph.ms;
          while (id === runId && last < end) {
            await sleepMs(16);
            const now = Math.min(performance.now(), end);
            const dy = (ph.dir * speed * (now - last)) / 1000;
            last = now;
            if (id === runId && dy) await wheel(dy);
          }
          if (id !== runId) return;
        }
      } while (sloop && id === runId);
      if (id === runId) stop();
    })();
    return true;
  }

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape") return;
      if (overlay) cancelPick();
      else if (running) stop();
    },
    true
  );

  chrome.runtime.onMessage.addListener((m, _sender, send) => {
    if (m.type === "tc-guard-release") {
      if (mode === "pattern") stop();
      return;
    }
    if (m.type === "getState") {
      ready.then(() => send({ points, kpoints, rapid, pattern: pattern ? patternStats(pattern) : null, patFrame: patternInFrame(), running, mode, reps, repsMode, runVals: running ? runVals : null, phase: running ? phase : null }));
      return true;
    } else if (m.type === "pickImage") {
      traceCap = 680;
      pickImage();
    } else if (m.type === "drawIcon") {
      traceCap = m.cap || 680;
      if (m.parts) {
        // a scene: several pictures placed together, each traced on its own
        Promise.all(m.parts.map((q) => createImageBitmap(new ImageData(Uint8ClampedArray.from(q.data), q.w, q.h)))).then((bs) => {
          const cv = document.createElement("canvas");
          cv.width = m.w;
          cv.height = m.h;
          const cx = cv.getContext("2d");
          bs.forEach((b, i) => cx.drawImage(b, m.parts[i].x, m.parts[i].y));
          return createImageBitmap(cv).then((all) => pickImage(all, m.parts.map((q, i) => ({ x: q.x, y: q.y, w: q.w, h: q.h, bmp: bs[i] }))));
        }, () => {});
      } else createImageBitmap(new ImageData(Uint8ClampedArray.from(m.data), m.w, m.h)).then((b) => pickImage(b), () => {});
      send({});
    } else if (m.type === "pick") {
      pick(m.slot, m.kb, m.kind);
      send({});
    } else if (m.type === "setmode") {
      const p = points[m.slot];
      if (p) {
        delete p.t;
        if (m.kind === "el" || m.kind === "tx") {
          const vx = p.x - window.scrollX;
          const vy = p.y - window.scrollY;
          if (vx >= 0 && vy >= 0 && vx <= window.innerWidth && vy <= window.innerHeight) {
            const t = describe(hitAt(document, vx, vy), m.kind, vx, vy);
            if (t) p.t = t;
          }
        }
        save();
      }
      send({ points, kpoints, rapid, running, mode });
    } else if (m.type === "clear") {
      if (m.slot === "rapid") rapid = null;
      else if (m.kb) kpoints[m.slot] = null;
      else points[m.slot] = null;
      save();
      render();
      send({ points, kpoints, rapid, running, mode });
    } else if (m.type === "remove") {
      points.splice(m.slot, 1);
      points.push(null);
      save();
      render();
      send({ points, kpoints, rapid, running, mode });
    } else if (m.type === "clearAll") {
      points = Array(SLOTS).fill(null);
      save();
      render();
      send({ points, kpoints, rapid, running, mode });
    } else if (m.type === "live") {
      applyLive(m);
      send({ running, mode });
      return true;
    } else if (m.type === "start") {
      ready.then(() => start(m.from)).then((ok) => send({ running: ok, mode }));
      return true;
    } else if (m.type === "record") {
      recordPattern();
      send({});
    } else if (m.type === "startPattern") {
      startPattern().then((ok) => send({ running: !!ok }));
      return true;
    } else if (m.type === "startKb") {
      startKb().then((ok) => send({ running: ok, mode }));
      return true;
    } else if (m.type === "clearAllK") {
      kpoints = Array(SLOTS).fill(null);
      save();
      render();
      send({ points, kpoints, rapid, running, mode });
    } else if (m.type === "startRapid") {
      startRapid().then((ok) => send({ running: ok, mode }));
      return true;
    } else if (m.type === "startScroll") {
      startScroll().then((ok) => send({ running: ok, mode }));
      return true;
    } else if (m.type === "stop") {
      stop();
      send({ running: false });
    }
  });

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === "local" && ch.pspeed && running && mode === "pattern" && patList) {
      const nk = SPD[ch.pspeed.newValue] || 0.5;
      if (nk !== patK) {
        patK = nk;
        showPlayback(patList, patK, patDx, patDy, patVt);
        if (runVals) runVals.pspeed = ch.pspeed.newValue;
      }
    }
    if (area === "local" && ch.keys) {
      keys = Array.isArray(ch.keys.newValue) ? ch.keys.newValue : [];
      render();
    }
  });

  const ready = chrome.storage.local.get([KEY, RKEY, KKEY, PKEY, "keys"]).then((r) => {
    keys = Array.isArray(r.keys) ? r.keys : [];
    kpoints = Array.from({ length: SLOTS }, (_, i) => (r[KKEY] && r[KKEY][i]) || null);
    points = Array.from({ length: SLOTS }, (_, i) => (r[KEY] && r[KEY][i]) || null);
    rapid = r[RKEY] || null;
    pattern = r[PKEY] && (Array.isArray(r[PKEY].pts) || Array.isArray(r[PKEY].strokes)) ? r[PKEY] : null;
    render();
  });
})();
