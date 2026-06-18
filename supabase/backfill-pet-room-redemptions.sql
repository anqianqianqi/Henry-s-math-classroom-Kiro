-- Backfill pet_room_background_id on existing redemptions where the shop item
-- is linked to a pet_room_background but the column was NULL (bought before the fix).
-- Also backfill book_skin_id for book skin purchases.
-- Run once in Supabase SQL editor.

-- Pet room backgrounds
UPDATE redemptions r
SET pet_room_background_id = prb.id
FROM pet_room_backgrounds prb
WHERE prb.shop_item_id = r.item_id
  AND r.pet_room_background_id IS NULL
  AND r.refunded_at IS NULL;

-- Book skins
UPDATE redemptions r
SET book_skin_id = bs.id
FROM book_skins bs
WHERE bs.shop_item_id = r.item_id
  AND r.book_skin_id IS NULL
  AND r.refunded_at IS NULL;
