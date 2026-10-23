// Opens every screen for every seeded role and fails on crashes, 4xx/5xx responses or error states.
const { start, done } = require('./lib');

const INTERNAL = [
  ['CrmDashboard'], ['LeadList', { view: 'mine' }], ['LeadList', { view: 'pool' }], ['Pipeline'], ['CrmReports'], ['ActivityFeed'],
  ['QuotationList'], ['TaskList'], ['TaskList', { kind: 'APPOINTMENT' }], ['TaskForm', { kind: 'FOLLOW_UP' }], ['LeadForm'],
  ['ConsultationList'], ['AiAssistant'], ['Settings'], ['Preferences'], ['Notifications'], ['FertilizerList'],
  ['Calendar'], ['DailyReport'], ['Targets'], ['TaskList', { kind: 'FIELD_VISIT' }], ['TaskForm', { kind: 'FIELD_VISIT' }],
];
const ADMIN = [['AdminOverview'], ['LeadList', { view: 'all' }], ['UserManagement'], ['UserForm', { role: 'EXPERT' }], ['ExpertCoverage'],
  ['AssignmentRules'], ['QuotationSettings'], ['Announcements'], ['AnnouncementComposer'], ['ConsultationList', { status: 'AWAITING_ASSIGNMENT' }],
  ['Performance'], ['AddCustomer'], ['ManageStock'], ['SalesReport'], ['EnquiryList'], ['AlertsList']];
const SUPER = [['WhatsAppConfig'], ['AiConfig'], ['RolePermissions'], ['AuditLog'], ['AddAdmin']];
const FARMER = [['ConsultationRequest'], ['ConsultationList'], ['QuotationList'], ['AiAssistant'], ['Settings'], ['Preferences'],
  ['Notifications'], ['CropTrackingHome'], ['Symptoms'], ['PurchaseHistory'], ['Enquiry'], ['ExpertAdvice'], ['Profile']];
const ROLES = { '9000000001': [...INTERNAL, ...ADMIN, ...SUPER], '9000000002': [...INTERNAL, ...ADMIN],
                '9000000003': INTERNAL, '9000000004': INTERNAL, '9000000006': FARMER };
const BAD = /Something went wrong|Internal server error|Unknown route|Access denied|Failed to load|Error:/i;

(async () => {
  let problems = 0;
  for (const [phone, screens] of Object.entries(ROLES)) {
    const c = await start();
    await c.login(phone);
    const found = [];
    for (const [name, params] of screens) {
      c.errors.length = 0;
      await c.go(name, params);
      const hit = BAD.exec(await c.page.locator('body').innerText());
      if (hit || c.errors.length) {
        found.push(`${name}${params ? JSON.stringify(params) : ''}: ${hit ? `"${hit[0]}" ` : ''}${c.errors.join(' ; ')}`);
        await c.shot(`smoke-${phone}-${name}`);
      }
    }
    console.log(`${phone}: ${screens.length} screens, ${found.length} problem(s)`);
    found.forEach(f => console.log('  ' + f));
    problems += found.length;
    await c.browser.close();
  }
  if (problems) process.exit(1);
  done();
})();
