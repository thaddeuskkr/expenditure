# Install the Expenditure backend

These files extend an existing PocketBase **0.40.6** installation with expense tracking, custom categories, multi-currency estimates, and personal API keys. They do not include or replace your PocketBase executable, `pb_data`, superuser credentials, or existing `users` OAuth/OIDC configuration.

The frontend is hosted on Vercel at **https://expenses.tkkr.dev**. This backend runs on your server at **https://e.tkkr.dev**. Upload these files only to the PocketBase server.

## Installation

1. Back up your existing `pb_data` directory using PocketBase’s backup facility or a consistent stopped-server backup.
2. From this project's `pocketbase/` directory, copy **all files** inside `pb_hooks/` (including `currencies.json`) and `pb_migrations/` into the corresponding directories used by your existing PocketBase process. Preserve unrelated files. Check for filename conflicts before copying.
3. Restart PocketBase. It automatically applies unapplied migrations on startup. If your service disables automatic migrations, run `./pocketbase migrate up` using the same data, hooks, and migration directories as the service, then restart it.
4. Confirm `https://e.tkkr.dev/api/expenditure/status` returns `{"version":3}`. In the PocketBase dashboard, confirm `expenses`, `budgets`, `preferences`, `api_keys`, `categories`, `exchange_rates`, and the five `circle_*` / `circles` collections exist.
5. Open **https://expenses.tkkr.dev** and sign in using tkID. Add an expense, create a write key under **API keys**, and test the example request below.

For a typical executable installation, the final directory layout is:

```text
pocketbase
pb_data/                         ← preserve your existing data
pb_hooks/
  main.pb.js
  expenditure.js
  configuration.pb.js
  configuration.js
  currencies.json
  exchange-rates.js
  overview.js
  circles.pb.js
  circles-service.js
  circles-core.cjs
  circles-core.d.cts             ← editor types; safe to copy with the hooks
pb_migrations/
  1793026800_expenditure.js
  1793100000_categories_currencies_rates.js
  1793103600_circles.js
```

For Docker, mount the supplied hook and migration directories at the paths your image uses. PocketBase’s `--hooksDir`, `--migrationsDir`, and `--dir` flags can override the defaults. Do not create a second empty `pb_data` volume when installing these files.

The migration requires the existing auth collection to be named `users`. It changes no OIDC or provider settings. Register the callback URL `https://e.tkkr.dev/api/oauth2-redirect` with your provider. There is no separate Next.js OAuth callback.

If you restrict PocketBase CORS using `--origins`, include `https://expenses.tkkr.dev` and any exact local or preview origins you use. The default PocketBase CORS configuration already supports a separate frontend. Ensure your reverse proxy supports PocketBase realtime/SSE connections, which are used during OAuth sign-in and for live expense updates.

The dashboard and API have been tested with PocketBase 0.40.6. If your host runs an older version, check its version and upgrade with the appropriate PocketBase release guidance before installing these files. Do not run the migration against a schema that already has collections named `expenses`, `budgets`, `preferences`, `api_keys`, `categories`, or `exchange_rates` without reviewing the collision. An existing Expenditure installation uses the upgrade procedure below.

## Upgrade an existing Expenditure installation

1. Back up your existing database. Stop PocketBase while copying files if your service automatically reloads hooks.
2. Replace the package’s files in `pb_hooks/`, including the shared `currencies.json`. Preserve unrelated hooks.
3. Add all unapplied migrations, including `1793100000_categories_currencies_rates.js` and `1793103600_circles.js`, to your migration directory. Keep the original applied migration and migration history intact.
4. Restart PocketBase, confirm status version 3, and open Settings in the app.

The upgrade changes category fields from fixed choices to validated text, expands currency choices, adds per-user enabled currencies, and creates `categories` and `exchange_rates`. It preserves existing record IDs, original amounts, category values, preferences, budgets, keys, and retry identifiers. Default categories are created per user on the first configuration request; old data is included. There is no remote migration performed by the Next.js app.

## Categories, currencies, and exchange rates

Each user can add up to 100 categories, set a color, rename them, and archive or restore them in Settings. Names are unique per user without regard to case; `Overall` and `All` are reserved. Renames update that user’s expenses and budgets atomically. Archived categories remain visible in reports and can remain on edited historical expenses; new entries must use an active category.

Users enable currencies from the 155-code catalog in `pb_hooks/currencies.json` and choose one as their main currency. Disabling a currency preserves historical entries. Monthly reports combine converted expense amounts in the main currency; transaction filters can still select an original currency. Budgets are stored in their original currency. Changing the main currency shows that currency’s budgets without rewriting old budgets.

The backend fetches [Frankfurter v2](https://frankfurter.dev/) reference rates from `https://api.frankfurter.dev/v2/rates?base=EUR`. No key is required. A PocketBase cron job checks at minute 7 every hour; authenticated `GET /api/expenditure/rates` also refreshes an expired cache. A shared lease prevents concurrent fetches; failed attempts are limited to one every five minutes. Keep PocketBase running and allow outbound HTTPS to the provider. `EXPENDITURE_FX_URL` is an optional server environment override for a trusted compatible mirror, otherwise leave it unset.

Frankfurter usually publishes daily reference rates, not continuous market ticks. Quotes are cached globally, without sending any expense or user data to the provider. Cross rates use EUR as a pivot. Amounts are rounded per expense to the main currency’s precision. Every conversion uses the latest available observation, including historical expenses, and is an estimate rather than a card settlement rate. Original amounts and currencies are never changed.

Failed fetches retain the last good rates. A cache older than 36 hours is marked stale. Missing quotes or observations over 14 days old are excluded from converted totals; the app warns that the subtotal is incomplete and suppresses an incomplete month comparison. Same-currency expenses need no quote. Conversion previews and exports include rate dates; exports retain original amounts, estimated main-currency amounts, rates, fetch times, and original UTC timestamps.

## API keys

Sign in through the web app to create a key. Keys expire after 30, 90, or 365 days and can be revoked immediately. Each user can have up to 20 active keys; a bounded history of up to 100 keys is retained, pruning inactive keys when necessary.

- `expenses:write`: add expenses using POST below.
- `expenses:read`: list expenses using GET below.
- Select both for both operations.

Only the secret’s hash is stored. The full key is returned once during creation and never appears in subsequent listings. API-key management requires a normal authenticated `users` session; a personal API key cannot create or manage other keys. No superuser credentials belong in the frontend or a Shortcut.

## Automation endpoints

### Add an expense

```sh
curl -X POST 'https://e.tkkr.dev/api/expenses/transactions' \
  -H 'X-API-Key: exp_REPLACE_WITH_YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: a-unique-transaction-id' \
  -d '{
    "merchant": "Apartment Coffee",
    "amount_minor": 650,
    "currency": "SGD",
    "category": "Food & drinks",
    "payment_method": "DBS Live Fresh",
    "occurred_at": "2026-10-26T15:30:00+08:00",
    "notes": "Afternoon coffee"
  }'
```

`merchant` and `amount_minor` are required. Use positive integer currency minor units, up to 99999999999: SGD 6.50 = 650, JPY 1000 = 1000, KWD 1.234 = 1234. Defaults: `currency` = the user’s main currency, `category` = active `Other` or the first active category, `occurred_at` = server time. Legacy `amount_cents` is accepted only for two-decimal currencies; if both amount fields are supplied they must agree. Optional strings: `payment_method` (80 characters), `notes` (2000 characters). Both default to an empty string. The legacy `card` request field is still accepted; when both payment fields are supplied their values must match exactly. Text is stored as supplied. Merchant limit: 160 characters. If supplied, `occurred_at` must be ISO 8601 with `Z` or an explicit timezone offset. The server determines ownership from the key. Omit `user`.

All optional fields are validated by PocketBase before saving. Explicit nulls, arrays, objects, numbers, and booleans are rejected for text fields; defaults apply only when a field is omitted. The currency must be a supported uppercase code enabled in the user’s Settings; an empty string is invalid. The category must be a non-empty string of at most 60 characters naming an active category belonging to that user. Category matching trims surrounding whitespace and is case-insensitive; responses use the configured name. Payment methods are free-text labels such as Cash or Visa, up to 80 characters, and notes allow up to 2000 characters. New users start with SGD, USD, EUR, GBP, AUD, and MYR enabled, and eight editable categories.

Responses include `amount_minor` and the legacy native field `amount_cents`, both containing the same currency minor-unit value. Create, replay, and list responses include `payment_method` and the legacy native `card` field with the same payment label. No database migration is needed for this alias. A new expense returns its record with HTTP 201 and `replay: false`. An exact retry with the same Idempotency-Key returns the original record with HTTP 200 and `replay: true`. Reusing a key with different expense data returns HTTP 409. The idempotency key is optional, scoped to the user, up to 128 characters, and allows letters, digits, underscores, dots, colons, and hyphens. Keep one value for retries of the same purchase and use a new value for each new purchase. If you omit `occurred_at`, a retry can omit it too. Deleting an expense also removes its deduplication record.

### List expenses

```sh
curl 'https://e.tkkr.dev/api/expenses/transactions?page=1&perPage=30' \
  -H 'X-API-Key: exp_REPLACE_WITH_A_READ_KEY'
```

Returns `items`, `page`, `perPage`, `totalItems`, and `totalPages`. Results belong only to the key’s user, ordered newest first. `perPage` is limited to 100. These API keys authorize only these custom automation endpoints; generic PocketBase collection endpoints still require PocketBase authentication tokens.

### Errors

- 400: invalid input, unsupported or disabled currency, inactive/unknown category, invalid expiry/scope, or too many active keys.
- 401: missing, invalid, expired, or revoked key (or an unavailable owning user).
- 403: key lacks the required scope.
- 409: conflicting idempotency key.

Native collection validation returns PocketBase’s usual error responses.

## iPhone Shortcuts

1. Create a key with write permission in Expenditure.
2. Add **Get Contents of URL** with `https://e.tkkr.dev/api/expenses/transactions`.
3. Set method to **POST** and request body to **JSON**.
4. Add headers `X-API-Key` with your key and `Content-Type` with `application/json`.
5. Add `merchant` as Text, `amount_minor` as Number, `currency` as Text (`SGD`), and optionally `category`, `payment_method`, `notes`, and `occurred_at`.
6. Convert the currency amount to integer minor units before sending: multiply SGD/USD by 100, JPY by 1, or KWD by 1000, then round. SGD 8.50 becomes 850. For multiple currencies, use the `digits` value from the supplied catalog.
7. For retries, generate a unique identifier once per purchase and pass it in `Idempotency-Key`. Reuse that identifier only for retries of the same purchase.

Wallet automations can supply available transaction fields to this request. Availability of Wallet trigger fields depends on your iOS version and transaction type; the app does not scrape Apple Wallet.

## Session-authenticated web endpoints

Use a normal PocketBase `users` authentication token in the `Authorization` header:

- `GET /api/expenditure/keys`: safe key metadata only.
- `POST /api/expenditure/keys`: JSON `{ "name": "My iPhone", "scopes": ["expenses:write"], "expires_in_days": 90 }`; returns `{ "key": "exp_…", "record": { … } }` once.
- `DELETE /api/expenditure/keys/{id}`: revokes an owned key.
- `GET /api/expenditure/config`: the user’s preferences, categories (including archived), and currencies already present in their expenses/budgets. Seeds default categories once.
- `POST /api/expenditure/categories`: JSON `{ "name": "Travel", "color": "#bfc9a4" }`; creates an active owned category.
- `PATCH /api/expenditure/categories/{id}`: any of `name`, `color`, `active`; updates an owned category and propagates renames. Keep at least one active category.
- `GET /api/expenditure/rates`: cached `{ quotes, dates, fetched_at, attempted_at, provider, source_url, stale }`. Quotes are units per EUR and dates are per currency; EUR’s identity quote is 1. Refreshes if due.
- `GET /api/expenditure/overview?from=…&to=…&previous=…&currency=all`: converted monthly summary, previous-month total, category totals, minute activity, original totals, and missing conversion counts. Converted totals use main-currency minor units; `original_totals` use each source currency’s minor units. `currency=all` combines source currencies; a supported code filters source records but totals still use the main currency. ISO 8601 bounds must be ordered and span at most 64 days; the frontend calculates local month boundaries.
- Native `/api/collections/expenses/records`, `/budgets/records`, and `/preferences/records`: standard PocketBase CRUD protected by ownership and configuration validation. Preferences include `currency` (main), `currencies` (enabled codes), and `timezone`. The native expense/budget amount field is named `amount_cents` for compatibility but stores currency minor units, including zero- or three-decimal currencies. Category changes must use the custom routes; native category mutations and exchange-rate access are locked.

## Operations

Enable PocketBase’s built-in rate limiter in your existing dashboard settings and choose limits appropriate to your traffic, including `/api/expenses/transactions` and `/api/expenditure/keys`. If using a reverse proxy, configure trusted proxy/IP handling according to your deployment. This package preserves your existing global security settings rather than replacing them.

API key usage timestamps update at most once per minute. Queries bind input parameters, ownership is immutable through native APIs, API-generated expenses retain their provenance, and API-key secrets and hashes are excluded from public responses and logs generated by this code. Configure your proxy not to log `X-API-Key` request headers.

The original migration’s down function **deletes the four original Expenditure collections and their records**. The category/currency migration’s down function deletes category configuration and the rate cache while retaining expanded expense/budget fields, so it is not a full schema reversal. Use a consistent backup to restore an earlier version; do not run `migrate down` merely to disable the frontend or install the previous UI.


## Circles API

Circles require a normal authenticated PocketBase **users session** in the `Authorization` header. The existing personal API keys only authorize the personal automation endpoints. All five Circles collections lock native list/view/create/update/delete access; the routes below recheck membership, owner permissions, record versions, and financial constraints inside transactions. Do not open collection rules to make the frontend work.

| Route | Purpose / permission |
| --- | --- |
| `GET /api/expenditure/circles` | List the caller’s active circles and incoming verified-email invitations. |
| `POST /api/expenditure/circles` | Create `{ name, icon, currency }`; creator becomes owner and member. |
| `GET /api/expenditure/circles/{id}` | Members: circle details, members, balances, suggested settlements, totals, and paginated history. Query `expense_page` and `settlement_page`; each page contains 25 records. |
| `PATCH /api/expenditure/circles/{id}` | Owner: `{ version, name?, icon?, currency?, owner_member? }`. Ownership can transfer only to an active member. |
| `DELETE /api/expenditure/circles/{id}` | Owner: `{ version, confirmation }`, where confirmation exactly matches the current circle name. Permanently removes its whole ledger. |
| `POST /api/expenditure/circles/{id}/invitations` | Owner: `{ email }`. Returns a seven-day email-bound invitation. Reissuing revokes older pending invitations for that address. |
| `GET /api/expenditure/circle-invitations/{invitation}` | Preview an invitation; requires its matching verified email. |
| `POST /api/expenditure/circle-invitations/{invitation}/accept` | Matching verified recipient joins or rejoins, preserving any old ledger identity. |
| `DELETE /api/expenditure/circle-invitations/{invitation}` | Owner revokes or recipient declines an invitation. |
| `DELETE /api/expenditure/circles/{id}/members/{member}` | Owner removes a member; a member may remove themself. All currencies must be settled first. Owners must transfer ownership before leaving. |
| `POST /api/expenditure/circles/{id}/expenses` | Any active member creates a shared expense. |
| `PATCH /api/expenditure/circles/{id}/expenses/{expense}` | Author or owner: full expense payload plus its `version`. |
| `DELETE /api/expenditure/circles/{id}/expenses/{expense}` | Author or owner: `{ version }`. |
| `POST /api/expenditure/circles/{id}/settlements` | Owner, payer, or recipient records a repayment. |
| `DELETE /api/expenditure/circles/{id}/settlements/{settlement}` | Author or owner: `{ version }`; removes the recorded repayment and recalculates balances. |

Invitation links use `https://expenses.tkkr.dev/?circle_invite=INVITATION_ID`. The id is not a bearer credential: acceptance always checks the signed-in account’s current verified email. The same invitation appears in that user’s in-app inbox. No SMTP configuration is needed and the app does not send invitation emails. Ensure the OIDC provider/PocketBase account has a verified email before accepting an invitation. Member profiles expose only display names, ids, and avatar filenames to fellow members; recipient addresses are visible only to the owner and recipient.

### Shared expense payload

Use membership ids returned by circle details (not user ids):

```json
{
  "title": "Dinner",
  "amount_minor": 3050,
  "currency": "SGD",
  "paid_by": "PAYER_MEMBER_ID",
  "split_mode": "percentage",
  "shares": [
    { "member": "FIRST_MEMBER_ID", "value": "60" },
    { "member": "SECOND_MEMBER_ID", "value": "40" }
  ],
  "payment_method": "Visa",
  "notes": "Dinner for two",
  "occurred_at": "2026-10-27T20:00:00+08:00"
}
```

For `even`, omit `value` from each share. For `percentage`, send decimal strings with at most two decimal places, totaling exactly 100. For `exact`, send decimal currency strings (`"18.30"` and `"12.20"` in this example) that add up exactly to the expense amount. Participants must be unique circle members. One participant is valid; the payer need not be a participant. Zero allocations are supported, including rounding very small amounts across multiple people. Amounts are positive integer minor units, capped at 99999999999. Any currency in the shared currency catalog is supported, independent of members’ personal currency preferences. Optional notes are limited to 2000 characters, payment method to 80, and title to 160. Dates follow the same timezone-explicit ISO format as personal expenses; omission uses server time.

The canonical saved `shares` contain integer `amount_minor` values and, for percentage splits, `percentage_bp` (basis points). Largest-remainder allocation distributes leftover units; member id breaks ties deterministically. Original amounts and allocations are never recomputed from changing exchange rates. Balances are `net` minor units per member and currency: positive means gets back, negative means owes. Each currency’s balances sum to zero.

### Record a settlement

```json
{
  "from_member": "DEBTOR_MEMBER_ID",
  "to_member": "CREDITOR_MEMBER_ID",
  "currency": "SGD",
  "amount_minor": 1000,
  "notes": "PayNow repayment",
  "occurred_at": "2026-10-27T21:00:00+08:00"
}
```

The debtor and creditor must be different members with matching outstanding balances in that currency. The amount cannot exceed either remaining balance. Full and partial settlements are supported. Suggested settlements simplify the net balances; they never mix currencies. No payment processor or money movement is involved.

### Integrity and operations

- Writes perform permission checks and updates in one database transaction. Circle settings, expense edits/deletes, and settlement undo require the current version. Concurrent stale edits return **409**; invalid splits, overpayments, and unsettled removals return **400**. Nonmembers cannot read circle details.
- Removed members lose access immediately. Their membership ids remain in historical shares. Historical edits or deletion/undo cannot change a former member’s balance. Invite them back if such history needs correction. Deleting a nonowner account preserves its membership name and balances; deleting an owner account cascades its owned circles.
- Limits: 50 active members per circle, 50 owned circles and 100 active memberships per account, 100 pending invitations per circle, and 10000 expenses plus 10000 settlements per circle. Totals use indexed SQLite aggregation rather than loading all expense descriptions into the browser. History is paginated.
- The browser refreshes Circles every 20 seconds while visible, on window focus, and after writes. All collection APIs remain locked; Circles use the authenticated custom routes rather than public realtime subscriptions.
- Include Circles mutations and invitations in your PocketBase/reverse-proxy rate limits. Preserve existing CORS and identity-provider settings.
- Back up before installation. The new migration creates only `circles`, `circle_members`, `circle_invitations`, `circle_expenses`, and `circle_settlements`; it leaves existing personal data and provider configuration intact. Its down migration **deletes all Circles data**. Copy the `.cjs` calculation module as well as every `.js` hook, then restart PocketBase.
