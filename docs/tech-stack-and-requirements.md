# Smart Agri — Tech Stack & Requirements Report

Generated 2026-10-27 from the repository (`master`, 25 commits). Facts below come from `package.json`, `app.json`,
`eas.json`, `backend/template.yaml`, `backend/src`, `.github/workflows/deploy.yml` and the code itself.

## 1. What the system is

A mobile-first agriculture platform for farmers, experts, sales staff and administrators: crop/land tracking,
expert consultations, a shared CRM, quotations, notifications, WhatsApp/push messaging, optional AI assistance and
configurable automations. One React Native codebase (Android, iOS, web) talks to a serverless AWS backend.

## 2. Tech stack

### Client (`/src`, ~144 TypeScript files)

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54, React Native 0.81.5, React 19.1, TypeScript 5.9 |
| Targets | Android (`com.siva_4693.agrimanageapp`), iOS, web (react-native-web 0.21) |
| Navigation | React Navigation 7 (native-stack, bottom-tabs, custom drawer) |
| State | Redux Toolkit 2 + react-redux 9 |
| HTTP | axios (wrapper in `src/services/api.ts`, typed clients in `src/services/platform.ts`) |
| UI | In-house Ant-Design-inspired kit (`src/ui`, core RN only), lucide-react-native icons, react-native-svg, expo-linear-gradient |
| Device features | expo-location, expo-image-picker (camera/gallery), expo-notifications (push), expo-print + expo-sharing (quotation PDFs), expo-device, expo-constants |
| Build / release | EAS Build (`development`, `preview`, `production` profiles, auto-increment) |

Deliberately **not** used: `@ant-design/react-native` and reanimated/gesture-handler (they crash the project's Expo Go client).

### Backend (`/backend`, ~8,750 lines of Python)

| Layer | Technology |
|---|---|
| Runtime | Python 3.12 on AWS Lambda (arm64, 512 MB, 29 s timeout), packaged with AWS SAM |
| API | API Gateway HTTP API (`/v1`), one Lambda per domain (25 functions), shared `lib/` |
| Database | DynamoDB on-demand, 19 tables with GSIs (users, lands, crop cycles, daily records, products, orders, advice, notifications, enquiries, symptoms, consultations, leads, lead activities, quotations, tasks, notification inbox, settings, audit log, automation runs); all `Retain` |
| Storage | S3 bucket for record / product / profile photos (public prefixes) and consultation photos (private, presigned URLs) |
| Secrets | SSM Parameter Store (JWT secret, Gmail credentials; SecureString for OpenAI/Gemini keys and WhatsApp tokens, written from the app, never returned) |
| Auth | PyJWT 2.8 bearer tokens, bcrypt 4.1.3 password hashes, role + permission checks re-reading the live user on each request |
| Scheduling | EventBridge: 15-minute scheduler (reminders, escalation, quotation expiry/follow-up, AI alerts, scheduled pushes) and daily deleted-account purge |
| Email | Gmail SMTP (OTP / password reset) |
| Integrations | OpenAI and Google Gemini (text + image), WhatsApp Business Cloud API (Meta Graph), Expo Push Service |

### Quality, CI/CD, tooling

| Area | Technology |
|---|---|
| Backend tests | pytest + moto (DynamoDB/SSM/S3 built from the real `template.yaml`); 81 tests passing at last run |
| Browser tests | Playwright-core 1.56 against Expo web + local API (`e2e/`: smoke, flows, responsive, visibility) |
| Local dev | `backend/scripts/local_api.py` runs the real handlers on in-memory moto with seeded users for every role |
| CI/CD | GitHub Actions: pytest, then `sam build` + `sam deploy` on push to `master` (paths `backend/**`), AWS auth via OIDC role. **A push to `master` deploys production.** |
| Region / stack | `ap-south-1`, stack `naveena-uzhavan` |

## 3. Software requirements (to build, run, deploy)

| Need | Version / detail |
|---|---|
| Node.js | 20.x (project is run on 20.20) with npm; `npm install` in repo root and `e2e/` |
| Expo / EAS CLI | Expo SDK 54; EAS CLI >= 18.7.0 |
| Python | 3.12 for deployment parity (3.14 also ran the tests locally); install `backend/tests/requirements.txt` in a virtualenv (system pip is blocked by PEP 668 on Homebrew) |
| AWS SAM CLI | for `sam build` / `sam deploy` |
| AWS account | DynamoDB, Lambda, API Gateway, S3, SSM, EventBridge, IAM; GitHub OIDC deploy role in secret `AWS_DEPLOY_ROLE_ARN` |
| SSM parameters | `/naveena/jwt-secret`, `/naveena/gmail-address`, `/naveena/gmail-app-password` (String type) |
| Mobile builds | Push notifications need a development/store build (not Expo Go); FCM credentials + APNs key uploaded to EAS |
| Optional env | `EXPO_PUBLIC_API_URL` (point app at local/staging API), `EXPO_ACCESS_TOKEN` (Expo enhanced push security) |
| External accounts (optional features) | OpenAI and/or Gemini API key; Meta WhatsApp Business account (phone number ID, permanent token, app secret, approved templates) |
| Disk | Note: the dev machine dropped to ~400 MB free during this work; keep a few GB free for installs and simulators |

Runtime permissions requested on device: location (weather), camera, photo library.

## 4. Functional requirements and current status

| Area | Requirement | Status |
|---|---|---|
| Roles | Super Admin, Admin, Staff, Expert, Farmer with default permissions, Super-Admin-editable per role; customers can never hold internal permissions; deactivated users blocked immediately | Built |
| Farm management | Lands, crop cycles, daily activity records with photos, weather, symptoms, advice, products, orders, enquiries | Built (original app) |
| Consultations | Farmer submits with photos; auto-assignment by exact crop, related category, general expert, else admin queue; reasons/history, reassignment, escalation | Built |
| CRM | Leads, pipeline stages, activities, calls (dialer launch vs completed call kept distinct), duplicates, dashboards, reports, daily report, performance, targets | Built |
| Quotations | Backend pricing, tax/discount limits, approval, sharing, customer accept/reject, printable document, expiry | Built |
| Tasks | Follow-ups, appointments, field visits with GPS check-in, calendar | Built |
| Notifications | Per-user inbox, read/dismiss independent, banner rules (X dismiss, 24 h after read, expiry), announcements, push | Built |
| WhatsApp | Business API sending, delivery states (accepted/sent/delivered/read/failed), signed webhook, opt-out; click-to-chat fallback | Built; needs Meta credentials to verify live |
| AI | Provider control (OpenAI/Gemini), global and per-feature switches, fallback, rate limit, usage counts, assistant incl. crop-photo analysis | Built; real answers unverified until keys are entered |
| Automation | Four predefined, toggleable rules with execution history, duplicate prevention, retry, approval gate | Built |
| Audit | Role/permission, assignment, quotation, AI-config and automation changes logged | Built |
| Product visibility | Customers have no product catalogue; products reach them via quotations | In progress (uncommitted changes in working tree when checked) |
| Multilingual UI | Tamil, Telugu, Kannada, Malayalam, Hindi, English | **Not built** — only the preference field is stored |
| Knowledge base (RAG) | Source-grounded answers with citations | **Not built** |
| Telephony | Provider-reported call completion/duration | **Not built** — dialer launch plus user-recorded outcome only |
| AI cost metrics | Token/cost reporting | Not built; request/error counts only (no invented figures) |

## 5. Non-functional requirements

- **Security:** no API keys in the app bundle; secrets only in SSM; keys never returned in full; WhatsApp webhooks rejected without a valid `X-Hub-Signature-256`; consultation photos private; account-deletion flow with 30-day grace purge (Play Store compliance).
- **Reliability:** idempotent consultation submit, webhook message ids and automation runs; conditional writes against double processing; AI failures never block the normal workflow.
- **Performance:** server-side pagination, GSIs for every list query, on-demand DynamoDB, 30 s settings cache per Lambda container.
- **Compliance docs:** privacy policy, account-deletion page and Play Console form notes under `docs/`.

## 6. Known risks and limitations

1. **Deployment gate:** `master` auto-deploys to production; at last check the platform upgrade was already merged and pushed to `master`, so production may be running it unreviewed.
2. **Unverified externally:** real AI answers, real WhatsApp delivery and real push delivery have not been exercised (no credentials in the test environment).
3. **Table names are fixed** (`naveena-*`), so a staging stack needs a different region or account.
4. `@react-navigation/stack` is listed in `package.json` but unused.
5. The working tree held uncommitted, unrelated changes (product visibility) at the time of writing.

## 7. Suggested next phase

Multilingual UI (i18next + translations), RAG knowledge base (needs an embedding provider and vector store decision), and a telephony provider if call tracking is required.
