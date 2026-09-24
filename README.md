# Lamees Ecommerce Store

A single-store fashion storefront and admin panel built with Next.js 16, React 19, TypeScript, Tailwind CSS, and Supabase. It supports product variants, customer accounts, wishlists, reviews, coupons, cash-on-delivery checkout, order tracking, and courier shipments.

## Requirements

- Node.js 22.22.1 or newer (Node.js 24 LTS recommended)
- npm
- A Supabase project

## Local setup

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Use a Supabase publishable key for the variable named `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the name is retained for compatibility with the current code. Keep server credentials out of `NEXT_PUBLIC_*` variables.
3. In a **fresh** Supabase project's SQL Editor, run these files in order: `schema.sql`, `migrations/013-couriers.sql`, then `migrations/014-order-phone.sql`. The main schema already incorporates migrations 001–012. Do not run the older standalone `rls.sql` or `place-order.sql` afterwards.
4. Run `seed.sql` once for categories. Optionally run `seed-data.sql` for demo products. Demo photos are placeholders.
5. In Supabase Auth settings, enable email/password sign-in, set the local Site URL to `http://localhost:3000`, and allow `http://localhost:3000/reset-password` as a redirect URL.
6. Start the app with `npm run dev` and open `http://localhost:3000`.

Run `verify-setup.sql` in the Supabase SQL Editor to check the final schema. It is read-only; zero rows means every listed table, index, function, policy, trigger, and storage bucket is present.

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

Run `npm run typecheck`, `npm run lint`, and `npm run build` before deployment. Vercel is configured for the Singapore region in `vercel.json`; choose a Supabase region nearby. Set the same environment variables on the host, replace `NEXT_PUBLIC_SITE_URL` with your HTTPS domain, and update Supabase Auth redirect URLs.

`.env` and `.env.local` are ignored by Git. Commit `.env.example` as the variable template, never a file containing credentials.
