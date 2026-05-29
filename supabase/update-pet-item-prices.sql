-- Cap all food items to max 5 pts
UPDATE shop_items
SET cost = LEAST(cost, 5)
WHERE category = 'food';

-- Set accessory prices (adjust as needed)
-- Accessories: max 20 pts
UPDATE shop_items
SET cost = LEAST(cost, 20)
WHERE category = 'accessory';

-- Verify
SELECT id, title, category, cost
FROM shop_items
WHERE category IN ('food', 'accessory')
ORDER BY category, cost;
