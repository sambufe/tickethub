import { chromium } from 'playwright';

const url = 'https://www.axs.com/events/1304849/sierra-ferrell-tickets';

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
  const rUrl = r.url();
  if (!rUrl.includes('axs.com')) return;
  if (/\.(css|js|png|jpg|woff2?|svg|ico|gif)(\?|$)/.test(rUrl)) return;
  captured.push({ status: r.status(), ct: (r.headers()['content-type']||'').slice(0,40), url: rUrl });
});

console.log('Loading AXS page...');
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(e => console.log('goto:', e.message));
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => console.log('(networkidle timeout)'));

console.log(`\nNon-asset responses from axs.com (${captured.length}):`);
for (const r of captured) {
  const jsonFlag = r.ct.includes('json') ? ' <<< JSON' : '';
  console.log(`  [${r.status}] ${r.ct.slice(0,35).padEnd(35)} ${r.url}${jsonFlag}`);
}
console.log('\nPage title:', await page.title().catch(() => '(error)'));
const bodySnippet = await page.evaluate(() => document.body?.innerText?.slice(0,200) || '').catch(() => '');
console.log('Body text preview:', bodySnippet);
await browser.close();
