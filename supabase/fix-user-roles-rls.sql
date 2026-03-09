-- Fix: Users can't see their own roles
-- This is why admin can't see challenges - the frontend can't detect the admin role

-- Allow users to view their own roles
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
CREATE POLICY "Users can view own roles"
  ON user_roles FOR SELECT
  USING (user_id = auth.uid());

-- Verify the policy was created
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'user_roles'
  AND policyname = 'Users can view own roles';

-- Test: This should now return your roles
SELECT ur.*, r.name as role_name
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE ur.user_id = auth.uid();
