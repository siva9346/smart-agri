// Shared helpers. Uses an installed Chromium: set CHROME_PATH, or it falls back to Playwright's cached headless shell.
const { chromium } = require('playwright-core');
const fs = require('fs');
const os = require('os');
const path = require('path');

const APP = process.env.APP_URL || 'http://localhost:8095';
const API = process.env.API_HOST || 'localhost:3055';
const OUT = path.join(__dirname, 'shots');

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  const dirs = fs.existsSync(base) ? fs.readdirSync(base).filter(d => d.startsWith('chromium_headless_shell')).sort().reverse() : [];
  for (const d of dirs) {
    const p = path.join(base, d, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Set CHROME_PATH to a Chrome/Chromium binary');
}

exports.start = async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath() });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 300)); });
  page.on('response', r => { if (r.url().includes(API) && r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`); });
  const shot = name => page.screenshot({ path: path.join(OUT, name + '.png') });
  const visible = t => page.getByText(t, { exact: true }).filter({ visible: true });
  const tap = async t => { await visible(t).last().click(); await page.waitForTimeout(1500); };
  const login = async phone => {
    await page.goto(APP, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.locator('input').nth(0).fill(phone);
    await page.locator('input').nth(1).fill('password1');
    await page.getByText(/^Login$/).last().click();
    await page.waitForTimeout(2500);
  };
  const go = async (screen, params) => { await page.evaluate(([s, p]) => window.__nav.navigate(s, p), [screen, params]); await page.waitForTimeout(1800); };
  return { browser, page, errors, shot, visible, tap, login, go };
};

let failures = 0;
exports.step = async (name, fn, c) => {
  try { await fn(); console.log('  ok   ', name); }
  catch (e) { failures++; console.log('  FAIL ', name, '-', e.message.split('\n')[0]); if (c) await c.shot('fail-' + name.replace(/\W+/g, '_')); throw e; }
};
exports.done = () => { if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); } console.log('\nall passed'); };
