/*
 * TriClick OCR worker. Runs Tesseract (tesseract.js-core, Apache-2.0) on-device.
 * The calling sequence follows tesseract.js's worker script (Apache-2.0).
 * See THIRD-PARTY.txt for licences.
 */
importScripts("core.js", "../ocrlangs.js", "../ocrdata.js");

let mod = null;
let api = null;
let loaded = "";
const have = new Set();

let job = 0; // id of the request being worked on, for progress messages

async function ensure(langs) {
  if (!mod) mod = await TesseractCore({ TesseractProgress: (p) => job && postMessage({ id: job, prog: { rec: p } }) });
  const list = langs.split("+");
  for (const l of list) {
    if (have.has(l)) continue;
    const id = job;
    mod.FS.writeFile(`./${l}.traineddata`, new Uint8Array(await OCRDATA.load(l, (f) => postMessage({ id, prog: { dl: f } }))));
    have.add(l);
  }
  if (api && loaded === langs) return;
  if (api) api.End();
  api = new mod.TessBaseAPI();
  // 1 = LSTM only
  if (api.Init(null, langs, 1) === -1) throw new Error("init failed");
  api.SetVariable("tessedit_pageseg_mode", "6");
  api.SetVariable("user_defined_dpi", "300");
  loaded = langs;
}

onmessage = async (e) => {
  const { id, langs, image } = e.data;
  job = id;
  try {
    await ensure(langs);
    mod.FS.writeFile("/input", image);
    if (api.SetImageFile(1, 0) === 1) throw new Error("bad image");
    api.Recognize(null);
    const text = api.GetUTF8Text();
    let conf = -1;
    try { conf = api.MeanTextConf(); } catch {}
    job = 0;
    postMessage({ id, ok: true, text: text || "", conf });
  } catch (err) {
    job = 0;
    postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
