-- Run this in Supabase SQL Editor to diagnose overlay issues
-- Step 1: Check if the table exists and has rows
SELECT COUNT(*) as total_overlays FROM book_skin_overlays;

-- Step 2: Check the most recently saved skin and its overlays
SELECT 
  bs.id,
  bs.name,
  bs.has_overlays,
  bs.created_at,
  COUNT(bso.id) as overlay_count
FROM book_skins bs
LEFT JOIN book_skin_overlays bso ON bso.skin_id = bs.id
WHERE bs.skin_type = 'cover'
ORDER BY bs.created_at DESC
LIMIT 10;

-- Step 3: See actual overlay rows for the most recent skin with overlays
SELECT 
  bso.id,
  bso.skin_id,
  bso.label,
  LEFT(bso.image_url, 80) as image_url_preview,
  bso.sort_order,
  bso.created_at
FROM book_skin_overlays bso
JOIN book_skins bs ON bs.id = bso.skin_id
ORDER BY bso.created_at DESC
LIMIT 20;
