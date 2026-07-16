# Shop Inventory

Internal stock-management web app for a small shop. Not a public storefront —
the whole app sits behind a login. An admin manages the product catalog from a
dashboard; employees use the main screen to check and adjust stock day to day.

## Roles

| Role     | Can do                                                          |
| -------- | -------------------------------------------------------------- |
| `ADMIN`  | Everything: dashboard (catalog + employees) and the main site. |
| `EDITOR` | Main site; adjust stock with the +/- buttons.                  |
| `VIEWER` | Main site; read-only stock (no +/- buttons).                   |

Access is enforced in two layers: an edge **proxy** (`src/proxy.ts`) redirects
anonymous users to `/login` and non-admins away from `/dashboard`, and every
page/API mutation re-checks authoritatively via `src/lib/rbac.ts`. The
stock-adjust and presign APIs reject the wrong role with `403` even though the
UI already hides those controls.

## Stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind CSS v4**
- **Postgres** via **Prisma 6**
- **Auth.js v5** (credentials, JWT sessions — no session table)
- **Cloudflare R2** (S3-compatible) for product images, with in-browser crop
- **zod** validation, **react-hook-form**-friendly forms, **bcryptjs** hashing

## Prerequisites

- Node.js 20+
- Postgres 14+ running locally (or a hosted `DATABASE_URL`)

The reference setup uses Homebrew:

```bash
brew install node postgresql@16
brew services start postgresql@16
createdb shop_inventory
```

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    edit DATABASE_URL if needed; generate a secret:
#    openssl rand -base64 32   ->   AUTH_SECRET

# 3. Create the schema and seed demo data
npx prisma migrate dev
npm run db:seed

# 4. Run
npm run dev        # http://localhost:3000
```

### Seeded accounts

All use the password from `SEED_PASSWORD` (default `password123`):

| Username | Role   |
| -------- | ------ |
| `admin`  | ADMIN  |
| `editor` | EDITOR |
| `viewer` | VIEWER |

Plus a few demo categories, a "Clothing Sizes" variant template, and sample
products.

## Data model

`User`, `Category`, `VariantTemplate`, `Product`, `ProductVariant`,
`StockAdjustment` — see `prisma/schema.prisma`. Every successful +/- writes a
`StockAdjustment` row (who changed what, the delta, and the resulting quantity)
as a lightweight audit trail.

## Images (Cloudflare R2)

Image upload is **optional and isolated**. With the `R2_*` env vars unset, the
presign endpoint returns `503` and the product form lets you save without a
picture — everything else works. To enable it, set `R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and (to serve the
images) `R2_PUBLIC_BASE_URL`. Uploads are cropped client-side and sent straight
to R2 with a presigned URL.

## Scripts

| Script            | Purpose                              |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Dev server                           |
| `npm run build`   | Production build                     |
| `npm run start`   | Serve the production build           |
| `npm run db:seed` | Seed accounts + demo data            |
| `npm run db:reset`| Drop, re-migrate, and re-seed the DB |
| `npm run test:e2e`| Playwright end-to-end tests          |

## Notes

- `src/proxy.ts` uses Next 16's `proxy` file convention (the renamed
  `middleware`).
- Auth config is split: `src/auth.config.ts` is edge-safe (imported by the
  proxy); `src/auth.ts` adds the Prisma/bcrypt credentials provider for the
  Node runtime.
