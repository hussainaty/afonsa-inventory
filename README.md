# Afonsa Inventory

A team inventory app for web and mobile (installable PWA). Products, categories, warehouses with locations and sections, and an Odoo-style double-entry stock ledger.

## Features

- **Items with sizes (variants):** one item such as "Wheel rim" with sizes like 15 inch and 18 inch. Each size has its own stock, codes, prices and photos. You can add a new size straight from **Add stock**.
- **Photos:** resized on the phone (about 200 KB each), stored in a private S3-compatible bucket (Backblaze B2 or Cloudflare R2, both with 10 GB free), and shown only to workspace members.
- **Products and categories:** nested categories, SKU, barcode, unit of measure, cost and sale price. Products with history are archived, never deleted.
- **Warehouses, locations and sections:** a tree such as `WH/Stock/Shelf A`, with the stock of every product per location.
- **Stock operations:**
  - quick **add / subtract** with a reason (restock, sale, damaged, lost…)
  - **move** between sections
  - **physical count**
  - multi-line **receipts, deliveries and internal transfers** with a draft → validate flow
  - references like `IN/00001`, `OUT/00002`, `INT/00003`
- **Double-entry ledger:** every change is a stock move between two locations. Vendor, customer, inventory-adjustment and scrap are virtual locations. On-hand stock can never go negative, even under concurrent updates.
- **Reordering rules:** min/max per product and location, plus a replenishment report.
- **Team workspaces:** owner/admin/member roles and shareable invite links (no email service needed). All data is isolated per workspace.
- **Mobile:** installable PWA, bottom navigation, and camera barcode scanning where the browser supports `BarcodeDetector`, with manual entry otherwise.

## Stack

Next.js 16 (App Router, server actions) · React 19 · Tailwind CSS 4 · Drizzle ORM · PostgreSQL · Better Auth (organization plugin) · Zod · Vitest · Playwright.

All tables live in a dedicated Postgres schema, `inventory`. The app can therefore share a database (e.g. an existing Supabase project) without touching other tables.

## Local development

No database server is needed locally. Without `DATABASE_URL`, the app uses an embedded PGlite database in `.data/`.

```bash
npm install
cp .env.example .env.local   # set BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:migrate
npm run dev
```

## Tests

```bash
npm run typecheck && npm run lint
npm test              # stock-engine integration tests (in-memory Postgres)
npm run test:e2e      # full browser journey, desktop + mobile (npx playwright install chromium)
```

## Deploying (Vercel + Supabase, free tiers)

1. Set these environment variables on the Vercel project:
   - `DATABASE_URL`: the Supabase **transaction pooler** URI (port `6543`).
   - `BETTER_AUTH_SECRET`: a long random string.
   - `BETTER_AUTH_URL` (optional): the public URL. It defaults to the Vercel production domain.
   - `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`: a private bucket, with an application key limited to that bucket.
2. Deploy. The `vercel-build` script applies migrations (`scripts/migrate.ts`) before `next build`.

Schema changes: edit `src/db/schema.ts`, run `npm run db:generate`, and commit the new file in `drizzle/`.
