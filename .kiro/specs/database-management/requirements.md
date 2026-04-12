# Database Management & Longevity Spec

## Problem Statement

Henry's Math Classroom needs a database management strategy that ensures:
1. Data lasts "forever" (or as long as practically needed)
2. Cost remains feasible for a small education platform
3. Security is airtight — no RLS gaps, no exposed data
4. Recovery is possible when things go wrong

## Current State (Audit Findings)

### Critical Security Issues
- 6 SQL scripts exist that DISABLE RLS on production tables
- Storage buckets may be PUBLIC if `temp-disable-storage-rls.sql` was executed
- `SECURITY DEFINER` functions with overly permissive INSERT policies on notifications
- No migration tracking — scripts are ad-hoc SQL files with no version control of what's been applied

### Missing Infrastructure
- No automated backups beyond Supabase defaults
- No point-in-time recovery configuration
- No data retention policy
- No migration versioning system
- No monitoring for RLS status drift

---

## Requirements

### REQ-1: RLS Enforcement (Safety)
- MUST re-enable RLS on ALL tables and verify status
- MUST delete or archive all `temp-disable-*` and `disable-*` SQL scripts
- MUST create a verification query that checks RLS status on every table
- MUST restrict `SECURITY DEFINER` functions to minimum necessary privilege
- MUST make storage buckets private with proper per-role policies

### REQ-2: Migration System (Feasibility)
- MUST adopt numbered, sequential migration files (e.g., `001_initial_schema.sql`)
- MUST track which migrations have been applied (migration history table)
- MUST NOT use ad-hoc SQL files for schema changes going forward
- SHOULD use Supabase CLI migrations (`supabase migration new`)

### REQ-3: Backup & Recovery (Longevity)
- MUST enable Supabase Point-in-Time Recovery (PITR) if on Pro plan
- MUST configure daily automated backups (Supabase provides this on paid plans)
- SHOULD export critical data periodically to external storage (e.g., S3 or local dump)
- MUST document recovery procedures
- SHOULD test recovery at least once

### REQ-4: Data Retention (Cost + Longevity Balance)
- MUST define retention periods per data type:
  - User profiles: indefinite (while account active)
  - Class data: indefinite (archive after 2 years)
  - Submissions/grades: indefinite (core educational record)
  - Notifications: 90 days, then auto-delete
  - Session materials/files: indefinite (but compress after 1 year)
- MUST implement notification cleanup (cron or scheduled function)
- SHOULD monitor database size and alert at thresholds

### REQ-5: Monitoring & Alerting
- SHOULD create a health-check function that verifies:
  - RLS enabled on all public tables
  - Storage buckets are private
  - No orphaned records
  - Database size within budget
- SHOULD run health check on a schedule (weekly minimum)

### REQ-6: Cost Optimization
- SHOULD use Supabase Free tier limits awareness (500MB DB, 1GB storage)
- MUST plan for Pro tier ($25/mo) when data exceeds free limits
- SHOULD implement soft deletes instead of hard deletes for audit trail
- SHOULD use database indexes efficiently (audit unused indexes)

---

## Out of Scope
- Multi-region replication (not needed at this scale)
- Real-time CDC/streaming (Supabase realtime covers this)
- Custom backup infrastructure (rely on Supabase managed backups)
