-- Fix Alex's name in profile

-- Check current name
SELECT 'Current profile:' as info;
SELECT id, email, full_name, 
       (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = profiles.id) as auth_name
FROM profiles 
WHERE email = 'alex@test.com';

-- Update Alex's profile directly to correct name
UPDATE profiles
SET full_name = 'Alex Wong'
WHERE email = 'alex@test.com';

-- Also update the auth.users metadata to match
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{full_name}',
  '"Alex Wong"'
)
WHERE email = 'alex@test.com';

-- Verify
SELECT 'After fix:' as info;
SELECT id, email, full_name
FROM profiles 
WHERE email = 'alex@test.com';

SELECT 'Auth metadata:' as info;
SELECT email, raw_user_meta_data->>'full_name' as auth_name
FROM auth.users
WHERE email = 'alex@test.com';

-- Also fix the profile creation trigger to always use auth.users metadata
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile for new user using metadata from auth.users
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', profiles.full_name);
  
  -- Assign default student role
  INSERT INTO public.user_roles (user_id, role_id, class_id)
  VALUES (
    NEW.id,
    (SELECT id FROM public.roles WHERE name = 'student'),
    NULL
  )
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT '✅ Alex''s name fixed and trigger updated!' as result;
