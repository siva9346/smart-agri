# Play Console Forms — Answer Key

Fill these in exactly as listed when you get to "App content" in Play Console.
(App content > Data safety / Content rating / Ads / Target audience etc.)

## 1. Content Rating Questionnaire (IARC)
Category: **Utility, Productivity, Communication, or Other** (pick "Utility" —
this is a farm/business management app, not a game)

Answer these truthfully as you go — for this app the answers should all be "No":
- Violence: No
- Sexual content: No
- Profanity: No
- Controlled substances (drugs/alcohol/tobacco references): No
- Gambling: No
- User-generated content shared with other users: No (enquiries/advice go to
  admin/experts, not shared publicly between farmers)
- Shares location with other users: No
- Allows purchases: **No** (checkout flow is Cash on Delivery only — no
  in-app payment gateway. Revisit this answer if you add online payment
  later.)

Expected result: rating should come back as "Everyone" / "3+" or similar low
tier.

## 2. Data Safety Form
This is the most scrutinized form — answer based on what the app actually
does (see backend/src/handlers for the real data flows).

### Does your app collect or share any of the required user data types?
**Yes**

### Data types to declare as COLLECTED:

| Data type | Collected? | Shared? | Purpose | Optional? |
|---|---|---|---|---|
| Name | Yes | No | Account management, App functionality | Required |
| Phone number | Yes | No | Account management, App functionality | Required |
| Approximate location | Yes | Yes (to weather provider) | App functionality | Optional (user can deny permission) |
| Precise location | Yes | Yes (to weather provider) | App functionality | Optional |
| Purchase history | Yes | No | App functionality | Required (if user places orders) |
| App activity — other user-generated content (crop/expense/land records, enquiries) | Yes | No | App functionality | Required |

Everything else (Financial info beyond purchase history, Health, Messages,
Photos/videos, Contacts, Web browsing history, App info & performance,
Device/other IDs) → **No, not collected**, unless you later add crash
reporting/analytics — if you add Sentry/Crashlytics/Firebase Analytics later,
come back and update this form.

### Security practices section
- "Is data encrypted in transit?" → **Yes** (HTTPS/TLS to API Gateway)
- "Can users request data deletion?" → **Yes** — provide the URL:
  `https://siva9346.github.io/smart-agri/account-deletion.html`
- "Data collection required for app to function?" → mostly Yes for
  name/phone (login), location is optional

### Third parties data is shared with
- OpenWeatherMap (location coordinates, for weather forecasts only)

## 3. Target Audience & Content
- Target age group: **18 and over** (safest choice — avoids extra
  "Designed for Families" requirements; this is a farmer business tool, not
  aimed at children)
- "Appeal primarily to children?" → No

## 4. Ads
- "Does your app contain ads?" → **No** (no ad SDK present in the codebase)

## 5. Government apps / News apps declarations
- Not a government app, not a news app → answer No to both

## 6. Data safety — App access
If any screens require login and Google reviewers can't access them without
credentials, you'll be asked for a **test account**. Provide a real
phone/password for a demo farmer account here so Google's reviewer can log in
and review the full app (this is required, not optional, if login is
mandatory to use the app).
