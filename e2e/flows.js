// Core cross-role workflows (spec tests 1, 3, 4, 5, 13): run against a freshly started local_api.py.
const { start, step, done } = require('./lib');

(async () => {
  let c;
  console.log('Customer requests expert advice');
  c = await start();
  try {
    await step('farmer login', () => c.login('9000000006'), c);
    await step('open request form', () => c.tap('Get Suggestions from Experts'), c);
    await step('fill form', async () => {
      await c.page.getByPlaceholder('e.g. Tomato').fill('Tomato');
      await c.tap('Choose problem type'); await c.tap('Disease (spots, rot, wilting)');
      await c.page.getByPlaceholder(/Lower leaves turning yellow/).fill('Lower leaves yellow with brown rings, spreading upward');
      await c.tap('High');
    }, c);
    await step('submit', () => c.tap('Send to expert'), c);
    await step('auto-assigned to tomato expert', () => c.visible('Dr. Meena (Tomato expert)').first().waitFor({ timeout: 5000 }), c);
  } catch {}
  await c.browser.close();

  console.log('Expert recommends a product');
  c = await start();
  try {
    await step('expert login', () => c.login('9000000004'), c);
    await step('open consultation', async () => { await c.tap('Consultations'); await c.tap('Tomato · Disease'); }, c);
    await step('accept', () => c.tap('Accept consultation'), c);
    await step('recommend', async () => {
      await c.tap('Provide recommendation');
      await c.page.getByPlaceholder(/Likely cause/).fill('Early blight. Remove infected leaves; spray neem oil weekly.');
      await c.tap('Add a product'); await c.tap('Neem Oil 1500 ppm');
      await c.tap('Send to customer');
    }, c);
    await step('status is Recommendation provided', () => c.visible('Recommendation provided').first().waitFor({ timeout: 5000 }), c);
  } catch {}
  await c.browser.close();

  console.log('Staff quotes, admin approves, staff shares, customer accepts');
  c = await start();
  try {
    await step('staff login', () => c.login('9000000003'), c);
    await step('open lead', async () => { await c.tap('Leads'); await c.tap('Murugan'); }, c);
    await step('build quotation from recommendation', async () => {
      await c.tap('Create quotation'); await c.page.waitForTimeout(1500);
      await c.tap('Add recommended products'); await c.page.waitForTimeout(1500);
      await c.tap('Create draft quotation'); await c.tap('Submit');
    }, c);
    await step('backend total ₹531.00 (450 + 18% tax)', () => c.visible('₹531.00').first().waitFor({ timeout: 5000 }), c);
  } catch {}
  await c.browser.close();
  c = await start();
  try {
    await step('admin login', () => c.login('9000000002'), c);
    await step('approve from banner', async () => { await c.tap('Quotation awaiting approval'); await c.tap('Approve'); }, c);
  } catch {}
  await c.browser.close();
  c = await start();
  try {
    await step('staff shares in-app', async () => {
      await c.login('9000000003'); await c.tap('Quotations');
      await c.page.getByText(/^QT-/).filter({ visible: true }).first().click(); await c.page.waitForTimeout(1500);
      await c.tap('Share with customer'); await c.tap("Send to customer's app");
    }, c);
  } catch {}
  await c.browser.close();
  c = await start();
  try {
    await step('customer accepts', async () => {
      await c.login('9000000006'); await c.tap('Quotations');
      await c.page.getByText(/^QT-/).filter({ visible: true }).first().click(); await c.page.waitForTimeout(1500);
      await c.tap('Accept quotation'); await c.tap('Accept');
    }, c);
    await step('quotation Accepted', () => c.visible('Accepted').first().waitFor({ timeout: 5000 }), c);
  } catch {}
  await c.browser.close();

  console.log('Announcement banner, X dismiss persists, still unread');
  c = await start();
  try {
    await step('admin sends to customers', async () => {
      await c.login('9000000002'); await c.go('AnnouncementComposer');
      const f = c.page.locator('input:visible, textarea:visible');
      await f.nth(0).fill('Heavy rain alert'); await f.nth(1).fill('Delay spraying until Saturday.');
      await c.tap('All users (non-admin)'); await c.tap('Customers');
      await c.tap('Send announcement'); await c.tap('Send');
    }, c);
  } catch {}
  await c.browser.close();
  c = await start();
  try {
    await step('banner shows', async () => { await c.login('9000000006'); await c.visible('Heavy rain alert').first().waitFor({ timeout: 5000 }); }, c);
    await step('X dismisses', async () => {
      await c.page.getByLabel('Dismiss notification banner').filter({ visible: true }).click(); await c.page.waitForTimeout(800);
      if (await c.visible('Heavy rain alert').count()) throw new Error('still visible');
    }, c);
    await step('stays dismissed after restart', async () => {
      await c.login('9000000006');
      if (await c.visible('Heavy rain alert').count()) throw new Error('reappeared');
    }, c);
    await step('still unread in Notification Center', async () => {
      await c.go('Notifications');
      await c.page.getByLabel(/^Unread\. Heavy rain alert/).filter({ visible: true }).waitFor({ timeout: 4000 });
    }, c);
  } catch {}
  await c.browser.close();
  done();
})();
