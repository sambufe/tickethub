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

async function selectQty(page, qty) {
  // Step 1: click the top-bar qty button to open dialog
  const topBarQtyBtn = page.locator('button.ccd77c1116a8a295._6c9ccc0bae4d7f24, button:text-matches("\\d+ Ticket")').first();
  await topBarQtyBtn.click({ timeout: 8000 });
  await page.waitForTimeout(500);

  // Step 2: click the qty option inside dialog
  const qtyLabel = qty === 1 ? '1 Ticket' : `${qty} Tickets`;
  const dialogBtn = page.locator(`dialog button[aria-pressed], [role="dialog"] button[aria-pressed]`).filter({ hasText: new RegExp(`^${qty}\\s*Ticket`, 'i') }).first();
  await dialogBtn.click({ timeout: 8000 });
  await page.waitForTimeout(300);

  // Step 3: click "Show listings" to apply
  const showBtn = page.locator('button:text-matches("Show listings", "i"), button:text-matches("show \\d+ listings", "i")').first();
  await showBtn.click({ timeout: 8000 });
  await page.waitForTimeout(2000); // wait for listing cards to update
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

// ── Baseline: Default (qty=2) ───────────────────────────────────
const listings2 = await getListings(page);
const prices2 = listings2.map(parsePrice).filter(Boolean).sort((a,b) => a-b);
const uniq2 = [...new Set(prices2)].sort((a,b)=>a-b);
console.log(`QTY=2 (default): ${listings2.length} raw texts, ${uniq2.length} unique prices`);
console.log('Cheapest at qty=2:', prices2[0]);
console.log('All unique prices at qty=2:', uniq2);

// ── Switch to qty=1 ─────────────────────────────────────────────
console.log('\nSwitching to qty=1...');
try {
  await selectQty(page, 1);
  
  const listings1 = await getListings(page);
  const prices1 = listings1.map(parsePrice).filter(Boolean).sort((a,b) => a-b);
  const uniq1 = [...new Set(prices1)].sort((a,b)=>a-b);
  console.log(`QTY=1: ${listings1.length} raw texts, ${uniq1.length} unique prices`);
  console.log('Cheapest at qty=1:', prices1[0]);
  console.log('All unique prices at qty=1:', uniq1);

  // What's new at qty=1?
  const set2Prices = new Set(prices2);
  const onlyAtQty1 = uniq1.filter(p => !set2Prices.has(p));
  console.log('\nPrices ONLY at qty=1:', onlyAtQty1);

  const newListings = listings1.filter(t => !listings2.includes(t));
  console.log(`\nNew raw texts at qty=1 (${newListings.length}):`);
  for (const t of newListings) console.log(' +', t.slice(0, 80));
  
  // Summary
  console.log(`\n=== SUMMARY ===`);
  console.log(`Cheapest all-in at qty=1: $${prices1[0]}`);
  console.log(`Cheapest all-in at qty=2: $${prices2[0]}`);
  console.log(`Prices differ: ${prices1[0] !== prices2[0]}`);
} catch(e) {
  console.error('Error selecting qty:', e.message);
  // Debug dialog structure
  const dialogInfo = await page.evaluate(() => {
    const dlg = document.querySelector('dialog');
    return dlg ? { open: dlg.open, html: dlg.innerHTML.slice(0, 500) } : null;
  });
  console.log('Dialog state:', JSON.stringify(dialogInfo));
}

await browser.close();
