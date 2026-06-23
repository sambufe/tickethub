import { chromium } from 'playwright';

const EVENT_URL = 'https://gametime.co/concert/tedeschi-trucks-band-tickets/8-13-2026-santa-barbara-ca-santa-barbara-bowl/events/6973dc366e2f4e59333fa7eb';

function parsePrice(txt) {
  const m = txt.match(/\$([\d,]+)(?:\/ea)?\s*$/);
  return m ? parseFloat(m[1].replace(/,/g, '')) : null;
}

async function getListings(page) {
  return page.evaluate(() => {
    const results = [], seen = new Set();
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const txt = (el.textContent ?? '').trim();
      if (!/includes fees/i.test(txt) || !/\$\d+/.test(txt)) continue;
      const hasChildWithFull = Array.from(el.children).some(ch => {
        const ct = ch.textContent ?? '';
        return /includes fees/i.test(ct) && /\$\d+/.test(ct);
      });
      if (hasChildWithFull) continue;
      const parent = el.parentElement;
      const parentTxt = (parent?.textContent ?? '').trim();
      const hasMultipleFees = (parentTxt.match(/includes fees/gi) ?? []).length > 1;
      const key = parentTxt && parentTxt.length < 400 && !hasMultipleFees ? parentTxt : txt;
      if (!seen.has(key)) { seen.add(key); results.push(key); }
    }
    return results;
  });
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 900 }, locale: 'en-US',
});
await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
const page = await ctx.newPage();

await page.goto(EVENT_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

// Check which qty buttons are visible (not in dialog)
const visibleQtyBtns = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('button[aria-pressed]'))
    .filter(b => {
      const rect = b.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;  // visible = has dimensions
    })
    .map(b => ({
      text: (b.textContent ?? '').trim(),
      pressed: b.getAttribute('aria-pressed'),
      cls: (b.className ?? '').slice(0, 60),
      x: Math.round(b.getBoundingClientRect().x),
      y: Math.round(b.getBoundingClientRect().y),
    }));
});
console.log('Visible qty buttons:', JSON.stringify(visibleQtyBtns, null, 2));

// ── Baseline: qty=2 (default) ──────────────────────────────────
const listings2 = await getListings(page);
const prices2 = listings2.map(parsePrice).filter(Boolean).sort((a,b) => a-b);
console.log(`\n=== QTY=2 default — ${listings2.length} raw listing texts ===`);
console.log('All prices (sorted):', prices2);
console.log('Cheapest:', prices2[0]);

// ── Click qty=1 ────────────────────────────────────────────────
// Find the visible "1" button by text content
const allAriaPressed = await page.$$('button[aria-pressed]');
let btn1 = null;
for (const btn of allAriaPressed) {
  const txt = (await btn.textContent()).trim();
  const isVisible = await btn.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  if (txt === '1' && isVisible) { btn1 = btn; break; }
}

if (btn1) {
  console.log('\nClicking visible "1" button...');
  await btn1.click({ timeout: 5000 });
  // Wait for DOM update — wait for any listing text to change
  await page.waitForTimeout(2000);

  const listings1 = await getListings(page);
  const prices1 = listings1.map(parsePrice).filter(Boolean).sort((a,b) => a-b);
  console.log(`\n=== QTY=1 after click — ${listings1.length} raw listing texts ===`);
  console.log('All prices (sorted):', prices1);
  console.log('Cheapest:', prices1[0]);

  // Find listings that appear in qty=1 but not in qty=2
  const set2 = new Set(listings2);
  const newAt1 = listings1.filter(t => !set2.has(t));
  console.log(`\nListings NEW at qty=1 (${newAt1.length}):`);
  for (const t of newAt1) console.log(' +', t.slice(0, 90));

  const missingAt1 = listings2.filter(t => !listings1.includes(t));
  console.log(`\nListings REMOVED at qty=1 (${missingAt1.length}):`);
  for (const t of missingAt1) console.log(' -', t.slice(0, 90));

  console.log(`\nCheapest at qty=1: $${prices1[0]} | Cheapest at qty=2: $${prices2[0]}`);
  console.log(`Prices differ: ${prices1[0] !== prices2[0]}`);
} else {
  console.log('\nERROR: Could not find visible "1" qty button');
  // Debug: show all aria-pressed buttons with dimensions
  for (const btn of allAriaPressed) {
    const txt = (await btn.textContent()).trim();
    const dims = await btn.evaluate(el => {
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
    });
    console.log(`  "${txt}" → ${JSON.stringify(dims)}`);
  }
}

await browser.close();
