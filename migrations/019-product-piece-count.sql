-- Run after 018. Existing products remain unclassified until edited.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS piece_count smallint CHECK (piece_count IN (2, 3));
