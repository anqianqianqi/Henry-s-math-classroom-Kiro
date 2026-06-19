-- Add animation_zones to pet_room_backgrounds
-- Each zone is a polygon + animation config:
-- [{
--   "id": "zone1",
--   "polygon": [{"x": 12.5, "y": 5.2}, ...],  -- % of image dimensions
--   "pivot": {"x": 15.0, "y": 30.0},           -- anchor point (base of object)
--   "animation": "sway",                        -- sway | float | shimmer | flicker
--   "intensity": 0.5,                           -- 0.0–1.0
--   "speed": 1.0                                -- relative speed multiplier
-- }]

ALTER TABLE pet_room_backgrounds
  ADD COLUMN IF NOT EXISTS animation_zones JSONB NOT NULL DEFAULT '[]';
