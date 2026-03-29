-- ============================================
-- EMERGENCY: Re-enforce RLS on ALL tables
-- Run this on your Supabase SQL Editor NOW
-- ============================================

-- 1. Enable RLS on every public table
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE '_migrations'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t.tablename);
    RAISE NOTICE 'RLS enabled on: %', t.tablename;
  END LOOP;
END $$;

-- 2. Make storage buckets private
UPDATE storage.buckets SET public = false;

-- 3. Drop dangerous public storage policies
DROP POLICY IF EXISTS "Public access to session-materials" ON storage.objects;
DROP POLICY IF EXISTS "Public access to homework-submissions" ON storage.objects;

-- 4. Recreate proper storage policies
DROP POLICY IF EXISTS "Auth users can upload" ON storage.objects;
CREATE POLICY "Auth users can upload"
ON storage.objects FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth users can read" ON storage.objects;
CREATE POLICY "Auth users can read"
ON storage.objects FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth users can delete own" ON storage.objects;
CREATE POLICY "Auth users can delete own"
ON storage.objects FOR DELETE
USING (auth.uid()::text = (storage.foldername(name))[1]);

-- 5. Fix notification INSERT policy (restrict to service role or own user)
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications"
ON notifications FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR auth.role() = 'service_role'
);

-- 6. Verify everything
SELECT
  t.tablename,
  t.rowsecurity as rls_enabled,
  COALESCE(p.cnt, 0) as policy_count,
  CASE
    WHEN NOT t.rowsecurity THEN '🚨 RLS DISABLED'
    WHEN COALESCE(p.cnt, 0) = 0 THEN '⚠️ NO POLICIES'
    ELSE '✅ OK'
  END as status
FROM pg_tables t
LEFT JOIN (
  SELECT pol.tablename, COUNT(*) as cnt
  FROM pg_policies pol
  WHERE pol.schemaname = 'public'
  GROUP BY pol.tablename
) p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
ORDER BY t.rowsecurity ASC, t.tablename;

-- 7. Verify storage buckets are private
SELECT id, name, public FROM storage.buckets;
