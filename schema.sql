-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id),
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  sale_price DECIMAL(10, 2),
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  category_id UUID REFERENCES categories(id),
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create product_images table
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create product_variants table (for size, color, etc.)
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  value VARCHAR(100) NOT NULL,
  price_adjustment DECIMAL(10, 2) DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(10, 2) NOT NULL,
  shipping_address TEXT NOT NULL,
  billing_address TEXT,
  payment_method VARCHAR(50),
  payment_status VARCHAR(50) DEFAULT 'pending',
  tracking_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create order_items table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_variant_id UUID REFERENCES product_variants(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cart table
CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  session_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cart_items table
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_variant_id UUID REFERENCES product_variants(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create wishlist table
CREATE TABLE wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create wishlist_items table
CREATE TABLE wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id UUID REFERENCES wishlists(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE users
ADD COLUMN user_type VARCHAR(20) NOT NULL DEFAULT 'user';

ALTER TABLE users
ADD CONSTRAINT users_user_type_check
CHECK (user_type IN ('admin', 'user'));


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
--
-- Added alongside the login/signup work. Everything above this
-- line leaves RLS off, which means every table is readable AND
-- writable by anyone holding the public anon key (it ships in
-- the browser bundle).
--
-- Most urgently: users.user_type gates the admin panel, so
-- without these policies any visitor can run
--
--   update users set user_type = 'admin' where email = '...';
--
-- and let themselves into /admin.
--
-- REVIEW THIS SECTION BEFORE RUNNING IT against a database
-- that already holds data.

-- ------------------------------------------------------------
-- 1. HELPERS
-- ------------------------------------------------------------
-- SECURITY DEFINER so these can read users without re-entering
-- the policies defined on users (which would recurse).

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND user_type = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_type()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_type FROM public.users WHERE id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 2. PROFILE CREATION
-- ------------------------------------------------------------
-- users.id is expected to equal the Supabase Auth user id, so
-- that orders.user_id, carts.user_id and wishlists.user_id can
-- be joined back to the signed-in user.
--
-- With email confirmation enabled there is no session at the
-- moment of sign-up, so the browser cannot insert the profile
-- row under RLS. This trigger creates it server-side instead.
-- The app's signUp() tolerates a row that already exists, so it
-- keeps working once this trigger is installed.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, password_hash, user_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    'managed_by_supabase_auth',  -- password_hash is NOT NULL; auth owns the real credential
    'user'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ------------------------------------------------------------
-- 3. USERS
-- ------------------------------------------------------------

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_or_admin" ON users
  FOR SELECT USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "users_insert_self" ON users
  FOR INSERT WITH CHECK (id = auth.uid());

-- A user may edit their own profile but NOT promote themselves:
-- user_type has to stay exactly what it already is.
CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND user_type = public.current_user_type());

CREATE POLICY "users_admin_manage" ON users
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- 4. CATALOGUE - public read, admin write
-- ------------------------------------------------------------

ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images   ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_public_read" ON categories FOR SELECT USING (true);
CREATE POLICY "categories_admin_write" ON categories FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "products_public_read" ON products FOR SELECT USING (true);
CREATE POLICY "products_admin_write" ON products FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "product_images_public_read" ON product_images FOR SELECT USING (true);
CREATE POLICY "product_images_admin_write" ON product_images FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "product_variants_public_read" ON product_variants FOR SELECT USING (true);
CREATE POLICY "product_variants_admin_write" ON product_variants FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- 5. ORDERS - owner reads, admin manages
-- ------------------------------------------------------------

ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select_own_or_admin" ON orders
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "orders_insert_own" ON orders
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Guest checkout. A shopper without an account places an order
-- that belongs to nobody; it reaches the admin Orders screen as
-- a Guest. The SELECT policy above is unchanged, so the row
-- stays unreadable to everyone but staff -- which is why the
-- confirmation page is rendered from the browser's own state.
CREATE POLICY "orders_insert_guest" ON orders
  FOR INSERT WITH CHECK (user_id IS NULL);

-- Only staff change fulfilment state, which is what the admin
-- Orders screen does.
CREATE POLICY "orders_admin_update" ON orders
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "order_items_select_own_or_admin" ON order_items
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
    )
  );

CREATE POLICY "order_items_insert_own" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
    )
  );

-- The lines of a guest order. Anyone holding the order's uuid
-- could append to it, which was the cost of writing guest
-- orders straight from the browser. Section 9 closes that: it
-- moves placement into a SECURITY DEFINER function and drops
-- this policy, so the definition below is only what section 9
-- then takes away.
CREATE POLICY "order_items_insert_guest" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id AND o.user_id IS NULL
    )
  );

CREATE POLICY "order_items_admin_manage" ON order_items
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- 6. CARTS & WISHLISTS - strictly the owner's
-- ------------------------------------------------------------
--
-- NOTE: guest carts (user_id NULL, identified only by
-- session_id) are NOT covered. Allowing anonymous access to
-- them would let anyone read any guest cart by guessing a
-- session id. Decide whether guest carts should live in the
-- database at all, or stay in localStorage as they do today.

ALTER TABLE carts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carts_own" ON carts
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "cart_items_own" ON cart_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM carts c WHERE c.id = cart_items.cart_id AND c.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM carts c WHERE c.id = cart_items.cart_id AND c.user_id = auth.uid())
  );

CREATE POLICY "wishlists_own" ON wishlists
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "wishlist_items_own" ON wishlist_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM wishlists w WHERE w.id = wishlist_items.wishlist_id AND w.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM wishlists w WHERE w.id = wishlist_items.wishlist_id AND w.user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- 7. GRANT YOURSELF ADMIN
-- ------------------------------------------------------------
-- Run once, from the SQL editor (which bypasses RLS), or you
-- will lock yourself out of /admin.
--
-- UPDATE users SET user_type = 'admin' WHERE email = 'you@example.com';


-- ============================================================
-- OPTIONAL CONSTRAINTS
-- ============================================================
--
-- Not applied. Each of these makes the database enforce a rule
-- the application already assumes, but each can FAIL on a table
-- that already holds rows breaking it. Check your data first,
-- then uncomment.

-- The app writes users.id = the Supabase Auth user id. This
-- makes that binding real and cleans up profiles when an auth
-- user is deleted. Fails if any users row has an id that is not
-- in auth.users -- profiles created before that fix will.
--
-- ALTER TABLE users
-- ADD CONSTRAINT users_id_fkey
-- FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- The admin Orders screen offers exactly these values, matching
-- the users_user_type_check pattern above. Fails if existing
-- orders use anything else.
--
-- ALTER TABLE orders
-- ADD CONSTRAINT orders_status_check
-- CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled'));
--
-- ALTER TABLE orders
-- ADD CONSTRAINT orders_payment_status_check
-- CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed'));


-- ============================================================
-- ADDRESSES
-- ============================================================
--
-- Added after the fact: the account Addresses tab was querying
-- a table that had never been created, so every load failed and
-- fell back to sample rows. This is that table.
--
-- Safe to run on an existing database -- it creates one new
-- table and touches nothing else.

CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- What the shopper calls it: "Home", "Office".
  name VARCHAR(100) NOT NULL,
  street_address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) NOT NULL DEFAULT 'Pakistan',
  phone VARCHAR(20),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- The tab lists a shopper's own addresses, default first.
CREATE INDEX IF NOT EXISTS addresses_user_id_idx ON addresses (user_id);

-- At most one default per shopper. The app clears the previous
-- default before setting a new one; this makes that a rule
-- rather than a convention.
CREATE UNIQUE INDEX IF NOT EXISTS addresses_one_default_per_user
  ON addresses (user_id) WHERE is_default;

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- Strictly the owner's, like carts and wishlists. Staff have no
-- reason to browse them: an order already carries the address it
-- was shipped to.
CREATE POLICY "addresses_own" ON addresses
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ============================================================
-- INDEXES
-- ============================================================
--
-- Postgres indexes primary keys and UNIQUE columns for you. It
-- does NOT index foreign keys -- so every join and every
-- "children of this row" lookup below was a sequential scan.
--
-- At 31 products that costs nothing. It is the difference
-- between a fast and an unusable catalogue at 10,000, and
-- adding them later means doing it on a live table.
--
-- Each is CREATE INDEX IF NOT EXISTS, so this block is safe to
-- re-run. On a large table prefer CREATE INDEX CONCURRENTLY,
-- which does not hold a write lock.

-- The product page loads images and variants for one product.
CREATE INDEX IF NOT EXISTS product_images_product_id_idx
  ON product_images (product_id);

CREATE INDEX IF NOT EXISTS product_variants_product_id_idx
  ON product_variants (product_id);

-- Every category listing filters products by category.
CREATE INDEX IF NOT EXISTS products_category_id_idx
  ON products (category_id);

-- The homepage strip, and the default catalogue ordering.
CREATE INDEX IF NOT EXISTS products_featured_idx
  ON products (featured) WHERE featured;

CREATE INDEX IF NOT EXISTS products_created_at_idx
  ON products (created_at DESC);

-- The navigation tree and the admin category cards both ask
-- for the children of a parent.
CREATE INDEX IF NOT EXISTS categories_parent_id_idx
  ON categories (parent_id);

-- A product can only be in a wishlist once. The app checks
-- before inserting, but two quick clicks on the heart race each
-- other; this settles it in the database.
CREATE UNIQUE INDEX IF NOT EXISTS wishlist_items_unique_product
  ON wishlist_items (wishlist_id, product_id);

-- The account Orders tab: one customer's orders, newest first.
CREATE INDEX IF NOT EXISTS orders_user_id_created_at_idx
  ON orders (user_id, created_at DESC);

-- The admin Orders list, and the dashboard's recent orders.
CREATE INDEX IF NOT EXISTS orders_created_at_idx
  ON orders (created_at DESC);

-- The order drawer loads the lines of one order.
CREATE INDEX IF NOT EXISTS order_items_order_id_idx
  ON order_items (order_id);

-- Carts and wishlists are always read by owner.
CREATE INDEX IF NOT EXISTS carts_user_id_idx
  ON carts (user_id);

CREATE INDEX IF NOT EXISTS cart_items_cart_id_idx
  ON cart_items (cart_id);

CREATE INDEX IF NOT EXISTS wishlists_user_id_idx
  ON wishlists (user_id);

CREATE INDEX IF NOT EXISTS wishlist_items_wishlist_id_idx
  ON wishlist_items (wishlist_id);


-- ============================================================
-- REVIEWS
-- ============================================================
--
-- Star ratings and written reviews on products, with the two
-- things a storefront needs around them: a "Verified purchase"
-- badge the shopper cannot award themselves, and a moderation
-- switch for the admin panel.
--
-- Safe to run on an existing database -- it adds one table, one
-- view, two functions and their policies, and touches nothing
-- that is already there.

-- ------------------------------------------------------------
-- 1. HELPER
-- ------------------------------------------------------------
-- SECURITY DEFINER so it can see orders that the calling
-- shopper's own policies would hide (a guest order that was
-- later claimed, an order row read through order_items).

-- Where a brand new review starts its life. Used both as the
-- column default and by the trigger that overwrites whatever
-- status a client tried to send, so switching the store to
-- approve-before-publish is this one word.

CREATE OR REPLACE FUNCTION public.default_review_status()
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'published'::TEXT;
$$;

CREATE OR REPLACE FUNCTION public.has_purchased_product(
  p_product_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.product_id = p_product_id
      AND o.user_id = p_user_id
  );
$$;

-- ------------------------------------------------------------
-- 2. TABLE
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title VARCHAR(150),
  body TEXT,

  -- Copied from users.full_name when the review is written.
  --
  -- Not a join: users is readable only by its owner and by
  -- staff (users_select_own_or_admin), so embedding the author
  -- would render every review by somebody else as anonymous.
  -- Storing it also keeps the byline the review was published
  -- under if the shopper later renames themselves.
  reviewer_name VARCHAR(255) NOT NULL DEFAULT '',

  -- Reviews appear immediately and staff hide the bad ones.
  -- default_review_status() above is the switch: return
  -- 'hidden' from it and the store becomes approve-before-
  -- publish, which the admin screen already handles.
  status VARCHAR(20) NOT NULL DEFAULT public.default_review_status()
    CHECK (status IN ('published', 'hidden')),

  -- Stamped by the trigger below, never by the client.
  is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,

  -- The store's public reply, shown under the review.
  admin_response TEXT,
  admin_response_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One review per shopper per product. The form upserts on
  -- this, so writing again edits the review already there.
  CONSTRAINT reviews_one_per_product_per_user UNIQUE (product_id, user_id)
);

-- ------------------------------------------------------------
-- 3. WHAT THE CLIENT MAY NOT SET
-- ------------------------------------------------------------
-- RLS decides which ROWS you may touch; it does not stop you
-- sending whatever COLUMNS you like in a row you own. Every
-- field a shopper must not choose for themselves is therefore
-- overwritten here, on the way in.

CREATE OR REPLACE FUNCTION public.handle_review_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous_response TEXT;
BEGIN
  NEW.updated_at := NOW();

  -- The badge is a fact about orders, recomputed on every
  -- write rather than accepted from the browser.
  NEW.is_verified_purchase :=
    public.has_purchased_product(NEW.product_id, NEW.user_id);

  -- The byline follows the profile, not the payload.
  SELECT COALESCE(u.full_name, '')
    INTO NEW.reviewer_name
    FROM public.users u
   WHERE u.id = NEW.user_id;

  NEW.reviewer_name := COALESCE(NEW.reviewer_name, '');

  IF TG_OP = 'INSERT' THEN
    previous_response := NULL;
  ELSE
    previous_response := OLD.admin_response;
    NEW.created_at := OLD.created_at;
  END IF;

  -- Moderation and the store's reply belong to staff. Without
  -- this a shopper could un-hide their own review, or publish
  -- an "official" response to it, by including those columns
  -- in an update of a row they legitimately own.
  IF NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := public.default_review_status();
      NEW.admin_response := NULL;
      NEW.admin_response_at := NULL;
    ELSE
      NEW.status := OLD.status;
      NEW.admin_response := OLD.admin_response;
      NEW.admin_response_at := OLD.admin_response_at;
    END IF;

    RETURN NEW;
  END IF;

  -- Staff: the reply timestamp tracks the reply itself, so the
  -- admin screen never has to remember to send it.
  IF NEW.admin_response IS DISTINCT FROM previous_response THEN
    NEW.admin_response_at :=
      CASE WHEN NEW.admin_response IS NULL THEN NULL ELSE NOW() END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_before_write ON reviews;

CREATE TRIGGER reviews_before_write
  BEFORE INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION public.handle_review_write();

-- ------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ------------------------------------------------------------
-- Anyone may read a published review -- including signed-out
-- visitors, since the product page is public. A shopper can
-- always see their own, so a hidden review does not silently
-- vanish from under them.
--
-- Writing requires an account: user_id = auth.uid() leaves no
-- way to post as somebody else, and the unique constraint
-- above caps it at one review per product.
--
-- Note that a review does NOT require a purchase. Verified
-- ones simply carry the badge. To make buying a precondition,
-- add to reviews_insert_own:
--
--   AND public.has_purchased_product(product_id, auth.uid())

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_public_read" ON reviews
  FOR SELECT USING (
    status = 'published'
    OR user_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY "reviews_insert_own" ON reviews
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "reviews_update_own" ON reviews
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "reviews_delete_own" ON reviews
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "reviews_admin_manage" ON reviews
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- 5. AGGREGATE
-- ------------------------------------------------------------
-- The average, the total and the 5..1 histogram, so a product
-- page renders its rating summary in one round trip instead of
-- pulling every review down to count them in the browser.
--
-- security_invoker means the view runs under the RLS of
-- whoever queries it rather than its owner's; without it a
-- view in public would quietly hand out rows the caller's own
-- policies deny. The status filter is what keeps the numbers
-- identical for everyone -- staff and authors can read hidden
-- reviews, but hidden reviews never move the average.

CREATE OR REPLACE VIEW public.product_review_stats
WITH (security_invoker = true) AS
  SELECT
    product_id,
    COUNT(*)::INT                               AS review_count,
    ROUND(AVG(rating)::NUMERIC, 2)              AS average_rating,
    COUNT(*) FILTER (WHERE rating = 5)::INT     AS five_star,
    COUNT(*) FILTER (WHERE rating = 4)::INT     AS four_star,
    COUNT(*) FILTER (WHERE rating = 3)::INT     AS three_star,
    COUNT(*) FILTER (WHERE rating = 2)::INT     AS two_star,
    COUNT(*) FILTER (WHERE rating = 1)::INT     AS one_star
  FROM public.reviews
  WHERE status = 'published'
  GROUP BY product_id;

GRANT SELECT ON public.product_review_stats TO anon, authenticated;

-- ------------------------------------------------------------
-- 6. INDEXES
-- ------------------------------------------------------------

-- The product page: this product's reviews, newest first.
CREATE INDEX IF NOT EXISTS reviews_product_id_created_at_idx
  ON reviews (product_id, created_at DESC);

-- The average and histogram above scan a product's rows.
CREATE INDEX IF NOT EXISTS reviews_product_id_rating_idx
  ON reviews (product_id, rating) WHERE status = 'published';

-- The admin moderation queue, and "my reviews".
CREATE INDEX IF NOT EXISTS reviews_created_at_idx
  ON reviews (created_at DESC);

CREATE INDEX IF NOT EXISTS reviews_user_id_idx
  ON reviews (user_id);


-- ============================================================
-- CATALOGUE IMAGE STORAGE
-- ============================================================
--
-- Product and category art is uploaded from the admin panel
-- instead of being pasted in as a third-party link, so it lives
-- in one public bucket that next.config.ts already allow-lists.
-- Objects are keyed products/... and categories/... .
--
-- Safe to run on an existing database -- the bucket is created
-- once and its limits are re-applied on every run.

-- ------------------------------------------------------------
-- 1. BUCKET
-- ------------------------------------------------------------
-- Public: the storefront reads images with the anon key and no
-- signed URLs. 2 MB / image, enforced by storage itself as well
-- as by the admin form.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'Lamees-images',
  'Lamees-images',
  TRUE,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ------------------------------------------------------------
-- 2. POLICIES - anyone reads, only admins write
-- ------------------------------------------------------------
-- The bucket being public covers reads through the CDN; the
-- SELECT policy is what lets the client list and read objects
-- through the API. Writes go through public.is_admin(), the
-- same gate the catalogue tables use.

DROP POLICY IF EXISTS "lamees_images_public_read" ON storage.objects;
CREATE POLICY "lamees_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'Lamees-images');

DROP POLICY IF EXISTS "lamees_images_admin_insert" ON storage.objects;
CREATE POLICY "lamees_images_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'Lamees-images' AND public.is_admin());

DROP POLICY IF EXISTS "lamees_images_admin_update" ON storage.objects;
CREATE POLICY "lamees_images_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'Lamees-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'Lamees-images' AND public.is_admin());

DROP POLICY IF EXISTS "lamees_images_admin_delete" ON storage.objects;
CREATE POLICY "lamees_images_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'Lamees-images' AND public.is_admin());


select tgname from pg_trigger where tgname = 'on_auth_user_created';


-- ------------------------------------------------------------
-- 9. ATOMIC ORDER PLACEMENT
-- ------------------------------------------------------------
--
-- Placing an order is a single SECURITY DEFINER transaction so
-- that the header, its lines and the stock decrements are
-- all-or-nothing, and so the conditional decrement cannot
-- oversell under concurrency. The browser has no insert
-- permission on orders or order_items as a result - the insert
-- policies that used to grant it are dropped at the end.
--
-- ------------------------------------------------------------
-- 1. THE FUNCTION
-- ------------------------------------------------------------
--
-- p_items is the cart, as a json array:
--   [{ "product_id": uuid,
--      "variant_ids": [uuid, ...],
--      "quantity": int,
--      "unit_price": numeric }, ...]
--
-- Returns the new order id.

create or replace function public.place_order(
  p_user_id          uuid,
  p_shipping_address text,
  p_payment_method   text,
  p_notes            text,
  p_total_amount     numeric,
  p_items            jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id   uuid;
  v_item       jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity   integer;
  v_unit_price numeric;
  v_name       text;
  v_available  integer;
begin
  /*
   * SECURITY DEFINER means RLS is not consulted inside here, so the checks
   * the policies would have made have to be made by hand.
   *
   * A signed-in shopper may only order as themselves; p_user_id null is a
   * guest order, which is allowed from an anonymous session.
   */
  if p_user_id is not null and p_user_id is distinct from auth.uid() then
    raise exception 'Cannot place an order on behalf of another account.'
      using errcode = '42501';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cannot place an order with an empty cart.';
  end if;

  insert into public.orders (
    user_id, status, total_amount, shipping_address,
    billing_address, payment_method, payment_status, notes
  )
  values (
    p_user_id, 'pending', p_total_amount, p_shipping_address,
    null, p_payment_method, 'pending', p_notes
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity   := (v_item ->> 'quantity')::integer;
    v_unit_price := (v_item ->> 'unit_price')::numeric;

    /* order_items records one variant per line; the cart may hold several
     * (size *and* colour), and every one of them has to be decremented. */
    v_variant_id := (v_item -> 'variant_ids' ->> 0)::uuid;

    if v_quantity is null or v_quantity < 1 then
      raise exception 'Every cart line needs a quantity of at least 1.';
    end if;

    select name into v_name from public.products where id = v_product_id;

    if v_name is null then
      raise exception 'That product is no longer available.';
    end if;

    if v_variant_id is null then
      /*
       * The conditional UPDATE is what makes this safe under concurrency:
       * READ COMMITTED re-evaluates the WHERE clause after waiting on a
       * row another transaction has locked, so two shoppers racing for the
       * last unit cannot both satisfy stock_quantity >= v_quantity.
       */
      update public.products
         set stock_quantity = stock_quantity - v_quantity,
             updated_at     = now()
       where id = v_product_id
         and stock_quantity >= v_quantity;

      if not found then
        select stock_quantity into v_available
          from public.products where id = v_product_id;

        raise exception '% — only % left, % requested.',
          v_name, coalesce(v_available, 0), v_quantity;
      end if;
    else
      /* Each chosen option carries its own stock, so each is decremented. */
      declare
        v_each uuid;
      begin
        for v_each in
          select (value #>> '{}')::uuid from jsonb_array_elements(v_item -> 'variant_ids')
        loop
          update public.product_variants
             set stock_quantity = stock_quantity - v_quantity,
                 updated_at     = now()
           where id = v_each
             and product_id = v_product_id
             and stock_quantity >= v_quantity;

          if not found then
            select stock_quantity into v_available
              from public.product_variants where id = v_each;

            raise exception '% — only % left, % requested.',
              v_name, coalesce(v_available, 0), v_quantity;
          end if;
        end loop;
      end;
    end if;

    insert into public.order_items (
      order_id, product_id, product_variant_id,
      quantity, unit_price, total_price
    )
    values (
      v_order_id, v_product_id, v_variant_id,
      v_quantity, v_unit_price, round(v_unit_price * v_quantity, 2)
    );
  end loop;

  return v_order_id;
end;
$$;

/*
 * The browser calls this as the anon or authenticated role. Nothing else
 * needs it, and revoking from public keeps it off any other role.
 */
revoke all on function public.place_order(uuid, text, text, text, numeric, jsonb) from public;
grant execute on function public.place_order(uuid, text, text, text, numeric, jsonb)
  to anon, authenticated;

-- ------------------------------------------------------------
-- 2. CLOSE THE DIRECT WRITE PATHS
-- ------------------------------------------------------------
--
-- place_order is now the only way an order is created, so the
-- browser does not need insert permission on either table. In
-- particular this retires order_items_insert_guest, which let
-- anyone holding an order's uuid append lines to it.
--
-- Reads are untouched: a shopper still sees their own orders,
-- and staff still see and update everything.

drop policy if exists "orders_insert_own"       on orders;
drop policy if exists "orders_insert_guest"     on orders;
drop policy if exists "order_items_insert_own"  on order_items;
drop policy if exists "order_items_insert_guest" on order_items;


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

-- ---------------------------------------------------------
-- 002 - Guest order tracking
-- ---------------------------------------------------------
--
-- /track-order needs to answer "where is my order" for someone
-- who checked out without an account.
--
-- It cannot do that through the table. `orders_select_own_or_admin`
-- reads `user_id = auth.uid() or is_admin()`, and a guest order
-- has `user_id is null`, so it belongs to nobody and is
-- readable by staff alone. That is the correct policy - it is
-- what stops one shopper reading another's orders - so this
-- adds a narrow, checked way through it rather than widening it.
--
-- SECURITY DEFINER means RLS is not consulted inside the
-- function, so the check the policy would have made is made
-- here by hand: the caller has to present BOTH the order id and
-- the email the order was placed with. The id alone is not
-- enough, because order ids travel in confirmation emails and
-- screenshots.
--
-- It returns status only. Never the address, never the notes -
-- the notes hold the guest's phone number.

create or replace function public.track_order(
  p_order_id uuid,
  p_email    text
)
returns table (
  id              uuid,
  status          varchar(50),
  payment_status  varchar(50),
  tracking_number varchar(100),
  total_amount    numeric,
  created_at      timestamptz,
  updated_at      timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    o.id,
    o.status,
    o.payment_status,
    o.tracking_number,
    o.total_amount,
    o.created_at,
    o.updated_at
  from public.orders o
  left join public.users u on u.id = o.user_id
  where o.id = p_order_id
    and coalesce(btrim(p_email), '') <> ''
    and (
      /*
       * A guest order records its contact details in `notes`,
       * as "Guest contact: <email> / <phone>". position() is
       * used rather than LIKE so an address containing % or _
       * cannot be read as a wildcard.
       */
      (
        o.user_id is null
        and o.notes is not null
        and position(lower(btrim(p_email)) in lower(o.notes)) > 0
      )
      /* An account order matches the account's own email. */
      or (
        o.user_id is not null
        and lower(u.email) = lower(btrim(p_email))
      )
    )
  limit 1;
$$;

-- Callable by shoppers, signed in or not. Nothing else is
-- granted: the function is the entire surface.
revoke all on function public.track_order(uuid, text) from public;
grant execute on function public.track_order(uuid, text) to anon, authenticated;


-- ---------------------------------------------------------
-- 003 - Look an order up by its short number
-- ---------------------------------------------------------
--
-- Replaces track_order from 002.
--
-- 002 took the order's uuid. That is fine for a link, and
-- useless for a person: nobody reads 36 characters down a
-- phone or types them from a screenshot. The number a customer
-- is now given is the uuid's first block, prefixed - LM-C3F9A1C0
-- - so the lookup has to accept that as well.
--
-- The signature changes from uuid to text, so the old function
-- is dropped rather than replaced. Safe to run before or after
-- 002; it does not depend on it.
--
-- What has NOT changed: the email is still required, and it is
-- still what proves the order is yours. A short code narrows
-- 8 hex characters, which is not a secret on its own and is
-- not treated as one.

drop function if exists public.track_order(uuid, text);
drop function if exists public.track_order(text, text);

-- Prefix matching would otherwise scan the table. Postgres can
-- use this for `left(id::text, 8) = ...` because the index is
-- on exactly that expression.
create index if not exists orders_short_id_idx
  on public.orders (left(id::text, 8));

/*
 * [superseded] public.track_order is redefined further down this
 * file. Postgres applies the last definition, so this one
 * never ran; it is removed rather than left in place so there
 * is only one copy to read - and only one to edit by mistake.
 * The migration comment above still explains what changed.
 */


-- ---------------------------------------------------------
-- 004 - Discount codes
-- ---------------------------------------------------------
--
-- The cart has had a coupon box since the beginning. It was a
-- setTimeout that answered "Invalid coupon" to everything, so
-- every customer who tried a code was told theirs had expired.
-- This is the table behind a box that can actually say yes.
--
-- Validation lives in redeem_coupon() below rather than in the
-- browser: a discount the client computes is a discount the
-- client can choose, and the cart total is already something
-- place_order recomputes for exactly that reason.

create table if not exists public.coupons (
  id            uuid primary key default gen_random_uuid(),
  /* Stored upper-case; lookups upper-case what the shopper typed. */
  code          varchar(40)  not null,
  description   text,

  /* 'percent' takes discount_value off as a %, 'fixed' as an amount. */
  discount_type varchar(10)  not null default 'percent',
  discount_value numeric(10,2) not null,

  /* Basket subtotal required before the code applies at all. */
  min_subtotal  numeric(10,2) not null default 0,
  /* Ceiling for a percentage code, so "50% off" cannot run away. */
  max_discount  numeric(10,2),

  starts_at     timestamptz,
  expires_at    timestamptz,

  /* null means unlimited. */
  max_uses      integer,
  times_used    integer not null default 0,

  active        boolean not null default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),

  constraint coupons_discount_type_check
    check (discount_type in ('percent', 'fixed')),
  constraint coupons_discount_value_check
    check (discount_value > 0),
  constraint coupons_percent_range_check
    check (discount_type <> 'percent' or discount_value <= 100)
);

-- Codes are matched case-insensitively, so uniqueness has to be too.
create unique index if not exists coupons_code_unique
  on public.coupons (upper(code));

alter table public.coupons enable row level security;

/*
 * Deliberately no public read policy. A shopper never lists
 * coupons - they present one code and the function below says
 * yes or no. Without this, `select * from coupons` would hand
 * anyone every unreleased discount in the shop.
 *
 * Dropped first because `create policy` has no `if not exists`
 * counterpart: everything else in this file can be re-run over
 * a database that already has it, and a migration that is safe
 * to re-run except for one line is not safe to re-run.
 */
drop policy if exists "coupons_admin_manage" on public.coupons;

create policy "coupons_admin_manage" on public.coupons
  for all using (public.is_admin()) with check (public.is_admin());

create index if not exists coupons_active_idx
  on public.coupons (active) where active;


-- ---------------------------------------------------------
-- Redemption check
-- ---------------------------------------------------------
--
-- Returns the discount for a code against a given subtotal, or
-- a row explaining why not. SECURITY DEFINER so it can read a
-- table the shopper cannot, and it returns only the verdict -
-- never the coupon row.

/*
 * [superseded] public.redeem_coupon is redefined further down this
 * file. Postgres applies the last definition, so this one
 * never ran; it is removed rather than left in place so there
 * is only one copy to read - and only one to edit by mistake.
 * The migration comment above still explains what changed.
 */


-- ---------------------------------------------------------
-- 005 - Promoted discount codes
-- ---------------------------------------------------------
--
-- 004 gave the cart's coupon box a table behind it, but a code
-- nobody has been told about is a code nobody types. The sale
-- page and the homepage now advertise one - which means the
-- shop needs a way to say "this code is public" without
-- undoing the reason coupons has no public read policy.
--
-- So: an opt-in flag, and a function that returns only the
-- codes carrying it. A one-off code written for a support
-- case, or an influencer's private code, stays unlisted
-- because promoted defaults to false.

alter table public.coupons
  add column if not exists promoted boolean not null default false;

comment on column public.coupons.promoted is
  'Advertise this code publicly (sale page banner, homepage modal).';

create index if not exists coupons_promoted_idx
  on public.coupons (promoted) where promoted;


-- ---------------------------------------------------------
-- Public listing
-- ---------------------------------------------------------
--
-- SECURITY DEFINER so it can read a table the shopper cannot,
-- and it returns a deliberately narrow slice: the code and the
-- terms a shopper needs to decide whether it is worth using.
-- `description` is staff-only note-keeping and is not in it.
--
-- The filters mirror redeem_coupon's refusals, so the page
-- never advertises a code the cart would then turn down.

create or replace function public.list_promoted_coupons()
returns table (
  code           varchar(40),
  discount_type  varchar(10),
  discount_value numeric(10,2),
  min_subtotal   numeric(10,2),
  max_discount   numeric(10,2),
  expires_at     timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  /*
   * Every column goes through the alias. The OUT columns above
   * share their names with the ones on coupons, and an
   * unqualified reference to either is ambiguous - the 42702
   * that redeem_coupon's `where upper(code) = ...` used to
   * raise on every code a shopper typed.
   */
  select
    cp.code,
    cp.discount_type,
    cp.discount_value,
    cp.min_subtotal,
    cp.max_discount,
    cp.expires_at
  from public.coupons cp
  where cp.promoted
    and cp.active
    and (cp.starts_at is null or now() >= cp.starts_at)
    and (cp.expires_at is null or now() <= cp.expires_at)
    and (cp.max_uses is null or cp.times_used < cp.max_uses)
  /* Whatever runs out first is the one worth shouting about. */
  order by cp.expires_at asc nulls last, cp.created_at desc
  limit 6;
$$;

revoke all on function public.list_promoted_coupons() from public;
grant execute on function public.list_promoted_coupons() to anon, authenticated;


-- ---------------------------------------------------------
-- 006 - Server-authoritative order totals
-- ---------------------------------------------------------
--
-- place_order used to take the money on trust. `p_total_amount`
-- went into orders.total_amount verbatim, and each line's
-- `unit_price` went into order_items verbatim; the only thing
-- it ever read from products was the name. Stock was defended
-- properly - the conditional UPDATE is sound - but price was
-- not defended at all.
--
-- The anon key ships inside the JavaScript bundle, so this was
-- reachable by anyone: POST to /rest/v1/rpc/place_order with
-- unit_price 1 and a matching total, and the shop writes a real
-- order at a price the buyer chose, decrementing real stock.
--
-- So the browser's arithmetic becomes a display concern. This
-- function now recomputes the subtotal from products and
-- product_variants, re-checks the discount code against
-- redeem_coupon, applies delivery itself, and refuses the order
-- if the figure the shopper agreed to is not the figure it
-- arrives at.
--
-- 004's header comment claimed place_order already recomputed
-- the total. It did not. Now it does.

-- ---------------------------------------------------------
-- What the computed total was made of
-- ---------------------------------------------------------
--
-- A server-computed total nobody can break down is not
-- auditable, so the components are recorded beside it.
-- contact_email is here because a guest leaves no users row and
-- their address was previously only recoverable by parsing it
-- back out of the notes column.

alter table public.orders
  add column if not exists discount_amount      numeric(10,2) not null default 0,
  add column if not exists coupon_code          varchar(40),
  add column if not exists contact_email        text,
  add column if not exists confirmation_sent_at timestamptz;

comment on column public.orders.discount_amount is
  'What the discount code took off, as computed by place_order.';
comment on column public.orders.coupon_code is
  'The code that produced discount_amount, or null.';
comment on column public.orders.contact_email is
  'Where the confirmation was sent. Set for guest and signed-in orders alike.';
comment on column public.orders.confirmation_sent_at is
  'Claimed by claim_order_confirmation(); null means not yet emailed.';


-- ---------------------------------------------------------
-- What one line actually costs
-- ---------------------------------------------------------
--
-- Mirrors getEffectivePrice() in src/app/lib/products.ts and
-- the price shown on the product page: sale_price when it is
-- genuinely cheaper than list, plus the adjustment carried by
-- each chosen variant.
--
-- Kept separate from place_order so the pricing rule can be
-- read - and tested - on its own.

create or replace function public.effective_unit_price(
  p_product_id  uuid,
  p_variant_ids jsonb
)
returns numeric
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_price      numeric(10,2);
  v_sale_price numeric(10,2);
  v_base       numeric(10,2);
  v_adjust     numeric(10,2);
begin
  select p.price, p.sale_price
    into v_price, v_sale_price
  from public.products p
  where p.id = p_product_id;

  /* No such product. The caller turns this into its own error. */
  if v_price is null then
    return null;
  end if;

  /* A sale_price only counts when it is actually cheaper. */
  v_base := case
    when v_sale_price is not null and v_sale_price > 0 and v_sale_price < v_price
      then v_sale_price
    else v_price
  end;

  /*
   * Scoped to the product, so an id belonging to a different
   * product contributes nothing. place_order separately refuses
   * a line whose variant does not belong to it, so a mismatch
   * cannot quietly become a cheaper order here.
   */
  select coalesce(sum(pv.price_adjustment), 0)
    into v_adjust
  from public.product_variants pv
  where pv.product_id = p_product_id
    and pv.id in (
      select (value #>> '{}')::uuid
      from jsonb_array_elements(coalesce(p_variant_ids, '[]'::jsonb))
    );

  return round(v_base + v_adjust, 2);
end;
$$;

revoke all on function public.effective_unit_price(uuid, jsonb) from public;
grant execute on function public.effective_unit_price(uuid, jsonb) to anon, authenticated;


-- ---------------------------------------------------------
-- place_order, recomputing
-- ---------------------------------------------------------
--
-- The old six-argument signature is dropped rather than left
-- beside this one: a default argument would make a six-argument
-- call ambiguous, and leaving the trusting version callable
-- would leave the hole open.

drop function if exists public.place_order(uuid, text, text, text, numeric, jsonb);

/*
 * [superseded] public.place_order is redefined further down this
 * file. Postgres applies the last definition, so this one
 * never ran; it is removed rather than left in place so there
 * is only one copy to read - and only one to edit by mistake.
 * The migration comment above still explains what changed.
 */


-- ---------------------------------------------------------
-- Claiming an order for its confirmation email
-- ---------------------------------------------------------
--
-- The mail is sent by /api/orders/confirmation, which needs to
-- read an order a guest has no policy to read - and needs to
-- send exactly one mail per order however many times it is
-- called (a double-submit, a retry, a refreshed success page).
--
-- Both fall out of one atomic claim: the UPDATE only matches
-- while confirmation_sent_at is still null, so the first caller
-- gets the order and every later one gets nothing. No service
-- key is involved; this returns one order, only to whoever
-- already holds its id, and only once.
--
-- The 24-hour bound keeps an old id from being replayed into a
-- fresh mail long after the fact.

/*
 * [superseded] public.claim_order_confirmation is redefined further down this
 * file. Postgres applies the last definition, so this one
 * never ran; it is removed rather than left in place so there
 * is only one copy to read - and only one to edit by mistake.
 * The migration comment above still explains what changed.
 */


-- ---------------------------------------------------------
-- 007 - Spend a coupon redemption when an order is placed
-- ---------------------------------------------------------
--
-- 004 gave coupons a max_uses and a times_used to count
-- against it. Nothing ever incremented the counter, so the
-- limit never bound: a code created for two redemptions stayed
-- usable for ever, and the admin screen reported "used 0 times"
-- for every campaign it ever ran.
--
-- That mattered more than a wrong number on a screen.
-- redeem_coupon is granted to anon and answers "not
-- recognised" or a discount for any code presented, with no
-- rate limit - so codes can be guessed, and coupon codes are
-- short and memorable by design. Without a working max_uses, a
-- guessed code is a permanent price cut rather than one order.
--
-- This replaces place_order with the same function plus the
-- redemption claim. Everything else is unchanged from 006.

/*
 * [superseded] public.place_order is redefined further down this
 * file. Postgres applies the last definition, so this one
 * never ran; it is removed rather than left in place so there
 * is only one copy to read - and only one to edit by mistake.
 * The migration comment above still explains what changed.
 */


-- ---------------------------------------------------------
-- 008 - Rate limiting
-- ---------------------------------------------------------
--
-- Nothing in the shop had any. That matters most for
-- redeem_coupon: it is granted to anon, the anon key ships in
-- the JavaScript bundle, and it answers "not recognised" or a
-- discount for whatever code it is handed. Coupon codes are
-- short and memorable by design, so that is a guessing oracle
-- anyone can run at full speed.
--
-- 007 capped what a guessed code is worth by making max_uses
-- bind. This raises the cost of guessing in the first place.
--
-- Done in Postgres rather than in a route handler because
-- serverless instances do not share memory: an in-process
-- counter limits one instance and lets every other one through.
-- The database is the only thing all of them agree on.

-- ---------------------------------------------------------
-- Counters
-- ---------------------------------------------------------
--
-- Fixed windows rather than a sliding log: one row per
-- (bucket, key, window) that is incremented in place, instead
-- of a row per attempt that has to be counted and swept. Less
-- precise at a window boundary - a caller can spend its budget
-- at the end of one window and again at the start of the next -
-- and enormously cheaper. For turning enumeration from free
-- into expensive, that trade is the right way round.

create table if not exists public.rate_limit_counters (
  /* What is being limited, e.g. 'coupon'. */
  bucket       text        not null,
  /* Who is being limited, usually an IP. */
  key          text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,

  primary key (bucket, key, window_start)
);

alter table public.rate_limit_counters enable row level security;

/*
 * No policy at all, deliberately. Every reader and writer is a
 * SECURITY DEFINER function below, and RLS with no policy means
 * nobody reaches the table directly - a caller who could write
 * here could exhaust someone else's budget for them.
 */

create index if not exists rate_limit_counters_window_idx
  on public.rate_limit_counters (window_start);


-- ---------------------------------------------------------
-- Who is calling
-- ---------------------------------------------------------
--
-- PostgREST publishes the request's headers as a GUC. The
-- first entry of X-Forwarded-For is the client as far as the
-- edge is concerned.
--
-- This is spoofable in principle - a header is whatever the
-- sender says - but the proxy in front of Supabase rewrites it,
-- so an attacker gets one identity per real source address.
-- That is enough: the point is to make enumeration cost
-- something, not to make it impossible.

create or replace function public.request_ip()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(
      btrim(
        split_part(
          coalesce(
            current_setting('request.headers', true)::json ->> 'x-forwarded-for',
            ''
          ),
          ',',
          1
        )
      ),
      ''
    ),
    /* Not called through PostgREST - psql, a trigger, a test. */
    'local'
  );
$$;

revoke all on function public.request_ip() from public;


-- ---------------------------------------------------------
-- The limiter
-- ---------------------------------------------------------
--
-- Returns true when the call is allowed. One statement does the
-- counting: the upsert is atomic, so two requests arriving
-- together cannot both read the same count and both decide they
-- are under the limit.
--
-- Deliberately NOT granted to anon. It is called from inside
-- the SECURITY DEFINER functions that need it. Exposed
-- directly, anyone could pass another caller's key and spend
-- their budget for them - a rate limiter that hands out denial
-- of service is worse than none.

create or replace function public.check_rate_limit(
  p_bucket         text,
  p_key            text,
  p_max            integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_hits         integer;
begin
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_counters (bucket, key, window_start, hits)
  values (p_bucket, p_key, v_window_start, 1)
  on conflict (bucket, key, window_start)
  do update set hits = public.rate_limit_counters.hits + 1
  returning hits into v_hits;

  /*
   * Swept here rather than by a scheduled job, so the table
   * cannot grow without bound on a deployment nobody has set
   * cron up on. One call in a hundred pays for it.
   */
  if random() < 0.01 then
    delete from public.rate_limit_counters
     where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_max;
end;
$$;

revoke all on function public.check_rate_limit(text, text, integer, integer) from public;


-- ---------------------------------------------------------
-- 009 - Rate limit the two functions anyone can reach
-- ---------------------------------------------------------
--
-- 008 built the limiter. This puts it in front of the two
-- SECURITY DEFINER functions granted to anon that do real work:
-- redeem_coupon, which is a guessing oracle, and
-- claim_order_confirmation, which sends mail.
--
-- Both call check_rate_limit themselves rather than relying on
-- a guard in a route handler. A guard in a route protects the
-- route; the RPC is reachable without it.
--
-- ---------------------------------------------------------
-- Why redeem_coupon is split in two
-- ---------------------------------------------------------
--
-- place_order re-checks the discount code inside the
-- transaction. If that call went through the limiter, a shopper
-- who had tried twenty codes in the cart would be unable to
-- check out at all - the limiter would have caused a worse
-- outage than the enumeration it exists to slow.
--
-- So the logic moves to coupon_verdict, which nothing outside
-- the database may call, and redeem_coupon becomes a thin
-- public wrapper that counts the attempt first. place_order
-- calls the verdict directly and is never limited.


-- ---------------------------------------------------------
-- The verdict: the rules, reachable only from inside
-- ---------------------------------------------------------

create or replace function public.coupon_verdict(
  p_code     text,
  p_subtotal numeric
)
returns table (
  valid    boolean,
  reason   text,
  code     varchar(40),
  discount numeric(10,2)
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  c public.coupons%rowtype;
  v_discount numeric(10,2);
begin
  /*
   * Aliased, and the column qualified through it: this
   * function RETURNS TABLE (.., code, ..), so a bare `code`
   * here is ambiguous between that OUT column and the one on
   * coupons, and plpgsql raises 42702 rather than guessing.
   */
  select * into c
  from public.coupons cp
  where upper(cp.code) = upper(btrim(p_code))
  limit 1;

  if not found then
    return query select false, 'That code is not recognised.'::text, null::varchar(40), 0::numeric(10,2);
    return;
  end if;

  if not c.active then
    return query select false, 'That code is no longer active.'::text, null::varchar(40), 0::numeric(10,2);
    return;
  end if;

  if c.starts_at is not null and now() < c.starts_at then
    return query select false, 'That code is not available yet.'::text, null::varchar(40), 0::numeric(10,2);
    return;
  end if;

  if c.expires_at is not null and now() > c.expires_at then
    return query select false, 'That code has expired.'::text, null::varchar(40), 0::numeric(10,2);
    return;
  end if;

  if c.max_uses is not null and c.times_used >= c.max_uses then
    return query select false, 'That code has been fully redeemed.'::text, null::varchar(40), 0::numeric(10,2);
    return;
  end if;

  if p_subtotal < c.min_subtotal then
    return query select
      false,
      format('Spend at least Rs. %s to use this code.', trim(to_char(c.min_subtotal, 'FM999,999,990')))::text,
      null::varchar(40),
      0::numeric(10,2);
    return;
  end if;

  if c.discount_type = 'percent' then
    v_discount := round(p_subtotal * (c.discount_value / 100.0), 2);
  else
    v_discount := c.discount_value;
  end if;

  if c.max_discount is not null then
    v_discount := least(v_discount, c.max_discount);
  end if;

  /* A discount can reduce the basket to zero, never below it. */
  v_discount := least(v_discount, p_subtotal);

  return query select true, null::text, c.code, v_discount;
end;
$$;

revoke all on function public.coupon_verdict(text, numeric) from public;

/*
 * Deliberately not granted to anon or authenticated. The only
 * callers are redeem_coupon and place_order below, both
 * SECURITY DEFINER, both in this schema.
 */


-- ---------------------------------------------------------
-- The public entry point: count, then answer
-- ---------------------------------------------------------
--
-- No longer `stable`: it records the attempt before answering.

create or replace function public.redeem_coupon(
  p_code     text,
  p_subtotal numeric
)
returns table (
  valid    boolean,
  reason   text,
  code     varchar(40),
  discount numeric(10,2)
)
language plpgsql
security definer
set search_path = public
as $$
begin
  /*
   * Twenty attempts a minute per address. A shopper types one
   * code and maybe mistypes it once; twenty is far past
   * anything honest and far below what enumeration needs.
   *
   * Refused before the coupons table is consulted, so a guesser
   * cannot read anything from the timing either.
   */
  if not public.check_rate_limit('coupon', public.request_ip(), 20, 60) then
    return query select
      false,
      'Too many attempts. Please wait a minute and try again.'::text,
      null::varchar(40),
      0::numeric(10,2);
    return;
  end if;

  return query select v.valid, v.reason, v.code, v.discount
  from public.coupon_verdict(p_code, p_subtotal) v;
end;
$$;

revoke all on function public.redeem_coupon(text, numeric) from public;
grant execute on function public.redeem_coupon(text, numeric) to anon, authenticated;


-- ---------------------------------------------------------
-- place_order, calling the verdict rather than the wrapper
-- ---------------------------------------------------------

create or replace function public.place_order(
  p_user_id          uuid,
  p_shipping_address text,
  p_payment_method   text,
  p_notes            text,
  /* Now a cross-check rather than the source of truth. */
  p_total_amount     numeric,
  p_items            jsonb,
  p_coupon_code      text default null,
  p_contact_email    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  /*
   * Mirrors SHIPPING_FEE and FREE_SHIPPING_THRESHOLD in
   * src/app/lib/order-totals.ts. Two languages cannot share one
   * constant, so they point at each other instead - change one
   * and the mismatch check below starts rejecting every order,
   * which is the loudest failure available.
   */
  c_shipping_fee   constant numeric(10,2) := 300;
  c_free_threshold constant numeric(10,2) := 5000;

  v_order_id   uuid;
  v_item       jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity   integer;
  v_unit_price numeric(10,2);
  v_name       text;
  v_available  integer;

  /* Pass 1 writes the priced lines here; pass 2 reads them. */
  v_priced     jsonb := '[]'::jsonb;

  v_subtotal   numeric(10,2) := 0;
  v_discount   numeric(10,2) := 0;
  v_discounted numeric(10,2);
  v_shipping   numeric(10,2);
  v_total      numeric(10,2);

  v_valid      boolean;
  v_reason     text;
  v_code       varchar(40);
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'An order needs at least one item.';
  end if;

  -- -------------------------------------------------------
  -- Pass 1: price every line from the database
  -- -------------------------------------------------------
  --
  -- Nothing is written yet. A basket that fails the total check
  -- below should not have touched stock on its way there, and
  -- reading first keeps that obvious rather than relying on the
  -- rollback to tidy up.

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity   := (v_item ->> 'quantity')::integer;

    if v_quantity is null or v_quantity < 1 then
      raise exception 'Every cart line needs a quantity of at least 1.';
    end if;

    select name into v_name from public.products where id = v_product_id;

    if v_name is null then
      raise exception 'That product is no longer available.';
    end if;

    /* Whatever the client sent as unit_price is ignored. */
    v_unit_price := public.effective_unit_price(v_product_id, v_item -> 'variant_ids');

    v_subtotal := round(v_subtotal + round(v_unit_price * v_quantity, 2), 2);

    v_priced := v_priced || jsonb_build_object(
      'product_id',  v_product_id,
      'quantity',    v_quantity,
      'unit_price',  v_unit_price,
      'variant_ids', coalesce(v_item -> 'variant_ids', '[]'::jsonb),
      'name',        v_name
    );
  end loop;

  -- -------------------------------------------------------
  -- The discount, re-earned
  -- -------------------------------------------------------
  --
  -- redeem_coupon is asked again, against the subtotal this
  -- function computed rather than the one the browser reported.
  -- A code that has expired or been spent between the cart and
  -- this call is refused here, in its own words.

  if p_coupon_code is not null and btrim(p_coupon_code) <> '' then
    select r.valid, r.reason, r.code, r.discount
      into v_valid, v_reason, v_code, v_discount
    /*
     * coupon_verdict, not redeem_coupon: the public wrapper is
     * rate limited, and this call is the shop's own, made once
     * per order. Routing checkout through the limiter meant a
     * shopper who had tried twenty codes in the cart could no
     * longer buy anything - a self-inflicted outage strictly
     * worse than the guessing it was meant to slow.
     */
    from public.coupon_verdict(p_coupon_code, v_subtotal) r;

    if not coalesce(v_valid, false) then
      raise exception '%', coalesce(v_reason, 'That discount code cannot be used.')
        using errcode = 'LM001';
    end if;
  end if;

  -- -------------------------------------------------------
  -- Delivery and the total
  -- -------------------------------------------------------
  --
  -- Same rule as calculateOrderTotals(): the threshold is
  -- judged on what is paid for goods after the discount, and an
  -- empty basket is not a free delivery.

  v_discounted := round(v_subtotal - coalesce(v_discount, 0), 2);
  v_shipping   := case
                    when v_discounted > 0 and v_discounted >= c_free_threshold then 0
                    else c_shipping_fee
                  end;
  v_total      := round(v_discounted + v_shipping, 2);

  /*
   * A paisa of tolerance for the rounding either side does
   * independently. Anything wider than that is either a price
   * that moved while the shopper was filling the form, or a
   * total that was never the shop's to begin with - and both
   * deserve the order refused rather than silently rewritten to
   * a figure nobody agreed to.
   */
  if p_total_amount is not null and abs(p_total_amount - v_total) > 0.01 then
    raise exception
      'The price of something in your basket has changed. The total is now Rs. %.',
      trim(to_char(v_total, 'FM999,999,990.00'))
      using errcode = 'LM001';
  end if;

  insert into public.orders (
    user_id, status, total_amount, discount_amount, coupon_code,
    shipping_address, billing_address, payment_method, payment_status,
    notes, contact_email
  )
  values (
    p_user_id, 'pending', v_total, coalesce(v_discount, 0), v_code,
    p_shipping_address, null, p_payment_method, 'pending',
    p_notes, nullif(btrim(coalesce(p_contact_email, '')), '')
  )
  returning id into v_order_id;

  -- -------------------------------------------------------
  -- Spend the redemption
  -- -------------------------------------------------------
  --
  -- times_used was read in three places and written in none:
  -- it sat at 0 forever, so max_uses was decorative. A code
  -- limited to two redemptions could be used for ever, and the
  -- admin's "used 0 times so far" was telling the truth about
  -- the column while lying about the campaign.
  --
  -- The conditional UPDATE is the same shape as the stock
  -- decrement below, and safe for the same reason: under READ
  -- COMMITTED the WHERE clause is re-evaluated after waiting on
  -- a row another transaction holds, so two orders racing for
  -- the last redemption cannot both satisfy times_used <
  -- max_uses. A plain `set times_used = times_used + 1` with the
  -- check done beforehand would let both through.
  --
  -- Deliberately here and not in redeem_coupon: that function
  -- is the cart's preview and runs on every keystroke of the
  -- discount box. A redemption is spent by placing an order,
  -- not by asking what a code is worth - which is also why it
  -- is `stable` and could not write even if we wanted it to.

  if v_code is not null then
    update public.coupons c
       set times_used = c.times_used + 1,
           updated_at = now()
     where upper(c.code) = upper(v_code)
       and (c.max_uses is null or c.times_used < c.max_uses);

    /*
     * Someone took the last redemption between redeem_coupon
     * above and this line. The order is refused rather than
     * quietly granted a discount the code no longer carries -
     * and the whole transaction rolls back, so no stock moves.
     */
    if not found then
      raise exception 'That code has been fully redeemed.'
        using errcode = 'LM001';
    end if;
  end if;

  -- -------------------------------------------------------
  -- Pass 2: take the stock, write the lines
  -- -------------------------------------------------------

  for v_item in select * from jsonb_array_elements(v_priced)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity   := (v_item ->> 'quantity')::integer;
    v_unit_price := (v_item ->> 'unit_price')::numeric;
    v_name       := v_item ->> 'name';

    /* order_items records one variant per line; the cart may hold several
     * (size *and* colour), and every one of them has to be decremented. */
    v_variant_id := (v_item -> 'variant_ids' ->> 0)::uuid;

    if v_variant_id is null then
      /*
       * The conditional UPDATE is what makes this safe under concurrency:
       * READ COMMITTED re-evaluates the WHERE clause after waiting on a
       * row another transaction has locked, so two shoppers racing for the
       * last unit cannot both satisfy stock_quantity >= v_quantity.
       */
      update public.products
         set stock_quantity = stock_quantity - v_quantity,
             updated_at     = now()
       where id = v_product_id
         and stock_quantity >= v_quantity;

      if not found then
        select stock_quantity into v_available
          from public.products where id = v_product_id;

        raise exception '% — only % left, % requested.',
          v_name, coalesce(v_available, 0), v_quantity;
      end if;
    else
      /* Each chosen option carries its own stock, so each is decremented. */
      declare
        v_each uuid;
      begin
        for v_each in
          select (value #>> '{}')::uuid from jsonb_array_elements(v_item -> 'variant_ids')
        loop
          update public.product_variants
             set stock_quantity = stock_quantity - v_quantity,
                 updated_at     = now()
           where id = v_each
             and product_id = v_product_id
             and stock_quantity >= v_quantity;

          if not found then
            select stock_quantity into v_available
              from public.product_variants where id = v_each;

            raise exception '% — only % left, % requested.',
              v_name, coalesce(v_available, 0), v_quantity;
          end if;
        end loop;
      end;
    end if;

    insert into public.order_items (
      order_id, product_id, product_variant_id,
      quantity, unit_price, total_price
    )
    values (
      v_order_id, v_product_id, v_variant_id,
      v_quantity, v_unit_price, round(v_unit_price * v_quantity, 2)
    );
  end loop;

  return v_order_id;
end;
$$;

revoke all on function
  public.place_order(uuid, text, text, text, numeric, jsonb, text, text) from public;
grant execute on function
  public.place_order(uuid, text, text, text, numeric, jsonb, text, text)
  to anon, authenticated;


-- ---------------------------------------------------------
-- The confirmation claim, limited
-- ---------------------------------------------------------

create or replace function public.claim_order_confirmation(p_order_id uuid)
returns table (
  order_id        uuid,
  contact_email   text,
  total_amount    numeric(10,2),
  discount_amount numeric(10,2),
  coupon_code     varchar(40),
  payment_method  varchar(50),
  shipping_addr   text,
  placed_at       timestamptz,
  items           jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  /*
   * Ten a minute per address. The honest caller is our own
   * checkout, once per order, so this costs a shopper nothing -
   * it stops the endpoint being used as a mail cannon by
   * someone replaying order ids.
   */
  if not public.check_rate_limit('order_confirmation', public.request_ip(), 10, 60) then
    return;
  end if;

  update public.orders o
     set confirmation_sent_at = now()
   where o.id = p_order_id
     and o.confirmation_sent_at is null
     and o.contact_email is not null
     and o.created_at > now() - interval '24 hours'
  returning o.* into v_order;

  /* Already sent, no address, or too old. The caller says so. */
  if not found then
    return;
  end if;

  return query
  select
    v_order.id,
    v_order.contact_email,
    v_order.total_amount,
    v_order.discount_amount,
    v_order.coupon_code,
    v_order.payment_method,
    v_order.shipping_address,
    v_order.created_at,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'name',        p.name,
                   'quantity',    oi.quantity,
                   'unit_price',  oi.unit_price,
                   'total_price', oi.total_price
                 )
                 order by p.name
               )
        from public.order_items oi
        join public.products p on p.id = oi.product_id
        where oi.order_id = v_order.id
      ),
      '[]'::jsonb
    );
end;
$$;

revoke all on function public.claim_order_confirmation(uuid) from public;
grant execute on function public.claim_order_confirmation(uuid) to anon, authenticated;


-- ---------------------------------------------------------
-- 010 - A review requires having bought the product
-- ---------------------------------------------------------
--
-- reviews_insert_own checked only that the row belonged to the
-- person writing it. Signing up is free, so anyone could create
-- an account and post a one-star review of every product in the
-- shop - and then another account, and another. The UNIQUE
-- (product_id, user_id) constraint capped it at one per account
-- per product, which prices the attack at one email address per
-- review rather than stopping it.
--
-- schema.sql already carried this fix in a comment as the way
-- to make buying a precondition. This applies it.
--
-- has_purchased_product is SECURITY DEFINER, so it can see the
-- order history that reviews_public_read cannot - the check
-- works without opening orders to the reviewer.
--
-- Two things this deliberately does not change:
--
--  - Reviews already published stay published. This gates new
--    ones; it does not retroactively delete anything.
--  - Guest orders carry no user_id, so a guest purchaser still
--    cannot review. They could not before either - reviews have
--    always required user_id = auth.uid() - so nothing is lost
--    here, but it is the reason to offer accounts at checkout.

drop policy if exists "reviews_insert_own" on public.reviews;

create policy "reviews_insert_own" on public.reviews
  for insert
  with check (
    user_id = auth.uid()
    and public.has_purchased_product(product_id, auth.uid())
  );

/*
 * Editing a review is still allowed without re-checking the
 * purchase: the row could only exist if the check passed when
 * it was written, and refunding an order should not silently
 * freeze someone's review.
 */


-- ---------------------------------------------------------
-- 011 - Rate limit order tracking
-- ---------------------------------------------------------
--
-- The last function granted to anon that 009 did not cover.
-- Lower risk than redeem_coupon, because it needs the
-- customer's email as well as the reference and so is not an
-- oracle on its own - but it is the remaining unmetered way to
-- ask the database about real orders, and someone holding a
-- leaked email list could grind the eight-character reference
-- space against it. The limiter already exists; this is the
-- last door to put it on.
--
-- The function becomes plpgsql to gain somewhere to put the
-- guard. It cannot go in the WHERE clause of the SQL version:
-- check_rate_limit writes, so a `stable` function may not call
-- it, and a predicate is evaluated per candidate row, which
-- would count one lookup many times over.
--
-- The query itself is unchanged.

create or replace function public.track_order(
  p_reference text,
  p_email     text
)
returns table (
  id              uuid,
  status          varchar(50),
  payment_status  varchar(50),
  tracking_number varchar(100),
  total_amount    numeric,
  created_at      timestamptz,
  updated_at      timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  /*
   * Thirty a minute per address. Tracking an order is two or
   * three attempts by someone who mistyped their reference.
   *
   * Returns nothing rather than raising: a caller who has run
   * out gets the same empty answer as a wrong reference, so a
   * guesser cannot tell "slow down" from "not found" and learns
   * nothing about whether they were close.
   */
  if not public.check_rate_limit('track_order', public.request_ip(), 30, 60) then
    return;
  end if;

  return query
  with input as (
      select
        lower(btrim(p_reference)) as ref,
        lower(btrim(p_email))     as email
    )
    select
      o.id,
      o.status,
      o.payment_status,
      o.tracking_number,
      o.total_amount,
      o.created_at,
      o.updated_at
    from public.orders o
    left join public.users u on u.id = o.user_id
    cross join input i
    where i.email <> ''
      and i.ref <> ''
      and (
        /* The full uuid, as it appears in the confirmation URL. */
        (length(i.ref) = 36 and o.id::text = i.ref)
        /* Or the short number the customer was shown. */
        or (length(i.ref) = 8 and left(o.id::text, 8) = i.ref)
      )
      and (
        /*
         * A guest order records its contact details in `notes`,
         * as "Guest contact: <email> / <phone>". position() is
         * used rather than LIKE so an address containing % or _
         * cannot be read as a wildcard.
         */
        (
          o.user_id is null
          and o.notes is not null
          and position(i.email in lower(o.notes)) > 0
        )
        /* An account order matches the account's own email. */
        or (
          o.user_id is not null
          and lower(u.email) = i.email
        )
      )
    limit 1;
end;
$$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;


-- ---------------------------------------------------------
-- 012 - Distinct filter options, from the database
-- ---------------------------------------------------------
--
-- The filter rail offers the sizes and colours the shop
-- actually stocks. It got them by selecting every row of
-- product_variants and reducing them in JavaScript - at four
-- products that is 44 rows to produce 11 options, and at a
-- hundred products it is about 1,100 rows to produce roughly
-- the same twenty-five. Forty times the bytes for an answer
-- that never changes shape.
--
-- The reduction belongs where the rows are. DISTINCT ON picks
-- one representative per (name, value) exactly as the
-- JavaScript did, and ordering by id makes which one it picks
-- deterministic rather than whatever the heap returned first.
--
-- Caching this (lib/catalogue.ts) already meant one read per
-- window rather than one per visitor. This makes that one read
-- small as well.

create or replace function public.list_variant_options()
returns table (
  id               uuid,
  name             varchar(100),
  value            varchar(100),
  price_adjustment numeric(10,2),
  stock_quantity   integer
)
language sql
security definer
set search_path = public
stable
as $$
  /*
   * Qualified through the alias throughout: the OUT columns
   * above share their names with the table's, and an
   * unqualified reference to either is the 42702 that
   * redeem_coupon's `where upper(code) = ...` used to raise.
   */
  select distinct on (lower(pv.name), lower(pv.value))
    pv.id,
    pv.name,
    pv.value,
    pv.price_adjustment,
    pv.stock_quantity
  from public.product_variants pv
  order by lower(pv.name), lower(pv.value), pv.id;
$$;

revoke all on function public.list_variant_options() from public;
grant execute on function public.list_variant_options() to anon, authenticated;
