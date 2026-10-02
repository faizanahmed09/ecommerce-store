# HAANI Threads Ecommerce Store

A single-store fashion storefront and admin panel built with Next.js 16, React 19, TypeScript, Tailwind CSS, and Supabase. It supports product variants, customer accounts, wishlists, reviews, coupons, cash-on-delivery checkout, order tracking, and courier shipments.

## Requirements

- Node.js 22.22.1 or newer (Node.js 24 LTS recommended)
- npm
- A Supabase project

## Local setup

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Use a Supabase publishable key for the variable named `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the name is retained for compatibility with the current code. Keep server credentials out of `NEXT_PUBLIC_*` variables.
3. In a **fresh** Supabase project's SQL Editor, run these files in order: `schema.sql`, `migrations/013-couriers.sql`, then `migrations/014-order-phone.sql`. The main schema already incorporates migrations 001–012. Do not run the older standalone `rls.sql` or `place-order.sql` afterwards.
4. Run `seed.sql` once for categories, then migrations `015-seasonal-unstitched.sql` through `019-product-piece-count.sql` in order. On an existing database, run only migrations you have not yet applied. Optionally run `seed-data.sql` for the older stitched demo products.
5. In Supabase Auth settings, enable email/password sign-in, set the local Site URL to `http://localhost:3000`, and allow `http://localhost:3000/reset-password` as a redirect URL.
6. Start the app with `npm run dev` and open `http://localhost:3000`.

Migration 016 adds one out-of-stock demo item to Summer Unstitched and one to Winter Wear, both with local concept images. Replace their descriptions, prices, stock, and photographs with real product details before selling. Migration 017 makes disabling a parent category also disable all its subcategories; re-enabling the parent leaves children disabled until you turn them on. The storefront hides disabled categories and their products even while you are signed in as an admin. In `.env.local`, set `NEXT_PUBLIC_STORE_NAME=HAANI Threads` and replace the old store contact email and public site URL with your actual HAANI Threads details before deployment.

Migration 018 adds the product enable/disable switch. Existing products stay enabled. Disabled products remain in Admin > Products but disappear from storefront listings and direct product URLs; saved carts cannot place an order for them.

Migration 019 adds an optional 2 Piece / 3 Piece value to products. Set it when creating or editing an unstitched product in Admin > Products, or use the optional `piece_count` column in a bulk import. The Printed and other unstitched subcategory pages use this value for their Pieces filter. Existing products have no piece count until you edit them.

Run `verify-setup.sql` in the Supabase SQL Editor to check the final schema, seasonal categories, and demo products. It is read-only; zero rows means every listed object and sample row is present.

The cart is stored in browser localStorage. Products, orders, customer data, and images use Supabase. The database `place_order` function validates prices and stock and writes orders atomically.

## Admin account

Sign up through the storefront, confirm the email if required, and sign in. Then run this in the Supabase SQL Editor, substituting your email:

```sql
UPDATE public.users
SET user_type = 'admin'
WHERE email = 'you@example.com'
RETURNING id, email, user_type;
```

The query should return one row. Visit `/admin` after signing in. The route guard and database Row Level Security restrict admin operations.

## Email and couriers

Order confirmation and shipment emails use Gmail SMTP through Nodemailer. Set `GMAIL_USER` and `GMAIL_APP_PASSWORD` in `.env.local`; `ORDER_NOTIFICATION_EMAIL` receives a BCC copy of order confirmations. Orders still save when mail is not configured. Supabase Auth handles signup and password-reset emails separately.

Leopards and PostEx have courier adapters; configure their credentials in `.env.local` before enabling them. M&P has no booking adapter. See `.env.example` for all optional settings.

## Checks and deployment

Run `npm run typecheck`, `npm run lint`, and `npm run build` before deployment. Stop any running `next start` server before building and restart it after the build; replacing `.next` while an older server is running can make its JavaScript chunk URLs return 404. For local development, use `npm run dev`. Vercel is configured for the Singapore region in `vercel.json`; choose a Supabase region nearby. Set the same environment variables on the host, replace `NEXT_PUBLIC_SITE_URL` with your HTTPS domain, and update Supabase Auth redirect URLs.

`.env` and `.env.local` are ignored by Git. Commit `.env.example` as the variable template, never a file containing credentials.
