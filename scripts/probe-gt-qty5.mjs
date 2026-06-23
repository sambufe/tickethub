import { chromium } from 'playwright';

const EVENT_URL = 'https://gametime.co/concert/tedeschi-trucks-band-tickets/8-13-2026-santa-barbara-ca-santa-barbara-bowl/events/6973dc366e2f4e59333fa7eb';

function parsePrice(txt) {
  const m = txt.match(/\$([\d,]+)(?:\/ea)?\s*$/);
  return m ? parseFloat(m[1].replace(/,/g, '')) : null;
}

async function dismissOverlays(page) {
  // Dismiss email opt-in / any sheet overlay
  const selectors = [
    'exp-email-opt-in-sheet-persist button[aria-label="Close"]',
    'button[aria-label="Close"]',
    '.MSf4IDL5 button',
    '[data-testid="close"]',
    'button[aria-label*="close" i]',
    'button[aria-label*="dismiss" i]',
  ];
  for (const sel of selectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`Dismissing overlay: ${sel}`);
      await btn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }
  // Also try pressing Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
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

async function selectQtyViaDialog(page, qty) {
  // Open the filter dialog by clicking the qty chip in the top bar
  await page.locator('[class*="_6c9ccc0bae4d7f24"]').first().click({ timeout: 5000 });
  await page.waitForTimeout(800);

  // Check if dialog opened
  const dialogOpen = await page.evaluate(() => {
    const dlg = document.querySelector('dialog');
    return dlg?.open ?? false;
  });
  console.log('  Dialog opened:', dialogOpen);
  if (!dialogOpen) throw new Error('Dialog did not open');

  // Click the qty option inside dialog
  const qtyText = qty === 1 ? '1 Ticket' : `${qty} Tickets`;
  const btn = page.locator(`dialog button`).filter({ hasText: new RegExp(`^${qty}\\s*Ticket`, 'i') }).first();
  await btn.click({ timeout: 5000 });
  await page.waitForTimeout(300);

  // Click "Show listings"
  const showBtn = page.locator(`dialog button`).filter({ hasText: /show\s+\d+\s+listings/i }).first();
  const showBtnTxt = await showBtn.textContent().catch(() => '');
  console.log('  Show listings button text:', showBtnTxt.trim());
  await showBtn.click({ timeout: 5000 });
  await page.waitForTimeout(2500);
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

// Dismiss any overlays before interacting
await dismissOverlays(page);

// Check overlay state
const overlayInfo = await page.evaluate(() => {
  const overlay = document.querySelector('exp-email-opt-in-sheet-persist, .MSf4IDL5');
  return overlay ? { tag: overlay.tagName, vis: window.getComputedStyle(overlay).display } : null;
});
console.log('Overlay after dismiss:', overlayInfo);

// ── Baseline: qty=2 ─────────────────────────────────────────────
const listings2 = await getListings(page);
const prices2 = [...new Set(listings2.map(parsePrice).filter(Boolean))].sort((a,b) => a-b);
console.log(`\nQTY=2 (default): ${listings2.length} raw, ${prices2.length} unique prices`);
console.log('Cheapest at qty=2:', prices2[0]);

// ── Switch to qty=1 ─────────────────────────────────────────────
console.log('\nSwitching to qty=1...');
try {
  await selectQtyViaDialog(page, 1);
  const listings1 = await getListings(page);
  const prices1 = [...new Set(listings1.map(parsePrice).filter(Boolean))].sort((a,b) => a-b);
  console.log(`\nQTY=1: ${listings1.length} raw, ${prices1.length} unique prices`);
  console.log('Cheapest at qty=1:', prices1[0]);

  const newAtQty1 = listings1.filter(t => !listings2.includes(t));
  console.log(`New listings at qty=1 (${newAtQty1.length}):`);
  for (const t of newAtQty1) console.log(' +', t.slice(0, 80));

  console.log(`\n=== RESULT ===`);
  console.log(`qty=1 cheapest: $${prices1[0]}`);
  console.log(`qty=2 cheapest: $${prices2[0]}`);
  console.log(`Different: ${prices1[0] !== prices2[0]}`);
} catch(e) {
  console.error('selectQty failed:', e.message);
  // Show dialog state
  const dstate = await page.evaluate(() => {
    const d = document.querySelector('dialog');
    return { open: d?.open, btns: Array.from(d?.querySelectorAll('button') ?? []).map(b => b.textContent?.trim().slice(0,30)) };
  });
  console.log('Dialog state:', JSON.stringify(dstate));
  
  // Try alternate approach: use page.evaluate to click directly
  console.log('\nTrying JS click approach...');
  const result = await page.evaluate(() => {
    // Find the "Ticket Quantity" section
    const allBtns = Array.from(document.querySelectorAll('button[aria-pressed]'));
    const btn1 = allBtns.find(b => /^1\s*ticket/i.test(b.textContent?.trim() ?? ''));
    if (btn1) { btn1.click(); return `Clicked: ${btn1.textContent?.trim()}`; }
    return `Not found. Buttons: ${allBtns.map(b => b.textContent?.trim().slice(0,20)).join(', ')}`;
  });
  console.log(result);
}

await browser.close();
