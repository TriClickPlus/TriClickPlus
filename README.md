# TriClick+

Auto clicker, auto scroller and on-screen text reader (OCR) for Chrome. Free and ad-free.

- Chrome Web Store: https://chromewebstore.google.com/detail/triclick-auto-clicker-scr/cjaihgphajfbnfclcfabngngdpflhlih
- Contact: chromedeveloper1@gmail.com (questions, bug reports, anything else)

## What it does

- **Sequence**: click points one after another, with a delay for each.
- **Simultaneous**: click one point as fast as you set it.
- **Scroll**: scroll up and down for a set time.
- **OCR**: drag over any text on the screen, read it on your device, and translate it with Google Translate.
- **Sketch**: draw a shape or an image with the mouse, and pick a color from the page.
- Extras: key presses, typed text, on-screen keyboard, reload until a target is found.
- Interface languages: English, Arabic, Chinese, Hindi, Portuguese, Russian, Spanish, Urdu.

## How to use

Open the page you want to work on, then click the TriClick+ icon in the toolbar. The popup has five tabs: Sequence, Simultaneous, Scroll, OCR and Sketch. Your settings and click points are saved, and click points are remembered per page. Press **Esc** at any time to cancel a picker or stop a run. TriClick does not work on `chrome://` pages or the Chrome Web Store itself, so use it on a regular website.

### Setting a click point (Sequence and Simultaneous)

1. Press **Set** next to a click. The popup closes.
2. Click anywhere on the page. That spot is saved as the click point. Esc cancels.
3. Open the popup again. The button now says **Relocate**, and you can press it to move the point.

### Sequence

Runs up to 10 clicks one after another, each with its own delay.

1. Open the **Sequence** tab and use **+** and **−** to add or remove clicks.
2. Press **Set** on each row and click its spot on the page.
3. Type a **delay** for each row. The click waits that long, then fires. The default is 3 seconds. Press the unit label next to the box to switch between seconds (s) and minutes (m).
4. Optional: rename a click by editing its name, and press the dot on a row to start the sequence from that click.
5. Tick **Repeat the sequence** to loop it. A counter shows how many times it has run.
6. Press **Start**. Press **Stop** (or Esc) to end it.

Changing a time while the sequence is running takes effect right away. **Reset Times** puts every delay back to the default, and **Reset Points** clears all click points.

**Settings (gear icon).**
- **Hold click: Yes** adds a **Hold** box to every row, so each click is held down for that many seconds instead of tapping.
- **Scalping: Yes** lets each click aim at a **Point** (a fixed spot), an **Element** (a button or link) or **Text** (any text on the page). Choose the type on the row, press Set, and click the thing you want. The target is looked up again before every click, so it still works if the page moves around or changes.
- **Reload until found** appears when Scalping is on. Type a number of seconds, and if the first target is not on the page yet, TriClick reloads the page every that many seconds until it shows up, then starts the sequence.

### Simultaneous

Clicks one spot as fast as you set.

1. Open the **Simultaneous** tab.
2. Press **Set** next to **Click point** and click the spot on the page.
3. Type how many **clicks/sec** you want (1 to 1,000, default 5).
4. Press **Start**, and **Stop** or Esc to end it.

The popup shows the running time and the click count. Each click lands a few pixels off the exact point, never on the same pixel twice. A page can only count what it accepts, so a page with a heavy click handler may register fewer clicks than TriClick sends.

### Scroll

Scrolls the page up and then down, on repeat if you want.

1. Open the **Scroll** tab.
2. Set the seconds for **Scroll up** and **Scroll down**. A direction set to 0 is skipped. The infinity button next to a box removes the time limit for that direction.
3. Choose **Slow**, **Normal** or **Fast**.
4. Tick **Repeat** to loop, then press **Start**. TriClick scrolls up first, then down.

**Reset Times** returns both boxes to 3 seconds.

### OCR

Reads text off the screen and, if you want, translates it. It works on anything you can see on the page, including images and videos.

1. Open the **OCR** tab.
2. Pick the **To** language (required, the language you want the result in). **From** is optional: leave it on **Auto-detect**, or choose the language of the text to read it more accurately. The swap button flips the two.
3. Press **Select area to read**. The popup closes.
4. Drag a box over the text on the page. Esc cancels.
5. Open the popup again. The result shows under **Translation** and **Original**, with the detected language and the number of lines. Press **Copy** to copy the text.
6. **History** keeps your past reads. **Clear** empties it.

English, Arabic, Spanish, Hindi, Urdu, Portuguese, Russian and Chinese (Simplified) are built in. Any other language downloads once, then stays on your device. The screenshot is read on your device and never uploaded. Only the recognized text is sent to Google Translate when you ask for a translation.

### Sketch (beta)

Draws with your mouse for you. It has three ways to make a drawing, plus a color picker.

**Simulate (your own drawing)**
1. Open the **Sketch** tab and press **Simulate**.
2. Hold the mouse button and move over the page. Let go to save the sketch.
3. Choose **Slow**, **Normal** or **Fast**. The infinity button repeats it forever.
4. Press **Start** to replay it. Moving the real mouse onto the page does not disturb the drawing, and pressing on the page or **Stop** gives control back.

**Search something to draw**
1. Type a word, or a phrase like "cat on a hill", and press **Search**.
2. Pick an outline. Press **More** for a new set. If nothing shows, try another word in English.
3. Drag a box on the page where the drawing should go.
4. TriClick draws it. Pictures come from open-license and public domain collections.

**Draw from an image**
1. Press **or use your own image** and choose a file from your computer.
2. Drag a box on the page where the drawing should go. TriClick traces the lines and draws them. The image never leaves your device.

**Color picker.** Press the dropper icon, then click any color on the page while the magnifier follows your cursor. The color shows in the Sketch tab as a swatch and a hex code, and the copy button copies the hex.

### Keyboard (key presses and typed text)

Presses keys and types text on a timer, one row at a time.

1. In the **Sequence** tab, press the keyboard icon to open the keyboard view.
2. Use **+** and **−** to set the number of rows.
3. For each row, press its key button to select it, then press a key on the on-screen keyboard or your own keyboard to bind it. Press the same key again to unbind it.
4. Optional: press **Set** to choose a spot on the page that the row clicks first (useful to focus a game or a text box).
5. Set the **delay** (wait before the row runs) and the **Hold** (how long the key stays down).
6. To type text after a click, press the text button (the "Read text from screen" icon) in the keyboard view to open the text section. Press **+** to add a text row, choose which click it belongs to, and type the text. Or press the capture icon and drag over text on the page to read it into the row. Choose **Instant** to type it all at once or **Normal** to type it like a person.
7. Tick **Repeat the sequence** to loop, then press **Start**.

The keyboard view has its own language menu for the on-screen layout (English, Arabic, Spanish, Hindi, Portuguese, Russian, Urdu and Chinese) and a toggle to hide the on-screen keyboard. Key presses reach games and editors inside frames only if you allow access to all sites when asked. If you press Not now, everything else still works.

### Language and theme

The language menu at the top right switches the interface between English, Arabic, Spanish, Hindi, Portuguese, Russian, Urdu and Chinese. The button next to it switches between light and dark.

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
