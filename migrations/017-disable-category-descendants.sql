-- Run after 016. Disabling a category also disables every nested child.
BEGIN;

CREATE OR REPLACE FUNCTION public.disable_category_descendants()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.is_enabled AND NOT NEW.is_enabled THEN
    UPDATE public.categories
    SET is_enabled = false
    WHERE parent_id = NEW.id AND is_enabled;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS categories_disable_descendants ON public.categories;
CREATE TRIGGER categories_disable_descendants
AFTER UPDATE OF is_enabled ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.disable_category_descendants();

-- Repair children of parents that were disabled before this migration.
UPDATE public.categories AS child
SET is_enabled = false
FROM public.categories AS parent
WHERE child.parent_id = parent.id
  AND NOT parent.is_enabled
  AND child.is_enabled;

COMMIT;
