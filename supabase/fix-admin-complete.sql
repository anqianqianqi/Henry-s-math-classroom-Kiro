-- Complete fix for admin role assignment
-- This handles the case where auth user exists but profile doesn't

-- Step 1: Ensure profile exists for admin@test.com
INSERT INTO profiles (id, email, full_name)
SELECT 
  id,
  email,
  'Administrator'
FROM auth.users
WHERE email = 'admin@test.com'
ON CONFLICT (id) DO NOTHING;

-- Step 2: Verify profile was created
SELECT id, email, full_name
FROM profiles
WHERE email = 'admin@test.com';

-- Step 3: Ensure administrator role exists
INSERT INTO roles (name, description)
VALUES ('administrator', 'System administrator with full access')
ON CONFLICT (name) DO NOTHING;

-- Step 4: Assign administrator role to the user
-- First check if it already exists
DO $$
DECLARE
  v_user_id uuid;
  v_role_id uuid;
  v_exists boolean;
BEGIN
  -- Get user_id
  SELECT id INTO v_user_id
  FROM profiles
  WHERE email = 'admin@test.com';
  
  -- Get role_id
  SELECT id INTO v_role_id
  FROM roles
  WHERE name = 'administrator';
  
  -- Check if assignment already exists
  SELECT EXISTS(
    SELECT 1 FROM user_roles
    WHERE user_id = v_user_id
      AND role_id = v_role_id
      AND class_id IS NULL
  ) INTO v_exists;
  
  -- Insert if it doesn't exist
  IF NOT v_exists AND v_user_id IS NOT NULL AND v_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id, class_id)
    VALUES (v_user_id, v_role_id, NULL);
    RAISE NOTICE 'Admin role assigned successfully';
  ELSIF v_exists THEN
    RAISE NOTICE 'Admin role already assigned';
  ELSE
    RAISE NOTICE 'User or role not found';
  END IF;
END $$;

-- Step 5: Verify the role assignment
SELECT 
  p.id as user_id,
  p.email,
  p.full_name,
  r.name as role_name,
  r.description
FROM profiles p
JOIN user_roles ur ON p.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE p.email = 'admin@test.com';

-- Step 6: Test that the user can see their own roles (this is what the frontend queries)
-- Run this while logged in as admin@test.com to verify
-- SELECT ur.*, r.name as role_name
-- FROM user_roles ur
-- JOIN roles r ON ur.role_id = r.id
-- WHERE ur.user_id = auth.uid();
