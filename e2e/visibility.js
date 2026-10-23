// Quotation-only product visibility: customers never see the catalogue, internal roles still do.
const { start, step, done } = require('./lib');

const API = `http://${process.env.API_HOST || 'localhost:3055'}/v1`;
const PRODUCT = 'Neem Oil 1500 ppm';           // seeded by backend/scripts/local_api.py
const CATALOGUE_UI = /Fertilizer Store|Browse Products|Add to Cart|My Cart/;

// The app keeps its token in memory, so reuse the Authorization header of its own API calls.
const watchToken = c => { c.auth = null; c.page.on('request', r => { const h = r.headers().authorization; if (h) c.auth = h; }); };
const apiAs = async (c, path) => {
  if (!c.auth) throw new Error('no session token seen');
  return c.page.evaluate(async ([url, auth]) => (await fetch(url, { headers: { Authorization: auth } })).status, [`${API}${path}`, c.auth]);
};

(async () => {
  let c = await start();
  watchToken(c);
  try {
    await c.login('9000000006');
    await step('customer home has no products tab or store', async () => {
      const body = await c.page.locator('body').innerText();
      if (CATALOGUE_UI.test(body) || body.includes('Fertilizers')) throw new Error('catalogue entry visible on home');
      await c.visible('My Quotations').first().waitFor({ timeout: 5000 });
    }, c);
    await step('customer drawer has no Products / store items', async () => {
      await c.go('FarmerTabs', { screen: 'Home' });
      const header = await c.page.locator('header, [role="banner"]').first().boundingBox().catch(() => null);
      await c.page.mouse.click(30, header ? header.y + header.height / 2 : 40);   // menu button
      await c.visible('Contact Support').first().waitFor({ timeout: 5000 });   // drawer-only item
      const body = await c.page.locator('body').innerText();
      if (/Fertilizer Store|\bProducts\b|\bCart\b/.test(body)) throw new Error('Products menu item visible');
    }, c);
    for (const [screen, params] of [['FertilizerList'], ['ProductDetails', { productId: 'x' }], ['Cart'], ['Checkout']]) {
      await step(`customer cannot open ${screen} by route`, async () => {
        await c.go(screen, params);
        const body = await c.page.locator('body').innerText();
        if (body.includes(PRODUCT) || CATALOGUE_UI.test(body)) throw new Error(`${screen} rendered catalogue content`);
      }, c);
    }
    await step('customer API: /products is forbidden', async () => {
      const status = await apiAs(c, '/products');
      if (status !== 403) throw new Error(`expected 403, got ${status}`);
    }, c);
  } catch {}
  await c.browser.close();

  c = await start();
  watchToken(c);
  try {
    await c.login('9000000003');
    await step('staff can browse products', async () => {
      await c.go('FertilizerList');
      await c.visible(PRODUCT).first().waitFor({ timeout: 8000 });
    }, c);
    await step('staff API: /products is allowed', async () => {
      const status = await apiAs(c, '/products');
      if (status !== 200) throw new Error(`expected 200, got ${status}`);
    }, c);
  } catch {}
  await c.browser.close();
  done();
})();
