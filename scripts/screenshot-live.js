// Generates store/screenshot-1280x800.png by:
//   1. Loading the extension into real Chromium
//   2. Screenshotting google.com as the background page
//   3. Screenshotting the extension popup
//   4. Compositing them into a browser-window mockup
//
// Run: node scripts/screenshot-live.js

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT           = path.resolve(__dirname, '..');
const EXTENSION_PATH = ROOT;
const TMP            = path.join(ROOT, '_live_tmp.html');
const OUT            = path.join(ROOT, 'store', 'screenshot-1280x800.png');

// ── 1. Launch Chromium with the extension loaded ──────────────────────────────
async function launch() {
  return chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--window-size=1280,900',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
}

// ── 2. Get extension ID from chrome://extensions shadow DOM ───────────────────
async function getExtensionId(context) {
  const page = await context.newPage();
  await page.goto('chrome://extensions/');
  await page.waitForTimeout(800);

  const id = await page.evaluate(() => {
    const manager = document.querySelector('extensions-manager');
    if (!manager?.shadowRoot) return null;

    // Try item-list first (Chrome 100+)
    const itemList = manager.shadowRoot.querySelector('extensions-item-list');
    if (itemList?.shadowRoot) {
      const items = itemList.shadowRoot.querySelectorAll('extensions-item');
      for (const item of items) {
        const v = item.getAttribute('id') || item.id;
        if (v && v.length === 32) return v;
      }
    }

    // Fallback: scan all shadow roots for 32-char IDs
    function walk(root) {
      if (!root) return null;
      for (const el of root.querySelectorAll('*')) {
        const v = el.getAttribute('id') || el.id;
        if (v && /^[a-p]{32}$/.test(v)) return v;
        if (el.shadowRoot) {
          const found = walk(el.shadowRoot);
          if (found) return found;
        }
      }
      return null;
    }
    return walk(manager.shadowRoot);
  });

  await page.close();
  return id;
}

// ── 3. Screenshot google.com page content ────────────────────────────────────
async function screenshotGoogle(context) {
  const page = await context.newPage();
  // Page content area inside our browser mockup: 1192 × 712
  await page.setViewportSize({ width: 1192, height: 712 });
  await page.goto('https://www.google.com', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(600);
  const buf = await page.screenshot();
  await page.close();
  return buf.toString('base64');
}

// ── 4. Screenshot the extension popup ────────────────────────────────────────
async function screenshotPopup(context, extensionId) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 300, height: 500 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.waitForTimeout(600);
  const buf = await page.screenshot({ fullPage: true });
  await page.close();
  return buf.toString('base64');
}

// ── 5. Build composite and screenshot ────────────────────────────────────────
async function composite(googleB64, popupB64) {
  const iconB64 = fs.readFileSync(path.join(ROOT, 'icons', 'icon48.png')).toString('base64');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    width: 1280px;
    height: 800px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: linear-gradient(145deg, #1e1b4b 0%, #3730a3 55%, #1e3a8a 100%);
  }

  .browser {
    position: absolute;
    inset: 36px 44px;
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 48px 120px rgba(0,0,0,0.55);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* toolbar */
  .toolbar {
    height: 44px;
    background: #ececec;
    border-bottom: 1px solid #d4d4d4;
    display: flex;
    align-items: center;
    padding: 0 14px;
    gap: 12px;
    flex-shrink: 0;
  }

  .tls { display: flex; gap: 6px; }
  .tl  { width: 12px; height: 12px; border-radius: 50%; }
  .tl-r { background: #ff5f57; }
  .tl-y { background: #febc2e; }
  .tl-g { background: #28c840; }

  .omnibox {
    flex: 1;
    height: 27px;
    background: #fff;
    border: 1px solid #d0d0d0;
    border-radius: 14px;
    display: flex;
    align-items: center;
    padding: 0 10px;
    gap: 5px;
    font-size: 12px;
    color: #3c4043;
    max-width: 540px;
    margin: 0 auto;
  }

  .lock { font-size: 10px; color: #188038; }

  .ext-btn {
    width: 26px; height: 26px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(79,70,229,0.45);
    flex-shrink: 0;
    box-shadow: 0 0 0 2px rgba(79,70,229,0.15);
  }
  .ext-btn img { width: 100%; height: 100%; display: block; }

  /* page area */
  .page {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  .page > img.bg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top left;
    display: block;
  }

  /* popup float */
  .popup-wrap {
    position: absolute;
    top: 8px;
    right: 14px;
    z-index: 10;
    filter: drop-shadow(0 8px 32px rgba(0,0,0,0.18));
  }

  /* caret */
  .popup-wrap::before {
    content: '';
    position: absolute;
    top: -7px; right: 8px;
    border: 7px solid transparent;
    border-top: 0;
    border-bottom-color: #d1d5db;
  }
  .popup-wrap::after {
    content: '';
    position: absolute;
    top: -6px; right: 9px;
    border: 6px solid transparent;
    border-top: 0;
    border-bottom-color: #ffffff;
  }

  .popup-wrap img {
    display: block;
    width: 300px;
    border-radius: 8px;
    border: 1px solid #d1d5db;
  }
</style>
</head>
<body>
  <div class="browser">
    <div class="toolbar">
      <div class="tls">
        <div class="tl tl-r"></div>
        <div class="tl tl-y"></div>
        <div class="tl tl-g"></div>
      </div>
      <div class="omnibox">
        <span class="lock">🔒</span>
        <span>google.com</span>
      </div>
      <div class="ext-btn">
        <img src="data:image/png;base64,${iconB64}" alt="">
      </div>
    </div>

    <div class="page">
      <img class="bg" src="data:image/png;base64,${googleB64}" alt="">

      <div class="popup-wrap">
        <img src="data:image/png;base64,${popupB64}" alt="">
      </div>
    </div>
  </div>

  <script>
    // no JS needed — all content is static base64 images
  </script>
</body>
</html>`;

  fs.writeFileSync(TMP, html);

  const browser = await chromium.launch();
  const page    = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('file://' + TMP);
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT });
  await browser.close();

  fs.unlinkSync(TMP);
  console.log('Saved:', OUT);
}

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  const context = await launch();

  console.log('Getting extension ID...');
  const extensionId = await getExtensionId(context);
  if (!extensionId) throw new Error('Could not find extension ID in chrome://extensions');
  console.log('Extension ID:', extensionId);

  console.log('Screenshotting google.com...');
  const googleB64 = await screenshotGoogle(context);

  console.log('Screenshotting popup...');
  const popupB64 = await screenshotPopup(context, extensionId);

  await context.close();

  console.log('Compositing...');
  await composite(googleB64, popupB64);
})();
