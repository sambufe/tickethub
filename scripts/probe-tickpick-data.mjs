import { chromium } from 'playwright';

const url = 'https://www.tickpick.com/buy-sierra-ferrell-tickets-santa-barbara-bowl-8-6-26-7pm/7723820/';
const eventId = '7723820';

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
});
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  locale: 'en-US', timezoneId: 'America/Los_Angeles',
});
await context.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
const page = await context.newPage();

// Intercept the exact listing API
const responsePromise = page.waitForResponse(
  (r) => r.url().includes(`/listings/internal/event-v2/${eventId}`),
  { timeout: 25000 }
);

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(e => console.log('goto:', e.message));

try {
  const r = await responsePromise;
  console.log('Listing API URL:', r.url());
  console.log('Status:', r.status());
  const data = await r.json();
  console.log('\nTop-level keys:', Object.keys(data));
  // Show structure of first listing
  const listings = data.listings || data.data || (Array.isArray(data) ? data : []);
  console.log('listings count:', listings.length);
  if (listings.length > 0) {
    console.log('\nFirst listing keys:', Object.keys(listings[0]));
    console.log('First listing:', JSON.stringify(listings[0], null, 2));
  }
} catch (e) {
  console.log('Error:', e.message);
}

await browser.close();
