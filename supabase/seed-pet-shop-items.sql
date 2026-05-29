-- ============================================================
-- Seed: Pet Shop Items (Food + Accessories)
-- Run this in the Supabase SQL Editor.
-- Uses the first teacher/admin account as created_by.
-- ============================================================

DO $$
DECLARE
  v_teacher_id UUID;
BEGIN
  -- Look up the admin by email
  SELECT id INTO v_teacher_id
  FROM profiles
  WHERE email = 'anqiluo1997@gmail.com';

  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found for anqiluo1997@gmail.com';
  END IF;

  RAISE NOTICE 'Using teacher/admin ID: %', v_teacher_id;

  -- ── Food items (feed your pet to gain XP) ──────────────────────────────────

  INSERT INTO shop_items (title, description, cost, is_active, created_by, category, commodity_type, food_xp)
  VALUES
    (
      '🍎 Apple',
      'A crisp apple to keep your pet healthy.',
      5,
      true,
      v_teacher_id,
      'food',
      'standard',
      20
    ),
    (
      '🍖 Drumstick',
      'A hearty drumstick for a growing pet.',
      10,
      true,
      v_teacher_id,
      'food',
      'standard',
      50
    ),
    (
      '🍰 Birthday Cake',
      'A special treat that gives a big XP boost!',
      25,
      true,
      v_teacher_id,
      'food',
      'standard',
      120
    ),
    (
      '🍣 Sushi Platter',
      'Premium sushi — your pet will love it.',
      40,
      true,
      v_teacher_id,
      'food',
      'standard',
      200
    ),
    (
      '⭐ Star Candy',
      'Magical star-shaped candy. Huge XP boost!',
      80,
      true,
      v_teacher_id,
      'food',
      'standard',
      400
    );

  -- ── Accessory items (equip on your pet) ────────────────────────────────────

  INSERT INTO shop_items (title, description, cost, is_active, created_by, category, commodity_type, food_xp)
  VALUES
    (
      '🎩 Top Hat',
      'A dapper top hat for your distinguished pet.',
      30,
      true,
      v_teacher_id,
      'accessory',
      'standard',
      NULL
    ),
    (
      '🕶️ Cool Shades',
      'Sunglasses to make your pet look extra cool.',
      20,
      true,
      v_teacher_id,
      'accessory',
      'standard',
      NULL
    ),
    (
      '🎀 Bow Tie',
      'A cute bow tie for formal occasions.',
      15,
      true,
      v_teacher_id,
      'accessory',
      'standard',
      NULL
    ),
    (
      '👑 Golden Crown',
      'A majestic crown fit for a legendary pet.',
      60,
      true,
      v_teacher_id,
      'accessory',
      'standard',
      NULL
    ),
    (
      '🌸 Flower Wreath',
      'A beautiful wreath of flowers for your pet.',
      25,
      true,
      v_teacher_id,
      'accessory',
      'standard',
      NULL
    );

  RAISE NOTICE 'Successfully inserted 5 food items and 5 accessory items.';
END;
$$;

-- Verify the items were created
SELECT title, category, cost, food_xp, is_active
FROM shop_items
WHERE category IN ('food', 'accessory')
ORDER BY category, cost;
