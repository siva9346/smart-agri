// Visits every screen for every seeded role at representative viewports and fails on layout breakage:
// page-level horizontal overflow, controls pushed outside the viewport, and button labels that are cut off.
// Content inside an intentional horizontal scroller (chip rows, pipeline board, wide tables) is exempt.
const { start, done } = require('./lib');

const VIEWPORTS = (process.env.VIEWPORTS || '360x800,390x844,430x932,768x1024,1024x768,1366x768,1920x1080')
  .split(',').map(v => v.split('x').map(Number));

const HOME = [['__home__']];
const INTERNAL = [
  ['CrmDashboard'], ['LeadList', { view: 'mine' }], ['Pipeline'], ['CrmReports'], ['ActivityFeed'], ['QuotationList'],
  ['TaskList'], ['TaskForm', { kind: 'FOLLOW_UP' }], ['LeadForm'], ['ConsultationList'], ['AiAssistant'], ['Settings'],
  ['Preferences'], ['Notifications'], ['FertilizerList'], ['Calendar'], ['DailyReport'], ['Targets'], ['QuotationBuilder'],
];
const ADMIN = [['AdminOverview'], ['LeadList', { view: 'all' }], ['UserManagement'], ['UserForm', { role: 'EXPERT' }],
  ['ExpertCoverage'], ['AssignmentRules'], ['QuotationSettings'], ['Announcements'], ['AnnouncementComposer'], ['Performance'],
  ['AddCustomer'], ['ManageStock'], ['SalesReport'], ['EnquiryList'], ['AlertsList'], ['OrderList'], ['CreateCustomer'],
  ['SymptomsList'], ['ExpertAdviceList'], ['UpdateRain'], ['AddProduct'], ['AutomationRules']];
const SUPER = [['WhatsAppConfig'], ['AiConfig'], ['RolePermissions'], ['AuditLog'], ['AddAdmin']];
const FARMER = [['ConsultationRequest'], ['ConsultationList'], ['QuotationList'], ['AiAssistant'], ['Settings'], ['Notifications'],
  ['CropTrackingHome'], ['Symptoms'], ['PurchaseHistory'], ['Enquiry'], ['ExpertAdvice'], ['Profile'], ['RainUpdates'], ['AddLand']];
const ONLY = process.env.ROLES ? process.env.ROLES.split(',') : null;
const ROLES = Object.entries({
  '9000000001': [...HOME, ...INTERNAL, ...ADMIN, ...SUPER], '9000000003': [...HOME, ...INTERNAL],
  '9000000004': [...HOME, ...INTERNAL], '9000000006': [...HOME, ...FARMER],
}).filter(([p]) => !ONLY || ONLY.includes(p));
const SCREEN = process.env.SCREEN;

// Runs in the page. Returns a list of human-readable layout problems.
const inspect = () => {
  const vw = window.innerWidth;
  const out = [];
  const se = document.scrollingElement;
  if (se.scrollWidth > vw + 1) out.push(`page scrolls horizontally (${se.scrollWidth}px > ${vw}px)`);
  // An element is exempt if an ancestor is an intentional horizontal scroller.
  const inScroller = el => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true;
    }
    return false;
  };
  const label = el => (el.getAttribute('aria-label') || el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const seen = new Set();
  for (const el of document.querySelectorAll('[role=button],[role=tab],[role=switch],input,textarea,button,a')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
    if (r.bottom < 0 || r.top > window.innerHeight * 6) continue;
    // Hidden drawer/off-canvas panels sit fully outside the viewport by design.
    if (r.right <= 0 || r.left >= vw) continue;
    if ((r.right > vw + 1 || r.left < -1) && !inScroller(el)) {
      const k = 'off:' + label(el);
      if (!seen.has(k)) { seen.add(k); out.push(`control off-screen: "${label(el)}" [${Math.round(r.left)}–${Math.round(r.right)}]`); }
    }
  }
  // Clipped single-line labels inside buttons (text-overflow ellipsis actually engaged).
  for (const el of document.querySelectorAll('[role=button] div[dir=auto], [role=button] [dir=auto]')) {
    const s = getComputedStyle(el);
    if (s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      const btn = el.closest('[role=button]');
      if (btn && inScroller(btn)) continue;
      const t = el.innerText.trim().slice(0, 40);
      // Rows with long free-text (lead names, product names) are expected to truncate; only flag short labels.
      if (t.length <= 28 && !seen.has('clip:' + t)) { seen.add('clip:' + t); out.push(`label clipped: "${t}" (${el.clientWidth}px < ${el.scrollWidth}px)`); }
    }
  }
  return out;
};

(async () => {
  let problems = 0;
  for (const [phone, screens] of ROLES) {
    const c = await start();
    await c.login(phone);
    const home = await c.page.evaluate(() => window.__nav.getCurrentRoute()?.name);
    for (const [w, h] of VIEWPORTS) {
      await c.page.setViewportSize({ width: w, height: h });
      for (const [name, params] of screens) {
        if (SCREEN && name !== SCREEN) continue;
        if (name === '__home__') await c.page.evaluate(() => window.__nav.reset?.({ index: 0, routes: [{ name: window.__nav.getRootState().routes[0].name }] }));
        else await c.go(name, params);
        await c.page.waitForTimeout(name === '__home__' ? 1500 : 200);
        const found = await c.page.evaluate(inspect);
        if (found.length) {
          problems++;
          const id = `${name === '__home__' ? home : name}${params ? JSON.stringify(params) : ''}`;
          console.log(`${phone} ${w}x${h} ${id}`);
          found.slice(0, 6).forEach(f => console.log('    ' + f));
          if (process.env.SHOTS) await c.shot(`resp-${phone}-${w}-${id.replace(/\W+/g, '_')}`);
        }
      }
    }
    await c.browser.close();
  }
  console.log(`\n${problems} screen/viewport combination(s) with layout problems`);
  if (problems) process.exit(1);
  done();
})();
