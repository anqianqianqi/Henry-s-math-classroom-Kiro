-- Run this in Supabase SQL Editor to diagnose the inventory state

-- 1. Check blindbox_sets quantities for all physical_blindbox items
SELECT 
  si.title AS item_title,
  si.commodity_type,
  si.quantity AS item_quantity,
  bs.id AS set_id,
  bs.name AS set_name,
  bs.quantity AS set_quantity
FROM shop_items si
JOIN blindbox_sets bs ON bs.item_id = si.id
WHERE si.commodity_type = 'physical_blindbox'
ORDER BY si.title, bs.sort_order;

-- 2. Check blindbox_claims for physical_blindbox items
SELECT 
  si.title AS item_title,
  bc.student_id,
  bc.set_id,
  bs.name AS set_name,
  bc.claimed_at
FROM blindbox_claims bc
JOIN shop_items si ON si.id = bc.item_id
LEFT JOIN blindbox_sets bs ON bs.id = bc.set_id
WHERE si.commodity_type = 'physical_blindbox'
ORDER BY bc.claimed_at DESC;

-- 3. Test the global remaining function
SELECT 
  si.id,
  si.title,
  get_physical_blindbox_total_remaining(si.id) AS total_remaining
FROM shop_items si
WHERE si.commodity_type = 'physical_blindbox';
