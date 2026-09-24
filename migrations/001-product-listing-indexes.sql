-- ---------------------------------------------------------
-- 001 - Indexes for the product listing filters
-- ---------------------------------------------------------
--
-- Additive and safe to re-run: every statement is IF NOT
-- EXISTS, and nothing in the application depends on these -
-- they only change how fast the same queries answer. On a
-- table with real traffic prefer CREATE INDEX CONCURRENTLY,
-- which cannot run inside a transaction block.
--
-- schema.sql already indexes category_id, featured and
-- created_at. These are the filters the storefront ships that
-- had nothing behind them.

-- The price-range filter (?minPrice/?maxPrice) and both price
-- sorts scan on this today.
CREATE INDEX IF NOT EXISTS products_price_idx
  ON products (price);

-- /sale runs `sale_price is not null and sale_price > 0` on
-- every load. Partial, so it indexes only the discounted rows
-- rather than a column that is null for most of the table.
CREATE INDEX IF NOT EXISTS products_sale_price_idx
  ON products (sale_price)
  WHERE sale_price IS NOT NULL AND sale_price > 0;

-- Header search is `name ILIKE '%term%'`. A leading wildcard
-- cannot use a btree at all, so this is a sequential scan over
-- every product on every search. Trigrams are what make an
-- infix match indexable.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS products_name_trgm_idx
  ON products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_description_trgm_idx
  ON products USING gin (description gin_trgm_ops);

-- The variant filter resolves product ids by value first
-- ("Size M" and "black" are two rows), so it looks up on value
-- rather than on product_id, which is the direction schema.sql
-- already covers.
CREATE INDEX IF NOT EXISTS product_variants_value_idx
  ON product_variants (lower(value));


-- ---------------------------------------------------------
-- OPTIONAL: ordering by discount
-- ---------------------------------------------------------
--
-- "Biggest discount" is a computed percentage, and PostgREST
-- can only order by a column. The application ranks each page
-- after it arrives, which orders what you are looking at but
-- cannot order across pages.
--
-- Uncomment to make it a real sort. Nothing breaks if you do
-- not: applySort() currently orders by sale_price, which is a
-- reasonable approximation.
--
-- ALTER TABLE products
--   ADD COLUMN IF NOT EXISTS discount_percent NUMERIC
--   GENERATED ALWAYS AS (
--     CASE
--       WHEN sale_price IS NOT NULL
--        AND sale_price > 0
--        AND sale_price < price
--       THEN round(((price - sale_price) / price) * 100)
--       ELSE 0
--     END
--   ) STORED;
--
-- CREATE INDEX IF NOT EXISTS products_discount_percent_idx
--   ON products (discount_percent DESC)
--   WHERE discount_percent > 0;
--
-- Then in applySort(), replace the sale_price ordering with:
--   query.order("discount_percent", { ascending: false });
-- and delete the post-fetch sort in fetchStorefrontProductPage.
