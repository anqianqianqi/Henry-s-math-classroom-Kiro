-- Henry's Math Classroom - Complete Database Cleanup
-- Run this to completely reset your database to a clean state

-- ============================================
-- CLEANUP: DROP ALL EXISTING OBJECTS
-- ============================================

-- Drop all RLS policies first
DROP POLICY IF EXISTS "Anyone can read permissions" ON permissions;
DROP POLICY IF EXISTS "Anyone can read roles" ON roles;
DROP POLICY IF EXISTS "Anyone can read role permissions" ON role_permissions;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read class member profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own roles" ON user_roles;
DROP POLICY IF EXISTS "Users with permission can create classes" ON classes;
DROP POLICY IF EXISTS "Users can read their classes" ON classes;
DROP POLICY IF EXISTS "Users can update their classes" ON classes;
DROP POLICY IF EXISTS "Users can delete their classes" ON classes;
DROP POLICY IF EXISTS "Users can read own memberships" ON class_members;
DROP POLICY IF EXISTS "Users can read class members" ON class_members;
DROP POLICY IF EXISTS "Users can create challenges" ON daily_challenges;
DROP POLICY IF EXISTS "Users can read assigned challenges" ON daily_challenges;
DROP POLICY IF EXISTS "Users can create own submissions" ON challenge_submissions;
DROP POLICY IF EXISTS "Users can read own submissions" ON challenge_submissions;
DROP POLICY IF EXISTS "Users can read submissions after posting" ON challenge_submissions;
DROP POLICY IF EXISTS "Users can upload materials" ON class_materials;
DROP POLICY IF EXISTS "Users can read class materials" ON class_materials;

-- Drop helper functions
DROP FUNCTION IF EXISTS user_has_permission(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS user_has_submitted(UUID, UUID);

-- Drop all tables (in reverse dependency order)
DROP TABLE IF EXISTS class_materials CASCADE;
DROP TABLE IF EXISTS challenge_submissions CASCADE;
DROP TABLE IF EXISTS challenge_assignments CASCADE;
DROP TABLE IF EXISTS daily_challenges CASCADE;
DROP TABLE IF EXISTS user_relationships CASCADE;
DROP TABLE IF EXISTS class_members CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;

-- ============================================
-- STORAGE BUCKET CLEANUP
-- ============================================

-- Delete all files from storage buckets
DELETE FROM storage.objects WHERE bucket_id = 'class-materials';
DELETE FROM storage.objects WHERE bucket_id = 'avatars';

-- Delete the buckets themselves
DELETE FROM storage.buckets WHERE id = 'class-materials';
DELETE FROM storage.buckets WHERE id = 'avatars';

-- ============================================
-- CLEANUP COMPLETE
-- ============================================

-- Now you can run schema.sql to recreate everything fresh
