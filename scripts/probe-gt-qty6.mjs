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

async function selectQtyJS(page, qty) {
  // Use { force: true } to bypass pointer-events interception by overlay
  // Step 1: open the filter panel by clicking the qty chip
  const chip = page.locator('[aria-pressed="false"].ccd77c1116a8a295').first();
  // Actually, try the chip that has text matching N Tickets
  const qtyChip = page.locator('button').filter({ hasText: /\d+ Tickets?/ }).first();
  await qtyChip.click({ force: true, timeout: 5000 });
  console.log('  Clicked qty chip (force)');
  await page.waitForTimeout(1000);

  // Check if a filter panel opened
  const panelVisible = await page.evaluate(() => {
    const allBtns = Array.from(document.querySelectorAll('button[aria-pressed]'));
    const visibleBtns = allBtns.filter(b => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    return visibleBtns.map(b => ({
      text: (b.textContent ?? '').trim(),
      pressed: b.getAttribute('aria-pressed'),
      dims: (() => { const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })(),
    }));
  });
  console.log('  Visible aria-pressed buttons after click:', JSON.stringify(panelVisible));

  // Step 2: try JS click on the "1 Ticket" / "N Tickets" button
  const clicked = await page.evaluate((qty) => {
    const allBtns = Array.from(document.querySelectorAll('button[aria-pressed]'));
    const targetText = qty === 1 ? '1 Ticket' : `${qty} Tickets`;
    // Find button matching target qty
    const btn = allBtns.find(b => {
      const t = (b.textContent ?? '').trim();
      return t === targetText || (qty === 1 && t === '1');
    });
    if (btn) { btn.click(); return `Clicked: "${btn.textContent?.trim()}"`; }
    return `Not found. All: ${allBtns.map(b => `"${(b.textContent??'').trim()}"`).join(', ')}`;
  }, qty);
  console.log('  Qty select:', clicked);
  await page.waitForTimeout(500);

  // Step 3: click "Show listings" via JS
  const applied = await page.evaluate(() => {
    const allBtns = Array.from(document.querySelectorAll('button'));
    const showBtn = allBtns.find(b => /show\s+\d*\s*listings/i.test((b.textContent ?? '').trim()));
    if (showBtn) { 
      const txt = showBtn.textContent?.trim();
      showBtn.click(); 
      return `Applied: "${txt}"`;
    }
    // Try simpler "show" match
    const show2 = allBtns.find(b => /^show\s+listings$/i.test((b.textContent ?? '').trim()));
    if (show2) { show2.click(); return `Applied (simple): "${show2.textContent?.trim()}"`; }
    return `Show btn not found. Btns with "show": ${allBtns.filter(b => /show/i.test(b.textContent??'')).map(b => `"${(b.textContent??'').trim().slice(0,30)}"`).join(', ')}`;
  });
  console.log('  Apply:', applied);
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

// ── Baseline: qty=2 ─────────────────────────────────────────────
const listings2 = await getListings(page);
const prices2 = [...new Set(listings2.map(parsePrice).filter(Boolean))].sort((a,b) => a-b);
console.log(`QTY=2 (default): ${listings2.length} raw, cheapest=$${prices2[0]}`);

// ── Switch to qty=1 ─────────────────────────────────────────────
console.log('\n--- Switching to qty=1 ---');
await selectQtyJS(page, 1);

const listings1 = await getListings(page);
const prices1 = [...new Set(listings1.map(parsePrice).filter(Boolean))].sort((a,b) => a-b);
console.log(`QTY=1 (after): ${listings1.length} raw, cheapest=$${prices1[0]}`);

const newAt1 = listings1.filter(t => !listings2.includes(t));
const removed2 = listings2.filter(t => !listings1.includes(t));
console.log(`New at qty=1: ${newAt1.length}`, newAt1.slice(0,3).map(t => t.slice(0,60)));
console.log(`Removed at qty=1: ${removed2.length}`, removed2.slice(0,3).map(t => t.slice(0,60)));

// Check the top bar to confirm qty changed
const topBarText = await page.locator('button').filter({ hasText: /\d+ Tickets?/ }).first().textContent().catch(() => '');
console.log('Top bar qty button now shows:', topBarText.trim());

console.log(`\n=== RESULT ===`);
console.log(`qty=1 cheapest: $${prices1[0]}`);
console.log(`qty=2 cheapest: $${prices2[0]}`);
console.log(`Prices differ: ${prices1[0] !== prices2[0]}`);

await browser.close();
