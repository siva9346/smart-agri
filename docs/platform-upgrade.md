# Smart Agri platform upgrade — roles, consultations, CRM, quotations, AI, notifications

## Architecture (unchanged foundations)

- **App:** Expo 54 / React Native 0.81, Redux Toolkit, React Navigation 7. New UI kit in `src/ui` (Ant Design–inspired,
  core RN only — `@ant-design/react-native` was not used because it requires reanimated/gesture-handler, which crash
  this project's Expo Go client).
- **Backend:** Python 3.12 Lambdas behind API Gateway HTTP API (SAM, `backend/template.yaml`), DynamoDB on-demand.
  Schema changes are new tables / GSIs in the template ("migrations"); existing tables keep their data.

## Roles

| Role | How created | Notes |
|---|---|---|
| `SUPER_ADMIN` | `backend/scripts/create_admin.py`, or Add Admin screen (capped) | Always has every permission |
| `ADMIN` | Super Admin → User Management | Manages staff/experts, CRM, consultations, announcements |
| `STAFF` | Admin / Super Admin → User Management | CRM leads (own + shared pool), quotations, follow-ups |
| `EXPERT` | Admin / Super Admin → User Management | Assigned consultations + their leads; set **specializations** |
| `FARMER` | Self sign-up / Register Farmer | Customer |

Defaults live in `backend/src/lib/permissions.py`; Super Admin can grant/revoke per role in **Settings → Roles & permissions**.
Customers can never receive internal permissions. Deactivated users are blocked on their next request.

## New backend endpoints

| Path | Function |
|---|---|
| `/consultations/*` | Get Suggestions from Experts, auto-assignment, workflow, recommendations |
| `/crm/*` | Leads, pipeline, activities, calls, WhatsApp click-to-chat, dashboards, reports, customer profiles |
| `/quotations/*` | Backend-priced quotations, approval, sharing, customer response, printable document |
| `/tasks/*` | Follow-ups, appointments, tasks |
| `/users/*` | Staff / expert / admin management, expert workload & coverage |
| `/profile/*` | Own preferences, role-specific fields, profile photo |
| `/ai/*` | AI status, assistance, configuration, connection tests, usage |
| `/admin/*`, `/dashboard` | Assignment / quotation / permission settings, audit log, role dashboards |
| `/notifications/inbox/*` | Per-user notification state (read / dismiss / banners / unread count) |
| `/whatsapp/*` | WhatsApp Business config, test send, signed Meta webhook |
| `/crm/daily-report`, `/crm/performance`, `/crm/targets` | Daily report, team performance, sales targets |
| `/profile/push-token` | Device push registration |

Existing routes are unchanged except: `POST /auth/login` rejects deactivated accounts and returns `user.permissions`;
`GET /notifications` now hides announcements not targeted at the caller's role; `POST /notifications` also fans out
per-user inbox records (old `targetRole` / `INFO|WARNING|ALERT|PROMOTION` payloads still work).

## New DynamoDB tables (all `Retain`)

`naveena-consultations`, `naveena-leads`, `naveena-lead-activities`, `naveena-quotations`, `naveena-tasks`,
`naveena-notification-inbox` (TTL `purgeAt`, 180-day history), `naveena-settings` (TTL `expiresAtEpoch` for rate limits),
`naveena-audit-log`. `naveena-users` gains a `RoleIndex` GSI (backfilled automatically by DynamoDB on deploy).

## Environment / secrets

| Item | Where | Notes |
|---|---|---|
| Table names, `PHOTOS_BUCKET`, `AI_KEY_PARAM_PREFIX` | SAM `Globals` | Set automatically |
| OpenAI / Gemini API keys | SSM `SecureString` `/naveena/ai/openai-api-key`, `/naveena/ai/gemini-api-key` | Written **from the app** (Settings → AI configuration). Never returned by the API; only `••••last4` is stored in settings |
| WhatsApp access token / app secret / verify token | SSM `SecureString` `/naveena/whatsapp/*` | Written from the app (WhatsApp Business screen) |
| `EXPO_ACCESS_TOKEN` (optional) | Lambda env | Only if Expo enhanced push security is enabled |
| `EXPO_PUBLIC_API_URL` (optional) | App build env | Overrides the API URL (local / staging) |
| Existing `/naveena/jwt-secret`, Gmail params | SSM | Unchanged |

No API keys exist in the app bundle. The `AiFunction` role may only read/write `/naveena/ai/*` parameters.

## S3

`consultations/` photos are **private**: the bucket policy now makes only `records/`, `products/` and `profiles/`
public; consultation photos are served via 1-hour presigned URLs to authorised viewers.

## Deploy

1. `cd backend && pip install -r tests/requirements.txt && python -m pytest -q tests` (CI runs this before deploy).
2. Push to `master` (GitHub Actions → `sam build` + `sam deploy`), or locally `sam build && sam deploy`.
3. App: `npm install` (adds `expo-print`, `expo-sharing`, `expo-notifications`, `expo-device`, `expo-constants`,
   `react-native-svg`), then build with EAS (`eas build --profile development|production`). Push needs a build, not Expo Go.

## After first deploy

1. Super Admin → **User Management**: create Staff and Experts; give every expert specializations
   (exact crops like `tomato`, categories like `vegetables`, and at least one `general` expert).
2. **Assignment rules**: review crop → category mapping, capacity, escalation hours, lead owner strategy.
3. **Quotation settings**: default tax %, discount limits per role, approval rules, terms, company contact line.
   Products can carry their own `taxRatePct` (otherwise the default applies).
4. **AI configuration**: paste a key → *Test connection* (loads available models) → pick model → *Save* → enable the
   provider → turn on **AI Enabled**. Choose preferred provider and fallback; toggle individual features.

## Push notifications (Expo Push Service)

- The app registers the device's Expo push token after login (`POST /profile/push-token`) and removes it on logout.
- System notifications (assignments, quotations, reminders, escalations…) are pushed automatically; announcements are
  pushed when the **Push** channel is chosen (scheduled ones are pushed by the scheduler when they start).
- Users can turn push off in Preferences; dead tokens reported by Expo are removed automatically.
- Status per recipient: `NO_DEVICE` → `SENT_TO_EXPO` → `DELIVERED_TO_OS` (Expo receipt: handed to Apple/Google) or
  `FAILED`. Shown in Announcements → Delivery stats.
- **Required on your side:** a development or store build (push does not work in Expo Go on Android); upload FCM
  credentials (`google-services.json` / FCM V1 key) and an APNs key to EAS (`eas credentials`). Optional
  `EXPO_ACCESS_TOKEN` env var if you enable Expo's enhanced push security.

## WhatsApp Business Platform (Meta Cloud API)

Configure in **Settings → AI & integrations → WhatsApp Business** (Super Admin):
1. Phone number ID + permanent system-user access token + app secret (stored in SSM `/naveena/whatsapp/*`).
2. Generate the verify token, then in Meta set the webhook callback URL to `<ApiUrl>/whatsapp/webhook`,
   paste the verify token, and subscribe to **messages**.
3. Add approved template names for Quotation / Follow-up / Greeting / Consultation summary (variables listed on screen).
4. Send a test message, then switch **Use WhatsApp Business API** on.

When enabled, leads and quotations get a **Send via WhatsApp Business** option: messages are sent by the API and the
CRM activity moves `ACCEPTED → SENT → DELIVERED → READ` (or `FAILED` with the reason) from signed webhook events.
Customer replies are logged on their lead (unknown numbers create a pool lead), and STOP / START keywords update
WhatsApp consent. Webhooks without a valid `X-Hub-Signature-256` are rejected. Outside the 24-hour customer-service
window WhatsApp only delivers templates; the API's error is shown to the user rather than hidden.
Without configuration, the app keeps using click-to-chat (`NOT_TRACKED`).

## Activities & reporting

- **Calendar** (month view, mine/team), **Field Work** (field-visit tasks with GPS check-in and a visit report),
  **Daily Report** (one person's recorded calls, WhatsApp, visits, completed tasks), **Staff Performance**
  (7/30/90-day metrics for staff and experts, expert response time), **Sales Targets** (monthly revenue / won-lead
  targets; progress = accepted quotations by acceptance month and won leads).
- All figures are computed from recorded data; nothing is entered as "achieved".

## Remaining limits (honest status)

- **Calling:** opens the phone dialer and the user records the outcome; no telephony provider is integrated, so call
  completion/duration is user-reported, never automatic.
- **AI:** tested against the real OpenAI API with an invalid key (correct rejection handling) and with mocked
  providers; answers from a real model will only be seen once you enter a valid OpenAI or Gemini key.
- **Language:** the preferred language is stored; the app UI is English (no translations yet).
- `@react-navigation/stack` is listed in package.json but unused; its gesture-handler peer is not installed.
- Banner rules: server decides visibility (dismissed / read > 24 h / expired / not yet started). X dismisses without
  marking read. Quotation "Viewed" is set only when the customer opens it in the app. PDFs are rendered on-device
  with `expo-print` from server-generated HTML.
- Scheduler (`SchedulerFunction`, every 15 min): reminders, escalation of consultations waiting longer than
  *escalateAfterHours* (retrying auto-assignment first), quotation expiry, scheduled pushes, push receipts.

## Local development (no AWS needed)

```bash
pip install -r backend/tests/requirements.txt
PORT=3055 python backend/scripts/local_api.py      # real handlers + in-memory DynamoDB/SSM/S3, seeded users
EXPO_PUBLIC_API_URL=http://localhost:3055/v1 npx expo start --web --port 8095
```
Seeded logins (password `password1`): 9000000001 Super Admin · 9000000002 Admin · 9000000003 Staff ·
9000000004 Expert (tomato) · 9000000005 Expert (general) · 9000000006 Farmer. `EXPO_PUBLIC_API_URL` also lets you
point a build at a staging stack.

## Tests

- `backend/tests/` (pytest + moto, real table definitions from `template.yaml`): spec tests 1–16, legacy
  compatibility, push, WhatsApp (signatures, statuses, inbound, opt-out), field work, reports, targets. CI runs them
  before every deploy.
- `e2e/` (Playwright, Expo web + local API): every screen for every role, plus the full consultation → quotation →
  acceptance flow and the banner/X-dismiss behaviour. See `e2e/README.md`.
