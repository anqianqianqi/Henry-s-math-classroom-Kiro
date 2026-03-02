-- Add mock submissions - Simple version
-- This temporarily disables constraints to add fake students

-- Get today's challenge ID
DO $$
DECLARE
  v_challenge_id uuid;
BEGIN
  SELECT id INTO v_challenge_id 
  FROM daily_challenges 
  WHERE challenge_date = CURRENT_DATE 
  LIMIT 1;

  IF v_challenge_id IS NULL THEN
    RAISE EXCEPTION 'No challenge found for today!';
  END IF;

  -- Temporarily disable the foreign key constraint
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

  -- Create mock student profiles
  INSERT INTO profiles (id, email, full_name, created_at) VALUES
    ('11111111-1111-1111-1111-111111111111', 'sarah.mock@test.com', 'Sarah Chen', NOW() - INTERVAL '30 days'),
    ('22222222-2222-2222-2222-222222222222', 'mike.mock@test.com', 'Mike Johnson', NOW() - INTERVAL '25 days'),
    ('33333333-3333-3333-3333-333333333333', 'emma.mock@test.com', 'Emma Davis', NOW() - INTERVAL '20 days')
  ON CONFLICT (id) DO NOTHING;

  -- Re-enable the foreign key constraint (but don't validate existing rows)
  ALTER TABLE profiles 
    ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) 
    ON DELETE CASCADE 
    NOT VALID;

  -- Create mock submissions
  INSERT INTO challenge_submissions (challenge_id, user_id, content, submitted_at) VALUES
    (v_challenge_id, '11111111-1111-1111-1111-111111111111',
     E'x = 5\n\nSteps:\n1. Start with: 2x + 5 = 15\n2. Subtract 5 from both sides: 2x = 10\n3. Divide both sides by 2: x = 5\n\nCheck: 2(5) + 5 = 15 ✓',
     NOW() - INTERVAL '15 minutes'),
    (v_challenge_id, '22222222-2222-2222-2222-222222222222',
     E'The answer is x = 5.\n\n2x + 5 = 15\n2x = 10\nx = 5\n\nI used inverse operations!',
     NOW() - INTERVAL '22 minutes'),
    (v_challenge_id, '33333333-3333-3333-3333-333333333333',
     E'x = 5\n\nI subtracted 5 from both sides to get 2x = 10, then divided by 2!',
     NOW() - INTERVAL '8 minutes')
  ON CONFLICT (challenge_id, user_id) DO NOTHING;

  RAISE NOTICE '✅ Mock data added!';
END $$;

-- Verify
SELECT '=== Mock Submissions ===' as status;
SELECT 
  p.full_name,
  LEFT(cs.content, 60) as preview,
  cs.submitted_at
FROM challenge_submissions cs
JOIN profiles p ON cs.user_id = p.id
WHERE cs.challenge_id = (SELECT id FROM daily_challenges WHERE challenge_date = CURRENT_DATE LIMIT 1)
ORDER BY cs.submitted_at DESC;
