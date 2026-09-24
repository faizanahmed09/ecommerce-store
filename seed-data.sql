-- ============================================================
-- SEED DATA — Women / Dresses (30 products)
-- ============================================================
--
-- Paste into the Supabase SQL editor and run. Safe to re-run:
-- every statement is guarded, so nothing is duplicated.
--
-- ------------------------------------------------------------
-- ABOUT THE IMAGES — PLEASE READ
-- ------------------------------------------------------------
-- The link you sent was a Google Images *viewer* URL
-- (google.com/imgres?...). That returns an HTML page, not an
-- image, so <img src="..."> shows nothing. The real image URL
-- buried inside it (lookaside.instagram.com/...) also returns
-- HTML rather than an image — Instagram only serves the picture
-- to its own crawler. Both were tested; neither renders.
--
-- Also worth saying plainly: that photo belongs to whoever
-- posted it on Instagram. Fine for a local mock-up, not for a
-- storefront you intend to publish.
--
-- So the seed uses picsum.photos, which is verified to return a
-- real JPEG and gives each product a different picture. To swap
-- in your own photos later, run:
--
--   UPDATE product_images
--   SET image_url = 'https://your-cdn.com/' || (
--     SELECT slug FROM products WHERE products.id = product_images.product_id
--   ) || '.jpg'
--   WHERE product_id IN (
--     SELECT p.id FROM products p
--     JOIN categories c ON c.id = p.category_id
--     WHERE c.slug = 'women-dresses'
--   );
--
-- Best long-term option is Supabase Storage: upload to a public
-- bucket and use the public URL.

-- ------------------------------------------------------------
-- 1. CATEGORY
-- ------------------------------------------------------------
-- Your database already has Women > Dresses as "women-dresses".
-- These are no-ops there, and make the file work on a fresh
-- database too.

INSERT INTO categories (name, slug, description)
VALUES ('Women', 'women', 'Women''s clothing and accessories')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, description, parent_id)
SELECT 'Dresses', 'women-dresses', 'Women''s dresses for every occasion', id
FROM categories
WHERE slug = 'women'
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------
-- 2. PRODUCTS
-- ------------------------------------------------------------
-- Prices in PKR. A third carry a sale_price so the discount
-- badge is visible, and six are featured so the homepage
-- "Featured products" section fills in.
--
-- The first row is explicitly cast: a VALUES list takes its
-- column types from row one, and sale_price is NULL further
-- down.

INSERT INTO products
  (name, slug, description, price, sale_price, stock_quantity, featured, category_id)
SELECT
  d.name, d.slug, d.description, d.price, d.sale_price,
  d.stock_quantity, d.featured, c.id
FROM (VALUES
  ('Aangan Embroidered Lawn Maxi'::TEXT,     'aangan-embroidered-lawn-maxi'::TEXT,     'A full-length lawn maxi with hand-guided thread work across the bodice and a softly gathered skirt.'::TEXT,             6990::NUMERIC, 5590::NUMERIC, 18::INTEGER, TRUE::BOOLEAN),
  ('Noor Chiffon Anarkali',                  'noor-chiffon-anarkali',                  'Flowing chiffon anarkali with a fitted bodice, full flare and matching inner slip.',                                    12500,         9990,          9,           TRUE),
  ('Meher Cotton Kurta Dress',               'meher-cotton-kurta-dress',               'Everyday cotton kurta dress with side slits and a relaxed straight cut.',                                               3490,          NULL,          42,          FALSE),
  ('Sana Silk Wrap Dress',                   'sana-silk-wrap-dress',                   'Fluid silk wrap dress with a self-tie waist that adjusts to your fit.',                                                 9800,          NULL,          14,          FALSE),
  ('Zohra Block-Print Midi',                 'zohra-block-print-midi',                 'Hand block-printed midi in breathable cotton, cut for warm afternoons.',                                                4250,          3400,          27,          FALSE),
  ('Laila Organza Formal Gown',              'laila-organza-formal-gown',              'Sheer organza gown layered over a satin base, finished with a scalloped hem.',                                          18900,         NULL,          6,           TRUE),
  ('Hina Printed Lawn Shirt Dress',          'hina-printed-lawn-shirt-dress',          'Button-through lawn shirt dress with a collar and roll-up sleeves.',                                                    3990,          NULL,          35,          FALSE),
  ('Ayla Velvet Winter Dress',               'ayla-velvet-winter-dress',               'Structured velvet dress with long sleeves and a lined bodice for cooler evenings.',                                     11200,         8960,          11,          FALSE),
  ('Rida Linen Shift Dress',                 'rida-linen-shift-dress',                 'Minimal linen shift with a straight silhouette and hidden side pockets.',                                               5490,          NULL,          22,          FALSE),
  ('Zeba Mirror-Work Frock',                 'zeba-mirror-work-frock',                 'Traditional frock with mirror and thread detailing across the yoke.',                                                   8750,          NULL,          13,          FALSE),
  ('Amal Georgette Party Dress',             'amal-georgette-party-dress',             'Lightweight georgette dress with a gently draped neckline.',                                                            7300,          5840,          16,          FALSE),
  ('Kiran Floral Summer Dress',              'kiran-floral-summer-dress',              'Sleeveless floral dress in soft viscose with a tie-back waist.',                                                        3850,          NULL,          38,          FALSE),
  ('Sahar Banarsi Formal Dress',             'sahar-banarsi-formal-dress',             'Woven banarsi fabric with a contrast border, tailored to a straight fit.',                                              15400,         NULL,          7,           TRUE),
  ('Iman Cotton Net Dress',                  'iman-cotton-net-dress',                  'Cotton net overlay on a cotton lining, with delicate lace trim at the hem.',                                            6250,          NULL,          19,          FALSE),
  ('Farah Pleated Maxi',                     'farah-pleated-maxi',                     'Knife-pleated maxi that moves easily, with an elasticated waistband.',                                                  8900,          7120,          12,          FALSE),
  ('Dua Embroidered Kaftan',                 'dua-embroidered-kaftan',                 'Loose kaftan with tonal embroidery down the front panel.',                                                              5750,          NULL,          24,          FALSE),
  ('Mahnoor Silk Slip Dress',                'mahnoor-silk-slip-dress',                'Bias-cut silk slip with adjustable straps and a subtle sheen.',                                                         10400,         NULL,          8,           FALSE),
  ('Areeba Denim Shirt Dress',               'areeba-denim-shirt-dress',               'Washed denim shirt dress with a removable belt and chest pockets.',                                                     6800,          5440,          21,          FALSE),
  ('Saira Chikankari Kurta Dress',           'saira-chikankari-kurta-dress',           'Fine chikankari embroidery on soft cotton, with a rounded neckline.',                                                   7900,          NULL,          15,          TRUE),
  ('Nida Ruffle Hem Dress',                  'nida-ruffle-hem-dress',                  'Tiered ruffle hem on a fitted bodice, in a fluid crepe.',                                                               5200,          NULL,          26,          FALSE),
  ('Bushra Woven Jacquard Dress',            'bushra-woven-jacquard-dress',            'Textured jacquard weave with a defined waist seam.',                                                                    9600,          NULL,          10,          FALSE),
  ('Alina Off-Shoulder Dress',               'alina-off-shoulder-dress',               'Off-shoulder cut with a smocked bodice and a full midi skirt.',                                                         6400,          5120,          17,          FALSE),
  ('Hania Tissue Formal Dress',              'hania-tissue-formal-dress',              'Tissue fabric with a metallic thread sheen, cut long and lean.',                                                        14200,         NULL,          5,           FALSE),
  ('Zunaira Cotton Wrap Midi',               'zunaira-cotton-wrap-midi',               'Everyday cotton wrap midi with a deep pocket on each side.',                                                            4600,          NULL,          31,          FALSE),
  ('Aiza Sequin Evening Dress',              'aiza-sequin-evening-dress',              'All-over sequin dress on a stretch mesh base, fully lined.',                                                            16800,         13440,         4,           TRUE),
  ('Maha Handloom Dress',                    'maha-handloom-dress',                    'Handloom cotton with a natural slub texture and a boxy fit.',                                                           5900,          NULL,          20,          FALSE),
  ('Rabia Lace Trim Dress',                  'rabia-lace-trim-dress',                  'Fitted dress with lace trim at the cuffs and hem.',                                                                     7100,          NULL,          14,          FALSE),
  ('Sadia Tiered Cotton Dress',              'sadia-tiered-cotton-dress',              'Three-tiered cotton dress that skims rather than clings.',                                                              4350,          3480,          29,          FALSE),
  ('Komal Satin Column Dress',               'komal-satin-column-dress',               'Column-cut satin dress with a concealed back zip.',                                                                    11900,         NULL,          9,           FALSE),
  ('Warda Printed Maxi Dress',               'warda-printed-maxi-dress',               'Full-length printed maxi in a lightweight viscose blend.',                                                              5350,          NULL,          23,          FALSE)
) AS d(name, slug, description, price, sale_price, stock_quantity, featured)
CROSS JOIN (SELECT id FROM categories WHERE slug = 'women-dresses') AS c
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------
-- 3. IMAGES
-- ------------------------------------------------------------
-- Two per product. The storefront card swaps to the second
-- image on hover, so both are worth having.

INSERT INTO product_images (product_id, image_url, is_primary, display_order)
SELECT
  p.id,
  'https://picsum.photos/seed/' || p.slug || '/800/1000',
  TRUE,
  0
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE c.slug = 'women-dresses'
  AND NOT EXISTS (
    SELECT 1 FROM product_images pi
    WHERE pi.product_id = p.id AND pi.is_primary
  );

INSERT INTO product_images (product_id, image_url, is_primary, display_order)
SELECT
  p.id,
  'https://picsum.photos/seed/' || p.slug || '-alt/800/1000',
  FALSE,
  1
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE c.slug = 'women-dresses'
  AND NOT EXISTS (
    SELECT 1 FROM product_images pi
    WHERE pi.product_id = p.id AND pi.display_order = 1
  );

-- ------------------------------------------------------------
-- 4. VARIANTS (Size + Colour)
-- ------------------------------------------------------------
-- The product page builds its pickers from these rows, so this
-- is what makes the size/colour selectors appear at all.
--
-- Stock is varied deterministically from the slug so some
-- sizes come through sold out — that is intentional, it shows
-- the disabled/struck-through state working.

INSERT INTO product_variants (product_id, name, value, price_adjustment, stock_quantity)
SELECT
  p.id,
  'Size',
  s.value,
  s.price_adjustment,
  CASE
    WHEN (length(p.slug) + ascii(s.value)) % 7 = 0 THEN 0
    ELSE ((length(p.slug) + ascii(s.value)) % 9) + 2
  END
FROM products p
JOIN categories c ON c.id = p.category_id
CROSS JOIN (VALUES
  ('XS'::TEXT, 0::NUMERIC),
  ('S',  0),
  ('M',  0),
  ('L',  0),
  ('XL', 250),
  ('XXL', 500)
) AS s(value, price_adjustment)
WHERE c.slug = 'women-dresses'
  AND NOT EXISTS (
    SELECT 1 FROM product_variants pv
    WHERE pv.product_id = p.id AND pv.name = 'Size' AND pv.value = s.value
  );

INSERT INTO product_variants (product_id, name, value, price_adjustment, stock_quantity)
SELECT
  p.id,
  'Color',
  col.value,
  0,
  CASE
    WHEN (length(p.name) + ascii(col.value)) % 8 = 0 THEN 0
    ELSE ((length(p.name) + ascii(col.value)) % 11) + 3
  END
FROM products p
JOIN categories c ON c.id = p.category_id
CROSS JOIN (VALUES
  ('Black'::TEXT),
  ('Ivory'),
  ('Maroon'),
  ('Navy'),
  ('Teal')
) AS col(value)
WHERE c.slug = 'women-dresses'
  AND NOT EXISTS (
    SELECT 1 FROM product_variants pv
    WHERE pv.product_id = p.id AND pv.name = 'Color' AND pv.value = col.value
  );

-- ------------------------------------------------------------
-- 5. CHECK WHAT LANDED
-- ------------------------------------------------------------

SELECT
  (SELECT count(*) FROM products p JOIN categories c ON c.id = p.category_id
     WHERE c.slug = 'women-dresses')                                   AS products,
  (SELECT count(*) FROM product_images pi JOIN products p ON p.id = pi.product_id
     JOIN categories c ON c.id = p.category_id
     WHERE c.slug = 'women-dresses')                                   AS images,
  (SELECT count(*) FROM product_variants pv JOIN products p ON p.id = pv.product_id
     JOIN categories c ON c.id = p.category_id
     WHERE c.slug = 'women-dresses')                                   AS variants;
