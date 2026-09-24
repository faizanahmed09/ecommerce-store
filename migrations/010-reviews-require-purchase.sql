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
