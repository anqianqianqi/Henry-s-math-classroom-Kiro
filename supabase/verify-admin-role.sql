-- Verify admin role assignment for admin@test.com

-- 1. Check if the user exists in auth
SELECT id, email, created_at
FROM auth.users
WHERE email = 'admin@test.com';

-- 2. Check if the administrator role exists
SELECT id, name, description
FROM roles
WHERE name = 'administrator';

-- 3. Check if the user_roles assignment exists
SELECT ur.id, ur.user_id, ur.role_id, r.name as role_name, u.email
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
JOIN auth.users u ON ur.user_id = u.id
WHERE u.email = 'admin@test.com';

-- 4. If the assignment is missing, create it
-- First get the user_id and role_id
DO $$
DECLARE
  v_user_id uuid;
  v_role_id uuid;
BEGIN
  -- Get user_id
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'admin@test.com';
  
  -- Get role_id for administrator
  SELECT id INTO v_role_id
  FROM roles
  WHERE name = 'administrator';
  
  -- Check if both exist
  IF v_user_id IS NOT NULL AND v_role_id IS NOT NULL THEN
    -- Insert if not exists
    INSERT INTO user_roles (user_id, role_id)
    VALUES (v_user_id, v_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    RAISE NOTICE 'Admin role assigned to user_id: %', v_user_id;
  ELSE
    RAISE NOTICE 'User or role not found. user_id: %, role_id: %', v_user_id, v_role_id;
  END IF;
END $$;

-- 5. Verify the assignment was created
SELECT ur.id, ur.user_id, ur.role_id, r.name as role_name, u.email
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
JOIN auth.users u ON ur.user_id = u.id
WHERE u.email = 'admin@test.com';
