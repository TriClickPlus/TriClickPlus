/*
 * TriClick (c) 2026 TriClick. MIT License, see LICENSE.
 * File: col-pick.js
 * Point picker for the Sketch tab's color picker. Injected on demand into the active tab.
 */
(() => {
  if (window.__tcColSel) return;
  window.__tcColSel = true;
  const cfg = window.__tcOcrCfg || {};
  // magnifier: N x N screenshot pixels around the mouse, each drawn CELL px wide
  const N = 11, CELL = 8, D = N * CELL;
  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;";
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML =
    "<style>" +
    ".l{position:fixed;inset:0;cursor:crosshair;touch-action:none;user-select:none}" +
    ".c{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#121c3a;color:#eef2fb;font:600 12px/1 Inter,system-ui,sans-serif;padding:9px 15px;border-radius:999px;white-space:nowrap;pointer-events:none}" +
    ".l.mg{cursor:none}" +
    ".m{position:fixed;left:0;top:0;width:" + D + "px;height:" + D + "px;margin:-" + D / 2 + "px 0 0 -" + D / 2 + "px;display:none;pointer-events:none;border-radius:50%;box-sizing:border-box;border:4px solid #000;box-shadow:0 0 0 1.5px #fff,0 0 0 3px rgba(0,0,0,.35),0 8px 24px rgba(0,0,0,.45);overflow:hidden}" +
    ".m canvas{display:block;width:100%;height:100%;image-rendering:pixelated}" +
    ".m i{position:absolute;left:50%;top:50%;width:" + CELL + "px;height:" + CELL + "px;margin:-" + CELL / 2 + "px 0 0 -" + CELL / 2 + "px;box-sizing:border-box;border:1.5px solid #fff;box-shadow:0 0 0 1px #000}" +
    ".h{position:fixed;left:0;top:0;display:none;transform:translate(-50%," + (D / 2 + 8) + "px);background:#121c3a;color:#eef2fb;font:600 11px/1 ui-monospace,Menlo,Consolas,monospace;padding:5px 8px;border-radius:7px;white-space:nowrap;pointer-events:none}" +
    "</style><div class=l></div><div class=m><canvas></canvas><i></i></div><div class=h></div><div class=c></div>";
  const layer = root.querySelector(".l");
  const mag = root.querySelector(".m");
  const hexTag = root.querySelector(".h");
  const view = mag.querySelector("canvas");
  let src = null; // the screenshot, drawn at its own size
  let kx = 1, ky = 1; // screenshot pixels per CSS pixel
  let px = null; // [r, g, b] under the mouse
  let last = null;
  root.querySelector(".c").textContent = (cfg.label ? cfg.label + " · " : "") + (cfg.cancel || "Esc");
  document.documentElement.appendChild(host);

  const paint = (x, y) => {
    if (!src) return;
    const cx = Math.max(0, Math.min(src.width - 1, Math.floor(x * kx)));
    const cy = Math.max(0, Math.min(src.height - 1, Math.floor(y * ky)));
    const g = view.getContext("2d");
    g.fillStyle = "#808080";
    g.fillRect(0, 0, N, N);
    g.drawImage(src, cx - (N >> 1), cy - (N >> 1), N, N, 0, 0, N, N);
    const d = src.getContext("2d").getImageData(cx, cy, 1, 1).data;
    px = [d[0], d[1], d[2]];
    const hex = "#" + px.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
    mag.style.borderColor = hex;
    mag.style.left = hexTag.style.left = x + "px";
    mag.style.top = hexTag.style.top = y + "px";
    mag.style.display = hexTag.style.display = "block";
    hexTag.textContent = hex;
  };
  if (cfg.shot) {
    const img = new Image();
    img.onload = () => {
      if (!host.isConnected) return;
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d", { willReadFrequently: true }).drawImage(img, 0, 0);
      src = c;
      kx = c.width / window.innerWidth;
      ky = c.height / window.innerHeight;
      view.width = view.height = N;
      layer.classList.add("mg");
      if (last) paint(last[0], last[1]);
    };
    img.src = cfg.shot;
  }
  cfg.shot = "";
  layer.addEventListener("pointermove", (e) => {
    last = [e.clientX, e.clientY];
    paint(e.clientX, e.clientY);
  });
  layer.addEventListener("pointerleave", () => {
    mag.style.display = hexTag.style.display = "none";
  });

  const done = () => {
    window.removeEventListener("keydown", onKey, true);
    host.remove();
    window.__tcColSel = false;
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
  layer.addEventListener("pointerup", (e) => {
    if (e.button !== 0) return;
    const x = e.clientX, y = e.clientY, vw = window.innerWidth;
    if (src) paint(x, y);
    const pick = src ? px : null;
    done();
    // let the page repaint without the overlay before the background takes the screenshot (used when there is no magnifier)
    requestAnimationFrame(() => requestAnimationFrame(() => chrome.runtime.sendMessage({ type: "col-pt", x, y, vw, px: pick })));
  });
})();
