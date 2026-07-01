// playwright-core: static import (not dynamic) so webpack doesn't create
// a hashed async split-chunk that Vercel's runtime can't resolve by name.
import { chromium as pwChromium } from 'playwright-core';
import type { Browser, BrowserContext, Page } from 'playwright-core';

declare global {
  // eslint-disable-next-line no-var
  var __pw_browser: Browser | undefined;
  // eslint-disable-next-line no-var
  var __pw_vercel_browser: Promise<Browser> | undefined;
  // eslint-disable-next-line no-var
  var __pw_exec_promise: Promise<{ executablePath: string; args: string[] }> | undefined;
}

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'font', 'stylesheet', 'media']);
const BLOCKED_DOMAIN_PATTERNS = /google-analytics|googletagmanager|doubleclick|googlesyndication|facebook\.com\/tr|hotjar|segment\.io|amplitude\.com|newrelic|mixpanel/;

async function getLaunchConfig(): Promise<{ executablePath: string; args: string[] }> {
  if (!global.__pw_exec_promise) {
    global.__pw_exec_promise = (async () => {
      const chromium = (await import('@sparticuz/chromium')).default;
      return { executablePath: await chromium.executablePath(), args: chromium.args };
    })();
  }
  return global.__pw_exec_promise;
}

async function getBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    // Reuse the browser across requests (one Chrome per Lambda instance).
    // Scrapers get independent contexts; only the Lambda eviction cleans up Chrome.
    // On crash: 'disconnected' event clears the singleton and the next request relaunches.
    if (global.__pw_vercel_browser) {
      try {
        const b = await global.__pw_vercel_browser;
        if (b.isConnected()) return b;
      } catch { /* browser failed to launch previously */ }
      global.__pw_vercel_browser = undefined;
    }
    global.__pw_vercel_browser = (async () => {
      const { executablePath, args } = await getLaunchConfig();
      const browser = await pwChromium.launch({ args, executablePath, headless: true });
      browser.on('disconnected', () => { global.__pw_vercel_browser = undefined; });
      return browser;
    })();
    return global.__pw_vercel_browser;
  }

  // Local dev — global singleton survives Next.js hot reloads.
  // turbopackIgnore + webpackIgnore prevent either bundler from processing 'playwright'
  // (it's a devDependency, not available on Vercel).
  if (global.__pw_browser?.isConnected()) return global.__pw_browser;
  await global.__pw_browser?.close().catch(() => {});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { chromium } = await (import(/* webpackIgnore: true */ /* turbopackIgnore: true */ 'playwright') as Promise<any>);
  global.__pw_browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
  }) as unknown as Browser;
  return global.__pw_browser!;
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
