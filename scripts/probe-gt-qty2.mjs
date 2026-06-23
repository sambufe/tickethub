import { chromium } from 'playwright';

const EVENT_URL = 'https://gametime.co/concert/tedeschi-trucks-band-tickets/8-13-2026-santa-barbara-ca-santa-barbara-bowl/events/6973dc366e2f4e59333fa7eb';

async function getListingTexts(page) {
  return page.evaluate(() => {
    const results = [], seen = new Set();
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const txt = (el.textContent ?? '').trim();
      if (!/includes fees/i.test(txt) || !/\$[\d,]+(?:\/ea)?/.test(txt)) continue;
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

async function getPriceSliderInfo(page) {
  return page.evaluate(() => {
    // Find all input[type=range] or price range elements
    const ranges = Array.from(document.querySelectorAll('input[type="range"], input[type="number"]'));
    const sliderInfo = ranges.map(el => ({
      type: el.type,
      value: el.value,
      min: el.getAttribute('min'),
      max: el.getAttribute('max'),
      ariaLabel: el.getAttribute('aria-label') ?? '',
      id: el.id ?? '',
      cls: (el.className ?? '').slice(0, 60),
    }));

    // Also look for text showing price range (e.g. "$X" near "Minimum" / "Maximum")
    const priceFilterEls = Array.from(document.querySelectorAll('*')).filter(el => {
      const txt = el.textContent ?? '';
      return /minimum|maximum/i.test(txt) && el.children.length <= 5 && txt.length < 200;
    }).slice(0, 5).map(el => ({
      tag: el.tagName,
      text: (el.textContent ?? '').trim().slice(0, 100),
      html: el.outerHTML.slice(0, 300),
    }));

    return { sliderInfo, priceFilterEls };
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

// ── Baseline (default: 2 Tickets) ──────────────────────────────
const baseline = await getListingTexts(page);
const baselineSlider = await getPriceSliderInfo(page);
console.log(`\n=== DEFAULT (2 Tickets) — ${baseline.length} listings ===`);
for (const t of baseline.slice(0, 5)) console.log(' ', t.slice(0, 80));
console.log('Slider info:', JSON.stringify(baselineSlider.sliderInfo));
console.log('Price filter elements:', JSON.stringify(baselineSlider.priceFilterEls, null, 2));

// Find qty buttons
const qtyBtns = await page.$$('button[aria-pressed]');
console.log('\nQty buttons with aria-pressed:');
for (const btn of qtyBtns) {
  const txt = (await btn.textContent()).trim();
  const pressed = await btn.getAttribute('aria-pressed');
  console.log(` "${txt}" (aria-pressed=${pressed})`);
}

// ── Click "1 Ticket" ───────────────────────────────────────────
console.log('\n=== Clicking "1 Ticket" ===');
const btn1 = await page.$('button[aria-pressed="false"]:has-text("1 Ticket"), button:text-is("1 Ticket")').catch(() => null)
  ?? await page.$$eval('button[aria-pressed]', btns => {
    const b = btns.find(b => /^1\s*ticket/i.test(b.textContent?.trim() ?? ''));
    return b ? btns.indexOf(b) : -1;
  }).then(idx => idx >= 0 ? page.$$('button[aria-pressed]').then(bs => bs[idx]) : null);

if (btn1) {
  await btn1.click();
  await page.waitForTimeout(1500);
  const after1 = await getListingTexts(page);
  const slider1 = await getPriceSliderInfo(page);
  console.log(`After 1 Ticket click — ${after1.length} listings`);
  for (const t of after1.slice(0, 5)) console.log(' ', t.slice(0, 80));
  console.log('Slider min after qty=1:', JSON.stringify(slider1.sliderInfo));

  // Show which listings are new (appear in qty=1 but not in qty=2 default)
  const baseSet = new Set(baseline);
  const newListings = after1.filter(t => !baseSet.has(t));
  console.log(`\nNew listings only visible at qty=1 (${newListings.length}):`);
  for (const t of newListings) console.log(' NEW:', t.slice(0, 80));

  const removedListings = baseline.filter(t => !after1.includes(t));
  console.log(`\nListings removed when switching to qty=1 (${removedListings.length}):`);
  for (const t of removedListings) console.log(' REMOVED:', t.slice(0, 80));
} else {
  console.log('Could not find "1 Ticket" button');
}

await browser.close();
