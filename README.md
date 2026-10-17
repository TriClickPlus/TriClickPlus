# TriClick+

Auto clicker, auto scroller and on-screen text reader (OCR) for Chrome. Free and ad-free.

- Chrome Web Store: https://chromewebstore.google.com/detail/triclick-auto-clicker-scr/cjaihgphajfbnfclcfabngngdpflhlih
- Support: https://ko-fi.com/triclick
- Contact: chromedeveloper1@gmail.com (questions, bug reports, anything else)

## What it does

- **Sequence**: click points one after another, with a delay for each.
- **Simultaneous**: click one point as fast as you set it.
- **Scroll**: scroll up and down for a set time.
- **OCR**: drag over any text on the screen, read it on your device, and translate it with Google Translate.
- **Sketch**: draw a shape or an image with the mouse, and pick a color from the page.
- Extras: key presses, typed text, on-screen keyboard, reload until a target is found.
- Interface languages: English, Arabic, Chinese, Hindi, Portuguese, Russian, Spanish, Urdu.

## Permissions

| Permission | Why |
|---|---|
| `activeTab`, `scripting` | Run the clicker on the tab you are using, and show the area and color pickers. |
| `storage` | Keep your settings and OCR history on your device. |
| `offscreen` | Run the OCR engine in a background page. |
| Access to all sites (optional, asked only if you allow it) | Lets key presses reach games and apps inside frames. |
| `https://translate.googleapis.com/*` (optional, asked on first translation) | Send the recognized text to Google Translate. |

Host access is optional, so there is no install warning. Nothing is requested until you use the feature that needs it.

## Network use

TriClick has no account, no analytics and no server of its own. These are the only network requests:

- **OCR**: the screenshot is read on your device and is never uploaded.
- **Translate** (OCR tab): the recognized text is sent to `translate.googleapis.com`.
- **OCR language data**: English, Arabic, Spanish, Hindi, Urdu, Portuguese, Russian and Chinese (Simplified) ship in the package. Other languages are downloaded once from `raw.githubusercontent.com/tesseract-ocr/tessdata_fast` (a pinned commit, checked against a SHA-256) and cached on your device. GitHub sees your IP address for that request.
- **Sketch search**: the word you type is sent to Iconify, Wikimedia Commons, Openverse, the Art Institute of Chicago and the Cleveland Museum of Art to find outlines to draw.
- **Color picker**: takes a screenshot of the visible tab to show the magnifier and read the color, on your device. It is never uploaded.

## Run it from source

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.

There is no build step.

## Layout

| File | Role |
|---|---|
| `manifest.json` | Extension manifest (MV3) |
| `popup.html`, `popup.css`, `popup.js` | The popup UI |
| `i18n.js` | Interface strings for every language |
| `content.js`, `frame.js` | Clicker, scroller and key presses inside pages and frames |
| `background.js` | Service worker: OCR, translation, color picker, reload-and-resume |
| `ocr-select.js`, `col-pick.js` | Area picker and color picker overlays |
| `offscreen.html`, `offscreen.js`, `ocr/` | On-device OCR (Tesseract compiled to WebAssembly) |
| `ocrlangs.js`, `ocrdata.js` | OCR language table, hashes and the download and cache logic |
| `vocab.js` | Word list that fixes typos in the Sketch search |

## License

MIT, see [LICENSE](LICENSE). Third-party components keep their own licenses, see [THIRD-PARTY.txt](THIRD-PARTY.txt).
