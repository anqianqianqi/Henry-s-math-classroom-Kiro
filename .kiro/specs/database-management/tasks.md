# Database Management — Implementation Tasks

## Task 1: Emergency RLS Re-enforcement ✅ CRITICAL
- [ ] Run RLS enforcement migration on live Supabase (enables RLS on ALL public tables)
- [ ] Verify storage buckets are set to `public = false`
- [ ] Drop all overly permissive storage policies
- [ ] Run `check_rls_health()` and confirm all tables show ✅

## Task 2: Delete Dangerous Scripts
- [ ] Delete `supabase/disable-rls-for-testing.sql`
- [ ] Delete `supabase/temp-disable-grading-rls.sql`
- [ ] Delete `supabase/temp-disable-materials-rls.sql`
- [ ] Delete `supabase/temp-disable-occurrences-rls.sql`
- [ ] Delete `supabase/temp-disable-storage-rls.sql`
- [ ] Delete `supabase/disable-comments-rls-test.sql`

## Task 3: Create Migration System
- [ ] Create `_migrations` tracking table
- [ ] Reorganize existing SQL into numbered migrations under `supabase/migrations/`
- [ ] Document migration workflow in README

## Task 4: Deploy Health Check Function
- [ ] Create `check_rls_health()` function in Supabase
- [ ] Create `cleanup_old_notifications()` function
- [ ] Schedule notification cleanup via `pg_cron` (daily at 3 AM)
- [ ] Schedule RLS health check via `pg_cron` (weekly)

## Task 5: Fix SECURITY DEFINER Functions
- [ ] Audit `create_notification()` — restrict INSERT to service role only
- [ ] Review all trigger functions for privilege escalation
- [ ] Ensure notification INSERT policy uses `WITH CHECK (user_id = auth.uid())` instead of `WITH CHECK (true)`

## Task 6: Storage Security
- [ ] Replace public storage policies with authenticated-only policies
- [ ] Test file upload/download still works for teachers and students
- [ ] Verify no public URLs are leaking

## Task 7: Backup Configuration
- [ ] Verify Supabase plan includes daily backups
- [ ] Enable PITR if on Pro plan
- [ ] Document recovery procedure in `.kiro/DEPLOYMENT.md`

## Task 8: Data Retention Implementation
- [ ] Add `is_archived` column to `classes` table
- [ ] Add `deleted_at` column to `profiles` for soft deletes
- [ ] Implement notification cleanup cron job
- [ ] Document retention policy
