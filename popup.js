/*
 * TriClick (c) 2026 TriClick. MIT License, see LICENSE.
 * File: popup.js
 * Contact: chromedeveloper1@gmail.com
 * Build ID: 98c76752-c731-4cf8-b7a4-b81f0646db2e
 */
const $ = (s) => document.querySelector(s);
const DEFAULT_DELAYS = Array(10).fill(3);
const MAX_ROWS = 10;
const DEFAULT_ROWS = 3;
const DEFAULT_RATE = 5;
const DEFAULT_SCROLL = 3;
const MAX_RATE = 1000;
const MAX_NAME = 40;
const DEFAULT_HOLD = 0;
const SK = { upS: "up5", downS: "down5" };
const IK = { upS: "upInf", downS: "downInf" };
const PAGES = ["seq", "rapid", "pattern", "scroll", "ocr"];

let tabId = null;
let state = { points: [], rapid: null, running: false, mode: "seq" };
let delays = [...DEFAULT_DELAYS];
let names = Array(MAX_ROWS).fill(null);
let holds = Array(MAX_ROWS).fill(DEFAULT_HOLD);
let holdOn = false;
let advOn = false;
let cmodes = Array(MAX_ROWS).fill("pt");
let sideOpen = false;
let kbOpen = false;
let kbSel = 0;
let keyBinds = Array(MAX_ROWS).fill(null);
let kRows = DEFAULT_ROWS;
let kHolds = Array(MAX_ROWS).fill(DEFAULT_HOLD);
let kPoints = [];
let kNames = Array(MAX_ROWS).fill(null);
let kLive = {};
let kEnts = [];
const MAX_TEXT = 1000;
let txtOpen = false;
let kType = "instant";
let speedKey = "normal";
let pSpeedKey = "normal";
let pInf = false;
let rows = DEFAULT_ROWS;
let scrollVals = { upS: DEFAULT_SCROLL, downS: DEFAULT_SCROLL };
let scrollInf = { upS: false, downS: false };
const showScroll = (k) => {
  $("#" + k).value = scrollVals[k];
};
let changed = { seq: false, rapid: false, scroll: false, pattern: false, kseq: false };
let lang = "en";

const send = (msg) => chrome.tabs.sendMessage(tabId, msg);
const live = (m) => !!state.running && state.mode === m;
const fmt = (v) => String(v);
const fmtU = (v, u) => (u === "m" ? String(+(v / 60).toFixed(2)) : String(v));
const parseU = (str, u) => {
  const v = parseFloat(str);
  return u === "m" ? Math.round(v * 60 * 1000) / 1000 : v;
};
const unitLbl = (u) => (u === "m" ? "m" : t("sec"));
let dUnits = [];
let hUnits = [];
let kUnits = [];
let kDUnits = [];
const DEFAULT_KDELAY = 3;
let kDelays = Array(MAX_ROWS).fill(DEFAULT_KDELAY);
function bindUnit(span, units, i, input, getV, key, stepS = "0.1") {
  span.textContent = unitLbl(units[i]);
  input.step = units[i] === "m" ? "0.01" : stepS;
  span.title = units[i] === "m" ? "m / s" : "s / m";
  const flip = () => {
    units[i] = units[i] === "m" ? "s" : "m";
    span.textContent = unitLbl(units[i]);
    input.step = units[i] === "m" ? "0.01" : stepS;
    input.value = fmtU(getV(), units[i]);
    fit(input);
    chrome.storage.local.set({ [key]: units });
  };
  span.addEventListener("click", flip);
  span.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      flip();
    }
  });
}
const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.en[k];

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("tc_theme", theme);
  } catch {}
  const tb = $("#theme");
  if (!tb.firstChild) tb.innerHTML = themeSvg();
  tb.classList.toggle("is-dark", theme === "dark");
  tb.classList.toggle("is-light", theme !== "dark");
  const nextName = theme === "dark" ? t("light") : t("dark");
  tb.title = nextName;
  tb.setAttribute("aria-label", nextName);
}

// Theme button: a sun behind a cloud in light mode, a dark raining cloud in dark mode.
function themeSvg() {
  let rays = "";
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const c = Math.cos(a), s = Math.sin(a);
    rays += '<line class="ray" x1="' + (9 + 6.8 * c).toFixed(2) + '" y1="' + (9 + 6.8 * s).toFixed(2) + '" x2="' + (9 + 9.2 * c).toFixed(2) + '" y2="' + (9 + 9.2 * s).toFixed(2) + '"/>';
  }
  return (
    '<svg viewBox="0 0 24 27" aria-hidden="true"><g class="sun">' + rays + '<circle cx="9" cy="9" r="4"/></g>' +
    '<g class="cloud"><g transform="translate(.5 10) scale(1.4)"><g class="o"><circle cx="4.9" cy="5.8" r="2.1"/><circle cx="7.8" cy="4.2" r="2.8"/><circle cx="11" cy="4.4" r="2.6"/><circle cx="13" cy="6" r="1.8"/><rect x="4.9" y="5.6" width="8.2" height="2.4"/></g><g class="f"><circle cx="4.9" cy="5.8" r="2.1"/><circle cx="7.8" cy="4.2" r="2.8"/><circle cx="11" cy="4.4" r="2.6"/><circle cx="13" cy="6" r="1.8"/><rect x="4.9" y="5.6" width="8.2" height="2.4"/></g></g></g>' +
    '<g class="rain"><line x1="8" y1="22.5" x2="8" y2="24"/><line x1="12.5" y1="22.5" x2="12.5" y2="24"/><line x1="17" y1="22.5" x2="17" y2="24"/><line x1="10.2" y1="22.5" x2="10.2" y2="24"/></g></svg>'
  );
}

function applyLang(l) {
  lang = I18N[l] ? l : "en";
  const root = document.documentElement;
  root.lang = lang === "in" ? "hi" : lang === "zh" ? "zh-CN" : lang;
  root.dir = lang === "ar" || lang === "ur" ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  const pb = $("#permask .pmb");
  if (pb) pb.innerHTML = pb.innerHTML.replace(/TriClick/g, '<span class="rl">T</span>ri<span class="rl">C</span>lick');
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    const s = t(el.dataset.i18nPh);
    el.placeholder = s;
    el.setAttribute("aria-label", s);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const s = t(el.dataset.i18nTitle);
    el.title = s;
    el.setAttribute("aria-label", s);
  });
  [["rate", "ariaRate"], ["upS", "ariaUp"], ["downS", "ariaDown"]].forEach(([id, k]) =>
    $("#" + id).setAttribute("aria-label", t(k))
  );
  document.querySelectorAll(".lang").forEach((b) => b.classList.toggle("on", b.dataset.lang === lang));
  $("#langbtn .lc").textContent = lang.toUpperCase();
  $("#langbtn use").setAttribute("href", "#f-" + lang);
  $("#kblangbtn .lc").textContent = lang.toUpperCase();
  $("#kblangbtn use").setAttribute("href", "#f-" + lang);
  renderOcr();
  applyPattern();
  sketchWord();
  applyTheme(root.dataset.theme || "dark");
  $("#msg").textContent = document.body.classList.contains("off") ? t("errOff") : "";
}

const tabAnim = new WeakMap();
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let curPage = null;

// Sketch tab: in English the word is handwritten and scribbles itself in when you leave the tab; other languages fade their own word in
const WORD_SVG = '<svg viewBox="0 0 46 17" aria-hidden="true"><path pathLength="1" d="M7.5 3.2C6.5 1.8 3 1.6 2.4 3.6 1.9 5.4 4.2 6 5.6 6.7 7.4 7.6 7.6 9.6 6.4 10.8 5 12.1 2.2 11.7 1.2 10.2"/><path pathLength="1" d="M10.5 1.5L10.5 12M15.2 5.6C13.6 7.4 12 8.4 10.5 9 12.4 9.6 14.2 10.8 15.8 12"/><path pathLength="1" d="M18 9.2L23.6 9.2C23.6 6.4 22 5.6 20.7 5.6 18.9 5.6 17.8 7.4 17.8 9 17.8 11 19 12.2 20.8 12.2 22 12.2 22.9 11.7 23.5 11"/><path pathLength="1" d="M28 2.6L28 10.2C28 11.6 28.8 12.2 30.2 12.1M25.6 6L30.4 6"/><path pathLength="1" d="M37 6.9C36.2 5.9 35.2 5.6 34.2 5.6 32.4 5.6 31.4 7.3 31.4 8.9 31.4 10.7 32.5 12.2 34.3 12.2 35.3 12.2 36.3 11.8 37 10.9"/><path pathLength="1" d="M39.5 1.5L39.5 12M39.5 8C40 6.4 41.2 5.6 42.6 5.6 44.2 5.6 44.6 6.8 44.6 8.2L44.6 12"/></svg>';
function sketchWord() {
  const tb = document.querySelector('.tab[data-page="pattern"]');
  if (!tb) return;
  const hand = lang === "en";
  tb.dataset.hand = hand ? "1" : "";
  tb.querySelector(".sw").innerHTML = hand ? WORD_SVG : "";
}

function stopAnim(tb) {
  const a = tabAnim.get(tb);
  if (a) {
    clearInterval(a.iv);
    clearTimeout(a.to);
    tabAnim.delete(tb);
  }
  const wasStill = tb.classList.contains("still");
  tb.classList.remove("ic", "clicking", "scrolling", "sketching", "scribble", "still");
  if (tb.dataset.hand) {
    // a tab that has not been touched yet stays static: no scribble until it is left
    tb.classList.add(wasStill ? "still" : "scribble");
    return;
  }
  const txt = tb.querySelector(".txt");
  txt.classList.remove("fade", "drop");
  tb.classList.remove("dropping");
  txt.style.width = txt.style.overflow = "";
  txt.textContent = t(txt.dataset.i18n);
  void tb.offsetWidth;
}

function wordIn(tb, drop) {
  tb.classList.remove("ic", "clicking", "scrolling", "sketching");
  if (tb.dataset.hand) {
    tb.classList.add("scribble");
    return;
  }
  const txt = tb.querySelector(".txt");
  txt.classList.add(drop ? "drop" : "fade");
  if (drop) tb.classList.add("dropping");
}

function animateTab(tb, enter, quiet) {
  tb.classList.remove("still");
  stopAnim(tb);
  const page = tb.dataset.page;
  if (enter) {
    tb.classList.add("ic");
    return;
  }
  if (reduceMotion) return;
  const rec = {};
  tabAnim.set(tb, rec);
  if (page === "rapid") {
    const txt = tb.querySelector(".txt");
    const full = t(txt.dataset.i18n);
    const chars = window.Intl && Intl.Segmenter
      ? Array.from(new Intl.Segmenter(lang === "in" ? "hi" : lang, { granularity: "grapheme" }).segment(full), (s) => s.segment)
      : Array.from(full);
    txt.style.width = txt.getBoundingClientRect().width + "px";
    txt.textContent = "";
    let n = 0;
    rec.iv = setInterval(() => {
      n++;
      txt.textContent = chars.slice(0, n).join("");
      if (n >= chars.length) {
        clearInterval(rec.iv);
        txt.style.width = "";
      }
    }, 28 + 200 / Math.max(1, chars.length));
  } else if (page === "seq") {
    tb.classList.add("ic", "clicking");
    rec.to = setTimeout(() => wordIn(tb), 900);
  } else if (page === "scroll") {
    tb.classList.add("ic", "scrolling");
    rec.to = setTimeout(() => wordIn(tb, true), 720);
  } else if (page === "ocr") {
    // leaving OCR: random letters flicker, then lock into the word one at a time, as if it is being read
    const txt = tb.querySelector(".txt");
    const full = t(txt.dataset.i18n);
    const chars = window.Intl && Intl.Segmenter
      ? Array.from(new Intl.Segmenter(lang === "in" ? "hi" : lang, { granularity: "grapheme" }).segment(full), (s) => s.segment)
      : Array.from(full);
    const G = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&@";
    const step = Math.min(130, 420 / Math.max(1, chars.length));
    txt.style.width = txt.getBoundingClientRect().width + "px";
    txt.style.overflow = "hidden";
    const t0 = performance.now();
    const tick = () => {
      const el = performance.now() - t0;
      let all = true;
      txt.textContent = chars
        .map((c, k) => {
          if (el >= 120 + k * step || !c.trim()) return c;
          all = false;
          return G[Math.floor(Math.random() * G.length)];
        })
        .join("");
      if (all) {
        clearInterval(rec.iv);
        txt.style.width = txt.style.overflow = "";
      }
    };
    tick();
    rec.iv = setInterval(tick, 45);
  } else if (page === "pattern") {
    // leaving Sketch: the word scribbles in right away
    wordIn(tb);
  }
}

function settleTabs() {
  document.querySelectorAll(".tab").forEach((tb) => {
    stopAnim(tb);
    if (tb.dataset.page === curPage) tb.classList.add("ic");
    // opening the popup never plays the Sketch animation: only clicking the tab, or clicking away from it, does
    if (tb.dataset.page === "pattern") tb.classList.add("still");
  });
}

function applyHold() {
  document.body.classList.toggle("holdon", holdOn);
  document.body.classList.toggle("wide", holdOn && curPage === "seq");
  $("#holdYes").classList.toggle("on", holdOn);
  $("#holdNo").classList.toggle("on", !holdOn);
}

function applySpeed() {
  document.querySelectorAll("#page-scroll .speedseg button").forEach((b) => b.classList.toggle("on", b.dataset.sp === speedKey));
}

// how long the saved sketch takes at each speed (the same factors the page script plays it with)
const PAT_SPEED = { slow: 0.25, normal: 0.5, fast: 2 };
let patShown = null, patTween = 0;
function applyPattern(anim) {
  document.querySelectorAll("#pseg button").forEach((b) => b.classList.toggle("on", b.dataset.sp === pSpeedKey));
  $("#pinf").setAttribute("aria-pressed", String(pInf));
  const ps = $("#pstat");
  cancelAnimationFrame(patTween);
  if (state && state.pattern) {
    const to = state.pattern.ms / 1000 / (PAT_SPEED[pSpeedKey] || 0.5);
    const paint = (v) => { ps.textContent = `${t("patternSaved")} \u00b7 ${v.toFixed(1)} ${t("sec")}`; };
    // pressing slow / normal / fast makes the time count up or down to the new value
    if (anim && patShown != null && !reduceMotion && Math.abs(patShown - to) > 0.05) {
      const from = patShown, t0 = performance.now();
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / 450);
        patShown = from + (to - from) * (1 - Math.pow(1 - k, 3));
        paint(patShown);
        if (k < 1) patTween = requestAnimationFrame(tick);
      };
      patTween = requestAnimationFrame(tick);
    } else {
      patShown = to;
      paint(to);
    }
    ps.classList.add("saved");
  } else {
    patShown = null;
    ps.textContent = t("patternHint");
    ps.classList.remove("saved");
  }
}

function kbLabel(code) {
  const b = document.querySelector(`#kb .kbd [data-c="${code}"]`);
  return b ? b.textContent : "";
}

function paintKb() {
  const bound = new Set(keyBinds.slice(0, kRows).filter(Boolean));
  const pick = keyBinds[kbSel];
  document.querySelectorAll("#kb .kbd [data-c]").forEach((b) => {
    b.classList.toggle("bound", bound.has(b.dataset.c));
    b.classList.toggle("pick", !!pick && b.dataset.c === pick);
  });
  document.querySelectorAll(".krow").forEach((r, i) => {
    r.classList.toggle("sel", i === kbSel);
    const chip = r.querySelector(".kbind");
    chip.textContent = keyBinds[i] ? kbLabel(keyBinds[i]) : t("keybind");
    chip.classList.toggle("has", !!keyBinds[i]);
  });
}

function kName(i) {
  return kLive[i] != null ? kLive[i] || `${t("click")} ${i + 1}` : kNames[i] || `${t("click")} ${i + 1}`;
}

function saveEnts() {
  chrome.storage.local.set({ ktents: kEnts });
}

function closeKdd() {
  const kt = $("#ktxt");
  if (kt) kt.style.paddingBottom = "";
  document.querySelectorAll("#ktxt .kddl").forEach((m) => (m.hidden = true));
  document.querySelectorAll("#ktxt .kdd").forEach((b) => b.setAttribute("aria-expanded", "false"));
}

function refreshKdd() {
  document.querySelectorAll("#ktxt .ktr").forEach((r, n) => {
    const e = kEnts[n];
    if (e) r.querySelector(".kdd .ddt").textContent = kName(e.i);
  });
}

function ocrGo(i) {
  if (tabId == null) return;
  const strs = {
    label: `${kName(i)} \u00b7 ${t("ocrDrag")}`,
    cancel: t("ocrCancel"),
    reading: t("ocrReading"),
    none: t("ocrNone"),
    saved: `${kName(i)}:`,
    fail: t("ocrFail"),
  };
  chrome.runtime.sendMessage({ type: "ocr-start", tabId, idx: i, lang, strs }).finally(() => window.close());
}

function buildKText() {
  const box = $("#ktxt");
  if (!box) return;
  const af = document.activeElement;
  if (af && af.tagName === "TEXTAREA" && box.contains(af) && box.querySelectorAll(".ktr").length === kEnts.length) return;
  box.textContent = "";
  kEnts = kEnts.filter((e) => e.i < kRows).slice(0, kRows);
  const head = document.createElement("div");
  head.className = "tseg seg";
  head.setAttribute("role", "group");
  head.setAttribute("aria-label", t("typeMode"));
  head.innerHTML = `<button type="button" data-ty="instant">${t("typeInstant")}</button><button type="button" data-ty="normal">${t("typeNormal")}</button>`;
  head.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("on", b.dataset.ty === kType);
    b.addEventListener("click", () => {
      kType = b.dataset.ty;
      chrome.storage.local.set({ ktype: kType });
      head.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.ty === kType));
    });
  });
  const bar = document.createElement("div");
  bar.className = "ocrbar";
  const dd = document.createElement("button");
  dd.type = "button";
  dd.className = "kdd ocrbtn";
  dd.id = "ocrbtn";
  dd.setAttribute("aria-haspopup", kRows > 1 ? "listbox" : "false");
  dd.setAttribute("aria-expanded", "false");
  dd.innerHTML = '<svg class="sc" viewBox="0 0 18 15" width="18" height="15" aria-hidden="true"><path d="M0.6 5.2V2.4a1.8 1.8 0 0 1 1.8 -1.8H5.2 M12.8 0.6H15.6a1.8 1.8 0 0 1 1.8 1.8V5.2 M17.4 9.8V12.6a1.8 1.8 0 0 1 -1.8 1.8H12.8 M5.2 14.4H2.4a1.8 1.8 0 0 1 -1.8 -1.8V9.8" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.2 5.1h9.4 M4.2 7.5h4 M4.2 9.9h7" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
  dd.title = t("ocrCapture");
  dd.setAttribute("aria-label", t("ocrCapture"));
  const menu = document.createElement("div");
  menu.className = "kddl";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;
  dd.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (kRows <= 1) {
      ocrGo(0);
      return;
    }
    const open = menu.hidden;
    closeKdd();
    if (!open) return;
    menu.textContent = "";
    for (let j = 0; j < kRows; j++) {
      const o = document.createElement("button");
      o.type = "button";
      o.setAttribute("role", "option");
      o.textContent = kName(j);
      o.title = kName(j);
      o.addEventListener("click", (ev2) => {
        ev2.stopPropagation();
        ocrGo(j);
      });
      menu.appendChild(o);
    }
    menu.hidden = false;
    dd.setAttribute("aria-expanded", "true");
    // the list opens downwards: make room so the popup grows instead of cutting it off
    const over = menu.getBoundingClientRect().bottom - box.getBoundingClientRect().bottom;
    if (over > 0) box.style.paddingBottom = Math.ceil(over) + 8 + "px";
    menu.scrollIntoView({ block: "nearest" });
  });
  const wrap = document.createElement("div");
  wrap.className = "ocrwrap";
  wrap.append(dd, menu);
  const st = document.createElement("div");
  st.className = "stepper";
  st.innerHTML = '<button id="ktminus" type="button">&minus;</button><button id="ktplus" type="button">+</button>';
  const mn = st.querySelector("#ktminus");
  const pl = st.querySelector("#ktplus");
  mn.disabled = kEnts.length === 0;
  pl.disabled = kEnts.length >= kRows;
  mn.addEventListener("click", () => {
    kEnts.pop();
    saveEnts();
    buildKText();
    paintKb();
  });
  pl.addEventListener("click", () => {
    const used = new Set(kEnts.map((e) => e.i));
    let j = 0;
    while (used.has(j) && j < kRows) j++;
    if (j >= kRows) return;
    kEnts.push({ i: j, text: "" });
    saveEnts();
    buildKText();
  });
  bar.append(st, wrap, head);
  box.appendChild(bar);
  if (!kEnts.length) {
    const h = document.createElement("div");
    h.className = "ocrhint";
    h.textContent = t("ocrHint");
    box.appendChild(h);
  }
  kEnts.forEach((e) => {
    const r = document.createElement("div");
    r.className = "ktr";
    const top = document.createElement("div");
    top.className = "ktt";
    const rd = document.createElement("button");
    rd.type = "button";
    rd.className = "kdd";
    rd.setAttribute("aria-haspopup", kRows > 1 ? "listbox" : "false");
    rd.setAttribute("aria-expanded", "false");
    rd.innerHTML =
      '<span class="ddt"></span>' +
      (kRows > 1 ? '<svg viewBox="0 0 10 6" width="9" height="6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' : "");
    rd.querySelector(".ddt").textContent = kName(e.i);
    if (kRows <= 1) rd.classList.add("solo");
    const rm = document.createElement("div");
    rm.className = "kddl";
    rm.setAttribute("role", "listbox");
    rm.hidden = true;
    rd.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (kRows <= 1) return;
      const open = rm.hidden;
      closeKdd();
      if (!open) return;
      rm.textContent = "";
      const used = new Set(kEnts.map((x) => x.i));
      for (let j = 0; j < kRows; j++) {
        if (used.has(j) && j !== e.i) continue;
        const o = document.createElement("button");
        o.type = "button";
        o.setAttribute("role", "option");
        o.className = j === e.i ? "on" : "";
        o.textContent = kName(j);
        o.title = kName(j);
        o.addEventListener("click", (ev2) => {
          ev2.stopPropagation();
          e.i = j;
          saveEnts();
          buildKText();
          paintKb();
        });
        rm.appendChild(o);
      }
      rm.hidden = false;
      rd.setAttribute("aria-expanded", "true");
      const over = rm.getBoundingClientRect().bottom - box.getBoundingClientRect().bottom;
      if (over > 0) box.style.paddingBottom = Math.ceil(over) + 8 + "px";
      rm.scrollIntoView({ block: "nearest" });
    });
    const cnt = document.createElement("span");
    cnt.className = "cnt";
    top.append(rd, rm, cnt);
    const ta = document.createElement("textarea");
    ta.maxLength = MAX_TEXT;
    ta.dir = "auto";
    ta.rows = 2;
    ta.value = e.text || "";
    ta.placeholder = t("textPh");
    ta.setAttribute("aria-label", t("presetText"));
    const upd = () => (cnt.textContent = `${ta.value.length}/${MAX_TEXT}`);
    upd();
    ta.addEventListener("input", () => {
      if (ta.value.length > MAX_TEXT) ta.value = ta.value.slice(0, MAX_TEXT);
      e.text = ta.value;
      upd();
      saveEnts();
    });
    r.append(top, ta);
    box.appendChild(r);
  });
}

let kbHide = false;
function applyKbHide() {
  const k = document.querySelector("#kb .kbd");
  if (k) k.style.display = kbHide ? "none" : "";
  const b = $("#kbtog");
  if (!b) return;
  b.classList.toggle("hid", kbHide);
  b.setAttribute("aria-pressed", String(kbHide));
  const s = t(kbHide ? "showKb" : "hideKb");
  b.title = s;
  b.setAttribute("aria-label", s);
}
$("#kbtog").addEventListener("click", () => {
  kbHide = !kbHide;
  chrome.storage.local.set({ kbhide: kbHide });
  applyKbHide();
});

function applyKText() {
  $("#ktxt").hidden = !txtOpen;
  $("#ktxtbtn").classList.toggle("on", txtOpen);
  $("#ktxtbtn").setAttribute("aria-expanded", String(txtOpen));
}

$("#kreskeys").addEventListener("click", () => {
  keyBinds = Array(MAX_ROWS).fill(null);
  chrome.storage.local.set({ keys: keyBinds });
  paintKb();
});

$("#ktxtbtn").addEventListener("click", () => {
  txtOpen = !txtOpen;
  chrome.storage.local.set({ ktxtOpen: txtOpen });
  if (txtOpen && kEnts.length === 0) {
    kEnts.push({ i: 0, text: "" });
    saveEnts();
  }
  buildKText();
  applyKText();
});

document.addEventListener("click", closeKdd);

$("#kloop").addEventListener("change", (e) => {
  chrome.storage.local.set({ kloop: e.target.checked });
  paintReps();
});

function buildKb() {
  applyKbHide();
  if (txtOpen && kEnts.length === 0) kEnts.push({ i: 0, text: "" });
  buildKText();
  applyKText();
  const wrap = $("#kbrows");
  wrap.textContent = "";
  if (kbSel >= kRows) kbSel = 0;
  $("#kplus").disabled = kRows >= MAX_ROWS;
  $("#kminus").disabled = kRows <= 1;
  for (let i = 0; i < kRows; i++) {
    const r = document.createElement("div");
    r.className = "krow";
    r.innerHTML =
      '<span class="dot"></span>' +
      '<span class="knm nm" contenteditable="plaintext-only" spellcheck="false"></span>' +
      '<button type="button" class="kbind"></button>' +
      '<button type="button" class="kset"></button>' +
      `<input type="number" class="kdi" min="0" step="0.1" value="${fmtU(kDelays[i], kDUnits[i])}" aria-label="${t("delayFor")} ${i + 1}">` +
      '<span class="unit ut kdu" role="button" tabindex="0"></span>' +
      '<span class="hold">' +
      `<span class="hl">${t("hold")}</span>` +
      `<input type="number" min="0" step="0.1" value="${fmtU(kHolds[i], kUnits[i])}" aria-label="${t("hold")} ${i + 1}">` +
      '<span class="unit ut" role="button" tabindex="0"></span>' +
      "</span>";
    const has = !!(kPoints && kPoints[i]);
    r.querySelector(".dot").classList.toggle("on", has);
    const knm = r.querySelector(".knm");
    bindRename(knm, `${t("click")} ${i + 1}`, () => kNames[i], (v) => {
      kNames[i] = v;
      chrome.storage.local.set({ knames: kNames });
    }, (txt) => {
      if (txt === null) delete kLive[i];
      else kLive[i] = txt.replace(/\s+/g, " ").trim();
      refreshKdd();
    });
    r.querySelector(".kset").textContent = has ? t("relocate") : t("set");
    r.querySelector(".kset").addEventListener("click", async () => {
      await send({ type: "pick", slot: i, kb: true });
      window.close();
    });
    r.querySelector(".kbind").addEventListener("click", () => {
      kbSel = i;
      paintKb();
    });
    const hin = r.querySelector(".hold input");
    const sync = (v) => {
      kHolds[i] = v;
      chrome.storage.local.set({ kholds: kHolds });
    };
    const din = r.querySelector(".kdi");
    bindUnit(r.querySelector(".kdu"), kDUnits, i, din, () => kDelays[i], "kdunits");
    const dsync = (v) => {
      kDelays[i] = v;
      chrome.storage.local.set({ kdelays: kDelays });
    };
    din.addEventListener("input", () => {
      const v = parseU(din.value, kDUnits[i]);
      if (Number.isFinite(v) && v >= 0) dsync(v);
    });
    din.addEventListener("change", () => {
      const v = parseU(din.value, kDUnits[i]);
      dsync(Number.isFinite(v) && v >= 0 ? v : DEFAULT_KDELAY);
      din.value = fmtU(kDelays[i], kDUnits[i]);
      pushLive();
    });
    bindUnit(r.querySelector(".hold .unit"), kUnits, i, hin, () => kHolds[i], "kunits");
    hin.addEventListener("input", () => {
      const v = parseU(hin.value, kUnits[i]);
      if (Number.isFinite(v) && v >= 0) sync(v);
    });
    hin.addEventListener("change", () => {
      const v = parseU(hin.value, kUnits[i]);
      sync(Number.isFinite(v) && v >= 0 ? v : DEFAULT_HOLD);
      hin.value = fmtU(kHolds[i], kUnits[i]);
      pushLive();
    });
    wrap.appendChild(r);
  }
  paintKb();
  fitAll();
}

// grow a number box to fit what is typed; the name column gives way, so the rest slides left
const fitCtx = document.createElement("canvas").getContext("2d");
// width a number box needs for a given text, measured in the box's own font
function boxW(b, text) {
  const cs = getComputedStyle(b);
  fitCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const chrome = ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"].reduce((n, k) => n + (parseFloat(cs[k]) || 0), 0);
  return Math.ceil(fitCtx.measureText(text).width + chrome + 2);
}

const FIT_GROUPS = [".krow .kdi", ".krow .hold input", ".row > input[type=number]", ".row .hold input", ".srow input"];

function fit(el) {
  // every box in a column shares the widest size, so the rows stay lined up; the smallest size holds "00"
  const sel = FIT_GROUPS.find((s) => el.matches(s));
  if (!sel) {
    el.style.width = Math.min(120, Math.max(62, String(el.value).length * 7 + 14)) + "px";
    return;
  }
  const boxes = document.querySelectorAll(sel);
  let w = boxW(el, "00");
  boxes.forEach((b) => (w = Math.max(w, Math.min(120, boxW(b, String(b.value))))));
  boxes.forEach((b) => (b.style.width = w + "px"));
}

if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitAll());

function fitAll() {
  document.querySelectorAll('input[type="number"]').forEach(fit);
}

["input", "change"].forEach((ev) =>
  document.addEventListener(ev, (e) => {
    if (e.target.matches && e.target.matches('input[type="number"]')) fit(e.target);
  })
);

function applyKb() {
  // the "allow" card is decided before the keyboard is drawn, so the keyboard never flashes first
  if (kbOpen) {
    document.body.classList.add("gating");
    permGate().finally(() => document.body.classList.remove("gating"));
  }
  $("#kb").hidden = !kbOpen;
  $("#main").hidden = kbOpen;
  $("#kbbtn").setAttribute("aria-expanded", String(kbOpen));
}

document.querySelectorAll("#kb .kbd [data-c]").forEach((b) =>
  b.addEventListener("click", () => {
    const c = b.dataset.c;
    keyBinds[kbSel] = keyBinds[kbSel] === c ? null : c;
    chrome.storage.local.set({ keys: keyBinds });
    paintKb();
  })
);

document.addEventListener("keydown", (e) => {
  if (!kbOpen || e.repeat || e.ctrlKey || e.metaKey) return;
  const t = e.target;
  if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t && t.isContentEditable)) return;
  if (!document.querySelector(`#kb .kbd [data-c="${e.code}"]`)) return;
  e.preventDefault();
  keyBinds[kbSel] = e.code;
  chrome.storage.local.set({ keys: keyBinds });
  paintKb();
});

$("#kbback").addEventListener("click", () => {
  kbOpen = false;
  chrome.storage.local.set({ kbOpen: false });
  applyKb();
});

function applySide() {
  $("#side").hidden = !(sideOpen && curPage === "seq");
  $("#gear").classList.toggle("on", !$("#side").hidden);
}

function showPage(p) {
  const prev = curPage;
  curPage = p;
  document.body.dataset.pg = p;
  applyHold();
  applySide();
  document.querySelectorAll(".tab").forEach((tb) => {
    const on = tb.dataset.page === p;
    tb.classList.toggle("on", on);
    if (prev === p) return;
    if (on) animateTab(tb, true, prev === null);
    else if (tb.dataset.page === prev) animateTab(tb, false);
    else stopAnim(tb);
  });
  PAGES.forEach((x) => {
    $("#page-" + x).hidden = x !== p;
  });
  if (!document.body.classList.contains("off")) $("#msg").textContent = "";
  renderTimer();
  chrome.storage.local.set({ page: p });
}

function bindRename(nm, def, getName, setName, onChange) {
  nm.textContent = getName() || def;
  const selectAll = () => {
    const r = document.createRange();
    r.selectNodeContents(nm);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  };
  let viaMouse = false;
  nm.addEventListener("mousedown", () => {
    viaMouse = document.activeElement !== nm;
  });
  nm.addEventListener("focus", () => {
    if (!viaMouse) selectAll();
  });
  nm.addEventListener("mouseup", () => {
    if (viaMouse) {
      viaMouse = false;
      selectAll();
    }
  });
  nm.addEventListener("input", () => {
    if (nm.textContent.length > MAX_NAME) {
      nm.textContent = nm.textContent.slice(0, MAX_NAME);
      const r = document.createRange();
      r.selectNodeContents(nm);
      r.collapse(false);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    }
    if (onChange) onChange(nm.textContent);
  });
  nm.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      nm.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      nm.textContent = getName() || def;
      nm.blur();
    }
  });
  nm.addEventListener("blur", () => {
    const v = nm.textContent.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
    setName(v && v !== def ? v : null);
    nm.textContent = getName() || def;
    getSelection().removeAllRanges();
    if (onChange) onChange(null);
  });
}

function build() {
  const wrap = $("#slots");
  wrap.textContent = "";
  for (let i = 0; i < rows; i++) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML =
      '<span class="dot"></span>' +
      '<span class="nm" contenteditable="plaintext-only" spellcheck="false"></span>' +
      '<button type="button" class="set"></button>' +
      `<input type="number" min="0" step="0.1" value="${fmtU(delays[i], dUnits[i])}" aria-label="${t("delayFor")} ${i + 1}">` +
      '<span class="unit ut dut" role="button" tabindex="0"></span>' +
      '<span class="hold">' +
      `<span class="hl">${t("hold")}</span>` +
      `<input type="number" min="0" step="0.1" value="${fmtU(holds[i], hUnits[i])}" aria-label="${t("hold")} ${i + 1}">` +
      '<span class="unit ut hut" role="button" tabindex="0"></span>' +
      "</span>";

    const nm = row.querySelector(".nm");
    const def = `${t("click")} ${i + 1}`;
    bindRename(nm, def, () => names[i], (v) => {
      names[i] = v;
      chrome.storage.local.set({ names });
    });

    row.querySelector(".set").addEventListener("click", async () => {
      await send({ type: "pick", slot: i, kind: advOn ? cmodes[i] : "pt" });
      window.close();
    });

    const adv = document.createElement("div");
    adv.className = "advrow";
    adv.hidden = !advOn;
    adv.innerHTML =
      '<div class="seg">' +
      ["pt", "el", "tx"].map((k) => `<button type="button" data-k="${k}">${t(k === "pt" ? "advPoint" : k === "el" ? "advElement" : "advText")}</button>`).join("") +
      '</div><code hidden></code>';
    adv.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", async () => {
        cmodes[i] = b.dataset.k;
        chrome.storage.local.set({ cmodes });
        if (state.points && state.points[i]) {
          try {
            const r = await send({ type: "setmode", slot: i, kind: cmodes[i] });
            if (r && r.points) state.points = r.points;
          } catch {}
        }
        paintAdv();
      })
    );

    // the dot of a row that has a point: press it to run the sequence from that click, right away
    row.querySelector(".dot").addEventListener("click", async () => {
      if (!(state.points && state.points[i])) return;
      $("#msg").textContent = "";
      try {
        if (live("seq")) await send({ type: "stop" });
        await frameAccess();
        const r = await send({ type: "start", from: i });
        state.running = r.running;
        state.mode = "seq";
        changed.seq = false;
      } catch {
        state.running = false;
      }
      refresh();
    });

    const hin = row.querySelector(".hold input");
    bindUnit(row.querySelector(".hut"), hUnits, i, hin, () => holds[i], "hunits");
    hin.addEventListener("input", () => {
      const v = parseU(hin.value, hUnits[i]);
      if (Number.isFinite(v) && v >= 0) {
        holds[i] = v;
        chrome.storage.local.set({ holds3: holds });
      }
      if (live("seq")) {
        changed.seq = true;
        refresh();
      }
    });
    hin.addEventListener("change", () => {
      const v = parseU(hin.value, hUnits[i]);
      holds[i] = Number.isFinite(v) && v >= 0 ? v : DEFAULT_HOLD;
      hin.value = fmtU(holds[i], hUnits[i]);
      chrome.storage.local.set({ holds3: holds });
      pushLive();
    });

    const input = row.querySelector("input");
    bindUnit(row.querySelector(".dut"), dUnits, i, input, () => delays[i], "dunits");

    input.addEventListener("input", () => {
      const v = parseU(input.value, dUnits[i]);
      if (Number.isFinite(v) && v >= 0) {
        delays[i] = v;
        chrome.storage.local.set({ delays2: delays });
      }
      if (live("seq")) {
        changed.seq = true;
        refresh();
      }
    });

    input.addEventListener("change", () => {
      const v = parseU(input.value, dUnits[i]);
      delays[i] = Number.isFinite(v) && v >= 0 ? v : DEFAULT_DELAYS[i];
      input.value = fmtU(delays[i], dUnits[i]);
      chrome.storage.local.set({ delays2: delays });
      pushLive();
    });

    wrap.appendChild(row);
    wrap.appendChild(adv);
  }
  paintAdv();
  fitAll();
}

function applyAdv() {
  $("#advYes").classList.toggle("on", advOn);
  $("#advNo").classList.toggle("on", !advOn);
  $("#rlbox").hidden = !advOn;
  document.querySelectorAll(".advrow").forEach((a) => (a.hidden = !advOn));
}

// each row shows how its click is aimed, and what it is aimed at
function paintAdv() {
  document.querySelectorAll(".advrow").forEach((a, i) => {
    a.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.k === cmodes[i]));
    const c = a.querySelector("code");
    const p = state.points && state.points[i];
    let txt = "";
    if (p) {
      if (cmodes[i] === "pt") txt = t("advFixed");
      else if (p.t) txt = p.t.k === "tx" ? `\u201c${p.t.text}\u201d` : [p.t.tag, p.t.text].filter(Boolean).join(" \u00b7 ");
      else txt = t("advPress");
    }
    c.hidden = !txt;
    c.textContent = txt;
    c.title = txt;
  });
}

$("#advYes").addEventListener("click", () => {
  advOn = true;
  chrome.storage.local.set({ advOn });
  applyAdv();
  paintAdv();
});
$("#advNo").addEventListener("click", () => {
  advOn = false;
  chrome.storage.local.set({ advOn });
  applyAdv();
});

// a time was committed (Enter, clicking away, arrow keys) while a sequence runs: the running one takes it over right away
async function pushLive() {
  const m = state.running ? state.mode : null;
  if (m !== "seq" && m !== "kseq") return;
  try {
    await send(m === "seq" ? { type: "live", delays2: delays, holds3: holds } : { type: "live", kdelays: kDelays, kholds: kHolds });
    changed[m] = false;
  } catch {}
  refresh();
}

function setRun(runSel, resetSel, m, labelKey) {
  const on = live(m);
  const run = $(runSel);
  run.textContent = on ? t("stop") : t("start");
  run.classList.toggle("stop", on);
  $(resetSel).textContent = t(labelKey);
}

let pollIv = null;
let rafId = 0;

function rafLoop() {
  renderTimer();
  rafId = requestAnimationFrame(rafLoop);
}

let cdOn = false;

function clearTimerUI() {
  const m = $("#msg");
  if (m.classList.contains("tm")) {
    m.classList.remove("tm");
    m.textContent = "";
  }
  if (!cdOn) return;
  cdOn = false;
  document.querySelectorAll(".row").forEach((r, i) => {
    r.classList.remove("act");
    const di = r.querySelector("input");
    const hi = r.querySelector(".hold input");
    if (document.activeElement !== di) di.value = fmtU(delays[i], dUnits[i]);
    if (document.activeElement !== hi) hi.value = fmtU(holds[i], hUnits[i]);
  });
}

let kcdOn = false;

function clearKTimer() {
  if (!kcdOn) return;
  kcdOn = false;
  document.querySelectorAll(".krow").forEach((r, i) => {
    r.classList.remove("act");
    const hi = r.querySelector(".hold input");
    const di = r.querySelector(".kdi");
    if (hi && document.activeElement !== hi) hi.value = fmtU(kHolds[i], kUnits[i]);
    if (di && document.activeElement !== di) di.value = fmtU(kDelays[i], kDUnits[i]);
  });
}

function renderKTimer() {
  const ph = state.phase;
  const ok = state.running && state.mode === "kseq" && kbOpen && ph && (ph.kind === "hold" || ph.kind === "delay");
  if (!ok) return clearKTimer();
  const msLeft = Math.max(0, ph.dur - Math.max(0, Date.now() - ph.t0));
  const leftS = (Math.ceil(msLeft / 100 - 1e-6) / 10).toFixed(1);
  const leftM = String(Math.ceil(msLeft / 6000 - 1e-6) / 10);
  const isHold = ph.kind === "hold";
  kcdOn = true;
  document.querySelectorAll(".krow").forEach((r, i) => {
    r.classList.toggle("act", i === ph.n);
    const hi = r.querySelector(".hold input");
    const di = r.querySelector(".kdi");
    if (!hi || !di) return;
    let hv = fmtU(kHolds[i], kUnits[i]);
    let dv = fmtU(kDelays[i], kDUnits[i]);
    if (i === ph.n) {
      if (isHold) hv = kUnits[i] === "m" ? leftM : leftS;
      else dv = kDUnits[i] === "m" ? leftM : leftS;
    }
    if (document.activeElement !== hi && hi.value !== hv) hi.value = hv;
    if (document.activeElement !== di && di.value !== dv) di.value = dv;
  });
}

function renderTimer() {
  renderKTimer();
  const ph = state.phase;
  const kind = ph && ph.kind;
  if (state.running && state.mode === "seq" && curPage === "seq" && kind === "watch") {
    const left = Math.max(0, Math.ceil((ph.dur - Math.max(0, Date.now() - ph.t0)) / 1000));
    const m = $("#msg");
    m.classList.add("tm");
    m.textContent = `${t("rlWaiting")} \u00b7 ${left} ${t("rlSecs")}`;
    return;
  }
  const ok =
    state.running &&
    ph &&
    ((state.mode === "seq" && curPage === "seq" && (kind === "delay" || kind === "hold")) ||
      (state.mode === "rapid" && curPage === "rapid" && kind === "rapid"));
  if (!ok) return clearTimerUI();
  const el = Math.max(0, Date.now() - ph.t0);
  if (kind === "rapid") {
    const m = $("#msg");
    m.classList.add("tm");
    m.textContent = `${t("timerRun")} ${(el / 1000).toFixed(1)} ${t("sec")} \u00b7 ${Number(ph.sent || 0).toLocaleString("en-US")} ${t("timerClicks")}`;
    return;
  }
  const msLeft = Math.max(0, ph.dur - el);
  const leftS = (Math.ceil(msLeft / 100 - 1e-6) / 10).toFixed(1);
  const leftM = String(Math.ceil(msLeft / 6000 - 1e-6) / 10);
  const isHold = kind === "hold";
  cdOn = true;
  document.querySelectorAll(".row").forEach((r, i) => {
    r.classList.toggle("act", i === ph.n);
    const di = r.querySelector("input");
    const hi = r.querySelector(".hold input");
    let dv = fmtU(delays[i], dUnits[i]);
    let hv = fmtU(holds[i], hUnits[i]);
    if (i === ph.n) {
      if (isHold) {
        hv = hUnits[i] === "m" ? leftM : leftS;
      } else {
        dv = dUnits[i] === "m" ? leftM : leftS;
      }
    }
    if (document.activeElement !== di && di.value !== dv) di.value = dv;
    if (document.activeElement !== hi && hi.value !== hv) hi.value = hv;
  });
}

async function pollTick() {
  try {
    const s = await send({ type: "getState" });
    state.running = !!s.running;
    state.mode = s.mode;
    state.phase = s.phase || null;
    state.reps = s.reps;
    state.repsMode = s.repsMode;
    paintReps();
    if (!state.running) return refresh();
    renderTimer();
  } catch {
    state.running = false;
    refresh();
  }
}

function syncPoll() {
  if (state.running && (state.mode === "seq" || state.mode === "rapid" || state.mode === "kseq" || state.mode === "pattern")) {
    if (!pollIv) pollIv = setInterval(pollTick, 50);
    if (!rafId) rafId = requestAnimationFrame(rafLoop);
    renderTimer();
  } else {
    if (pollIv) clearInterval(pollIv);
    pollIv = null;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    state.phase = null;
    clearTimerUI();
    clearKTimer();
  }
}

function setKbRun() {
  const on = !!state.running && state.mode === "kseq";
  $("#krun").textContent = on ? t("stop") : t("start");
  $("#krun").classList.toggle("stop", on);
  $("#kreset").textContent = t("resetPoints");
}

// something the key sequence uses was edited while it runs
function kChanged() {
  if (state.running && state.mode === "kseq") {
    changed.kseq = true;
    setKbRun();
  }
}

document.addEventListener("input", (e) => {
  if (e.target.matches && e.target.matches("#kb .kdi, #kb .hold input")) kChanged();
});
document.addEventListener("change", (e) => {
  if (e.target.matches && e.target.matches("#kb .kdi, #kb .hold input")) kChanged();
});

function refresh() {
  $("#plus").disabled = rows >= MAX_ROWS;
  $("#minus").disabled = rows <= 1;
  document.querySelectorAll(".row").forEach((row, i) => {
    const has = !!(state.points && state.points[i]);
    row.querySelector(".dot").classList.toggle("on", has);
    row.querySelector(".set").textContent = has ? t("relocate") : t("set");
  });
  paintAdv();
  const hasR = !!state.rapid;
  $("#rdot").classList.toggle("on", hasR);
  $("#rset").textContent = hasR ? t("relocate") : t("set");
  setRun("#run", "#reset", "seq", "resetPoints");
  setRun("#run2", "#reset2", "rapid", "resetPoint");
  setRun("#run3", "#reset3", "scroll", "resetTimes");
  $("#run4").textContent = live("pattern") ? t("stop") : t("start");
  $("#run4").classList.toggle("stop", live("pattern"));
  applyPattern();
  setKbRun();
  paintReps();
  syncPoll();
}

function wireRun(runSel, resetSel, m, startType, emptyKey, clearAll) {
  $(runSel).addEventListener("click", async () => {
    $("#msg").textContent = "";
    if (live(m)) {
      await send({ type: "stop" });
      state.running = false;
    } else {
      if (m === "seq" || m === "rapid") await frameAccess();
      const r = await send({ type: startType });
      state.running = r.running;
      state.mode = m;
      changed[m] = false;
      if (!r.running) $("#msg").textContent = t(emptyKey);
    }
    refresh();
  });

  $(resetSel).addEventListener("click", async () => {
    $("#msg").textContent = "";
    const was = live(m);
    if (was) {
      await send({ type: "stop" });
      state.running = false;
    }
    await clearAll();
    changed[m] = false;
    refresh();
  });

}

const otherKey = (k) => (k === "upS" ? "downS" : "upS");
let savedVal = {};

function applyInf(key) {
  const on = scrollInf[key];
  $("#" + key).closest(".srow").classList.toggle("is-inf", on);
  $("#" + (key === "upS" ? "upI" : "downI")).setAttribute("aria-pressed", String(on));
  // the opposite row fades and locks while this one is infinite
  const o = otherKey(key);
  $("#" + o).closest(".srow").classList.toggle("is-faded", on);
  $("#" + o).readOnly = on;
}

function wireInfBtn(key, btnId) {
  $(btnId).addEventListener("click", () => {
    const o = otherKey(key);
    if (!scrollInf[key]) {
      scrollInf[key] = true;
      scrollInf[o] = false;
      savedVal[o] = scrollVals[o];
      scrollVals[o] = 0;
      showScroll(o);
      const set = { [IK[key]]: true, [IK[o]]: false, [SK[o]]: 0 };
      if (Number.isFinite(savedVal[key])) {
        scrollVals[key] = savedVal[key];
        showScroll(key);
        set[SK[key]] = savedVal[key];
        delete savedVal[key];
      }
      chrome.storage.local.set(set);
    } else {
      scrollInf[key] = false;
      const v = Number.isFinite(savedVal[o]) ? savedVal[o] : DEFAULT_SCROLL;
      delete savedVal[o];
      scrollVals[o] = v;
      showScroll(o);
      chrome.storage.local.set({ [IK[key]]: false, [SK[o]]: v });
    }
    applyInf(key);
    applyInf(o);
  });
}

function wireScrollInput(key) {
  const el = $("#" + key);
  el.addEventListener("input", () => {
    const v = parseFloat(el.value);
    if (Number.isFinite(v) && v >= 0) {
      scrollVals[key] = Math.round(v);
      chrome.storage.local.set({ [SK[key]]: scrollVals[key] });
    }
  });
  el.addEventListener("change", () => {
    const v = parseFloat(el.value);
    scrollVals[key] = Number.isFinite(v) && v >= 0 ? Math.round(v) : DEFAULT_SCROLL;
    showScroll(key);
    chrome.storage.local.set({ [SK[key]]: scrollVals[key] });
  });
}

function commitRate() {
  let v = parseFloat($("#rate").value);
  if (!Number.isFinite(v)) v = DEFAULT_RATE;
  v = Math.min(MAX_RATE, Math.max(1, v));
  const was = $("#rate").value;
  $("#rate").value = v;
  chrome.storage.local.set({ cps: v });
  return String(v) !== was;
}

function onRateChange() {
  commitRate();
}

const STORE_KEYS = ["kbhide", "keys", "krows", "kholds", "ktents", "ktexts", "knames", "kloop", "dunits", "hunits", "kunits", "kdelays", "kdunits", "ktxtOpen", "ktype", "delays2", "loop", "cps", "up5", "down5", "upInf", "downInf", "sloop", "rows", "names", "holdOn", "holds3", "sspeed2", "pspeed", "pinf", "rlSec", "advOn", "cmodes"];

async function loadVals() {
  const s = await chrome.storage.local.get(STORE_KEYS);
  delays = DEFAULT_DELAYS.map((d, i) =>
    Array.isArray(s.delays2) && Number.isFinite(s.delays2[i]) ? s.delays2[i] : d
  );
  names = Array.from({ length: MAX_ROWS }, (_, i) =>
    Array.isArray(s.names) && typeof s.names[i] === "string" && s.names[i].trim() ? s.names[i].slice(0, MAX_NAME) : null
  );
  keyBinds = Array.from({ length: MAX_ROWS }, (_, i) =>
    Array.isArray(s.keys) && typeof s.keys[i] === "string" ? s.keys[i] : null
  );
  kNames = Array.from({ length: MAX_ROWS }, (_, i) =>
    Array.isArray(s.knames) && typeof s.knames[i] === "string" && s.knames[i].trim() ? s.knames[i].slice(0, MAX_NAME) : null
  );
  if (Array.isArray(s.ktents)) {
    kEnts = s.ktents
      .filter((e) => e && Number.isInteger(e.i) && e.i >= 0 && e.i < MAX_ROWS && typeof e.text === "string")
      .map((e) => ({ i: e.i, text: e.text.slice(0, MAX_TEXT) }))
      .filter((e) => e.text);
  } else if (Array.isArray(s.ktexts)) {
    kEnts = s.ktexts.map((x, i) => ({ i, text: typeof x === "string" ? x.slice(0, MAX_TEXT) : "" })).filter((e) => e.text);
  }
  const U = (a) => Array.from({ length: MAX_ROWS }, (_, i) => (Array.isArray(a) && a[i] === "m" ? "m" : "s"));
  dUnits = U(s.dunits);
  hUnits = U(s.hunits);
  kUnits = U(s.kunits);
  kDUnits = U(s.kdunits);
  kDelays = Array.from({ length: MAX_ROWS }, (_, i) =>
    Array.isArray(s.kdelays) && Number.isFinite(s.kdelays[i]) && s.kdelays[i] >= 0 ? s.kdelays[i] : DEFAULT_KDELAY
  );
  $("#kloop").checked = !!s.kloop;
  txtOpen = !!s.ktxtOpen;
  kbHide = !!s.kbhide;
  kType = s.ktype === "normal" ? "normal" : "instant";
  kHolds = Array.from({ length: MAX_ROWS }, (_, i) =>
    Array.isArray(s.kholds) && Number.isFinite(s.kholds[i]) && s.kholds[i] >= 0 ? s.kholds[i] : DEFAULT_HOLD
  );
  kRows = Number.isInteger(s.krows) && s.krows >= 1 && s.krows <= MAX_ROWS ? s.krows : DEFAULT_ROWS;
  holdOn = !!s.holdOn;
  advOn = !!s.advOn;
  cmodes = Array.from({ length: MAX_ROWS }, (_, i) => (Array.isArray(s.cmodes) && ["el", "tx"].includes(s.cmodes[i]) ? s.cmodes[i] : "pt"));
  applyAdv();
  $("#rlSec").value = s.rlSec > 0 ? s.rlSec : "";
  speedKey = ["slow", "normal", "fast"].includes(s.sspeed2) ? s.sspeed2 : "normal";
  applySpeed();
  pSpeedKey = ["slow", "normal", "fast"].includes(s.pspeed) ? s.pspeed : "normal";
  pInf = !!s.pinf;
  applyPattern();
  holds = Array.from({ length: MAX_ROWS }, (_, i) =>
    Array.isArray(s.holds3) && Number.isFinite(s.holds3[i]) && s.holds3[i] >= 0 ? s.holds3[i] : DEFAULT_HOLD
  );
  rows = Number.isInteger(s.rows) && s.rows >= 1 && s.rows <= MAX_ROWS ? s.rows : DEFAULT_ROWS;
  $("#loop").checked = !!s.loop;
  $("#rate").value = s.cps > 0 ? s.cps : DEFAULT_RATE;
  for (const k of ["upS", "downS"]) {
    scrollVals[k] = Number.isFinite(s[SK[k]]) && s[SK[k]] >= 0 ? Math.round(s[SK[k]]) : DEFAULT_SCROLL;
    showScroll(k);
    scrollInf[k] = !!s[IK[k]];
  }
  if (scrollInf.upS && scrollInf.downS) scrollInf.downS = false;
  applyInf("upS");
  applyInf("downS");
  $("#sloop").checked = !!s.sloop;
  fitAll();
}

// put back the values the running mode is actually using
async function revert(m) {
  if (!live(m) || !changed[m]) return;
  let st;
  try {
    st = await send({ type: "getState" });
  } catch {
    return;
  }
  if (!st || !st.running || !st.runVals) return;
  await chrome.storage.local.set(st.runVals);
  changed[m] = false;
  await loadVals();
  applyHold();
  build();
  refresh();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// inject the content script if needed and ask the page for its state, without blocking the first paint
async function attach(tab) {
  try {
    tabId = tab.id;
    const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: () => !!window.__autoClicker });
    if (!r || !r.result) await chrome.scripting.executeScript({ target: { tabId }, files: ["i18n.js", "content.js"] });
    return await send({ type: "getState" });
  } catch {
    return null;
  }
}

// the page keeps its points in storage, so the dots can be drawn on the very first paint
async function preload(tab) {
  try {
    const u = new URL(tab.url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return;
    const k = u.origin + u.pathname;
    const r = await chrome.storage.local.get(["pts:" + k, "rp:" + k, "kp:" + k]);
    state.points = r["pts:" + k] || [];
    state.rapid = r["rp:" + k] || null;
    kPoints = r["kp:" + k] || [];
    kRows = Math.max(kRows, kPoints.reduce((m, p, i) => (p ? i : m), -1) + 1);
    const last = state.points.reduce((m, p, i) => (p ? i : m), -1);
    rows = Math.max(rows, last + 1);
  } catch {}
}

async function applyState(st, rebuild) {
  if (!st) {
    document.body.classList.add("off");
    $("#msg").textContent = t("errOff");
    refresh();
    return;
  }
  const before = rows;
  let again = rebuild;
  state = st;
  kPoints = st.kpoints || kPoints;
  kRows = Math.max(kRows, kPoints.reduce((m, p, i) => (p ? i : m), -1) + 1);
  if (st.running && st.runVals) {
    await chrome.storage.local.set(st.runVals);
    await loadVals();
    applyHold();
    again = true;
  }
  const last = (st.points || []).reduce((m, p, k) => (p ? k : m), -1);
  rows = Math.max(rows, last + 1);
  if (again || rows !== before) build();
  refresh();
  if (kbOpen) buildKb();
}

async function init() {
  const [tabs, s] = await Promise.all([
    chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []),
    chrome.storage.local.get(["theme", "page", "lang", "kbOpen", "ocrFrom", "ocrTo", "ocrRes", "ocrHist", "ocrBusy", "ocrRetr", "pcol"]),
  ]);
  s.lang = "en"; // always opens in English
  const tab = tabs[0] || null;
  if (tab) tabId = tab.id;
  const stateP = tab ? attach(tab) : Promise.resolve(null);
  document.documentElement.dataset.theme =
    s.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  ocrLoad(s);
  pcolShow(s.pcol);
  applyLang(s.lang);
  await loadVals();
  if (tab) await preload(tab);
  showPage(PAGES.includes(s.page) ? s.page : "seq");
  settleTabs();
  build();
  refresh();
  if (s.kbOpen) {
    kbOpen = true;
    buildKb();
    applyKb();
  }

  // give the page a moment to answer so a running state shows correctly on the first frame
  const LATE = {};
  const first = await Promise.race([stateP, sleep(120).then(() => LATE)]);
  if (first !== LATE) await applyState(first, false);
  document.documentElement.classList.remove("pending");
  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove("boot")));
  if (first === LATE) await applyState(await stateP, false);
}

// key binds reach games inside frames only with site access; asked when the keyboard opens, and Chrome keeps the answer
let permWired = false;
async function permGate() {
  const ask = $("#permask");
  if (!ask) return;
  try {
    const origins = ["<all_urls>"];
    const { permskip = false } = await chrome.storage.local.get("permskip");
    if (permskip || (await chrome.permissions.contains({ origins }))) return;
    ask.hidden = false;
    if (permWired) return;
    permWired = true;
    $("#permallow").addEventListener("click", async () => {
      let ok = false;
      try { ok = await chrome.permissions.request({ origins }); } catch {}
      if (!ok) chrome.storage.local.set({ permskip: true });
      ask.hidden = true;
    });
    $("#permlater").addEventListener("click", () => {
      chrome.storage.local.set({ permskip: true });
      ask.hidden = true;
    });
    chrome.permissions.onAdded.addListener(() => { ask.hidden = true; });
  } catch {}
}

// in the time boxes, Down / Enter jump to the same box in the next row, Up to the row above
document.addEventListener("keydown", (e) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement) || el.type !== "number") return;
  if (e.key !== "Enter" && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  e.preventDefault();
  const ROW = ".krow, .row, .srow";
  const row = el.closest(ROW);
  if (row) {
    const idx = [...row.querySelectorAll('input[type="number"]')].indexOf(el);
    const up = e.key === "ArrowUp";
    let sib = up ? row.previousElementSibling : row.nextElementSibling;
    while (sib && !sib.matches(ROW)) sib = up ? sib.previousElementSibling : sib.nextElementSibling;
    const nxt = sib && sib.querySelectorAll('input[type="number"]')[idx];
    if (nxt) {
      nxt.focus();
      nxt.select();
      return;
    }
  }
  if (e.key === "Enter") el.blur();
});

document.querySelectorAll(".tab").forEach((tb) =>
  tb.addEventListener("click", () => {
    const prev = curPage;
    showPage(tb.dataset.page);
    if (prev !== tb.dataset.page) revert(prev);
  })
);

function closeMenu() {
  $("#langlist").hidden = true;
  $("#langbtn").setAttribute("aria-expanded", "false");
  $("#kblanglist").hidden = true;
  $("#kblangbtn").setAttribute("aria-expanded", "false");
}

$("#kblangbtn").addEventListener("click", (e) => {
  e.stopPropagation();
  const open = $("#kblanglist").hidden;
  $("#kblanglist").hidden = !open;
  $("#kblangbtn").setAttribute("aria-expanded", String(open));
});

$("#langbtn").addEventListener("click", (e) => {
  e.stopPropagation();
  const open = $("#langlist").hidden;
  $("#langlist").hidden = !open;
  $("#langbtn").setAttribute("aria-expanded", String(open));
});

document.addEventListener("click", (e) => {
  closeMenu();
  if (sideOpen && !$("#side").contains(e.target)) {
    sideOpen = false;
    applySide();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeMenu();
    if (sideOpen) {
      sideOpen = false;
      applySide();
    }
  }
});

document.querySelectorAll(".lang").forEach((b) =>
  b.addEventListener("click", () => {
    closeMenu();
    chrome.storage.local.set({ lang: b.dataset.lang });
    applyLang(b.dataset.lang);
    settleTabs();
    build();
    refresh();
    if (kbOpen) buildKb();
  })
);

$("#theme").addEventListener("click", () => {
  $("#theme").classList.add("live");
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  chrome.storage.local.set({ theme: next });
});

const speedTimers = new WeakMap();

function animateSpeed(btn) {
  const prev = speedTimers.get(btn);
  if (prev) {
    clearInterval(prev.iv);
    clearTimeout(prev.to);
  }
  const full = t(btn.dataset.i18n);
  btn.textContent = full;
  if (reduceMotion) return;
  const sp = document.createElement("span");
  sp.className = "tl";
  sp.textContent = full;
  btn.textContent = "";
  btn.appendChild(sp);
  const rec = {};
  speedTimers.set(btn, rec);
  const kind = btn.dataset.sp;
  const done = () => {
    btn.textContent = full;
  };
  if (kind === "slow") {
    const chars = window.Intl && Intl.Segmenter
      ? Array.from(new Intl.Segmenter(lang === "in" ? "hi" : lang, { granularity: "grapheme" }).segment(full), (s) => s.segment)
      : Array.from(full);
    sp.style.display = "inline-block";
    sp.style.width = sp.getBoundingClientRect().width + "px";
    sp.style.textAlign = "start";
    sp.textContent = "";
    let n = 0;
    rec.iv = setInterval(() => {
      n++;
      sp.textContent = chars.slice(0, n).join("");
      if (n >= chars.length) {
        clearInterval(rec.iv);
        rec.to = setTimeout(done, 200);
      }
    }, 300);
  } else {
    if (kind === "fast") {
      const sr = btn.getBoundingClientRect();
      const br = sp.getBoundingClientRect();
      const rtl = document.documentElement.dir === "rtl";
      const from = rtl ? sr.right - br.right : sr.left - br.left;
      sp.style.setProperty("--from", from + "px");
    }
    sp.classList.add(kind === "fast" ? "pop-fast" : "pop-normal");
    rec.to = setTimeout(done, kind === "fast" ? 300 : 750);
  }
}

document.querySelectorAll("#page-scroll .speedseg button").forEach((b) =>
  b.addEventListener("click", () => {
    animateSpeed(b);
    if (speedKey === b.dataset.sp) return;
    speedKey = b.dataset.sp;
    chrome.storage.local.set({ sspeed2: speedKey });
    applySpeed();
  })
);

$("#kbbtn").addEventListener("click", (e) => {
  e.stopPropagation();
  kbOpen = true;
  chrome.storage.local.set({ kbOpen: true });
  buildKb();
  applyKb();
});

$("#gear").addEventListener("click", (e) => {
  e.stopPropagation();
  sideOpen = !sideOpen;
  applySide();
});

function setHold(v) {
  if (holdOn === v) return;
  holdOn = v;
  chrome.storage.local.set({ holdOn });
  applyHold();
}

$("#holdYes").addEventListener("click", () => {
  setHold(true);
  sideOpen = false;
  applySide();
});
$("#holdNo").addEventListener("click", () => {
  setHold(false);
  sideOpen = false;
  applySide();
});

for (const [id, key] of [["#rlSec", "rlSec"]]) {
  $(id).addEventListener("change", (e) => {
    const n = Math.floor(Number(e.target.value));
    const v = Number.isFinite(n) && n > 0 ? Math.min(n, 999999) : 0;
    e.target.value = v || "";
    chrome.storage.local.set({ [key]: v });
  });
}

function paintReps() {
  for (const [id, loopId, m] of [["#reps", "#loop", "seq"], ["#kreps", "#kloop", "kseq"]]) {
    const n = Number(state.reps) || 0;
    const show = $(loopId).checked && state.repsMode === m && n > 0 && (state.running ? state.mode === m : true);
    const el = $(id);
    el.hidden = !show;
    if (!show) {
      delete el.dataset.v;
      continue;
    }
    const txt = String(n);
    el.title = `${t("repCount")}: ${n}`;
    el.setAttribute("aria-label", el.title);
    if (el.dataset.v === txt) continue;
    const old = el.dataset.v;
    el.dataset.v = txt;
    // a new number rolls up into place, the old one rolls out the top
    el.textContent = "";
    const inn = document.createElement("span");
    inn.className = "rn";
    inn.textContent = txt;
    if (old !== undefined) {
      const out = document.createElement("span");
      out.className = "rn out";
      out.textContent = old;
      inn.classList.add("in");
      el.append(out, inn);
      inn.addEventListener("animationend", () => {
        if (el.dataset.v === txt) {
          el.textContent = "";
          inn.classList.remove("in");
          el.append(inn);
        }
      }, { once: true });
    } else el.append(inn);
  }
}

$("#loop").addEventListener("change", (e) => {
  paintReps();
  chrome.storage.local.set({ loop: e.target.checked });
});

$("#sloop").addEventListener("change", (e) => {
  chrome.storage.local.set({ sloop: e.target.checked });
});

wireScrollInput("upS");
wireScrollInput("downS");
wireInfBtn("upS", "#upI");
wireInfBtn("downS", "#downI");

$("#rate").addEventListener("change", onRateChange);

$("#rate").addEventListener("input", () => {
  let v = parseFloat($("#rate").value);
  if (v > MAX_RATE) {
    v = MAX_RATE;
    $("#rate").value = v;
  }
  if (v >= 1) chrome.storage.local.set({ cps: v });
});

$("#run2").addEventListener("click", commitRate);

function addRow() {
  if (rows >= MAX_ROWS) return;
  rows++;
  chrome.storage.local.set({ rows });
  build();
  refresh();
}

async function removeRow() {
  if (rows <= 1) return;
  if (!document.body.classList.contains("off")) {
    state = await send({ type: "clear", slot: rows - 1 });
  }
  rows--;
  names[rows] = null;
  holds[rows] = DEFAULT_HOLD;
  chrome.storage.local.set({ rows, names, holds3: holds });
  build();
  refresh();
}

$("#plus").addEventListener("click", addRow);
$("#minus").addEventListener("click", removeRow);

// games and apps embedded in a frame get their keys from a small script inside that frame
async function frameAccess() {
  try {
    const origins = ["<all_urls>"];
    if (!(await chrome.permissions.contains({ origins }))) {
      const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: () => {
          // also looks for frames inside shadow roots
          const walk = (root, depth) => {
            if (root.querySelector("iframe,frame")) return true;
            if (depth > 8) return false;
            for (const el of root.querySelectorAll("*")) {
              let sr = null;
              try { sr = (chrome.dom && chrome.dom.openOrClosedShadowRoot && chrome.dom.openOrClosedShadowRoot(el)) || el.shadowRoot; } catch {}
              if (sr && walk(sr, depth + 1)) return true;
            }
            return false;
          };
          return walk(document, 0);
        } });
      if (!r || !r.result) return;
      if (!(await chrome.permissions.request({ origins }))) return;
    }
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["frame.js"] });
  } catch {}
}

// pages ask document.hasFocus() before accepting keys, and it is false while this popup is open;
// this lets the key sequence report "focused" to the page while it runs (the page-side switch is in content.js)
async function focusPatch() {
  const func = () => {
    const k = "__tcfp";
    if (window[k]) return;
    Object.defineProperty(window, k, { value: 1 });
    let on = false;
    const orig = Document.prototype.hasFocus;
    Document.prototype.hasFocus = function () { return on || orig.call(this); };
    addEventListener("tc-focus-on", () => { on = true; }, true);
    addEventListener("tc-focus-off", () => { on = false; }, true);
  };
  try {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, world: "MAIN", func });
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func });
    } catch {}
  }
}

$("#krun").addEventListener("click", async () => {
  try {
    if (state.running && state.mode === "kseq") {
      await send({ type: "stop" });
      state.running = false;
    } else {
      await frameAccess();
      await focusPatch();
      const r = await send({ type: "startKb" });
      state.running = !!r.running;
      state.mode = "kseq";
    }
    changed.kseq = false;
  } catch {
    state.running = false;
  }
  refresh();
});

$("#krtimes").addEventListener("click", () => {
  kHolds = kHolds.map(() => DEFAULT_HOLD);
  kDelays = kDelays.map(() => 0);
  chrome.storage.local.set({ kholds: kHolds, kdelays: kDelays });
  buildKb();
  kChanged();
});

$("#kreset").addEventListener("click", async () => {
  try {
    if (state.running && state.mode === "kseq") await send({ type: "stop" });
    const st = await send({ type: "clearAllK" });
    kPoints = (st && st.kpoints) || [];
  } catch {}
  state.running = false;
  changed.kseq = false;
  buildKb();
  refresh();
});

$("#kplus").addEventListener("click", () => {
  if (kRows >= MAX_ROWS) return;
  kRows++;
  chrome.storage.local.set({ krows: kRows });
  buildKb();
});

$("#kminus").addEventListener("click", async () => {
  if (kRows <= 1) return;
  if (!document.body.classList.contains("off")) {
    try {
      const st = await send({ type: "clear", slot: kRows - 1, kb: true });
      if (st && st.kpoints) kPoints = st.kpoints;
    } catch {}
  }
  kRows--;
  kHolds[kRows] = DEFAULT_HOLD;
  kDelays[kRows] = DEFAULT_KDELAY;
  keyBinds[kRows] = null;
  kNames[kRows] = null;
  kEnts = kEnts.filter((e) => e.i < kRows);
  if (kPoints[kRows]) kPoints[kRows] = null;
  chrome.storage.local.set({ krows: kRows, kholds: kHolds, kdelays: kDelays, keys: keyBinds, knames: kNames, ktents: kEnts });
  buildKb();
});

$("#rtimes").addEventListener("click", () => {
  delays = delays.map(() => 0);
  holds = holds.map(() => 0);
  chrome.storage.local.set({ delays2: delays, holds3: holds });
  build();
  if (live("seq")) changed.seq = true;
  refresh();
});

$("#rset").addEventListener("click", async () => {
  await send({ type: "pick", slot: "rapid" });
  window.close();
});

wireRun("#run", "#reset", "seq", "start", "errSeq", async () => {
  state = await send({ type: "clearAll" });
});

wireRun("#run2", "#reset2", "rapid", "startRapid", "errRapid", async () => {
  state = await send({ type: "clear", slot: "rapid" });
});

wireRun("#run3", "#reset3", "scroll", "startScroll", "errScroll", async () => {
  for (const k of ["upS", "downS"]) {
    scrollVals[k] = 0;
    showScroll(k);
    scrollInf[k] = false;
  }
  savedVal = {};
  applyInf("upS");
  applyInf("downS");
  chrome.storage.local.set({ up5: 0, down5: 0, upInf: false, downInf: false });
});

document.querySelectorAll("#pseg button").forEach((b) =>
  b.addEventListener("click", () => {
    animateSpeed(b);
    if (pSpeedKey === b.dataset.sp) return;
    pSpeedKey = b.dataset.sp;
    chrome.storage.local.set({ pspeed: pSpeedKey });
    applyPattern(true);
  })
);

$("#pinf").addEventListener("click", () => {
  pInf = !pInf;
  chrome.storage.local.set({ pinf: pInf });
  applyPattern();
});

$("#psim").addEventListener("click", async () => {
  try {
    await send({ type: "record" });
    window.close();
  } catch {}
});

// ---- Sketch: type what to draw, pick one of ten outlines ----
const ICON_API = "https://api.iconify.design";
// Only icon sets released under permissive licenses (MIT, Apache 2.0, ISC), so no credit lines are needed.
const ICON_SETS = [
  "noto", "noto-v1", "fluent-emoji-flat", "fluent-emoji", "fluent-emoji-high-contrast", "lucide", "tabler", "ph",
  "mdi", "material-symbols", "material-symbols-light", "ic", "hugeicons", "mingcute", "ri", "icon-park-outline",
  "icon-park", "carbon", "iconoir", "heroicons", "healthicons", "ion", "bi", "uil", "mage", "jam", "mynaui",
  "tdesign", "fxemoji", "line-md", "boxicons",
  // more sets, all MIT, Apache 2.0 or CC0
  "flat-color-icons", "fluent-color", "fluent", "fluent-mdl2", "ant-design", "eva", "feather", "akar-icons", "majesticons",
  "octicon", "ep", "radix-icons", "clarity", "gg", "teenyicons", "pixelarticons", "uiw", "zondicons", "vscode-icons",
  "meteocons", "ooui", "maki", "proicons", "humbleicons", "bytesize", "quill", "mono-icons",
];
const RESULTS = 60; // pictures per search, all prepared: the grid scrolls
let iconSvgs = {};
let findGen = 0;
// results already shown for the current search, so pressing Enter again brings a different set
let seenIds = new Set();
let lastQuery = "";
let lastRaw = "";

// Second source for words the icon sets do not have ("hill"): Wikimedia Commons drawings, public domain / CC0 files only
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const wmThumb = {};

// More sources, public domain / CC0 only (nothing needs a credit line): Openverse illustrations, the Art Institute of Chicago and the Cleveland Museum of Art
const OPENVERSE_API = "https://api.openverse.org/v1/images/";
const AIC_API = "https://api.artic.edu/api/v1/artworks/search";
const CMA_API = "https://openaccess-api.clevelandart.org/api/artworks/";
const SRC_NAMES = { ov: "Openverse", aic: "Art Institute of Chicago", cma: "Cleveland Museum of Art" };
const extThumb = {}; // id -> { thumb, title }

// plain requests only: no permission prompts. A site that does not allow it just adds nothing to the results.
const netGet = (url) => fetch(url);
const iconGet = (path) => netGet(ICON_API + path);

const STOPWORDS = new Set("a an the on in of with and to for at by my me your some any draw drawing picture image icon is are it its that this there from into over under near next like".split(" "));
let VOC = null;

function vocab() {
  if (!VOC) {
    VOC = new Map();
    const A = (window.ICON_VOCAB || "").split(" ");
    A.forEach((w, i) => VOC.set(w, i));
    // everyday English words with no icon of their own: known spellings, ranked below every icon word
    (window.ICON_VOCAB2 || "").split(" ").forEach((w) => { if (w && !VOC.has(w)) VOC.set(w, A.length * 2); });
  }
  return VOC;
}

// sound-alike key: "elefant" and "elephant" share one
const phon = (w) => w.replace(/ph/g, "f").replace(/ck/g, "k").replace(/c(?=[eiy])/g, "s").replace(/[cq]/g, "k").replace(/z/g, "s").replace(/y/g, "i").replace(/(.)\1+/g, "$1");
let PHON = null;

// every word one edit away, with a cost: dropped letters are the most likely typo to repair, wrong letters less so
function edits1(w) {
  const L = "abcdefghijklmnopqrstuvwxyz";
  const out = new Map();
  const add = (k, c) => { if (!out.has(k) || out.get(k) > c) out.set(k, c); };
  for (let i = 0; i <= w.length; i++) {
    const a = w.slice(0, i), b = w.slice(i);
    if (b) add(a + b.slice(1), 1.5);
    if (b.length > 1) add(a + b[1] + b[0] + b.slice(2), 0);
    for (const c of L) {
      if (b) add(a + c + b.slice(1), 0.7);
      add(a + c + b, 0);
    }
  }
  return out;
}

// closest known icon word to a misspelled one ("bicyle" -> "bicycle"), common words first
function spell(w) {
  const v = vocab();
  if (v.has(w)) return w;
  if (!PHON) {
    PHON = new Map();
    for (const [word] of v) {
      const k = phon(word);
      if (!PHON.has(k)) PHON.set(k, word);
    }
  }
  if (PHON.has(phon(w))) return PHON.get(phon(w));
  let best = null, bc = Infinity;
  const e1 = edits1(w);
  for (const [e, c] of e1) {
    const r = v.get(e);
    if (r !== undefined && c + Math.log(r + 2) < bc) { bc = c + Math.log(r + 2); best = e; }
  }
  if (best || w.length < 5) return best;
  for (const e of e1.keys()) for (const e2 of edits1(e).keys()) {
    const r = v.get(e2);
    if (r !== undefined && Math.log(r + 2) < bc) { bc = Math.log(r + 2); best = e2; }
  }
  if (best || w.length < 8) return best;
  // long words with several wrong letters ("extignhser"): closest vocabulary word that starts the same way
  const lim = Math.min(4, Math.floor(w.length * 0.4));
  let bd = Infinity;
  for (const [word, rk] of v) {
    if (Math.abs(word.length - w.length) > lim || word.slice(0, 2) !== w.slice(0, 2)) continue;
    const d = lev(w, word, lim);
    if (d > lim) continue;
    const sc = d + Math.log(rk + 2) / 8;
    if (sc < bd) { bd = sc; best = word; }
  }
  return best;
}

function lev(a, b, max) {
  let p = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const c = [i];
    let lo = i;
    for (let j = 1; j <= b.length; j++) {
      c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (c[j] < lo) lo = c[j];
    }
    if (lo > max) return max + 1;
    p = c;
  }
  return p[b.length];
}

// a run-together word the vocabulary lacks ("treehosue" -> "tree house"): split it where both halves are common icon words, at most one half misspelled
function compoundFix(w) {
  const v = vocab();
  const N = 3000; // only everyday words count as halves
  const fix1 = (p) => {
    if (v.has(p) && v.get(p) < N) return [p, 0, v.get(p)];
    let best = null;
    for (const [e, c] of edits1(p)) {
      const r = v.get(e);
      if (r === undefined || r >= N) continue;
      if (!best || c < best[1] || (c === best[1] && r < best[2])) best = [e, c, r];
    }
    return best;
  };
  let best = null;
  for (let i = 3; i <= w.length - 3; i++) {
    const a = fix1(w.slice(0, i)), b = fix1(w.slice(i));
    if (!a || !b || (a[1] > 0 && b[1] > 0)) continue;
    const cost = a[1] + b[1], rank = a[2] + b[2];
    if (!best || cost < best.cost || (cost === best.cost && rank < best.rank)) best = { text: a[0] + " " + b[0], cost, rank, exact: a[0] + b[0] === w };
  }
  return best;
}

// what to search instead when the typed words find nothing: a close spelling fix, else a split compound, else the nearest known word
function autoFix(q) {
  const v = vocab();
  const out = q.toLowerCase().split(/\s+/).filter(Boolean).map((tok) => {
    if (!/^[a-z]+$/.test(tok) || tok.length < 4 || STOPWORDS.has(tok) || v.has(tok)) return tok;
    const sp = spell(tok);
    const comp = compoundFix(tok);
    if (comp && comp.exact) return comp.text;
    if (sp && (edits1(tok).has(sp) || phon(sp) === phon(tok) || lev(tok, sp, 2) <= 2)) return sp;
    return (comp && comp.text) || sp || tok;
  });
  return out.join(" ");
}

// the typed word, plain singulars, then the spelling fix
function variants(w) {
  const plain = [w];
  if (w.endsWith("ies") && w.length > 4) plain.push(w.slice(0, -3) + "y");
  if (w.endsWith("es") && w.length > 3) plain.push(w.slice(0, -2));
  if (w.endsWith("s") && w.length > 3) plain.push(w.slice(0, -1));
  const fixed = [];
  const sp = spell(w);
  if (sp) fixed.push(sp);
  if (w.endsWith("s") && w.length > 3) {
    const sp2 = spell(w.slice(0, -1));
    if (sp2) fixed.push(sp2);
  }
  return [[...new Set(plain)], [...new Set(fixed)].filter((x) => !plain.includes(x))];
}

const nameScore = (n, words) => {
  const parts = n.split("-");
  if (n === words.join("-")) return 0;
  if (words.every((w) => parts.includes(w) || parts.includes(w + "s"))) return 1 + parts.length / 20;
  return 3 + n.length / 50;
};

// names that contain the whole word(s) (cat, cat-face), not look-alikes (locate)
const goodIds = (ids, words) => ids.filter((id) => nameScore(id.split(":")[1], words) < 3);

// best match from each set first, so the styles are as different as possible
function pickN(ids, words, cap) {
  const by = new Map();
  for (const id of ids) {
    const [p, n] = id.split(":");
    if (!by.has(p)) by.set(p, []);
    by.get(p).push(n);
  }
  const sets = [...by.keys()].map((p, i) => {
    by.get(p).sort((a, b) => nameScore(a, words) - nameScore(b, words));
    return { p, i, s: nameScore(by.get(p)[0], words) };
  });
  sets.sort((a, b) => a.s - b.s || a.i - b.i);
  const out = [];
  for (let r = 0; out.length < cap; r++) {
    let any = false;
    for (const { p } of sets) {
      const n = by.get(p)[r];
      if (n === undefined) continue;
      any = true;
      out.push(p + ":" + n);
      if (out.length === cap) break;
    }
    if (!any) break;
  }
  return out;
}

async function searchIds(words) {
  const r = await iconGet("/search?query=" + encodeURIComponent(words.join(" ")) + "&limit=200&prefixes=" + ICON_SETS.join(","));
  if (!r.ok) throw new Error("http " + r.status);
  return goodIds((await r.json()).icons || [], words).filter((id) => !seenIds.has(id));
}

const WM_SKIP = new Set("logo logos flag flags map maps coat arms emblem seal diagram chart graph screenshot banner stamp".split(" "));

// drawings from Commons whose file name contains the word(s); never throws, an unreachable Commons just adds nothing
async function commonsIds(words) {
  try {
    const u =
      COMMONS_API +
      "?action=query&format=json&formatversion=2&origin=*&generator=search&gsrnamespace=6&gsrlimit=50&gsrsearch=" +
      encodeURIComponent(words.join(" ") + " filetype:drawing") +
      "&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=320&iiextmetadatafilter=LicenseShortName|AttributionRequired|Restrictions";
    const r = await netGet(u);
    if (!r.ok) return [];
    const pages = ((await r.json()).query || {}).pages || [];
    const out = [];
    for (const p of pages) {
      const ii = (p.imageinfo || [])[0];
      if (!ii || !ii.thumburl) continue;
      const m = ii.extmetadata || {};
      const val = (k) => ((m[k] || {}).value || "").toString();
      if (!/^(cc0|cc[ -]zero|public domain|pd\b)/i.test(val("LicenseShortName")) || /true/i.test(val("AttributionRequired")) || val("Restrictions")) continue;
      const tw = (p.title || "").replace(/^File:/i, "").replace(/\.[a-z0-9]+$/i, "").toLowerCase().match(/[a-z]+/g) || [];
      const stem = (x) => (x.length > 3 ? x.replace(/ies$/, "y").replace(/s$/, "") : x);
      const hit = words.filter((w) => tw.some((x) => stem(x) === stem(w))).length;
      if (!hit || tw.some((x) => WM_SKIP.has(x) && !words.includes(x))) continue;
      out.push({ id: "wm:" + p.title, hit, n: tw.length, i: p.index || 0, thumb: ii.thumburl });
    }
    out.sort((a, b) => b.hit - a.hit || a.n - b.n || a.i - b.i);
    for (const o of out) wmThumb[o.id] = o.thumb;
    return out.map((o) => o.id).filter((id) => !seenIds.has(id));
  } catch {
    return [];
  }
}

// illustrations from Openverse that have the word in their title or tags; never throws, an unreachable Openverse just adds nothing
async function openverseIds(words) {
  try {
    if (!words.length) return [];
    const u =
      OPENVERSE_API +
      "?q=" + encodeURIComponent(words.join(" ")) +
      "&category=illustration&license=cc0,pdm&mature=false&page_size=30";
    const r = await netGet(u);
    if (!r.ok) return [];
    const list = (await r.json()).results || [];
    const stem = (x) => (x.length > 3 ? x.replace(/ies$/, "y").replace(/s$/, "") : x);
    const out = [];
    list.forEach((p, i) => {
      if (!p || !p.id || !p.thumbnail || !/^(cc0|pdm)$/i.test(p.license || "")) return;
      const tw = (p.title || "").toLowerCase().match(/[a-z]+/g) || [];
      const tags = (p.tags || []).map((t) => (t && t.name ? String(t.name).toLowerCase() : "")).filter(Boolean);
      const inTitle = words.filter((w) => tw.some((x) => stem(x) === stem(w))).length;
      const inTags = words.filter((w) => tags.some((x) => stem(x) === stem(w))).length;
      if (!inTitle && !inTags) return;
      if (tw.some((x) => WM_SKIP.has(x) && !words.includes(x))) return;
      out.push({ id: "ov:" + p.id, score: inTitle * 2 + inTags, i, thumb: p.thumbnail, title: p.title || "" });
    });
    out.sort((a, b) => b.score - a.score || a.i - b.i);
    for (const o of out) extThumb[o.id] = { thumb: o.thumb, title: o.title };
    return out.map((o) => o.id).filter((id) => !seenIds.has(id));
  } catch {
    return [];
  }
}

const stemW = (x) => (x.length > 3 ? x.replace(/ies$/, "y").replace(/s$/, "") : x);
const wordHits = (words, text) => {
  const tw = (text || "").toLowerCase().match(/[a-z]+/g) || [];
  return words.filter((w) => tw.some((x) => stemW(x) === stemW(w))).length;
};
const LINEY = /print|drawing|illustrat|sketch|woodcut|woodblock|etching|engrav|lithograph|poster|book/i;

// Art Institute of Chicago: public domain works whose title or subjects have the word; prints and drawings first
async function aicIds(words) {
  try {
    if (!words.length) return [];
    const u =
      AIC_API +
      "?q=" + encodeURIComponent(words.join(" ")) +
      "&query[term][is_public_domain]=true&limit=40&fields=id,title,image_id,artwork_type_title,subject_titles";
    const r = await netGet(u);
    if (!r.ok) return [];
    const d = await r.json();
    const base = (d.config && d.config.iiif_url) || "https://www.artic.edu/iiif/2";
    const out = [];
    (d.data || []).forEach((p, i) => {
      if (!p || !p.image_id || /photograph/i.test(p.artwork_type_title || "")) return;
      const score = wordHits(words, p.title) * 2 + wordHits(words, (p.subject_titles || []).join(" "));
      if (!score) return;
      out.push({ id: "aic:" + p.id, score: score + (LINEY.test(p.artwork_type_title || "") ? 3 : 0), i, thumb: base + "/" + p.image_id + "/full/400,/0/default.jpg", title: p.title || "" });
    });
    out.sort((a, b) => b.score - a.score || a.i - b.i);
    for (const o of out) extThumb[o.id] = { thumb: o.thumb, title: o.title };
    return out.map((o) => o.id).filter((id) => !seenIds.has(id));
  } catch {
    return [];
  }
}

// Cleveland Museum of Art open access (CC0): works whose title has the word; prints and drawings first
async function cmaIds(words) {
  try {
    if (!words.length) return [];
    const u =
      CMA_API +
      "?q=" + encodeURIComponent(words.join(" ")) +
      "&cc0&has_image=1&limit=40&fields=id,title,type,department,images";
    const r = await netGet(u);
    if (!r.ok) return [];
    const d = await r.json();
    const out = [];
    (d.data || []).forEach((p, i) => {
      const img = p && p.images && p.images.web && p.images.web.url;
      if (!img || /photograph/i.test(p.type || "")) return;
      const score = wordHits(words, p.title) * 2;
      if (!score) return;
      out.push({ id: "cma:" + p.id, score: score + (LINEY.test((p.type || "") + " " + (p.department || "")) ? 3 : 0), i, thumb: img, title: p.title || "" });
    });
    out.sort((a, b) => b.score - a.score || a.i - b.i);
    for (const o of out) extThumb[o.id] = { thumb: o.thumb, title: o.title };
    return out.map((o) => o.id).filter((id) => !seenIds.has(id));
  } catch {
    return [];
  }
}

// "a cat on a tree" -> cat + tree, "bicyle" -> bicycle; falls back word by word when nothing matches the whole phrase
async function resolveBase(q) {
  const words = (q.toLowerCase().match(/[a-z]+/g) || []).filter((w) => !STOPWORDS.has(w));
  if (!words.length) return { ids: [], shown: null };
  const first = await searchIds(words);
  if (first.length >= 3) {
    const ids = pickN(first, words, RESULTS);
    if (ids.length < RESULTS) for (const id of await commonsIds(words)) if (ids.length < RESULTS) ids.push(id);
    return { ids, shown: null };
  }
  const lists = [], shown = [];
  let usedWm = false;
  for (const w of words) {
    // the word as typed (and its singular) on Iconify, then on Commons; only then a spelling fix, so "hill" never turns into "fill"
    const [plain, fixed] = variants(w);
    let found = false;
    for (const group of [plain, fixed]) {
      for (const v of group) {
        const g = v === w && words.length === 1 ? first : await searchIds([v]);
        if (g.length) {
          lists.push(pickN(g, [v], RESULTS));
          shown.push(v);
          found = true;
          break;
        }
      }
      if (found) break;
      for (const v of group) {
        const c = await commonsIds([v]);
        if (c.length) {
          lists.push(c.slice(0, RESULTS));
          shown.push(v);
          usedWm = true;
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }
  if (words.length > 1 && shown.length === words.length && shown.join(" ") !== words.join(" ") && !usedWm) {
    // every word was repaired: search the repaired phrase as a whole, so "fire extinguiser" gives extinguishers, not fire + extinguisher
    const fixedPhrase = await searchIds(shown);
    if (fixedPhrase.length >= 3) {
      const ids = pickN(fixedPhrase, shown, RESULTS);
      return { ids, shown: shown.join(" ") };
    }
  }
  const ids = [];
  for (let r = 0; ids.length < RESULTS; r++) {
    let any = false;
    for (const l of lists) {
      if (l[r] !== undefined && !ids.includes(l[r])) { ids.push(l[r]); any = true; if (ids.length === RESULTS) break; }
      else if (l[r] !== undefined) any = true;
    }
    if (!any) break;
  }
  if (ids.length && ids.length < RESULTS && !usedWm) for (const id of await commonsIds(shown)) if (ids.length < RESULTS && !ids.includes(id)) ids.push(id);
  return { ids, shown: shown.length && shown.join(" ") !== words.join(" ") || lists.length > 1 ? shown.join(", ") : null };
}

// every source takes turns, so each word gives a lot of different styles: illustrations, museum prints, Commons drawings, icons
async function resolveQuery(q) {
  const base = await resolveBase(q);
  const words = base.shown ? base.shown.toLowerCase().match(/[a-z]+/g) || [] : (q.toLowerCase().match(/[a-z]+/g) || []).filter((w) => !STOPWORDS.has(w));
  const [ov, aic, cma] = await Promise.all([openverseIds(words), aicIds(words), cmaIds(words)]);
  if (!ov.length && !aic.length && !cma.length) return base;
  const wm = base.ids.filter((id) => id.startsWith("wm:"));
  const icons = base.ids.filter((id) => !id.startsWith("wm:"));
  const lists = [ov, aic, cma, wm, icons];
  const ids = [];
  for (let r = 0; ids.length < RESULTS; r++) {
    let any = false;
    for (const l of lists) {
      if (l[r] === undefined) continue;
      any = true;
      if (ids.length < RESULTS) ids.push(l[r]);
    }
    if (!any) break;
  }
  return { ids, shown: base.shown };
}

// "cat on a hill": the part before the word is the subject, the part after it the thing it sits on / in / under / beside
const SCENE_REL = { on: "on", over: "on", above: "on", atop: "on", upon: "on", in: "in", inside: "in", within: "in", under: "under", below: "under", beneath: "under", beside: "beside", near: "beside", and: "beside", next: "beside" };
let scene = null;

function parseScene(q) {
  const toks = q.toLowerCase().match(/[a-z]+/g) || [];
  const strip = (a) => a.filter((w) => !STOPWORDS.has(w)).join(" ");
  for (let i = 1; i < toks.length - 1; i++) {
    const rel = SCENE_REL[toks[i]];
    if (!rel) continue;
    const j = toks[i] === "next" && toks[i + 1] === "to" ? i + 2 : i + 1;
    const a = strip(toks.slice(0, i)), b = strip(toks.slice(j));
    if (a && b) return { rel, a, b };
  }
  return null;
}

function placeholders() {
  const res = $("#pres");
  res.replaceChildren();
  for (let i = 0; i < 10; i++) {
    const d = document.createElement("div");
    d.className = "pr ld";
    res.appendChild(d);
  }
}

// download and show a list of results; returns how many tiles were drawn, or -1 if a newer search took over
async function showIcons(ids, gen) {
  const res = $("#pres");
  iconSvgs = {};
  const load = async (id) => {
      try {
        const src = id.split(":")[0];
        if (src === "wm" || SRC_NAMES[src]) {
          const rr = await netGet(src === "wm" ? wmThumb[id] : extThumb[id].thumb);
          if (!rr.ok) return null;
          const blob = await rr.blob();
          if (!/^image\//.test(blob.type)) return null;
          const url = await new Promise((ok, no) => {
            const fr = new FileReader();
            fr.onload = () => ok(fr.result);
            fr.onerror = no;
            fr.readAsDataURL(blob);
          });
          return [id, { url }];
        }
        const [p, n] = id.split(":");
        const rr = await iconGet("/" + p + "/" + n + ".svg");
        if (!rr.ok) return null;
        const txt = await rr.text();
        return /^\s*<svg[\s>]/.test(txt) ? [id, { svg: txt, url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(txt) }] : null;
      } catch {
        return null;
      }
  };
  // at most 12 downloads at a time, started in result order
  let active = 0;
  const waiters = [];
  const acquire = () => (active < 12 ? (active++, Promise.resolve()) : new Promise((ok) => waiters.push(ok)));
  const release = () => { const w = waiters.shift(); if (w) w(); else active--; };
  const tasks = ids.map(async (id) => {
    await acquire();
    try { return await load(id); } finally { release(); }
  });
  let shownN = 0, cleared = false;
  const add = (g) => {
    if (!g) return;
    if (!cleared) { res.replaceChildren(); cleared = true; }
    shownN++;
    iconSvgs[g[0]] = g[1];
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pr";
    b.dataset.id = g[0];
    b.title = SRC_NAMES[g[0].split(":")[0]] ? (extThumb[g[0]].title || "illustration") + " · " + SRC_NAMES[g[0].split(":")[0]] : g[0].startsWith("wm:") ? g[0].slice(8).replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ") + " · Wikimedia Commons" : g[0].replace(":", " · ");
    const im = document.createElement("img");
    im.alt = "";
    im.src = g[1].url;
    b.appendChild(im);
    res.appendChild(b);
  };
  // the first two rows appear together; the rest fill in below while they scroll
  let k = 0;
  while (k < tasks.length && shownN < 10) {
    const g = await tasks[k++];
    if (gen !== findGen) return -1;
    add(g);
  }
  if (!cleared) res.replaceChildren();
  (async () => {
    for (; k < tasks.length; k++) {
      const g = await tasks[k];
      if (gen !== findGen) return;
      add(g);
    }
  })();
  return shownN;
}

// same search again gives results not shown yet; once everything has been shown it starts over
async function resolveFresh(q) {
  let r = await resolveQuery(q);
  if (!r.ids.length && seenIds.size) {
    seenIds = new Set();
    r = await resolveQuery(q);
  }
  return r;
}

async function findIcons(q, retried) {
  const gen = ++findGen;
  const res = $("#pres"), msg = $("#pmsg");
  scene = null;
  placeholders();
  msg.textContent = t("findBusy");
  try {
    const sc = parseScene(q);
    if (sc) {
      const [ra, rb] = await Promise.all([resolveFresh(sc.a), resolveFresh(sc.b)]);
      if (gen !== findGen) return;
      if (ra.ids.length && rb.ids.length) {
        for (const id of ra.ids.concat(rb.ids)) seenIds.add(id);
        scene = { rel: sc.rel, step: 0, picks: [], lists: [ra, rb], words: [sc.a, sc.b], gen };
        await sceneShow();
        return;
      }
    }
    const { ids, shown } = await resolveFresh(q);
    if (gen !== findGen) return;
    if (!ids.length) {
      if (retry(q, retried)) return;
      res.replaceChildren();
      msg.textContent = t("findNone");
      return;
    }
    for (const id of ids) seenIds.add(id);
    const n = await showIcons(ids, gen);
    if (n < 0) return;
    if (!n && retry(q, retried)) return;
    msg.textContent = !n ? t("findNone") : shown ? t("findShowing").replace("{w}", shown) : "";
  } catch {
    if (gen !== findGen) return;
    res.replaceChildren();
    msg.textContent = t("findOffline");
  }
}

// nothing found: fix the spelling in the box itself and search again, once
function retry(q, retried) {
  if (retried) return false;
  const q2 = autoFix(q);
  if (!q2 || q2 === q.toLowerCase().trim().replace(/\s+/g, " ")) return false;
  $("#pq").value = q2;
  lastRaw = q2;
  lastQuery = (q2.match(/[a-z]+/g) || []).join(" ");
  seenIds = new Set();
  findIcons(q2, true);
  return true;
}

// "More" (or Enter again): a fresh set for what is on screen; in a scene only the part being picked changes, the earlier pick stays
async function moreIcons() {
  if (!scene) return findIcons(lastRaw);
  const gen = ++findGen;
  scene.gen = gen;
  placeholders();
  $("#pmsg").textContent = t("findBusy");
  try {
    const r = await resolveFresh(scene.words[scene.step]);
    if (gen !== findGen) return;
    if (r.ids.length) {
      for (const id of r.ids) seenIds.add(id);
      scene.lists[scene.step] = r;
    }
    await sceneShow();
  } catch {
    if (gen !== findGen) return;
    $("#pres").replaceChildren();
    $("#pmsg").textContent = t("findOffline");
  }
}

async function sceneShow() {
  const sc = scene, gen = sc.gen;
  const r = sc.lists[sc.step];
  placeholders();
  $("#pmsg").textContent = t("findBusy");
  try {
    const n = await showIcons(r.ids, gen);
    if (n < 0) return;
    $("#pmsg").textContent = n ? t("findPick").replace("{w}", r.shown || sc.words[sc.step]) : t("findNone");
  } catch {
    if (gen !== findGen) return;
    $("#pres").replaceChildren();
    $("#pmsg").textContent = t("findOffline");
  }
}

// draw one icon (SVG or picture) onto a canvas, longest side = max
async function rasterise(ic, max) {
  const im = new Image();
  let W, H;
  if (ic.svg) {
    const m = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(ic.svg);
    const vw = m ? +m[1] : 24, vh = m ? +m[2] : 24;
    const k = max / Math.max(vw, vh);
    W = Math.max(24, Math.round(vw * k));
    H = Math.max(24, Math.round(vh * k));
    const sized = ic.svg.replace(/<svg([^>]*)>/, (all, a) => "<svg" + a.replace(/\s(width|height)="[^"]*"/g, "") + ' width="' + W + '" height="' + H + '">');
    im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(sized);
    await im.decode();
  } else {
    im.src = ic.url;
    await im.decode();
    const k = max / Math.max(im.naturalWidth, im.naturalHeight);
    W = Math.max(24, Math.round(im.naturalWidth * k));
    H = Math.max(24, Math.round(im.naturalHeight * k));
  }
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  cv.getContext("2d").drawImage(im, 0, 0, W, H);
  return cv;
}

// crop to the drawn part, so "centred" and "on top of" mean the picture itself, not its empty margins
function trimCanvas(cv) {
  const w = cv.width, h = cv.height, d = cv.getContext("2d").getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) return cv;
  const o = document.createElement("canvas");
  o.width = x1 - x0 + 1;
  o.height = y1 - y0 + 1;
  o.getContext("2d").drawImage(cv, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}

function scaleCanvas(cv, k) {
  const o = document.createElement("canvas");
  o.width = Math.max(8, Math.round(cv.width * k));
  o.height = Math.max(8, Math.round(cv.height * k));
  const cx = o.getContext("2d");
  cx.imageSmoothingQuality = "high";
  cx.drawImage(cv, 0, 0, o.width, o.height);
  return o;
}

// solid white shape of a picture (inside of outlines filled), so what is behind it does not show through
function silhouette(cv, r) {
  const P = r + 2, w = cv.width + 2 * P, h = cv.height + 2 * P;
  const src = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  let m = new Uint8Array(w * h);
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (src[(y * cv.width + x) * 4 + 3] > 40) m[(y + P) * w + x + P] = 1;
  const dil = (a, horiz) => {
    const o = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!a[y * w + x]) continue;
      for (let k = -r; k <= r; k++) {
        const xx = horiz ? x + k : x, yy = horiz ? y : y + k;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) o[yy * w + xx] = 1;
      }
    }
    return o;
  };
  m = dil(dil(m, true), false);
  const out = new Uint8Array(w * h), st = [0];
  out[0] = 1;
  while (st.length) {
    const i = st.pop(), x = i % w, y = (i - x) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = yy * w + xx;
      if (!out[j] && !m[j]) { out[j] = 1; st.push(j); }
    }
  }
  const o = document.createElement("canvas");
  o.width = w;
  o.height = h;
  const cx = o.getContext("2d"), id = cx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) if (!out[i]) { id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255; id.data[i * 4 + 3] = 255; }
  cx.putImageData(id, 0, 0);
  o.pad = P;
  return o;
}

// put the subject on / in / under / beside the base and return one picture
async function composeScene(rel, A, B) {
  let ca = trimCanvas(await rasterise(A, 420)), cb = trimCanvas(await rasterise(B, 420));
  let bx = 0, by = 0, sx = 0, sy = 0;
  if (rel === "beside") {
    const hh = 220;
    ca = scaleCanvas(ca, Math.min(hh / ca.height, 250 / ca.width));
    cb = scaleCanvas(cb, Math.min(hh / cb.height, 250 / cb.width));
    const H = Math.max(ca.height, cb.height);
    sx = 0;
    sy = H - ca.height;
    bx = ca.width + 16;
    by = H - cb.height;
  } else {
    const baseS = rel === "under" ? 250 : 300;
    cb = scaleCanvas(cb, baseS / Math.max(cb.width, cb.height));
    const subS = rel === "in" ? Math.max(60, 0.5 * Math.min(cb.width, cb.height)) : 0.42 * baseS;
    ca = scaleCanvas(ca, subS / Math.max(ca.width, ca.height));
    sx = Math.round((cb.width - ca.width) / 2);
    if (rel === "on") {
      // sit on the highest part of the base under the subject's middle
      const d = cb.getContext("2d").getImageData(0, 0, cb.width, cb.height).data;
      let sum = 0, cnt = 0;
      for (let x = Math.max(0, Math.round(sx + 0.2 * ca.width)); x <= Math.min(cb.width - 1, Math.round(sx + 0.8 * ca.width)); x++) {
        let top = cb.height;
        for (let y = 0; y < cb.height; y++) if (d[(y * cb.width + x) * 4 + 3] > 40) { top = y; break; }
        sum += top;
        cnt++;
      }
      sy = Math.round(sum / Math.max(1, cnt)) - ca.height;
    } else if (rel === "in") sy = Math.round((cb.height - ca.height) / 2);
    else sy = cb.height + 8;
  }
  const pad = 8;
  const minX = Math.min(bx, sx) - pad, minY = Math.min(by, sy) - pad;
  const maxX = Math.max(bx + cb.width, sx + ca.width) + pad, maxY = Math.max(by + cb.height, sy + ca.height) + pad;
  // two separate pictures, each traced on its own: a dark outline icon next to a coloured one would otherwise
  // be traced with one setting and lose half of the scene
  let base = cb;
  if (rel === "on" || rel === "in") {
    // cut the subject's shape out of the base, so the base lines do not run through it
    const sil = silhouette(ca, 1);
    base = document.createElement("canvas");
    base.width = cb.width;
    base.height = cb.height;
    const bc = base.getContext("2d");
    bc.drawImage(cb, 0, 0);
    bc.globalCompositeOperation = "destination-out";
    bc.drawImage(sil, sx - bx - sil.pad, sy - by - sil.pad);
  }
  const part = (cv, x, y) => ({ x: x - minX, y: y - minY, w: cv.width, h: cv.height, data: Array.from(cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data) });
  return { w: maxX - minX, h: maxY - minY, parts: [part(base, bx, by), part(ca, sx, sy)] };
}

async function drawScene() {
  const sc = scene;
  try {
    const sc2 = await composeScene(sc.rel, sc.picks[0], sc.picks[1]);
    await send({ type: "drawIcon", w: sc2.w, h: sc2.h, parts: sc2.parts, cap: 680 });
    window.close();
  } catch {
    $("#pmsg").textContent = t("findOffline");
  }
}

// draw the chosen outline: rasterise it here (the page may block images), then hand the pixels to the page
async function drawIcon(id) {
  const ic = iconSvgs[id];
  if (!ic) return;
  try {
    const cv = await rasterise(ic, 230);
    const data = Array.from(cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data);
    await send({ type: "drawIcon", w: cv.width, h: cv.height, data });
    window.close();
  } catch {
    $("#pmsg").textContent = t("findOffline");
  }
}

$("#pimg").addEventListener("click", () => {
  const f = $("#pfind");
  f.hidden = !f.hidden;
  $("#pimg").setAttribute("aria-expanded", String(!f.hidden));
  // while the picture search is open, Simulate and the repeat button fade out
  $("#page-pattern").classList.toggle("imgmode", !f.hidden);
  $("#psim").tabIndex = $("#pinf").tabIndex = f.hidden ? 0 : -1;
  if (!f.hidden) $("#pq").focus();
});
function runSearch() {
  const q = $("#pq").value.trim();
  if (!q) return;
  const key = (q.toLowerCase().match(/[a-z]+/g) || []).join(" ");
  if (key !== lastQuery || !lastRaw) {
    seenIds = new Set();
    lastQuery = key;
    lastRaw = q;
    findIcons(q);
  } else moreIcons();
}
$("#pform").addEventListener("submit", (e) => {
  e.preventDefault();
  runSearch();
});
// the Enter key on the keyboard (and the numpad one) searches on its own, not only through the form's own submit
$("#pq").addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.code === "NumpadEnter" || e.keyCode === 13) && !e.isComposing) {
    e.preventDefault();
    runSearch();
  }
});
$("#pres").addEventListener("click", (e) => {
  const b = e.target.closest(".pr[data-id]");
  if (!b) return;
  if (!scene) return drawIcon(b.dataset.id);
  scene.picks.push(iconSvgs[b.dataset.id]);
  if (scene.picks.length === 1) {
    scene.step = 1;
    sceneShow();
  } else drawScene();
});
$("#pup").addEventListener("click", async () => {
  try {
    await send({ type: "pickImage" });
    window.close();
  } catch {}
});

// some drawing pages read every pointer move through getCoalescedEvents(), which is empty for scripted events: make it hand back the event itself
async function patchPointerEvents() {
  const func = () => {
    if (window.__tcCoal) return;
    window.__tcCoal = true;
    const P = window.PointerEvent && PointerEvent.prototype;
    const orig = P && P.getCoalescedEvents;
    if (!orig) return;
    Object.defineProperty(P, "getCoalescedEvents", {
      configurable: true,
      writable: true,
      value: function () {
        const r = orig.call(this);
        return !this.isTrusted && !r.length ? [this] : r;
      },
    });
  };
  try {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, world: "MAIN", func });
  } catch {
    try { await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func }); } catch {}
  }
}

$("#run4").addEventListener("click", async () => {
  $("#msg").textContent = "";
  if (live("pattern")) {
    await send({ type: "stop" });
    state.running = false;
  } else {
    // site access is only asked for when the sketch sits on an embedded frame
    try { if ((await send({ type: "getState" })).patFrame) await frameAccess(); } catch {}
    await patchPointerEvents();
    const r = await send({ type: "startPattern" });
    state.running = !!r.running;
    state.mode = "pattern";
    if (!r.running) $("#msg").textContent = t("errPattern");
  }
  refresh();
});

(function simIcon() {
  // wave of dots spaced evenly along the line, filled circle at each end
  const W = 46, H = 18, amp = 6.6, x0 = 3.5, x1 = W - 3.5, N = 13, M = 300;
  const pts = [], cum = [0];
  for (let i = 0; i <= M; i++) {
    const t = i / M;
    pts.push([x0 + (x1 - x0) * t, H / 2 - amp * Math.sin(t * Math.PI * 2)]);
  }
  for (let i = 1; i <= M; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const at = (f) => {
    const t = f * cum[M];
    let i = 1;
    while (i < M && cum[i] < t) i++;
    const k = (t - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
  };
  let o = "";
  for (let i = 1; i < N; i++) {
    const f = i / N, p = at(f);
    o += '<circle class="bd" cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r="1.3" style="animation-delay:' + (f * 2.21).toFixed(2) + 's"/>';
  }
  const a = at(0), z = at(1);
  o += '<circle class="be" cx="' + a[0].toFixed(2) + '" cy="' + a[1].toFixed(2) + '" r="2.3"/><circle class="be" cx="' + z[0].toFixed(2) + '" cy="' + z[1].toFixed(2) + '" r="2.3"/>';
  $("#psim .sico").innerHTML = '<svg class="sk" viewBox="0 0 ' + W + " " + H + '" aria-hidden="true">' + o + "</svg>";
})();

/* ---------- OCR tab: read a screen area, translate it with Google Translate ---------- */
const OC_GT = "https://translate.googleapis.com/*";
const OC_RTL = new Set(["ar", "fa", "ur", "ps", "sd", "ug"]);
const OC_BY = {};
OCR_TABLE.forEach((r) => (OC_BY[r[0]] = r));
const ocr = { from: "auto", to: "", res: null, hist: [], busy: false, view: "tr", pick: null, hl: 0, items: [], have: new Set(), dl: null };

function ocNorm(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function ocLabel(g) {
  const r = OC_BY[g];
  if (!r) return g;
  return r[2] === r[3] ? r[2] : r[3] + " · " + r[2];
}
function ocrLoad(s) {
  if (s.ocrFrom === "auto" || (OC_BY[s.ocrFrom] && OC_BY[s.ocrFrom][1])) ocr.from = s.ocrFrom;
  // the To language is always set: the last one used, else the language of the popup
  ocr.to = OC_BY[s.ocrTo] ? s.ocrTo : { en: "en", ar: "ar", es: "es", in: "hi", ur: "ur", pt: "pt", ru: "ru", zh: "zh-CN" }[s.lang] || "en";
  if (s.ocrRes && typeof s.ocrRes === "object") ocr.res = s.ocrRes;
  if (Array.isArray(s.ocrHist)) ocr.hist = s.ocrHist;
  ocr.busy = !!s.ocrBusy && Date.now() - s.ocrBusy < 90000;
  ocr.retr = s.ocrRetr && Date.now() - s.ocrRetr.ts < 60000 ? s.ocrRetr : null;
}
function ocSave() {
  chrome.storage.local.set({ ocrFrom: ocr.from, ocrTo: ocr.to });
}
function ocNote(txt) {
  const n = $("#ocnote");
  if (n) n.textContent = txt || "";
}
function renderOcr() {
  if (!$("#ocfrom")) return;
  const fv = $("#ocfrom .ov");
  fv.textContent = ocr.from === "auto" ? t("ocrAutoShort") : ocLabel(ocr.from);
  const tv = $("#octo .ov");
  tv.textContent = ocr.to ? ocLabel(ocr.to) : t("ocrPick");
  tv.classList.toggle("ph", !ocr.to);
  $("#ocgo").disabled = !ocr.to || ocr.busy || !!ocr.dl;
  $("#ocswap").disabled = ocr.from === "auto" || !ocr.to || !(OC_BY[ocr.to] && OC_BY[ocr.to][1]);
  $("#ocgo span").textContent = ocr.busy ? t("ocrBusy") : t("ocrSelect");
  if (ocr.dl) {
    $("#ocnote").dataset.keep = "";
    ocNote(t("ocrDl") + " " + OC_BY[ocr.dl.g][2] + " " + Math.round(ocr.dl.pct * 100) + "%");
  } else if (ocr.busy) ocNote("");
  else if (!$("#ocnote").dataset.keep) ocNote("");
  const r = ocr.res;
  $("#ocres").hidden = !r;
  if (r) {
    const showTr = ocr.view === "tr";
    $("#octr").classList.toggle("on", showTr);
    $("#ocor").classList.toggle("on", !showTr);
    const box = $("#octext");
    const txt = showTr ? r.tr : r.orig;
    box.classList.toggle("err", showTr && !!r.err);
    if (ocr.retr && Date.now() - ocr.retr.ts > 60000) ocr.retr = null;
    const retr = showTr && !!ocr.retr;
    box.parentElement.classList.toggle("retr", retr);
    const pg = $("#ocprog");
    pg.hidden = !retr;
    if (retr) {
      const many = ocr.retr.total > 1;
      pg.classList.toggle("ind", !many);
      pg.firstElementChild.style.setProperty("--p", many ? Math.max(8, Math.round((ocr.retr.done / ocr.retr.total) * 100)) + "%" : "35%");
    }
    box.textContent = showTr && r.err ? t("ocrNetFail") : txt;
    const code = showTr ? r.to : r.src;
    box.dir = code && OC_RTL.has(code) ? "rtl" : code ? "ltr" : "auto";
    $("#occopy").hidden = showTr && !!r.err;
    const pill = $("#ocpill");
    pill.textContent = (r.auto ? t("ocrDetected") : t("ocrFromPill")) + ": " + (OC_BY[r.src] ? OC_BY[r.src][2] : r.src || "?");
    pill.hidden = !r.src;
    const ln = r.orig.split("\n").filter(Boolean).length || 1;
    $("#oclines").textContent = ln + " " + t(ln === 1 ? "ocrLine" : "ocrLines");
  }
  renderOcHist();
}
function renderOcHist() {
  const box = $("#ochist");
  if (!box || box.hidden) return;
  box.textContent = "";
  if (!ocr.hist.length) {
    const e = document.createElement("div");
    e.className = "oc-empty";
    e.textContent = t("ocrHistEmpty");
    box.appendChild(e);
    return;
  }
  ocr.hist.forEach((h) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "oc-h";
    const a = document.createElement("span");
    a.textContent = (h.tr || h.orig).replace(/\s+/g, " ").slice(0, 60);
    a.dir = "auto";
    const z = document.createElement("span");
    z.textContent = (h.to || "").toUpperCase();
    b.append(a, z);
    b.addEventListener("click", () => {
      ocr.res = h;
      ocr.view = "tr";
      renderOcr();
    });
    box.appendChild(b);
  });
  const c = document.createElement("button");
  c.type = "button";
  c.className = "oc-hclear";
  c.textContent = t("ocrClear");
  c.addEventListener("click", () => {
    ocr.hist = [];
    chrome.storage.local.set({ ocrHist: [] });
    renderOcHist();
  });
  box.appendChild(c);
}
function ocOpen(which) {
  if (ocr.pick === which) return ocClose();
  ocr.pick = which;
  $("#ocfrom").setAttribute("aria-expanded", String(which === "from"));
  $("#octo").setAttribute("aria-expanded", String(which === "to"));
  $("#ocmenu").hidden = false;
  if (which === "from") OCRDATA.cached().then((h) => { ocr.have = h; if (ocr.pick === "from") ocList(true); });
  const q = $("#ocsearch");
  q.value = "";
  ocList();
  q.focus();
}
function ocClose() {
  ocr.pick = null;
  $("#ocmenu").hidden = true;
  $("#ocfrom").setAttribute("aria-expanded", "false");
  $("#octo").setAttribute("aria-expanded", "false");
}
function ocList(keepHl) {
  const hl0 = keepHl ? ocr.hl : 0;
  const q = ocNorm($("#ocsearch").value.trim());
  const from = ocr.pick === "from";
  const items = [];
  if (from && (!q || ocNorm(t("ocrAuto")).includes(q) || "auto".includes(q))) items.push({ g: "auto" });
  OCR_TABLE.forEach((r) => {
    if (from && !r[1]) return;
    if (q && !(ocNorm(r[2]).includes(q) || ocNorm(r[3]).includes(q) || ocNorm(r[0]) === q)) return;
    items.push({ g: r[0] });
  });
  // names that start with the query come first
  if (q) items.sort((a, b) => {
    const s = (x) => (x.g !== "auto" && (ocNorm(OC_BY[x.g][2]).startsWith(q) || ocNorm(OC_BY[x.g][3]).startsWith(q)) ? 0 : 1);
    return s(a) - s(b);
  });
  ocr.items = items;
  ocr.hl = Math.min(hl0, Math.max(0, items.length - 1));
  const box = $("#oclist");
  box.textContent = "";
  if (!items.length) {
    const e = document.createElement("div");
    e.className = "oc-none";
    e.textContent = t("ocrNoMatch");
    box.appendChild(e);
    return;
  }
  const cur = from ? ocr.from : ocr.to;
  items.forEach((it, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "option");
    b.className = "oc-opt" + (i === ocr.hl ? " hl" : "") + (it.g === cur ? " sel" : "");
    const nm = document.createElement("span");
    nm.className = "nm";
    const sm = document.createElement("small");
    if (it.g === "auto") nm.textContent = t("ocrAuto");
    else {
      const r = OC_BY[it.g];
      nm.textContent = r[3];
      nm.dir = "auto";
      const need = from && r[1] && !OCRDATA.bundled.has(r[1]) && !ocr.have.has(r[1]);
      sm.textContent = (r[3] !== r[2] ? r[2] : "") + (need ? (r[3] !== r[2] ? "  " : "") + "\u2193 " + (OCR_DATA[r[1]][0] / 1048576).toFixed(1) + " MB" : "");
    }
    b.append(nm, sm);
    b.addEventListener("click", () => ocPick(it.g));
    b.addEventListener("mousemove", () => ocHl(i));
    box.appendChild(b);
  });
}
function ocHl(i) {
  const opts = document.querySelectorAll("#oclist .oc-opt");
  if (!opts.length) return;
  ocr.hl = Math.max(0, Math.min(opts.length - 1, i));
  opts.forEach((o, k) => o.classList.toggle("hl", k === ocr.hl));
  opts[ocr.hl].scrollIntoView({ block: "nearest" });
}
async function ocDownload(g, l) {
  ocr.dl = { g, pct: 0 };
  renderOcr();
  try {
    await OCRDATA.ready(l, (p) => { ocr.dl.pct = p; renderOcr(); });
    ocr.have.add(l);
    ocr.from = g;
    ocSave();
    ocr.dl = null;
    $("#ocnote").dataset.keep = "";
  } catch {
    ocr.dl = null;
    $("#ocnote").dataset.keep = "1";
    renderOcr();
    ocNote(t("ocrNetFail"));
    return;
  }
  renderOcr();
}
function ocPick(g) {
  if (ocr.pick === "from" && g !== "auto") {
    const l = OC_BY[g][1];
    if (!OCRDATA.bundled.has(l) && !ocr.have.has(l)) {
      ocClose();
      ocDownload(g, l);
      return;
    }
  }
  const was = ocr.pick;
  if (ocr.pick === "from") ocr.from = g;
  else ocr.to = g;
  ocClose();
  ocSave();
  $("#ocnote").dataset.keep = "";
  renderOcr();
  // a result is already on screen: translate the same text again into the new language
  if (was === "to" && ocr.res && ocr.res.orig && g !== ocr.res.to) ocRetranslate(g);
}
async function ocRetranslate(g) {
  let ok = false;
  try {
    ok = await chrome.permissions.contains({ origins: [OC_GT] });
    if (!ok) ok = await chrome.permissions.request({ origins: [OC_GT] });
  } catch {}
  if (!ok) {
    $("#ocnote").dataset.keep = "1";
    ocNote(t("ocrPermDeny"));
    return;
  }
  ocr.view = "tr";
  ocr.retr = { to: g, done: 0, total: 1, ts: Date.now() };
  renderOcr();
  chrome.runtime.sendMessage({ type: "ocr-retr", to: g }).catch(() => {
    ocr.retr = null;
    renderOcr();
  });
}
async function ocCopy() {
  const r = ocr.res;
  if (!r) return;
  const txt = ocr.view === "tr" ? r.tr : r.orig;
  try {
    await navigator.clipboard.writeText(txt);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch {}
    ta.remove();
  }
  const s = $("#occopy span");
  s.textContent = t("ocrCopied");
  setTimeout(() => (s.textContent = t("ocrCopy")), 1100);
}
async function ocGo() {
  if (tabId == null || !ocr.to) return;
  let ok = false;
  try {
    ok = await chrome.permissions.contains({ origins: [OC_GT] });
    if (!ok) ok = await chrome.permissions.request({ origins: [OC_GT] });
  } catch {}
  if (!ok) {
    $("#ocnote").dataset.keep = "1";
    ocNote(t("ocrPermDeny"));
    return;
  }
  const strs = { label: t("ocrDrag"), cancel: t("ocrCancel"), reading: t("ocrBusy"), none: t("ocrNone"), fail: t("ocrFail"), netfail: t("ocrNetFail") };
  chrome.runtime.sendMessage({ type: "ocr-start", mode: "tr", tabId, from: ocr.from, to: ocr.to, lang, strs }).finally(() => window.close());
}
(function ocWire() {
  $("#ocfrom").addEventListener("click", () => ocOpen("from"));
  $("#octo").addEventListener("click", () => ocOpen("to"));
  $("#ocsearch").addEventListener("input", ocList);
  $("#ocsearch").addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); ocHl(ocr.hl + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); ocHl(ocr.hl - 1); }
    else if (e.key === "Enter") { e.preventDefault(); const it = ocr.items[ocr.hl]; if (it) ocPick(it.g); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); ocClose(); }
  });
  document.addEventListener("mousedown", (e) => {
    if (ocr.pick && !e.target.closest("#ocmenu, #ocfrom, #octo")) ocClose();
  });
  $("#ocswap").addEventListener("click", () => {
    const a = ocr.from, b = ocr.to;
    if (a === "auto" || !b || !(OC_BY[b] && OC_BY[b][1])) return;
    ocr.from = b;
    ocr.to = a;
    ocSave();
    renderOcr();
  });
  $("#octr").addEventListener("click", () => { ocr.view = "tr"; renderOcr(); });
  $("#ocor").addEventListener("click", () => { ocr.view = "or"; renderOcr(); });
  $("#occopy").addEventListener("click", ocCopy);
  $("#ocgo").addEventListener("click", ocGo);
  $("#ochistbtn").addEventListener("click", () => {
    const box = $("#ochist");
    box.hidden = !box.hidden;
    $("#ochistbtn").setAttribute("aria-expanded", String(!box.hidden));
    renderOcHist();
  });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local") return;
    if (ch.ocrRes && ch.ocrRes.newValue) { ocr.res = ch.ocrRes.newValue; ocr.view = "tr"; }
    if (ch.ocrHist && Array.isArray(ch.ocrHist.newValue)) ocr.hist = ch.ocrHist.newValue;
    if (ch.ocrBusy) ocr.busy = !!ch.ocrBusy.newValue;
    if ("ocrRetr" in ch) ocr.retr = ch.ocrRetr.newValue || null;
    renderOcr();
  });
})();

/* ---------- Sketch: color picker ---------- */
let pcolNow = null;
function pcolShow(c) {
  if (!$("#pcolres")) return;
  if (!c || !c.hex) return;
  pcolNow = c;
  $("#pcsw").hidden = false;
  $("#pcsw").style.background = c.hex;
  $("#pchex").removeAttribute("data-i18n");
  $("#pchex").textContent = c.hex;
  $("#pcolres").title = c.rgb;
  $("#pccopy").hidden = false;
}
$("#pcol").addEventListener("click", () => {
  if (tabId == null) return;
  const strs = { label: t("colClick"), cancel: t("ocrCancel"), fail: t("ocrFail") };
  chrome.runtime.sendMessage({ type: "col-start", tabId, strs }).finally(() => window.close());
});
$("#pccopy").addEventListener("click", async () => {
  if (!pcolNow) return;
  try { await navigator.clipboard.writeText(pcolNow.hex); } catch {
    const ta = document.createElement("textarea");
    ta.value = pcolNow.hex;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch {}
    ta.remove();
  }
  $("#pccopy").style.color = "var(--accent)";
  setTimeout(() => ($("#pccopy").style.color = ""), 1100);
});
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === "local" && ch.pcol) pcolShow(ch.pcol.newValue);
});

init().finally(() => document.documentElement.classList.remove("pending"));
