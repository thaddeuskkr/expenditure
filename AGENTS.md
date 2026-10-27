<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working on Expenditure

## Scope and conventions

- Read the files involved before editing. Preserve unrelated work in the checkout.
- Keep public READMEs short: an introduction, local setup, and essential installation steps. Put maintenance guidance here; use `pocketbase/openapi.json` for request/response details instead of duplicating a route inventory in prose.
- This file is tracked too. Never put credentials, tokens, account data, or private deployment details in documentation. Documentation placement is not an access control.
- No demo mode, fake workspace data, authentication bypasses, or legacy API aliases in product code. Do not add backward compatibility unless explicitly requested.
- Follow `eslint.config.mjs`: four spaces, double quotes, semicolons, and existing JSX formatting. Prefer clear names and feature-local code over extra abstraction.
- Keep the existing tkkr.dev-inspired visual system. Reuse `src/components/ui/`, styled currency/month/date controls, and workspace context. Avoid native pickers and unnecessary explanatory copy. Check mobile/Safari sizing when changing inputs.
- Do not commit screenshots, deployment archives, downloaded binaries, runtime databases, `.env.local`, or build output. Use temporary directories for verification artifacts.

## Where changes belong

- `src/components/expense-app.tsx`: workspace startup, navigation, queries, and saving personal expenses/budgets.
- `src/components/auth-provider.tsx`, `sign-in.tsx`, `user-avatar.tsx`: PocketBase session/provider flow and avatar loading. Protected avatars use file tokens, not session tokens in image URLs.
- `src/components/circles/`, `src/lib/circles.ts`: Circle screens, dialogs, API calls, and types.
- `src/components/workspace-settings.tsx`, `workspace-context.tsx`: categories, currencies, timezone, and shared account settings.
- `src/lib/domain.ts`: personal record types, currency precision, amount parsing, date/time boundaries, and display conversions.
- `src/lib/export.ts`: CSV/Excel exports. Export every matching record, not just the visible page; retain original currency/UTC timestamp and typed Excel values.
- `pocketbase/pb_hooks/main.pb.js`, `expenditure.js`: API-key management, automation expenses, provenance, and retry handling.
- `pocketbase/pb_hooks/configuration.pb.js`, `configuration.js`: account initialization, category management/order, preferences, and native record validation.
- `pocketbase/pb_hooks/circles.pb.js`, `circles-service.js`: Circle routes, permissions, transactions, and ledger operations.
- `pocketbase/pb_hooks/circles-core.cjs`: allocation and settlement calculations shared by frontend and backend. Keep `circles-core.d.cts` in sync.
- `pocketbase/pb_hooks/exchange-rates.js`, `overview.js`, `request.js`: cached rates, complete-dataset reports, and timestamp validation.
- `pocketbase/pb_hooks/currencies.json`: shared currency catalog; use its precision on both sides.
- `pocketbase/pb_migrations/`: ordered schema/data migrations. `tests/`: domain/export tests and disposable PocketBase integration/upgrade tests.

## Data and API rules

- Use the database field names and types directly in requests, responses, and frontend types. Update all callers, OpenAPI, and tests together when changing a contract.
- Monetary fields are `amount`: integer currency minor units, never floating-point money. SGD 6.50 = 650; JPY 650 = 650; KWD 1.234 = 1234. The current maximum is enforced in the schema/core. Use `payment_method` for payment labels.
- Circle shares use `member` (membership ID). Even inputs contain only `member`; exact inputs add integer `amount`; percentage inputs add integer `percentage_bp` (6000 = 60%). Saved shares contain the calculated `amount`. Preserve deterministic largest-remainder rounding.
- Circle `owner` is a user ID. `paid_by`, share members, settlement participants, and `created_by` are membership IDs. Never interchange the two kinds of IDs.
- Relations retain their stored IDs. Public related data goes under `expand.user` or `expand.circle`; do not replace relation IDs with objects. Keep profile projections limited to public fields.
- Key creation accepts a future timezone-explicit `expires_at`, or an empty string for no expiration. Duration choices are presentation logic in the form. Unsupported request fields are rejected.
- `exchange_rates.quotes` and `dates` have the same structure in storage and responses. Preferences and default categories are persisted during initialization; do not synthesize legacy settings on reads.
- Validate input on the server even when a frontend form already validates it. Preserve ownership checks, API-key scope separation, hidden secrets, and server-managed provenance. Never expose superuser credentials to the browser or automation clients.
- API secrets are shown once and stored as hashes. Key metadata projections must not expose secrets/hashes. Usage writes must not overwrite concurrent revocation.
- Idempotency is scoped to the user and lasts 24 hours from server `created`, not `occurred_at`. Identical retries replay; changed data conflicts; reuse after expiry creates a new expense. Atomically release expired markers without deleting expenses or extending the window through retries/edits.
- Circle writes must check authorization and balances inside their transaction. Keep version checks for stale edits, verified-email invitation matching, and author/owner restrictions. Preserve former member IDs/history; historical changes must not alter their balances. Settlements cannot overpay or mix currencies and never move money.
- Deleting accounts marks retained memberships inactive; deleting an owner account cleans up owned circles. Do not derive substitute membership status on reads.
- Category renames update expenses and budgets atomically. Archiving/disabling preserves history. Ordering includes archived categories and checks `previous_ids` before saving; do not overwrite concurrent reorder changes.
- Dates are stored as instants; the account timezone controls entry, report boundaries, daily grouping, and exports. Test daylight-saving boundaries. Defaults are SGD and Asia/Singapore.
- Reports aggregate all matching records on the backend. Do not calculate monthly totals from paginated browser results.
- Exchange rates are reference estimates using the latest cached observations, including for historical expenses. Preserve original amounts, per-expense rounding, the shared refresh lease, failure throttling, stale/missing-rate warnings, and age limits. Never recompute Circle debts from exchange rates.

## Migrations and deployment

- The Next.js app runs on Vercel; PocketBase runs separately. Keep backend work in PocketBase hooks/migrations unless a requirement actually needs another service. Preserve the existing `users` collection and OAuth/OIDC settings.
- The frontend URL is `expenses.tkkr.dev`; the configured PocketBase URL is `e.tkkr.dev`. `NEXT_PUBLIC_POCKETBASE_URL` is public and baked into the client at build time. Do not change a running server or deployment without authorization.
- Prepare installable PocketBase files for the user; do not assume server access. Copy all hook files, including JSON/CJS modules, together with all unapplied migrations. Keep the matching frontend/schema/hooks coordinated.
- Add new migrations; do not rewrite applied history or remove old migrations because they contain earlier field names. Historical migrations are not runtime compatibility aliases. Back up before applying; some down migrations delete collections/data.
- Current backend status is version 6 in `main.pb.js`, checked by workspace startup. When a contract changes, update both the reported and required version together.
- Test fresh installation and upgrades with existing records. Preserve IDs, amounts, timestamps, provider configuration, and ledger balances unless the requested change explicitly requires otherwise.
- PocketBase 0.40.6 is the validated server version; do not confuse it with the JS SDK version. Read `package.json` for installed frontend/tool versions.
- OAuth callback uses the PocketBase URL with `/api/oauth2-redirect`. Preserve exact allowed origins and realtime/SSE support. The frontend does not need a separate OAuth callback or privileged API proxy.

## Verification

```sh
pnpm format
pnpm validate
POCKETBASE_BINARY=/absolute/path/to/pocketbase pnpm test:backend
```

- `format` applies ESLint layout fixes. `validate` runs lint, type checks, unit tests, and a production build. Run backend tests after changing hooks, schema, or contracts; they use disposable local databases rather than the hosted instance.
- Use meaningful regression cases for money, isolation, concurrency, migrations, and exports. Documentation-only edits need link/diff checks, not a full rebuild.
- For browser verification, use a disposable local backend and real test sign-in. Do not add auth bypasses to product code or modify real user records. Check the complete save/refresh flow.
- Leave user-started dev servers running. If a temporary build bakes in a test backend URL, stop its preview server and restore a normal build afterward.
- Use Context7 for current library/API documentation when needed; read the installed Next.js guides before framework edits as required above. For business-logic refactors, the implementation and regression tests are the primary reference.
