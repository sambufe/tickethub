import { chromium } from 'playwright';

const productionId = '6570158';
const productionUrl = `https://www.vividseats.com/tedeschi-trucks-band-tickets-santa-barbara-santa-barbara-bowl-8-13-2026--concerts-country-and-folk/production/${productionId}`;

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
});
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 800 }, locale: 'en-US', timezoneId: 'America/Los_Angeles',
  extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
});
await context.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
const page = await context.newPage();

const captured = { value: null };
const responsePromise = page.waitForResponse(
  r => r.url().includes('/hermes/api/v1/listings') && r.url().includes(`productionId=${productionId}`),
  { timeout: 25000 }
);

await page.goto(productionUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(e => console.log('goto:', e.message));

try {
  const r = await responsePromise;
  captured.value = await r.json();
} catch(e) { console.log('Response error:', e.message); }

if (!captured.value) { console.log('No listing data captured'); await browser.close(); process.exit(0); }

const tickets = captured.value.tickets ?? [];
console.log(`Total raw tickets: ${tickets.length}`);

// Show structure of first ticket
console.log('\nFirst ticket fields:', Object.keys(tickets[0] || {}));
console.log('First ticket sample:', JSON.stringify(tickets[0], null, 2));

// Analyze by quantity
const allPrices = tickets.map(t => ({ qty: Number(t.q ?? t.quantity ?? 0), listed: Number(t.p ?? 0), allIn: Number(t.aip ?? t.allInPricePerTicket ?? 0), section: String(t.sectionName ?? t.s ?? ''), row: String(t.r ?? t.row ?? '') })).filter(t => t.listed > 0);
allPrices.sort((a, b) => a.allIn - b.allIn);

console.log('\n--- Cheapest 10 listings (any quantity) ---');
for (const t of allPrices.slice(0, 10)) {
  console.log(`  qty=${t.qty} listed=$${t.listed} allIn=$${t.allIn} section="${t.section}" row="${t.row}"`);
}

// Filter qty >= 1
const qty1 = allPrices.filter(t => t.qty === 0 || t.qty >= 1);
console.log(`\n--- Cheapest with qty>=1 (${qty1.length} listings) ---`);
console.log('Cheapest:', qty1[0]);

// Filter qty >= 2
const qty2 = allPrices.filter(t => t.qty === 0 || t.qty >= 2);
console.log(`\n--- Cheapest with qty>=2 (${qty2.length} listings) ---`);
console.log('Cheapest:', qty2[0]);

// Show qty=1 only listings (single tickets)
const singleOnly = allPrices.filter(t => t.qty === 1);
console.log(`\n--- qty=1 ONLY listings (${singleOnly.length}) ---`);
for (const t of singleOnly.slice(0, 5)) {
  console.log(`  qty=${t.qty} listed=$${t.listed} allIn=$${t.allIn} section="${t.section}"`);
}

await browser.close();
