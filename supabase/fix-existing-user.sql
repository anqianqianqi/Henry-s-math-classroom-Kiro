-- Fix Existing User: anqiluo@amazon.com
-- This script manually creates the missing profile and assigns roles
-- Run this FIRST before applying the trigger

-- ============================================
-- Step 1: Create missing profile
-- ============================================

INSERT INTO public.profiles (id, email, full_name, created_at)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', 'Henry'),
  created_at
FROM auth.users 
WHERE email = 'anqiluo@amazon.com'
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name;

-- ============================================
-- Step 2: Assign teacher role
-- ============================================

INSERT INTO public.user_roles (user_id, role_id, class_id)
SELECT 
  au.id,
  (SELECT id FROM public.roles WHERE name = 'teacher'),
  NULL
FROM auth.users au 
WHERE au.email = 'anqiluo@amazon.com'
ON CONFLICT (user_id, role_id, COALESCE(class_id, '00000000-0000-0000-0000-000000000000'::uuid)) 
DO NOTHING;

-- ============================================
-- Step 3: Verify the fix
-- ============================================

SELECT 
  '✅ Profile and role fixed for anqiluo@amazon.com' as status;

-- Check profile
SELECT 
  'Profile:' as check_type,
  id, 
  email, 
  full_name 
FROM public.profiles 
WHERE email = 'anqiluo@amazon.com';

-- Check roles
SELECT 
  'Roles:' as check_type,
  p.email, 
  p.full_name, 
  r.name as role
FROM public.profiles p
JOIN public.user_roles ur ON p.id = ur.user_id
JOIN public.roles r ON ur.role_id = r.id
WHERE p.email = 'anqiluo@amazon.com';
