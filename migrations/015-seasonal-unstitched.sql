-- Add seasonal unstitched collections without changing existing products.
-- Safe to run more than once in the Supabase SQL Editor.
INSERT INTO public.categories (name, slug, description)
VALUES
  ('Summer Unstitched', 'summer-unstitched', 'Unstitched fabrics for warmer days, ready to tailor your way.'),
  ('Winter Unstitched', 'winter-unstitched', 'Unstitched fabrics for cooler days, ready to tailor your way.')
ON CONFLICT (slug) DO NOTHING;
