-- Remove Alex's submission

DELETE FROM challenge_submissions
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'alex@test.com');

-- Verify
SELECT 'Remaining submissions:' as info;
SELECT 
  p.email,
  p.full_name,
  LEFT(cs.content, 40) as preview
FROM challenge_submissions cs
JOIN profiles p ON cs.user_id = p.id
WHERE cs.challenge_id = (
  SELECT id FROM daily_challenges 
  WHERE challenge_date = CURRENT_DATE 
  LIMIT 1
)
ORDER BY cs.submitted_at DESC;

SELECT '✅ Alex''s submission removed!' as result;
