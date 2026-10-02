-- Run in the Supabase SQL Editor after migration 015.
-- Existing categories remain enabled. Re-running this file is safe.
BEGIN;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_enabled boolean NOT NULL DEFAULT true;

-- Read the category and its parent without recursively applying category RLS.
CREATE OR REPLACE FUNCTION public.category_is_enabled(p_category_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(
    (SELECT c.is_enabled AND COALESCE(parent.is_enabled, true)
     FROM public.categories c
     LEFT JOIN public.categories parent ON parent.id = c.parent_id
     WHERE c.id = p_category_id),
    false
  );
$$;
GRANT EXECUTE ON FUNCTION public.category_is_enabled(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS categories_public_read ON public.categories;
CREATE POLICY categories_public_read ON public.categories
  FOR SELECT USING (public.category_is_enabled(id));

-- The existing admin FOR ALL policies still allow admins to see and edit
-- disabled categories and their products. Customers see neither.
DROP POLICY IF EXISTS products_public_read ON public.products;
CREATE POLICY products_public_read ON public.products
  FOR SELECT USING (category_id IS NULL OR public.category_is_enabled(category_id));

INSERT INTO public.categories (name, slug, description)
VALUES
  ('Winter Wear', 'winter-wear', 'Winter clothing and accessories'),
  ('Summer Unstitched', 'summer-unstitched', 'Unstitched fabrics for warmer days, ready to tailor your way.')
ON CONFLICT (slug) DO NOTHING;

-- Clearly marked samples with no sellable stock.
INSERT INTO public.products
  (name, slug, description, price, stock_quantity, featured, category_id)
SELECT
  sample.name, sample.slug, sample.description, sample.price, 0, false, c.id
FROM (VALUES
  ('Demo Summer Lawn 3-Piece', 'demo-summer-lawn-3-piece',
   'Demo listing only. Unstitched printed lawn shirt fabric, coordinating trouser fabric and floral dupatta. Replace with real product details before selling.', 3990::numeric, 'summer-unstitched'),
  ('Demo Winter Khaddar 3-Piece', 'demo-winter-khaddar-3-piece',
   'Demo listing only. Unstitched khaddar shirt fabric, coordinating trouser fabric and winter shawl. Replace with real product details before selling.', 5490::numeric, 'winter-wear')
) AS sample(name, slug, description, price, category_slug)
JOIN public.categories c ON c.slug = sample.category_slug
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.product_images (product_id, image_url, is_primary, display_order)
SELECT p.id, sample.image_url, true, 0
FROM (VALUES
  ('demo-summer-lawn-3-piece', '/demo-summer-lawn.webp'),
  ('demo-winter-khaddar-3-piece', '/demo-winter-khaddar.webp')
) AS sample(product_slug, image_url)
JOIN public.products p ON p.slug = sample.product_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_images existing
  WHERE existing.product_id = p.id AND existing.is_primary
);

COMMIT;
