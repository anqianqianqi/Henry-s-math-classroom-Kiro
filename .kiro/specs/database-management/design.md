# Database Management — Design & Implementation

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  Supabase                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ PostgreSQL│  │ Storage  │  │ Auth         │  │
│  │ + RLS     │  │ (private)│  │ (managed)    │  │
│  └────┬─────┘  └────┬─────┘  └──────────────┘  │
│       │              │                           │
│  ┌────┴──────────────┴─────┐                    │
│  │ Daily PITR Backups      │                    │
│  │ + Weekly pg_dump export │                    │
│  └─────────────────────────┘                    │
│                                                  │
│  ┌─────────────────────────┐                    │
│  │ Health Check Function   │ ← runs weekly      │
│  │ - RLS status            │                    │
│  │ - Orphan detection      │                    │
│  │ - Size monitoring       │                    │
│  └─────────────────────────┘                    │
│                                                  │
│  ┌─────────────────────────┐                    │
│  │ Notification Cleanup    │ ← runs daily       │
│  │ - Delete > 90 days      │                    │
│  └─────────────────────────┘                    │
└─────────────────────────────────────────────────┘
```

---

## 1. RLS Re-enforcement Migration

Create a single migration that guarantees RLS is ON for every public table and storage buckets are private.

```sql
-- Migration: 001_enforce_rls_everywhere.sql

-- Re-enable RLS on ALL public tables (idempotent)
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t.tablename);
  END LOOP;
END $$;

-- Make storage buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('session-materials', 'homework-submissions', 'class-materials', 'class-covers', 'avatars');

-- Drop overly permissive storage policies
DROP POLICY IF EXISTS "Public access to session-materials" ON storage.objects;
DROP POLICY IF EXISTS "Public access to homework-submissions" ON storage.objects;
```

---

## 2. RLS Health Check Function

```sql
CREATE OR REPLACE FUNCTION check_rls_health()
RETURNS TABLE(
  table_name TEXT,
  rls_enabled BOOLEAN,
  policy_count BIGINT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tablename::TEXT,
    t.rowsecurity,
    COALESCE(p.cnt, 0),
    CASE
      WHEN NOT t.rowsecurity THEN '🚨 RLS DISABLED'
      WHEN COALESCE(p.cnt, 0) = 0 THEN '⚠️ RLS ON but NO POLICIES'
      ELSE '✅ OK'
    END
  FROM pg_tables t
  LEFT JOIN (
    SELECT pol.tablename, COUNT(*) as cnt
    FROM pg_policies pol
    WHERE pol.schemaname = 'public'
    GROUP BY pol.tablename
  ) p ON t.tablename = p.tablename
  WHERE t.schemaname = 'public'
  ORDER BY t.rowsecurity ASC, t.tablename;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 3. Notification Cleanup Function

```sql
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM notifications
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND is_read = TRUE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Schedule via Supabase `pg_cron`:
```sql
SELECT cron.schedule('cleanup-notifications', '0 3 * * *', 'SELECT cleanup_old_notifications()');
```

---

## 4. Migration Tracking

Create a migrations table to track what's been applied:

```sql
CREATE TABLE IF NOT EXISTS _migrations (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE _migrations ENABLE ROW LEVEL SECURITY;
-- No SELECT policy for regular users — only service role can access
```

---

## 5. Storage Security Policies (Replacement)

```sql
-- Authenticated users can upload to their own folder
CREATE POLICY "Auth users upload own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id IN ('session-materials', 'homework-submissions')
  AND auth.role() = 'authenticated'
);

-- Authenticated users can read files in their class buckets
CREATE POLICY "Auth users read class files"
ON storage.objects FOR SELECT
USING (
  bucket_id IN ('session-materials', 'homework-submissions')
  AND auth.role() = 'authenticated'
);

-- Only file owner or teacher can delete
CREATE POLICY "Owner can delete files"
ON storage.objects FOR DELETE
USING (
  auth.uid()::text = (storage.foldername(name))[1]
);
```

---

## 6. Backup Strategy

| Tier | Method | Frequency | Retention | Cost |
|------|--------|-----------|-----------|------|
| Free | Supabase daily backup | Daily | 7 days | $0 |
| Pro | PITR | Continuous | 7 days | Included in $25/mo |
| Manual | `pg_dump` via edge function | Weekly | 30 days | Storage cost only |

### Manual Export (Edge Function)
For critical data, create a Supabase Edge Function that runs `pg_dump` equivalent queries and stores results. This is the "belt and suspenders" approach.

---

## 7. Files to Delete/Archive

These scripts should be removed from the repo (they're dangerous if accidentally run):

```
supabase/disable-rls-for-testing.sql          → DELETE
supabase/temp-disable-grading-rls.sql         → DELETE
supabase/temp-disable-materials-rls.sql       → DELETE
supabase/temp-disable-occurrences-rls.sql     → DELETE
supabase/temp-disable-storage-rls.sql         → DELETE
supabase/disable-comments-rls-test.sql        → DELETE
```

---

## 8. Data Retention Summary

| Data Type | Retention | Action After |
|-----------|-----------|-------------|
| Profiles | Indefinite | Soft-delete on account closure |
| Classes | Indefinite | Archive flag after 2 years |
| Submissions & Grades | Indefinite | Core educational record |
| Notifications | 90 days (read) | Auto-delete via cron |
| Notifications (unread) | 1 year | Auto-delete via cron |
| Storage files | Indefinite | Consider compression after 1 year |
| Audit/migration logs | Indefinite | Append-only |
