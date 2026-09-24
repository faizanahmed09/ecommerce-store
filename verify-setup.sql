-- Read-only verification for the fresh-project setup documented in README.md.
-- Run in the Supabase SQL Editor. Zero rows means the listed schema objects are present.
-- This checks the final schema state, not a migration execution history.
WITH expected(kind, name) AS (
  VALUES
    ('table', 'users'), ('table', 'categories'), ('table', 'products'),
    ('table', 'product_images'), ('table', 'product_variants'),
    ('table', 'orders'), ('table', 'order_items'), ('table', 'carts'),
    ('table', 'cart_items'), ('table', 'wishlists'), ('table', 'wishlist_items'),
    ('table', 'addresses'), ('table', 'reviews'), ('table', 'coupons'),
    ('table', 'rate_limit_counters'), ('table', 'couriers'),
    ('table', 'courier_cities'), ('table', 'courier_status_map'),
    ('table', 'shipments'), ('table', 'shipment_events'),
    ('index', 'products_price_idx'), ('index', 'products_sale_price_idx'),
    ('index', 'products_name_trgm_idx'), ('index', 'products_description_trgm_idx'),
    ('index', 'product_variants_value_idx'), ('index', 'orders_short_id_idx'),
    ('index', 'coupons_code_unique'), ('index', 'coupons_active_idx'),
    ('index', 'coupons_promoted_idx'), ('index', 'rate_limit_counters_window_idx'),
    ('index', 'courier_cities_lookup_idx'), ('index', 'shipments_order_idx'),
    ('index', 'shipments_status_idx'), ('index', 'shipments_one_active_per_order'),
    ('index', 'shipment_events_shipment_idx'),
    ('function', 'is_admin()'), ('function', 'handle_new_auth_user()'),
    ('function', 'effective_unit_price(uuid,jsonb)'),
    ('function', 'redeem_coupon(text,numeric)'),
    ('function', 'list_promoted_coupons()'),
    ('function', 'request_ip()'),
    ('function', 'check_rate_limit(text,text,integer,integer)'),
    ('function', 'claim_order_confirmation(uuid)'),
    ('function', 'track_order(text,text)'),
    ('function', 'list_variant_options()'),
    ('function', 'sync_order_tracking()'),
    ('function', 'place_order(uuid,text,text,text,numeric,jsonb,text,text,text)'),
    ('column', 'orders.contact_phone'),
    ('column', 'orders.confirmation_sent_at'),
    ('column', 'coupons.promoted'),
    ('column', 'shipments.customer_notified_at'),
    ('trigger', 'auth.users.on_auth_user_created'),
    ('trigger', 'public.shipments.shipments_sync_order'),
    ('policy', 'public.reviews.reviews_insert_own'),
    ('policy', 'public.couriers.couriers_public_read'),
    ('policy', 'public.shipments.shipments_admin'),
    ('bucket', 'Lamees-images')
), checks(kind, name) AS (
  SELECT kind, name FROM expected
  UNION ALL
  SELECT 'rls', name FROM expected WHERE kind = 'table'
  UNION ALL
  SELECT 'review_purchase_policy', 'reviews_insert_own'
  UNION ALL
  SELECT 'tracking_rate_limit', 'track_order(text,text)'
  UNION ALL
  SELECT 'obsolete_function', 'place_order(uuid,text,text,text,numeric,jsonb,text,text)'
)
SELECT kind, name
FROM checks e
WHERE CASE kind
  WHEN 'table' THEN to_regclass('public.' || name) IS NULL
  WHEN 'index' THEN to_regclass('public.' || name) IS NULL
  WHEN 'function' THEN to_regprocedure('public.' || name) IS NULL
  WHEN 'column' THEN NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = split_part(name, '.', 1)
      AND c.column_name = split_part(name, '.', 2)
  )
  WHEN 'trigger' THEN NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = to_regclass(split_part(name, '.', 1) || '.' || split_part(name, '.', 2))
      AND t.tgname = split_part(name, '.', 3)
      AND NOT t.tgisinternal
  )
  WHEN 'policy' THEN NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = split_part(name, '.', 1)
      AND p.tablename = split_part(name, '.', 2)
      AND p.policyname = split_part(name, '.', 3)
  )
  WHEN 'bucket' THEN NOT EXISTS (SELECT 1 FROM storage.buckets b WHERE b.id = name)
  WHEN 'rls' THEN NOT EXISTS (
    SELECT 1 FROM pg_class c
    WHERE c.oid = to_regclass('public.' || name) AND c.relrowsecurity
  )
  WHEN 'review_purchase_policy' THEN NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'reviews'
      AND p.policyname = name AND p.with_check ILIKE '%has_purchased_product%'
  )
  WHEN 'tracking_rate_limit' THEN NOT COALESCE(
    pg_get_functiondef(to_regprocedure('public.' || name)) ILIKE '%check_rate_limit%', false
  )
  WHEN 'obsolete_function' THEN to_regprocedure('public.' || name) IS NOT NULL
END
ORDER BY kind, name;
