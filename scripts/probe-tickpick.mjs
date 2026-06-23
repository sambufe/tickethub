import { chromium } from 'playwright';

const url = 'https://www.tickpick.com/buy-sierra-ferrell-tickets-santa-barbara-bowl-8-6-26-7pm/7723820/';

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

const captured = [];
page.on('response', (r) => {
  if (!r.url().includes('tickpick')) return;
  captured.push({ status: r.status(), ct: (r.headers()['content-type']||'').slice(0,40), url: r.url() });
});

console.log('Loading page...');
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(e => console.log('goto:', e.message));
await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});

console.log(`\nTotal responses from tickpick.com: ${captured.length}`);
for (const r of captured) {
  const jsonFlag = r.ct.includes('json') ? ' <<< JSON' : '';
  console.log(`  [${r.status}] ${r.ct.padEnd(40)} ${r.url.slice(0,120)}${jsonFlag}`);
}
console.log('\nPage title:', await page.title().catch(() => '(error)'));
await browser.close();
