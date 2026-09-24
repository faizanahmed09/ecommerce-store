-- Insert main categories
INSERT INTO categories (name, slug, description) VALUES
('Men', 'men', 'Men''s clothing and accessories'),
('Women', 'women', 'Women''s clothing and accessories'),
('Kids', 'kids', 'Children''s clothing and accessories'),
('Footwear', 'footwear', 'Shoes and footwear for all ages'),
('Fragrance', 'fragrance', 'Perfumes and fragrances'),
('Winter Wear', 'winter-wear', 'Winter clothing and accessories');

-- Insert subcategories for Men
INSERT INTO categories (name, slug, description, parent_id)
SELECT 'T-Shirts', 'men-t-shirts', 'Men''s t-shirts and casual tops', id
FROM categories WHERE slug = 'men';

INSERT INTO categories (name, slug, description, parent_id)
SELECT 'Shirts', 'men-shirts', 'Men''s formal and casual shirts', id
FROM categories WHERE slug = 'men';

INSERT INTO categories (name, slug, description, parent_id)
SELECT 'Pants', 'men-pants', 'Men''s pants and trousers', id
FROM categories WHERE slug = 'men';

-- Insert subcategories for Women
INSERT INTO categories (name, slug, description, parent_id)
SELECT 'Dresses', 'women-dresses', 'Women''s dresses for all occasions', id
FROM categories WHERE slug = 'women';

INSERT INTO categories (name, slug, description, parent_id)
SELECT 'Tops', 'women-tops', 'Women''s tops and blouses', id
FROM categories WHERE slug = 'women';

INSERT INTO categories (name, slug, description, parent_id)
SELECT 'Pants', 'women-pants', 'Women''s pants and trousers', id
FROM categories WHERE slug = 'women';