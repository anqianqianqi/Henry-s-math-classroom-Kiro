-- Add set_id to redemptions so we can directly link each draw to its blindbox set.
-- This eliminates fragile timestamp/index-based matching for image lookup.
ALTER TABLE redemptions
  ADD COLUMN IF NOT EXISTS set_id UUID DEFAULT NULL REFERENCES blindbox_sets(id);

-- Also add refund columns if not already present (from add-refund-to-redemptions.sql)
ALTER TABLE redemptions
  ADD COLUMN IF NOT EXISTS refunded_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS refunded_by  UUID        DEFAULT NULL REFERENCES profiles(id);

-- Index for filtering non-refunded redemptions efficiently
CREATE INDEX IF NOT EXISTS idx_redemptions_refunded ON redemptions(refunded_at)
  WHERE refunded_at IS NULL;
