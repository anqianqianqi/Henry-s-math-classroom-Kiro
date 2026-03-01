# Supabase SQL Scripts

## Core Schema (Run in order)
1. **schema.sql** - Main database schema with all tables and RLS policies
2. **seed.sql** - Initial data (roles, permissions)
3. **fix-profile-creation.sql** - Trigger to auto-create profiles on signup

## Setup Scripts (For initial setup)
- **fix-existing-user.sql** - Fix missing profile for existing user
- **assign-teacher-role.sql** - Assign teacher role to a user
- **auto-assign-role.sql** - Auto-assign student role on signup

## Testing Scripts (For development/testing)
- **simple-setup.sql** - Quick setup for testing Daily Challenge
- **add-mock-data-simple.sql** - Add mock student submissions
- **mock-challenge-data.sql** - Full mock data with students and challenges
- **create-test-accounts.sql** - Create test accounts
- **debug-student.sql** - Debug student access issues

## Fix Scripts (Run when needed)
- **fix-all-rls.sql** - Fix all RLS policies (use this if having permission issues)
- **fix-rls-policies.sql** - Fix specific RLS policies
- **simple-rls-fix.sql** - Simplified RLS policies
- **fix-submissions.sql** - Fix submission policies
- **cleanup.sql** - Clean up and reset database

## Deprecated/Old Scripts
- add-student-to-class.sql
- setup-student-testing.sql
- quick-setup.sql
- fix-existing-user.sql

## Recommended Setup Flow

### First Time Setup
1. Run `schema.sql` in Supabase SQL Editor
2. Run `seed.sql`
3. Run `fix-profile-creation.sql`
4. Run `fix-all-rls.sql`

### Testing Daily Challenge
1. Create a class via UI at /classes/new
2. Run `simple-setup.sql` to create today's challenge
3. Run `add-mock-data-simple.sql` to add mock submissions
4. Test as student!

### If You Have Issues
- Permission errors → Run `fix-all-rls.sql`
- Missing profile → Run `fix-profile-creation.sql`
- Need to reset → Run `cleanup.sql` then start over
