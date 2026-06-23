/**
 * Probe: capture VS listings API and print full ticket structure.
 * Usage: node scripts/probe-vs.mjs
 */
import { chromium } from 'playwright';

const TEST_URL =
  'https://www.vividseats.com/ed-sheeran-tickets-inglewood-sofi-stadium-8-8-2026--concerts-pop/production/6049710';

(async () => {
  console.log('Launching Chromium…');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  let listingsData = null;

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/hermes/api/v1/listings') && url.includes('productionId')) {
      try {
        const data = await response.json();
        listingsData = data;
        console.log(`\n[LISTINGS] ${url}\n`);
      } catch { /* skip */ }
    }
  });

  console.log('Navigating…');
  try {
    await page.goto(TEST_URL, { waitUntil: 'networkidle', timeout: 30_000 });
  } catch { /* timeout ok */ }
  await page.waitForTimeout(3000);

  if (!listingsData) {
    console.log('ERROR: No listings response captured');
    await browser.close();
    return;
  }

  const { global: g, tickets } = listingsData;

  console.log('=== global ===');
  console.log(`  listingCount: ${g?.[0]?.listingCount}`);
  console.log(`  lowestAip: ${g?.[0]?.lowestAip}`);
  console.log(`  highestAip: ${g?.[0]?.highestAip}`);

  console.log('\n=== tickets structure ===');
  if (Array.isArray(tickets)) {
    console.log(`  tickets is array, length=${tickets.length}`);
    if (tickets.length > 0) {
      console.log('  First ticket keys:', Object.keys(tickets[0]).join(', '));
      console.log('\n  First 3 tickets:');
      tickets.slice(0, 3).forEach((t, i) => {
        console.log(`\n  [${i}] ${JSON.stringify(t, null, 2)}`);
      });
    }
  } else if (tickets && typeof tickets === 'object') {
    console.log('  tickets is object, keys:', Object.keys(tickets).join(', '));
    const firstKey = Object.keys(tickets)[0];
    if (Array.isArray(tickets[firstKey])) {
      const arr = tickets[firstKey];
      console.log(`  tickets.${firstKey} is array, length=${arr.length}`);
      if (arr.length > 0) {
        console.log('  First item keys:', Object.keys(arr[0]).join(', '));
        console.log('\n  First 3 items:');
        arr.slice(0, 3).forEach((t, i) => {
          console.log(`\n  [${i}] ${JSON.stringify(t, null, 2)}`);
        });
      }
    }
  } else {
    console.log('  tickets:', JSON.stringify(tickets, null, 2).slice(0, 1000));
  }

  console.log('\n=== groups (first 3) ===');
  if (Array.isArray(listingsData.groups)) {
    console.log(`  groups is array, length=${listingsData.groups.length}`);
    listingsData.groups.slice(0, 3).forEach((g, i) => {
      console.log(`\n  [${i}] ${JSON.stringify(g, null, 2)}`);
    });
  }

  await browser.close();
  console.log('\nDone.');
})();
