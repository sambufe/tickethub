import { chromium } from 'playwright';

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

// Test 1: full title (original behavior)
console.log('=== TEST 1: full title query ===');
const q1 = encodeURIComponent('Tedeschi Trucks Band w/ Lukas Nelson Santa Barbara');
await page.goto(`https://www.vividseats.com/search?searchTerm=${q1}`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
// Try accepting cookie consent
await page.click('button:has-text("Accept All")', { timeout: 3000 }).catch(() => {});
await page.waitForSelector('a[href*="/production/"]', { timeout: 8000 }).catch(() => {});
const hrefs1 = await page.$$eval('a[href*="/production/"]', els => [...new Set(els.map(el => el.getAttribute('href') ?? '').filter(Boolean))]).catch(() => []);
console.log(`Production hrefs after cookie accept: ${hrefs1.length}`);
for (const h of hrefs1.slice(0, 5)) console.log(' ', h);

// Test 2: title only (no city, no "w/ Lukas Nelson")
console.log('\n=== TEST 2: artist-only query ===');
const q2 = encodeURIComponent('Tedeschi Trucks Band');
await page.goto(`https://www.vividseats.com/search?searchTerm=${q2}`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
await page.waitForSelector('a[href*="/production/"]', { timeout: 8000 }).catch(() => {});
const hrefs2 = await page.$$eval('a[href*="/production/"]', els => [...new Set(els.map(el => el.getAttribute('href') ?? '').filter(Boolean))]).catch(() => []);
console.log(`Production hrefs: ${hrefs2.length}`);
const santaBarbara = hrefs2.filter(h => h.includes('santa-barbara') || h.includes('8-13'));
console.log('Santa Barbara or Aug 13 results:', santaBarbara.length);
for (const h of hrefs2.slice(0, 10)) console.log(' ', h);

// Test 3: check the w%2F encoding
console.log('\n=== TEST 3: title with / as literal slash in path ===');
const q3 = encodeURIComponent('Tedeschi Trucks Band Santa Barbara');
await page.goto(`https://www.vividseats.com/search?searchTerm=${q3}`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
await page.waitForSelector('a[href*="/production/"]', { timeout: 8000 }).catch(() => {});
const hrefs3 = await page.$$eval('a[href*="/production/"]', els => [...new Set(els.map(el => el.getAttribute('href') ?? '').filter(Boolean))]).catch(() => []);
console.log(`Production hrefs: ${hrefs3.length}`);
for (const h of hrefs3.slice(0, 10)) console.log(' ', h);

await browser.close();
