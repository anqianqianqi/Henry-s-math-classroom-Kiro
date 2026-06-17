-- Add layout settings to book_skins (cover only)
-- Stored as JSONB so the structure can evolve without schema changes.
-- Example value:
-- {
--   "title": { "x": 50, "y": 25, "fontSize": 20, "color": "#f0dea0", "shadow": true },
--   "prompt": { "x": 50, "y": 82, "fontSize": 14, "color": "#f5e6b0" }
-- }
-- x/y are percentages (0–100) relative to the cover image dimensions.

ALTER TABLE book_skins
  ADD COLUMN IF NOT EXISTS cover_layout JSONB DEFAULT NULL;

COMMENT ON COLUMN book_skins.cover_layout IS
  'JSON layout for title and Open-the-Book prompt overlaid on the cover image. '
  'Only used when skin_type = ''cover''. '
  'Schema: { title: { x, y, fontSize, color, shadow }, prompt: { x, y, fontSize, color } }';
