# Expenditure

A personal expense tracker with Next.js 16.4.3, React 19.3, Tailwind CSS v4, shadcn/ui, and PocketBase. The forest-charcoal palette, Inter typography, Instrument Serif headings, and sign-in landscape follow tkkr.dev.

Production app: **https://expenses.tkkr.dev** on Vercel. API: **https://e.tkkr.dev** on your PocketBase server.

## What works

- Sign in through the providers already configured on PocketBase’s `users` collection. No second authentication system or OIDC secrets in Next.js.
- Add, edit, and delete expenses; search merchants, payment methods, and notes; filter by category, currency, and month; paginate and export all matching rows to Excel (.xlsx) or CSV for Google Sheets.
- Monthly totals, previous-month comparison, daily activity, category spending, and overall/category budgets.
- Custom categories with names, colors, renaming, and archiving. Changes belong to each user.
- Choose enabled currencies from 155 supported fiat currencies and set a main currency for combined totals, conversion previews, and budgets. Defaults: SGD and Asia/Singapore.
- Online reference rates cached in PocketBase, checked hourly. Original amounts stay intact; dated conversions are estimates using the latest available rates.
- Scoped, expiring, revocable personal API keys for adding or reading expenses from Shortcuts and other tools. Secrets are shown once and only SHA-256 hashes are stored.
- Idempotent API writes, live expense updates through PocketBase realtime, and refresh on window focus.
- Responsive layouts, accessible shadcn dialogs and menus, keyboard shortcut `N` for a new expense, and reduced-motion support.

## Run locally

Use Node.js 22.18 or later and pnpm.

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000. `NEXT_PUBLIC_POCKETBASE_URL` defaults to `https://e.tkkr.dev`. This is a public endpoint, not a secret. Set it before building if you use another instance. The frontend needs no PocketBase superuser credentials.

Install the PocketBase files below before using the app. The setup screen appears until the hooks and migrations are installed.

## Install the PocketBase backend

See [pocketbase/README.md](pocketbase/README.md). The backend source lives in `pocketbase/pb_hooks/` and `pocketbase/pb_migrations/`; upload those directories directly. Installation instructions and the OpenAPI specification live alongside them.

Upload the hooks and migrations next to your **existing** PocketBase executable, or to the directories mapped to your PocketBase container. Restart PocketBase to apply the migrations and load the routes. Keep the existing `pb_data` and OIDC configuration. Use PocketBase **0.40.6**, the version validated by the integration tests; do not assume compatibility with older versions.

The migrations add `expenses`, `budgets`, `preferences`, `api_keys`, `categories`, and `exchange_rates`. It references the existing `users` collection and does not replace it or change its provider settings.

## Architecture

The Next.js application is a browser client. PocketBase is the backend: its native collection API handles authenticated expense, budget, and preference operations; its hooks implement category management, exchange-rate caching, API-key management, automation endpoints, and monthly aggregation. There are no Next.js API routes, privileged frontend tokens, or separate Express/FastAPI service.

User-owned collections enforce ownership for every operation and prevent ownership reassignment. `api_keys` is locked to normal collection access, with management available only through custom routes authenticated by a `users` session. API-key secrets work on the automation endpoints, not on PocketBase’s generic collection APIs.

Amounts use positive integer currency minor units: SGD 8.50 = 850, JPY 1000 = 1000, and KWD 1.234 = 1234. The native collection field retains its original name `amount_cents` for compatibility; the automation API uses `amount_minor`. This app tracks expenses, not income, transfers, or refunds. Overall and custom-category budgets apply to a selected month and currency and do not roll over. Changing the main currency shows that currency’s budgets; existing budgets retain their original currency and amount. Excel and CSV exports include every matching row, not just the visible page. Excel amounts are numeric, dates are sortable, and the selected timezone is included in the date header. The original UTC timestamp is preserved in a separate column. Exports also include estimated amounts in the main currency, the exchange rate, its date, and the cache fetch time. Unavailable estimates are blank. Import either file format into Google Sheets. A previous-month comparison compares the selected full month with the previous full month; the current month is month-to-date.

Browser session tokens use PocketBase’s standard local auth store. API keys are never persisted by the frontend. Monthly totals are computed in PocketBase across the entire matching dataset. The activity endpoint groups by UTC minute, and the browser folds those groups into calendar days in the supported timezones. Month boundaries use the selected timezone, including daylight-saving changes.

## Source layout

- `src/components/expense-app.tsx`: sign-in state, workspace navigation, loading data, and saving changes.
- `src/components/`: named feature components for transactions, expense and budget forms, category reports, settings, and API keys. `ui/` contains shared shadcn controls.
- `src/lib/domain.ts`: record types, currency amounts, conversions, and timezone calculations. Amount helpers use currency minor units; the database keeps the legacy `amount_cents` field name.
- `src/lib/export.ts`: CSV and Excel formatting and downloads.
- `pocketbase/pb_hooks/`: server-side validation, owned categories, API keys, report aggregation, and cached exchange rates.
- `pocketbase/pb_migrations/`: ordered database schema changes. Keep applied migrations intact when adding new ones.
- `tests/`: amount, export, API isolation, and upgrade checks.

Commit the source, configuration, documentation, tests, and `pnpm-lock.yaml`. Dependencies, local environment files, build output, PocketBase runtime data, and generated artifacts are excluded by `.gitignore`.

## Categories, currencies, and rates

Use **Settings** to add or rename categories, change their colors, archive or restore them, enable currencies, and set the main currency. Renaming updates existing expenses and budgets together. Archiving hides a category from new entries while keeping historical reports. Disabling a currency also keeps old entries available. Each account’s settings and categories are private.

PocketBase fetches [Frankfurter v2](https://frankfurter.dev/) reference rates from public sources. Its scheduled job checks at minute 7 every hour; opening the app also refreshes an expired cache, with a shared lease to prevent duplicate requests. The browser checks PocketBase every five minutes while visible and on window focus. The upstream source generally publishes daily, not continuously. No provider key or additional backend is needed.

Conversions use the latest cached rates even for historical expenses, rounded once per expense into the main currency. They are estimates, not the actual card or bank exchange rate. Each expense retains its original amount and currency. Failed refreshes preserve the last good quotes; the app flags a cache older than 36 hours. Missing quotes or observations over 14 days old are excluded from converted totals, with an explicit incomplete-total warning. Same-currency expenses need no exchange rate.

For an existing installation, upload all updated `pb_hooks` files, including `currencies.json`, and the new migration `1793100000_categories_currencies_rates.js`, then restart PocketBase. Back up first. The upgrade preserves expense and budget IDs, amounts, categories, preferences, API keys, and idempotency data. See the backend guide for installation and rollback details.

## Timezone

Open **Settings → Timezone**, select a timezone, and save. The selection is stored in your PocketBase account and controls expense entry, displayed dates, monthly report boundaries, daily charts, and export dates. Supported options are Singapore, UTC, Kuala Lumpur, Sydney, London, New York, and Los Angeles. Daylight-saving changes are handled automatically.

## Deploy the frontend

1. Import this project into Vercel with the **Next.js** framework preset. Keep the default build command and output directory; the project builds with `pnpm build`.
2. Set these Vercel environment variables for the environments you deploy:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_POCKETBASE_URL` | `https://e.tkkr.dev` |
   | `ENABLE_EXPERIMENTAL_COREPACK` | `1` |

   Corepack selects the pnpm version pinned in `package.json`. The PocketBase URL is public and embedded in the browser bundle at build time. Redeploy after changing it. Preview deployments use the same backend if given the same URL.
3. Add **`expenses.tkkr.dev`** in the Vercel project's **Settings → Domains**. Apply the DNS records Vercel shows for that project, then deploy to production.
4. Install the PocketBase files on your server as described above. Test sign-in and expense creation from **https://expenses.tkkr.dev**.

The browser talks directly to **https://e.tkkr.dev** for authentication, records, realtime updates, and API-key routes. PocketBase stays on your server; no Vercel API proxy, rewrites, superuser credentials, or OIDC client secret are needed in the frontend.

Set the tkID OAuth callback to **`https://e.tkkr.dev/api/oauth2-redirect`**. The SDK uses PocketBase's popup/realtime flow; **`expenses.tkkr.dev` is the app URL, not an OAuth callback**. If you have restricted PocketBase's `--origins`, include `https://expenses.tkkr.dev` and the exact local or preview origins you use. PocketBase's default CORS configuration already allows the separate frontend origin. The server's reverse proxy must allow PocketBase realtime/SSE connections for OAuth sign-in and live updates.

Reference: [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build), [PocketBase authentication](https://pocketbase.io/docs/authentication/).

## Verify

```sh
pnpm format
pnpm validate
POCKETBASE_BINARY=/absolute/path/to/pocketbase pnpm test:backend
```

`format` applies ESLint's layout fixes. The style rules match tkkr.dev: four-space indentation, double quotes, semicolons, and consistent JSX formatting. `pnpm lint` checks all JavaScript and TypeScript source, configuration, tests, PocketBase hooks, and migrations. Only dependencies, generated output, and PocketBase runtime data are excluded. PocketBase files use their own runtime globals and CommonJS loading.

`validate` runs ESLint, TypeScript, domain and export tests, and a production build. The backend tests start a separate PocketBase process with a fresh temporary database and two disposable users; they never contact `e.tkkr.dev`. They cover ownership isolation, locked key collections, secret hashing, input validation, scopes, retry deduplication (including concurrent requests), timezone boundaries, currency precision, custom categories and category renames, main-currency totals, cached-rate outages, existing-database upgrades, budget uniqueness, expiration, revocation, and user deletion.

Validated locally against PocketBase 0.40.6. Hosted tkID login and installation on `e.tkkr.dev` still require your deployment and a real interactive sign-in.
