# Expenditure

An income and expense tracker with recurring expenses, custom categories, budgets, multiple currencies, shared Circle ledgers, and Excel/CSV exports.

[Open Expenditure](https://expenses.tkkr.dev)

## Development

Requires Node.js 22.18+ and pnpm.

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Open [localhost:3000](http://localhost:3000). Set `NEXT_PUBLIC_POCKETBASE_URL` in `.env.local` to your PocketBase instance.

## Deployment

Install the [PocketBase files](pocketbase/README.md), then deploy the Next.js app to Vercel with `NEXT_PUBLIC_POCKETBASE_URL` set. Redeploy after changing this value.

Run `pnpm validate` to check changes.
