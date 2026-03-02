-- TEMPORARY: Disable RLS entirely for testing
-- This is the nuclear option - use only for development

-- Disable RLS on all tables
ALTER TABLE classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE class_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenges DISABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_submissions DISABLE ROW LEVEL SECURITY;

SELECT '⚠️ RLS DISABLED ON ALL TABLES' as warning;
SELECT 'This is for testing only - re-enable RLS before production!' as note;
SELECT 'Everything should work now' as result;
