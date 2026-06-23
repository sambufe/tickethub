import { chromium } from 'playwright';

const event = {
  title: 'Tedeschi Trucks Band w/ Lukas Nelson',
  city: 'Santa Barbara',
  event_date: '2026-08-13T18:00:00',
};

const CORRECT_URL = 'https://www.vividseats.com/tedeschi-trucks-band-tickets-santa-barbara-santa-barbara-bowl-8-13-2026--concerts-country-and-folk/production/6570158';

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

// Replicate the exact query from findProductionUrl
const query = encodeURIComponent(`${event.title} ${event.city}`);
const searchUrl = `https://www.vividseats.com/search?searchTerm=${query}`;
console.log('Search URL:', searchUrl);
console.log('Search term:', decodeURIComponent(query));

await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(e => console.log('goto:', e.message));
await page.waitForSelector('a[href*="/production/"]', { timeout: 10000 }).catch(() => console.log('(no production links found)'));

const hrefs = await page.$$eval('a[href*="/production/"]', (els) =>
  [...new Set(els.map(el => el.getAttribute('href') ?? '').filter(Boolean))]
).catch(() => []);

console.log(`\nFound ${hrefs.length} unique production/ hrefs:`);
for (const href of hrefs) {
  console.log(' ', href);
}

// Now replicate matchBestProductionHref logic
const titleWords = event.title.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3).slice(0, 3);
const [year, mm, dd] = event.event_date.split('T')[0].split('-');
const dateSlug = `${parseInt(mm)}-${parseInt(dd)}-${year}`;
const monthDay = `${parseInt(mm)}-${parseInt(dd)}`;

console.log('\n--- matchBestProductionHref logic ---');
console.log('titleWords (first 3, len>3):', titleWords);
console.log('dateSlug:', dateSlug, '| monthDay:', monthDay);
console.log('Correct production URL href:', CORRECT_URL.replace('https://www.vividseats.com', ''));

let matched = null;
let fallback = null;
for (const href of hrefs) {
  const lower = href.toLowerCase();
  const hasTitle = titleWords.every(w => lower.includes(w));
  const hasDate = lower.includes(dateSlug) || lower.includes(monthDay);
  const marker = hasTitle && hasDate ? '  ✅ MATCH (title+date)' 
    : hasTitle ? '  🟡 FALLBACK (title only)'
    : '';
  if (marker) console.log(marker, href);
  if (hasTitle && hasDate && !matched) matched = href;
  if (hasTitle && !hasDate && !fallback) fallback = href;
}

console.log('\nResult:', matched ? `MATCHED: ${matched}` : fallback ? `FALLBACK: ${fallback}` : 'NO MATCH');

// Check if the correct URL is in the hrefs at all
const correctHref = CORRECT_URL.replace('https://www.vividseats.com', '');
const inResults = hrefs.some(h => h === correctHref);
console.log(`\nCorrect URL in results? ${inResults ? 'YES' : 'NO'}`);

await browser.close();
