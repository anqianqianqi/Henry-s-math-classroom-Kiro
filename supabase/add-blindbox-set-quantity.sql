-- ============================================================
-- Add quantity column to blindbox_sets
--
-- For physical_blindbox items, each set has a physical stock count.
-- quantity = how many copies of this set are available.
-- NULL = unlimited (for digital blindbox sets).
--
-- The shop_items.quantity is auto-derived as SUM(set quantities)
-- when saving a physical_blindbox item from the admin UI.
-- ============================================================

ALTER TABLE blindbox_sets
  ADD COLUMN IF NOT EXISTS quantity INTEGER
    CHECK (quantity IS NULL OR quantity >= 1);

COMMENT ON COLUMN blindbox_sets.quantity IS
  'Physical stock count for this set. NULL = unlimited (digital). '
  'For physical_blindbox items, set this to the number of physical copies available.';
