-- Add image parsing fields to ta_grades table
-- Supports Node 0 (Image Parser): pre-parse quality check before grading
-- These fields are surfaced in Henry's grading UI so he can see what the AI read

ALTER TABLE ta_grades
  ADD COLUMN IF NOT EXISTS image_transcription TEXT,
  ADD COLUMN IF NOT EXISTS parse_quality TEXT CHECK (parse_quality IN ('good', 'partial', 'poor')),
  ADD COLUMN IF NOT EXISTS parse_confidence FLOAT,
  ADD COLUMN IF NOT EXISTS flag_reason TEXT CHECK (flag_reason IN ('image_unreadable', 'low_confidence', 'verifier_disagreement'));
