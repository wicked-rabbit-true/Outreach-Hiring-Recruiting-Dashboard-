# Outreach Hiring · Recruiting Dashboard (Version 1)

Password-protected Next.js dashboard that reads the existing Google Sheet (filled from GoHighLevel by Zapier),
cleans it, and shows leads, pipeline stages, quiz results, conversion rates and ROI.
3 pages (Dashboard, Leads, Managers), 2 logins (master, shared viewer). No database.

## Run it

```bash
npm install
cp .env.example .env.local     # fill in the values
npm run selftest               # checks the counting rules without touching the sheet
npm run reconcile              # prints the weekly table from the live sheet (compare with Stats v2)
npm run dev
```

## Day-1 setup (all in Sam's accounts)

1. **Google Cloud**: create a project, enable *Google Sheets API*, create a *service account*, download its JSON key.
2. **Share the Sheet** with the service account's email as *Editor*.
3. **Add two empty tabs** to the Sheet: `Assignments` and `Spend` (headers are written automatically on first save).
4. **Vercel**: import the repo from Sam's GitHub. Add the env vars from `.env.example`
   (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID`, `MASTER_PASSWORD`, `VIEWER_PASSWORD`, `SESSION_SECRET`).
5. **Cloudflare**: add a CNAME for the subdomain pointing at Vercel, then add the domain in Vercel.
6. **Open `settings/settings.ts`** and make every tab name and column header match the real Sheet exactly
   (several accepted names can be listed per column). The names in the file are best guesses from the spec.
7. Run `npm run reconcile` and compare the weekly table with 4+ past weeks of the **Stats v2** tab.
   Differences should only come from duplicates or test rows. The master dashboard also shows a "Sheet check"
   banner when a configured tab or column cannot be found.

## Using MySQL instead of the Google Sheet

Set `DATA_SOURCE=mysql` (default is `sheets`) and the `MYSQL_*` variables from `.env.example`. Then:

```bash
npm install
npm run mysql:init                 # creates lead_records, assignments, spend (sql/schema.sql)
npm run mysql:import -- --replace  # optional one-off copy from the Google Sheet (needs the Google env vars too)
npm run reconcile                  # same weekly table, now computed from MySQL
```

- `lead_records` has one row per event. `kind` is one of `lead`, `abandoned`, `disqualified`, `passed`, `passedNoInterview`,
  `booked1`, `booked2`, `hiredList`, `dispo`, `autoNoShow` (the old sheet tabs). Whatever fills the database (Zapier, a webhook,
  GHL later) just inserts rows; duplicates and test rows are cleaned by the app, as before.
- Store timestamps in **UTC** `DATETIME`. Leave `action_at` NULL to fall back to the creation date.
- Assignments and weekly spend are written to the `assignments` and `spend` tables (spend is one row per week, saving again updates it).
- Table names live in `settings.mysql.tables`. Everything else (counting rules, pages, roles) is unchanged.
- Hosted databases that need TLS: set `MYSQL_SSL=true`. On Vercel the database must accept connections from the internet
  (or use a provider with a serverless-friendly proxy). The pool is limited to 5 connections per instance.

## How it is organised

```
settings/public.ts      stage labels, funnel order, weekly columns, lead tabs, pill colours (browser-safe)
settings/settings.ts    sheet tabs + column names, dispo values, managers, test-lead patterns, env var NAMES
lib/types.ts            domain types + the DataSource interface (the V1 -> V2 seam)
lib/data/sheets.ts      Google Sheets reader/writer: the ONLY file that knows the sheet layout
lib/data/mysql.ts       MySQL reader/writer (sql/schema.sql); chosen with DATA_SOURCE=mysql
lib/data/index.ts       chooses the data source
lib/engine/model.ts     cleaning: one person per email/phone, test leads, stage dates, round detection
lib/engine/metrics.ts   every number on screen (KPIs, ROI, funnel, weekly table, leads, managers)
lib/engine/range.ts     Today / week / month / custom in Pacific time
lib/model-cache.ts      2-minute in-memory cache; serves last good copy if a refresh fails
lib/auth.ts, middleware.ts, lib/api.ts   signed cookie sessions, route guards, role checks
app/api/*               dashboard, leads, leads/[id], managers (GET); assign, spend, hide (master-only POST)
app/(app)/*             the three pages (client components that call the API and refresh every 2 min)
```

### Switching to GoHighLevel in V2

Write `lib/data/ghl.ts` that implements `DataSource` (`load()` returns a `Snapshot` of normalised records;
`addAssignment` / `setSpend` write wherever they should live), then change one line in `lib/data/index.ts`.
The engine, API routes and pages do not change.

### Security

- Passwords, the Google key and the session secret exist only in Vercel env vars. `settings.ts` holds env var *names*.
- Sessions are HMAC-signed, httpOnly, SameSite=Lax cookies (7 days). Middleware requires a session for every page and API route except login.
- Roles are enforced in the route handlers: `assign`, `spend`, `hide` return 403 for viewers, and `/api/leads/[id]`
  only includes raw quiz answers when the session is master. The list endpoints never contain answers.
- `assign` takes only a lead id from the browser; the name/email/phone written to the sheet come from the server's own data.
- Login has a basic per-instance attempt limit. Writes also check the Origin header.

## Counting rules as implemented (see `lib/engine/model.ts`)

- One record per person: rows are merged by email, then phone (transitively). Rows with neither are matched on name.
- Test leads (name/email patterns, `test@test.test`) are dropped. Master can hide any other lead (stored as a marker row in the `Assignments` tab, so no third tab is needed).
- Each stage is dated by its own action date; blank action date falls back to the lead's creation date. Leads count by creation date.
- Weeks are Monday to Sunday in Pacific time. Mixed real dates, ISO text and day-first typed text (`24/9/2025`) are normalised in the sheet adapter.
- Each person counts once per stage (earliest date). A lead created Sep 29 who shows on Oct 7 is a lead in the Sep 29 week and a show in the Oct 6 week.
- Interview round comes from the lead's history: Rejected / No show / Unresponsive is 2nd round if the 2nd interview was booked on an earlier day. "No show" entered by Sam is always 2nd round. Unresponsive counts as a no-show in its round.
- 2nd-round Rejected and Hired also count as "2nd interview showed". Pending = latest dispo is "Held 2nd interview - undetermined outcome" with no Hired/Rejected after it.
- Quiz pass rate = passed ÷ (passed + disqualified). Show rate = showed ÷ (showed + no-show), 1st interviews. Quiz completion = (passed + disqualified) ÷ leads.
- ROI: cost per lead / quiz-passer use the selected week's spend; cost per show / hire use the last 4 weeks of spend and results.

## Things to confirm with Sam (the spec leaves them open)

1. **Sheet names**: every tab/column in `settings.ts` (especially the quiz answer columns and the step column on Abandoned/Disqualified).
2. **Quiz pass/fail per question**: V1 derives it from the step a lead was disqualified at (earlier steps pass, that step fails, later steps blank; passed leads pass all). If the sheet marks each answer pass/fail, add a rule in `quizResults`.
3. **"Active at 30 days"** (Managers page): the spec gives no data source. V1 counts a started recruit as active unless the Hired list's `Status` column holds one of `inactiveStatuses`; only recruits started 30+ days ago are counted.
4. **"Passed, no interview"** and **Pending** are taken straight from the tab / latest dispo as the spec describes; check them against Stats v2 on day 1.
5. **Show rate** uses 1st interviews only (matches the mock: 8 showed, 3 no-show). Change in `kpiSet` if 2nd interviews should be included.
6. Ambiguous typed dates (both parts 12 or under) are read day-first (`ambiguousDateOrder`).
7. Managers page date filter from the mock is not implemented: the results table is fixed to the last 90 days as written in the spec.
