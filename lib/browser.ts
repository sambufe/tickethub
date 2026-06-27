import type { Browser, BrowserContext, Page } from 'playwright';

declare global {
  // eslint-disable-next-line no-var
  var __pw_browser: Browser | undefined;
}

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'font', 'stylesheet', 'media']);
const BLOCKED_DOMAIN_PATTERNS = /google-analytics|googletagmanager|doubleclick|googlesyndication|facebook\.com\/tr|hotjar|segment\.io|amplitude\.com|newrelic|mixpanel/;

async function getBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default;
    const { chromium: pw } = await import('playwright-core');
    const browser = await pw.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    return browser as unknown as Browser;
  }

  // Local dev — global singleton survives Next.js hot reloads
  if (global.__pw_browser?.isConnected()) return global.__pw_browser;
  await global.__pw_browser?.close().catch(() => {});
  const { chromium } = await import('playwright');
  global.__pw_browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
  });
  return global.__pw_browser;
}

export async function closeBrowser(): Promise<void> {
  if (global.__pw_browser) {
    await global.__pw_browser.close().catch(() => {});
    global.__pw_browser = undefined;
  }
}

export async function restartBrowser(): Promise<void> {
  await closeBrowser();
  if (!process.env.VERCEL) await getBrowser();
}

process.once('exit', () => { global.__pw_browser?.close().catch(() => {}); });
process.once('SIGINT', () => { global.__pw_browser?.close().catch(() => {}); process.exit(0); });
process.once('SIGTERM', () => { global.__pw_browser?.close().catch(() => {}); process.exit(0); });

async function buildContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
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
  return context;
}

export async function newPage(): Promise<{ page: Page; context: BrowserContext }> {
  const context = await buildContext();
  const page = await context.newPage();
  return { page, context };
}

export async function newFastPage(): Promise<{ page: Page; context: BrowserContext }> {
  const context = await buildContext();
  await context.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (BLOCKED_RESOURCE_TYPES.has(type)) return route.abort();
    if (BLOCKED_DOMAIN_PATTERNS.test(route.request().url())) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  return { page, context };
}
