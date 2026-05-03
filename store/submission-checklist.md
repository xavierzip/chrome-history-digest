# Chrome Web Store Submission Checklist

## Code
- [x] Manifest V3
- [x] Icons: 16×16, 48×48, 128×128 PNG (`icons/`)
- [x] Privacy policy page (`privacy.html`) — host on GitHub Pages or similar
- [x] Single purpose, clearly stated
- [x] Permissions justified (history, downloads, storage)

## Store Listing (fill in at submit time)
- [ ] **Name**: History Digest
- [ ] **Short description** (≤132 chars): Export your daily Chrome history as Markdown or JSON — deduped, noise-filtered, ready for Obsidian.
- [ ] **Long description**: see `store/description.txt`
- [ ] **Category**: Productivity
- [ ] **Primary language**: English
- [x] **Privacy policy URL**: https://xavierzip.github.io/chrome-history-digest/privacy.html
- [x] **Homepage URL**: https://github.com/xavierzip/chrome-history-digest

## Screenshots (required — create manually)
- [ ] At least 1 screenshot at 1280×800 or 640×400
  - Suggested: popup open showing the export UI
  - Suggested: sample exported Markdown file in a text editor
- [ ] Promotional tile 440×280 (optional but recommended)

## Final checks before submit
- [ ] Load unpacked, test full export flow (both MD and JSON)
- [ ] Test with date that has no history — confirm "No matching history" message
- [ ] Test empty date field — confirm validation error shown
- [ ] Test folder path with `../` — confirm it's sanitized
- [ ] Bump version in manifest.json from 0.1.0 to 1.0.0
