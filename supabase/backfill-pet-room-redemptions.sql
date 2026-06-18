-- Backfill pet_room_background_id on existing redemptions where the shop item
-- is linked to a pet_room_background but the column was NULL (bought before the fix).
-- Run once in Supabase SQL editor.

UPDATE redemptions r
SET pet_room_background_id = prb.id
FROM pet_room_backgrounds prb
WHERE prb.shop_item_id = r.item_id
  AND r.pet_room_background_id IS NULL
  AND r.refunded_at IS NULL;
