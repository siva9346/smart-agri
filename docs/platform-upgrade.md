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
| Existing `/naveena/jwt-secret`, Gmail params | SSM | Unchanged |

No API keys exist in the app bundle. The `AiFunction` role may only read/write `/naveena/ai/*` parameters.

## S3

`consultations/` photos are **private**: the bucket policy now makes only `records/`, `products/` and `profiles/`
public; consultation photos are served via 1-hour presigned URLs to authorised viewers.

## Deploy

1. `cd backend && pip install -r tests/requirements.txt && python -m pytest -q tests` (CI runs this before deploy).
2. Push to `master` (GitHub Actions → `sam build` + `sam deploy`), or locally `sam build && sam deploy`.
3. App: `npx expo install` (adds `expo-print`, `expo-sharing`), then build as usual (`eas build` / `expo start`).

## After first deploy

1. Super Admin → **User Management**: create Staff and Experts; give every expert specializations
   (exact crops like `tomato`, categories like `vegetables`, and at least one `general` expert).
2. **Assignment rules**: review crop → category mapping, capacity, escalation hours, lead owner strategy.
3. **Quotation settings**: default tax %, discount limits per role, approval rules, terms, company contact line.
   Products can carry their own `taxRatePct` (otherwise the default applies).
4. **AI configuration**: paste a key → *Test connection* (loads available models) → pick model → *Save* → enable the
   provider → turn on **AI Enabled**. Choose preferred provider and fallback; toggle individual features.

## Behaviour notes / limits (honest status)

- **WhatsApp:** click-to-chat (`wa.me`) with the message generated from real lead/quotation data. Recorded as
  `deliveryStatus: NOT_TRACKED`. The WhatsApp Business Platform API is **not integrated** (no provider configured).
- **Calling:** opens the dialer and logs "Dialer opened"; the user records the outcome. Nothing is marked completed
  automatically — no telephony provider is integrated.
- **Push notifications:** not configured. The `PUSH` channel is recorded as `NOT_CONFIGURED`. In-app delivery is
  tracked: "delivered" = the recipient's app fetched it.
- **Quotation "Viewed"** is set only when the customer opens it in the app.
- **PDF:** backend returns printable HTML; the app renders it to PDF with `expo-print` and shares it.
- **Notification banner:** server decides visibility (dismissed / read > 24 h / expired / not yet started). X dismisses
  without marking read. Notification preferences can mute categories; Important / Maintenance always deliver.
- Not built (no fabricated data shown instead): sales targets, field-work tracking.
- Scheduler (`SchedulerFunction`, every 15 min): reminders, escalation of consultations waiting longer than
  *escalateAfterHours* (retrying auto-assignment first), quotation expiry.

## Tests

`backend/tests/test_workflows.py` runs against moto-mocked AWS using the real table definitions from
`template.yaml` and covers spec tests 1–16 plus legacy compatibility.
