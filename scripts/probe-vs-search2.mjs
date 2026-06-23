import { chromium } from 'playwright';

const event = { title: 'Tedeschi Trucks Band w/ Lukas Nelson', city: 'Santa Barbara' };
const query = encodeURIComponent(`${event.title} ${event.city}`);
const searchUrl = `https://www.vividseats.com/search?searchTerm=${query}`;

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

await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(e => console.log('goto:', e.message));

// Wait up to 5s for the page to settle
await page.waitForTimeout(5000);

const title = await page.title();
const url = page.url();
console.log('Final URL:', url);
console.log('Page title:', title);

// Check all hrefs on the page
const allHrefs = await page.$$eval('a[href]', els => [...new Set(els.map(el => el.href).filter(h => h.includes('vividseats.com')))]);
console.log(`\nAll vividseats.com hrefs on page (${allHrefs.length} total):`);

// Show just the ones that look like event/production links
const eventLinks = allHrefs.filter(h => h.includes('/production/') || h.includes('/event/') || h.includes('/tickets'));
console.log(`Event-like hrefs (${eventLinks.length}):`);
for (const h of eventLinks.slice(0, 20)) console.log(' ', h);

// Check for VS's alternative data attributes (React rendered)
const dataLinks = await page.$$eval('[data-testid]', els => els.map(el => `${el.getAttribute('data-testid')}: ${el.tagName}`)).catch(() => []);
console.log('\ndata-testid elements:', dataLinks.slice(0, 10));

// Get a snapshot of visible text
const visibleText = await page.evaluate(() => document.body?.innerText?.slice(0, 500)).catch(() => '');
console.log('\nBody text preview:\n', visibleText);

await browser.close();
