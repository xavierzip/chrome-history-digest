const dateInput     = document.getElementById('date');
const minVisitsInput = document.getElementById('minVisits');
const maxItemsInput  = document.getElementById('maxItems');
const folderInput    = document.getElementById('folder');
const exportBtn      = document.getElementById('export');
const statusEl       = document.getElementById('status');
const formatToggle   = document.getElementById('formatToggle');

let currentFormat = 'md';

dateInput.value = localISODate(new Date());

chrome.storage.local.get({ folder: 'obsidian-inbox', format: 'md' }, ({ folder, format }) => {
  folderInput.value = folder;
  setFormat(format);
});

formatToggle.addEventListener('click', e => {
  const btn = e.target.closest('.seg-btn');
  if (!btn) return;
  setFormat(btn.dataset.fmt);
  chrome.storage.local.set({ format: currentFormat });
});

function setFormat(fmt) {
  currentFormat = fmt;
  formatToggle.querySelectorAll('.seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.fmt === fmt);
  });
}

exportBtn.addEventListener('click', run);

const IGNORE = [
  /mail\.google\.com/i,
  /outlook\.(live|office)\.com/i,
  /calendar\.google\.com/i,
  /(drive|docs|sheets|slides|meet)\.google\.com/i,
  /one\.google\.com/i,
  /google\.com\/search/i,
  /bing\.com\/search/i,
  /duckduckgo\.com/i,
  /kagi\.com/i,
  /(open\.)?spotify\.com/i,
  /(chat\.openai\.com|chatgpt\.com)/i,
  /claude\.ai/i
];

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_|_hs|ref|referrer|igshid|si|ved|sa|sca_|usg|cd)/i;

function isVideo(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be';
  } catch { return false; }
}

function shouldIgnore(url) {
  return IGNORE.some(re => re.test(url));
}

function normalizeUrl(raw) {
  try {
    const u = new URL(raw);
    u.hash = '';
    const keep = [];
    for (const [k, v] of u.searchParams) {
      if (!TRACKING_PARAMS.test(k)) keep.push([k, v]);
    }
    u.search = '';
    for (const [k, v] of keep) u.searchParams.append(k, v);
    let s = u.toString();
    if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1);
    return s;
  } catch { return raw; }
}

function sanitizeFolder(raw) {
  return (raw.trim() || 'obsidian-inbox')
    .replace(/\/+$/, '')
    .split('/')
    .filter(seg => seg && seg !== '..' && seg !== '.')
    .join('/') || 'obsidian-inbox';
}

async function run() {
  exportBtn.disabled = true;
  statusEl.className = '';
  statusEl.textContent = 'Querying history…';

  const dateStr = dateInput.value;
  if (!dateStr) {
    statusEl.className = 'error';
    statusEl.textContent = '✗ Please select a date.';
    exportBtn.disabled = false;
    return;
  }

  const minVisits = parseInt(minVisitsInput.value, 10) || 1;
  const maxItems  = parseInt(maxItemsInput.value, 10) || 200;
  const folder    = sanitizeFolder(folderInput.value);
  folderInput.value = folder;
  chrome.storage.local.set({ folder });

  const start = new Date(dateStr + 'T00:00:00');
  const end   = new Date(dateStr + 'T23:59:59.999');

  try {
    const items = await chrome.history.search({
      text: '',
      startTime: start.getTime(),
      endTime: end.getTime(),
      maxResults: 10000
    });

    const dayItems = await collectAndDedupe(items, start.getTime(), end.getTime());
    const filtered = dayItems
      .filter(i => i.dayVisits >= minVisits)
      .sort((a, b) => (a.title || a.url).localeCompare(b.title || b.url, undefined, { sensitivity: 'base' }))
      .slice(0, maxItems);

    if (filtered.length === 0) {
      statusEl.textContent = 'No matching history for that day.';
      exportBtn.disabled = false;
      return;
    }

    if (currentFormat === 'json') {
      const json = renderJson(dateStr, filtered);
      await downloadFile(dateStr, json, 'json', 'application/json');
    } else {
      const md = renderMarkdown(dateStr, filtered);
      await downloadFile(dateStr, md, 'md', 'text/markdown');
    }

    statusEl.className = 'success';
    statusEl.textContent = `✓ Exported ${filtered.length} entries.`;
  } catch (err) {
    statusEl.className = 'error';
    statusEl.textContent = '✗ ' + err.message;
  } finally {
    exportBtn.disabled = false;
  }
}

async function collectAndDedupe(items, startMs, endMs) {
  const byKey = new Map();
  for (const item of items) {
    if (shouldIgnore(item.url)) continue;
    const visits = await chrome.history.getVisits({ url: item.url });
    const dayVisits = visits.filter(v => v.visitTime >= startMs && v.visitTime <= endMs);
    if (dayVisits.length === 0) continue;

    const key = normalizeUrl(item.url);
    const typedToday = dayVisits.filter(v => v.transition === 'typed').length;
    const lastVisit  = Math.max(...dayVisits.map(v => v.visitTime));

    const existing = byKey.get(key);
    if (existing) {
      existing.dayVisits  += dayVisits.length;
      existing.typedToday += typedToday;
      if (lastVisit > existing.lastVisitTime) {
        existing.lastVisitTime = lastVisit;
        if (item.title) existing.title = item.title;
        existing.url = item.url;
      }
    } else {
      byKey.set(key, {
        url: item.url,
        title: item.title || item.url,
        dayVisits: dayVisits.length,
        typedToday,
        lastVisitTime: lastVisit
      });
    }
  }
  return [...byKey.values()];
}

function renderMarkdown(dateStr, items) {
  const videos = items.filter(i => isVideo(i.url));
  const rest   = items.filter(i => !isVideo(i.url));

  const lines = [
    '---',
    `date: ${dateStr}`,
    'type: browsing-digest',
    `count: ${items.length}`,
    '---',
    '',
    `# Browsing — ${dateStr}`,
    ''
  ];
  for (const it of rest) lines.push(formatItem(it));
  if (videos.length > 0) {
    lines.push('', '## Videos', '');
    for (const it of videos) lines.push(formatItem(it));
  }
  lines.push('');
  return lines.join('\n');
}

function formatItem(it) {
  const meta = [];
  if (it.dayVisits > 1) meta.push(`${it.dayVisits} visits`);
  if (it.typedToday > 0) meta.push('typed');
  const suffix = meta.length ? ` — ${meta.join(', ')}` : '';
  const title  = (it.title || it.url).replace(/[\[\]]/g, '');
  return `- [ ] [${title}](${it.url})${suffix}`;
}

function renderJson(dateStr, items) {
  const toEntry = it => ({
    url:       it.url,
    title:     it.title || it.url,
    visits:    it.dayVisits,
    typed:     it.typedToday > 0,
    lastVisit: new Date(it.lastVisitTime).toISOString()
  });
  return JSON.stringify({
    date:   dateStr,
    type:   'browsing-digest',
    count:  items.length,
    items:  items.filter(i => !isVideo(i.url)).map(toEntry),
    videos: items.filter(i =>  isVideo(i.url)).map(toEntry)
  }, null, 2);
}

async function downloadFile(dateStr, content, ext, mime) {
  const dataUrl = `data:${mime};charset=utf-8,` + encodeURIComponent(content);
  await chrome.downloads.download({
    url: dataUrl,
    filename: `${folderInput.value}/browsing-${dateStr}.${ext}`,
    saveAs: false,
    conflictAction: 'overwrite'
  });
}

function localISODate(d) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
