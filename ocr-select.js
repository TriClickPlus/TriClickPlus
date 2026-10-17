/*
 * TriClick (c) 2026 TriClick. MIT License, see LICENSE.
 * File: ocr-select.js
 * Region picker for "read text from screen". Injected on demand into the active tab.
 */
(() => {
  if (window.__tcOcrSel) return;
  window.__tcOcrSel = true;
  const cfg = window.__tcOcrCfg || {};
  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;";
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML =
    "<style>" +
    ".l{position:fixed;inset:0;cursor:crosshair;background:rgba(8,12,24,.5);touch-action:none;user-select:none}" +
    ".b{position:fixed;display:none;border:2px solid #ff2d2d;border-radius:3px;box-shadow:0 0 0 100vmax rgba(8,12,24,.55);box-sizing:border-box;pointer-events:none}" +
    ".t{position:fixed;display:none;background:#ff2d2d;color:#fff;font:700 12px/1 Inter,system-ui,sans-serif;padding:6px 10px;border-radius:7px 7px 7px 0;white-space:nowrap;pointer-events:none}" +
    ".c{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#121c3a;color:#eef2fb;font:600 12px/1 Inter,system-ui,sans-serif;padding:9px 15px;border-radius:999px;white-space:nowrap;pointer-events:none}" +
    "</style><div class=l></div><div class=b></div><div class=t></div><div class=c></div>";
  const layer = root.querySelector(".l");
  const box = root.querySelector(".b");
  const tag = root.querySelector(".t");
  root.querySelector(".c").textContent = cfg.cancel || "Esc";
  tag.textContent = cfg.label || "";
  tag.dir = "auto";
  document.documentElement.appendChild(host);

  let x0 = 0, y0 = 0, drag = false;
  const rect = (x, y) => ({ x: Math.min(x0, x), y: Math.min(y0, y), w: Math.abs(x - x0), h: Math.abs(y - y0) });
  const draw = (r) => {
    box.style.cssText = `display:block;left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
    layer.style.background = "transparent";
    tag.style.display = "block";
    tag.style.left = r.x + "px";
    tag.style.top = Math.max(0, r.y - 26) + "px";
  };
  const done = () => {
    window.removeEventListener("keydown", onKey, true);
    host.remove();
    window.__tcOcrSel = false;
  };
  const onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      done();
    }
  };
  window.addEventListener("keydown", onKey, true);
  layer.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
  layer.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    done();
  });
  layer.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    drag = true;
    x0 = e.clientX;
    y0 = e.clientY;
    layer.setPointerCapture(e.pointerId);
    draw({ x: x0, y: y0, w: 0, h: 0 });
  });
  layer.addEventListener("pointermove", (e) => {
    if (drag) draw(rect(e.clientX, e.clientY));
  });
  layer.addEventListener("pointerup", (e) => {
    if (!drag) return;
    drag = false;
    const r = rect(e.clientX, e.clientY);
    if (r.w < 6 || r.h < 6) {
      box.style.display = "none";
      tag.style.display = "none";
      layer.style.background = "rgba(8,12,24,.5)";
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    done();
    // let the page repaint without the overlay before the background takes the screenshot
    requestAnimationFrame(() => requestAnimationFrame(() => chrome.runtime.sendMessage({ type: "ocr-rect", rect: r, vw, vh })));
  });
})();
