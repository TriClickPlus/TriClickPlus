/*
 * TriClick (c) 2026 TriClick. MIT License, see LICENSE.
 * File: frame.js
 * Contact: chromedeveloper1@gmail.com
 * Build ID: 98c76752-c731-4cf8-b7a4-b81f0646db2e
 */
(() => {
  if (window === window.top || window.__tcFrame) return;
  window.__tcFrame = true;

  const isFrame = (el) => !!el && /^(IFRAME|FRAME)$/.test(el.tagName);

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

  function shadowOf(el) {
    try {
      return (chrome.dom && chrome.dom.openOrClosedShadowRoot && chrome.dom.openOrClosedShadowRoot(el)) || el.shadowRoot || null;
    } catch {
      return el && el.shadowRoot ? el.shadowRoot : null;
    }
  }

  function hitAt(x, y) {
    let el = document.elementFromPoint(x, y);
    for (let guard = 0; el && guard < 20; guard++) {
      const sr = shadowOf(el);
      const inner = sr && sr.elementFromPoint(x, y);
      if (!inner || inner === el) break;
      el = inner;
    }
    return el;
  }

  function deepActive() {
    let el = document.activeElement;
    for (let guard = 0; el && guard < 20; guard++) {
      const sr = shadowOf(el);
      if (!sr || !sr.activeElement) break;
      el = sr.activeElement;
    }
    return el;
  }

  function closestDeep(el, sel) {
    for (let guard = 0; el && guard < 200; guard++) {
      if (el.matches && el.matches(sel)) return el;
      const root = el.parentElement ? null : el.getRootNode && el.getRootNode();
      el = el.parentElement || (root && root.host) || null;
    }
    return null;
  }

  let textId = 0;
  let picked = false;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const editable = (el) => {
    if (!el) return false;
    if (el.isContentEditable) return true;
    if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
    if (el instanceof HTMLInputElement) {
      return !el.readOnly && !el.disabled && /^(text|search|url|tel|email|password|number)$/.test(el.type);
    }
    return false;
  };

  async function typeIn(m) {
    const my = ++textId;
    if (!m.normal && editable(deepActive())) {
      insertInto(deepActive(), m.text);
      return;
    }
    for (const ch of m.text) {
      if (my !== textId) return;
      const el = deepActive() || document.body;
      const init = { key: ch, bubbles: true, cancelable: true, composed: true, view: window };
      const down = new KeyboardEvent("keydown", init);
      el.dispatchEvent(down);
      if (m.normal && !down.defaultPrevented && editable(el)) insertInto(el, ch);
      else el.dispatchEvent(new KeyboardEvent("keypress", init));
      el.dispatchEvent(new KeyboardEvent("keyup", init));
      if (m.text.length > 1) await sleep(15);
    }
  }

  // while the popup is open this frame is not focused and games stop listening; tell the page it has focus for the length of a run
  let lent = false;
  function lendFocus(on) {
    if (on === lent || (on && document.hasFocus())) return;
    lent = on;
    window.dispatchEvent(new Event(on ? "tc-focus-on" : "tc-focus-off"));
    if (!on) return;
    try {
      const a = deepActive();
      window.dispatchEvent(new FocusEvent("focus"));
      if (a && a !== document.body && a !== document.documentElement && !isFrame(a)) {
        a.dispatchEvent(new FocusEvent("focus", { composed: true }));
        a.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
      }
    } catch {}
  }

  // the popup can be opened again mid-run, which blurs this frame: lend focus again once the page has reacted
  let wanted = false;
  window.addEventListener(
    "blur",
    (e) => {
      if (e.target !== window || !(wanted || lent)) return;
      setTimeout(() => {
        if (!(wanted || lent)) return;
        lent = false;
        lendFocus(true);
      }, 0);
    },
    true
  );

  // same idea as the page script: typing into a field when the browser refuses execCommand
  function beforeInput(el, inputType, data) {
    if (!el) return true;
    try {
      return el.dispatchEvent(new InputEvent("beforeinput", { inputType, data: data == null ? null : data, bubbles: true, cancelable: true, composed: true }));
    } catch {
      return true;
    }
  }

  function insertInto(el, text, noGate) {
    if (!noGate && !beforeInput(el, "insertText", text)) return;
    let ok = false;
    try { ok = document.execCommand("insertText", false, text); } catch {}
    if (ok || !el) return;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      try {
        const s = el.selectionStart == null ? el.value.length : el.selectionStart;
        el.setRangeText(text, s, el.selectionEnd == null ? s : el.selectionEnd, "end");
      } catch {
        el.value += text;
      }
    } else if (el.isContentEditable) el.append(text);
    else return;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, data: text, inputType: "insertText" }));
  }

  const sizeIs = (m) => m.w != null && Math.abs(m.w - window.innerWidth) <= 2 && Math.abs(m.h - window.innerHeight) <= 2;

  // the page script asks every frame to ignore the real mouse while a drawing plays; a real press gives it back
  let guardOn = false;
  const guardEv = (e) => {
    if (!guardOn || !e.isTrusted) return;
    if (e.type === "pointerdown" || e.type === "mousedown" || e.type === "touchstart") {
      guardOn = false;
      chrome.runtime.sendMessage({ type: "tc-relay", msg: { type: "tc-guard-release" } }).catch(() => {});
      return;
    }
    e.stopImmediatePropagation();
  };
  for (const t of ["pointermove", "pointerrawupdate", "pointerover", "pointerout", "pointerenter", "pointerleave", "mousemove", "mouseover", "mouseout", "mouseenter", "mouseleave", "pointerdown", "mousedown", "touchstart"]) window.addEventListener(t, guardEv, { capture: true, passive: true });

  chrome.runtime.onMessage.addListener((m) => {
    if (m && m.type === "tc-guard") { guardOn = !!m.on; return; }
    if (m && m.type === "tc-text-stop") { textId++; return; }
    if (m && m.type === "tc-focus") { wanted = !!m.on; lendFocus(!!m.on); return; }
    if (!m || (m.type !== "tc-key" && m.type !== "tc-click" && m.type !== "tc-text")) return;
    if (m.type === "tc-click") {
      // the clicked frame is the one whose size matches; older messages without a size go to the focused frame
      picked = m.w != null ? Math.abs(m.w - window.innerWidth) <= 2 && Math.abs(m.h - window.innerHeight) <= 2 : document.hasFocus();
      if (!picked) return;
      const el = hitAt(m.x, m.y);
      if (!el) return;
      if (isFrame(el)) {
        // a frame inside this frame: pass the click on, relative to the inner frame
        const r = el.getBoundingClientRect();
        const sx = el.offsetWidth ? r.width / el.offsetWidth : 1;
        const sy = el.offsetHeight ? r.height / el.offsetHeight : 1;
        chrome.runtime
          .sendMessage({
            type: "tc-relay",
            msg: { type: "tc-click", x: (m.x - r.left) / sx - el.clientLeft, y: (m.y - r.top) / sy - el.clientTop, w: Math.round(el.clientWidth), h: Math.round(el.clientHeight), types: m.types, n: m.n, held: m.held },
          })
          .catch(() => {});
        return;
      }
      lendFocus(true);
      const types = m.types || PRESS;
      for (let k = 0; k < (m.n || 1); k++) {
        if ((k ? PRESS : types)[0] === "pointerdown") HOVER.forEach((type) => fireMouse(el, type, m.x, m.y));
        (k ? PRESS : types).forEach((type) => fireMouse(el, type, m.x, m.y, m.held));
      }
      if (types.indexOf("mousedown") !== -1) {
        let f = closestDeep(el, "input,textarea,select,[contenteditable],[tabindex],button,a[href],canvas");
        if (!f && document.body && document.body.isContentEditable) f = document.body;
        if (f && f.focus) f.focus();
        if (f && f.isContentEditable && document.caretRangeFromPoint) {
          try {
            const r = document.caretRangeFromPoint(m.x, m.y);
            const sel = window.getSelection();
            if (r && sel && f.contains(r.startContainer)) {
              sel.removeAllRanges();
              sel.addRange(r);
            }
          } catch {}
        }
      }
      return;
    }
    // keys and text go to the frame that was focused: by its size when the page says which one, else by focus
    const mine = m.w != null ? sizeIs(m) : document.hasFocus() || picked;
    if (!mine) return;
    const a = deepActive();
    if (isFrame(a)) {
      // a frame inside this frame holds the focus: pass the keys on to it
      chrome.runtime.sendMessage({ type: "tc-relay", msg: { ...m, w: Math.round(a.clientWidth), h: Math.round(a.clientHeight) } }).catch(() => {});
      return;
    }
    lendFocus(true);
    if (m.type === "tc-text") { typeIn(m); return; }
    if (m.type === "tc-key") {
      const init = { ...m.init, view: window };
      const ev = new KeyboardEvent(m.ev, init);
      for (const k of ["keyCode", "which", "charCode"]) {
        if (init[k] != null && ev[k] !== init[k]) {
          try { Object.defineProperty(ev, k, { get: () => init[k] }); } catch {}
        }
      }
      // nothing focused: games listen on their canvas or player, so use the biggest one on screen
      let tgt = a && a !== document.body && a !== document.documentElement ? a : null;
      if (!tgt) {
        let area = 0;
        for (const el of document.querySelectorAll("canvas, ruffle-player, ruffle-embed, embed, object")) {
          const r = el.getBoundingClientRect();
          const ar = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
          if (ar > area) { area = ar; tgt = el; }
        }
        if (area < 0.2 * innerWidth * innerHeight) tgt = null;
      }
      (tgt || a || document.body).dispatchEvent(ev);
      // typing a key into a field inside this frame
      if (m.ev === "keydown" && !m.init.repeat && !ev.defaultPrevented && editable(a)) {
        const k = m.init.key;
        if (k && k.length === 1) insertInto(a, k);
        else if (k === "Backspace") {
          if (beforeInput(a, "deleteContentBackward", null)) {
            let ok = false;
            try { ok = document.execCommand("delete"); } catch {}
            if (!ok && (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement)) {
              try {
                const s = a.selectionStart, e2 = a.selectionEnd;
                if (s === e2 && s > 0) a.setRangeText("", s - 1, e2, "end");
                else if (s !== e2) a.setRangeText("", s, e2, "end");
                a.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "deleteContentBackward" }));
              } catch {}
            }
          }
        } else if (k === "Enter") {
          if (a instanceof HTMLInputElement) {
            if (a.form && a.form.requestSubmit) { try { a.form.requestSubmit(); } catch {} }
          } else if (beforeInput(a, a.isContentEditable ? "insertParagraph" : "insertLineBreak", null)) insertInto(a, "\n", true);
        }
      }
    }
  });
})();
