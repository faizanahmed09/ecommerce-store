-- Run after 017. Existing products remain enabled.
BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_enabled boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS products_public_read ON public.products;
CREATE POLICY products_public_read ON public.products FOR SELECT
  USING (is_enabled AND (category_id IS NULL OR public.category_is_enabled(category_id)));

-- A saved cart must not order a product hidden after it was added.
CREATE OR REPLACE FUNCTION public.reject_disabled_order_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.product_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = NEW.product_id
      AND p.is_enabled
      AND (p.category_id IS NULL OR public.category_is_enabled(p.category_id))
  ) THEN
    RAISE EXCEPTION 'This product is no longer available.' USING errcode = 'LM001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_items_reject_disabled_product ON public.order_items;
CREATE TRIGGER order_items_reject_disabled_product
BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.reject_disabled_order_item();

COMMIT;
