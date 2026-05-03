// Generates store/screenshot-1280x800.png — a browser-window mockup
// showing the extension popup open in context.
//
// Run from the project root: node scripts/screenshot.js
// Requires: npm install && npx playwright install chromium

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const TMP  = path.join(ROOT, '_screenshot_tmp.html');
const OUT  = path.join(ROOT, 'store', 'screenshot-1280x800.png');

// ─── Extract pieces from popup.html ──────────────────────────────────────────
const popupSrc = fs.readFileSync(path.join(ROOT, 'popup.html'), 'utf8');

const styleMatch = popupSrc.match(/<style>([\s\S]*?)<\/style>/);
const popupStyles = styleMatch ? styleMatch[1] : '';

const bodyMatch = popupSrc.match(/<body>([\s\S]*?)<\/body>/);
const popupBody = bodyMatch
  ? bodyMatch[1].replace(/<script src="popup\.js"><\/script>/, '').trim()
  : '';

// ─── Build mockup HTML ────────────────────────────────────────────────────────
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

  /* ── Browser window ── */
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

  /* ── Toolbar ── */
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
    width: 26px;
    height: 26px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(79,70,229,0.35);
    flex-shrink: 0;
  }

  .ext-btn img { width: 100%; height: 100%; display: block; }

  /* ── Page skeleton ── */
  .page {
    flex: 1;
    background: #f8f9fa;
    padding: 40px 64px;
    position: relative;
  }

  .sk { background: #e2e5e9; border-radius: 4px; margin-bottom: 10px; }

  /* ── Popup floating ── */
  .popup-wrap {
    position: absolute;
    top: 8px;
    right: 14px;
    z-index: 10;
  }

  /* Caret pointing up toward ext-btn */
  .popup-wrap::before {
    content: '';
    position: absolute;
    top: -7px;
    right: 8px;
    border: 7px solid transparent;
    border-top: 0;
    border-bottom-color: #d1d5db;
  }

  .popup-wrap::after {
    content: '';
    position: absolute;
    top: -6px;
    right: 9px;
    border: 6px solid transparent;
    border-top: 0;
    border-bottom-color: #ffffff;
  }

  .popup-card {
    width: 300px;
    background: #fff;
    border-radius: 8px;
    border: 1px solid #d1d5db;
    box-shadow: 0 6px 28px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.08);
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    color: #111827;
  }

  /* ── Popup component styles (verbatim from popup.html) ── */
  ${popupStyles}

  /* Neutralise the body-level width that popup.html sets */
  body { width: unset; }
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
        <span>github.com/xavierzip/chrome-history-digest</span>
      </div>
      <div class="ext-btn">
        <img src="icons/icon48.png" alt="">
      </div>
    </div>

    <div class="page">
      <!-- Skeleton page content -->
      <div class="sk" style="width:320px;height:26px;margin-bottom:18px"></div>
      <div class="sk" style="width:91%"></div>
      <div class="sk" style="width:84%"></div>
      <div class="sk" style="width:96%"></div>
      <div class="sk" style="width:77%;margin-bottom:22px"></div>
      <div class="sk" style="width:240px;height:17px;margin-bottom:12px"></div>
      <div class="sk" style="width:89%"></div>
      <div class="sk" style="width:93%"></div>
      <div class="sk" style="width:68%"></div>

      <!-- Extension popup -->
      <div class="popup-wrap">
        <div class="popup-card">
          ${popupBody}
        </div>
      </div>
    </div>
  </div>

  <script>
    // Stub Chrome APIs so popup.js initialises without errors
    window.chrome = {
      storage: { local: {
        get: (_defaults, cb) => cb({ folder: 'obsidian-inbox', format: 'md' }),
        set: () => {}
      }},
      history:   { search: () => Promise.resolve([]), getVisits: () => Promise.resolve([]) },
      downloads: { download: () => Promise.resolve(1) }
    };
  </script>
  <script src="popup.js"></script>
</body>
</html>`;

// ─── Take screenshot ──────────────────────────────────────────────────────────
(async () => {
  fs.writeFileSync(TMP, html);

  const browser = await chromium.launch();
  const page    = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto('file://' + TMP);
  await page.waitForTimeout(400); // let fonts and images settle

  await page.screenshot({ path: OUT });
  console.log('Saved:', OUT);

  await browser.close();
  fs.unlinkSync(TMP);
})();
