-- Add refund tracking columns to redemptions table
ALTER TABLE redemptions
  ADD COLUMN IF NOT EXISTS refunded_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS refunded_by  UUID        DEFAULT NULL REFERENCES profiles(id);

-- Index for filtering non-refunded redemptions
CREATE INDEX IF NOT EXISTS idx_redemptions_refunded ON redemptions(refunded_at)
  WHERE refunded_at IS NULL;
