# Supabase Setup Instructions

## Prerequisites
- Supabase account (free tier is fine for MVP)
- Two Supabase projects: dev and prod

## Setup Steps

### 0. Clean Existing Database (If Needed)

If you're resetting an existing Supabase project:

1. Go to SQL Editor in Supabase dashboard
2. Copy contents of `cleanup.sql`
3. Paste and click "Run"
4. This will drop all tables, policies, functions, and storage buckets
5. Then proceed with steps below

### 1. Create Supabase Projects

#### Dev Project
1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Name: `henry-math-dev`
4. Database Password: (save this securely)
5. Region: Choose closest to your users
6. Click "Create new project"

#### Prod Project
1. Repeat above steps
2. Name: `henry-math-prod`
3. Use a different, secure password

### 2. Run Database Schema

For each project (dev and prod):

1. Go to SQL Editor in Supabase dashboard
2. Click "New Query"
3. Copy contents of `schema.sql`
4. Paste and click "Run"
5. Verify all tables are created (check Table Editor)

### 3. Seed Initial Data

For each project (dev and prod):

1. Go to SQL Editor
2. Click "New Query"
3. Copy contents of `seed.sql`
4. Paste and click "Run"
5. Verify permissions and roles are created:
   - Check `permissions` table (should have 16 rows)
   - Check `roles` table (should have 3 rows: teacher, student, observer)
   - Check `role_permissions` table (should have mappings)

### 4. Configure Storage Buckets

For each project (dev and prod):

1. Go to Storage in Supabase dashboard
2. Create bucket: `class-materials`
   - Public: No
   - File size limit: 50MB
   - Allowed MIME types: (leave empty for all)
3. Create bucket: `avatars`
   - Public: Yes
   - File size limit: 2MB
   - Allowed MIME types: image/*

### 5. Configure Authentication

For each project (dev and prod):

1. Go to Authentication → Settings
2. Enable Email provider
3. Disable email confirmations (for MVP, enable later)
4. Configure email templates (optional)
5. Add site URL:
   - Dev: `http://localhost:3000`
   - Prod: Your production domain

### 6. Get API Keys

For each project:

1. Go to Settings → API
2. Copy these values:
   - Project URL
   - `anon` public key
   - `service_role` secret key (keep secure!)

### 7. Configure Environment Variables

#### Local Development (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx-dev.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-dev-service-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### Vercel Dev App
Add environment variables in Vercel dashboard:
- Use dev Supabase credentials
- Set for "Preview" and "Development" environments

#### Vercel Prod App
Add environment variables in Vercel dashboard:
- Use prod Supabase credentials
- Set for "Production" environment

## Verify Setup

### Test Database Connection
```typescript
// Test in your app
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
const { data, error } = await supabase.from('roles').select('*')
console.log('Roles:', data) // Should show 3 roles
```

### Test RLS Policies
1. Create a test user via Supabase dashboard
2. Try querying tables with that user's session
3. Verify RLS policies are enforcing permissions

## Troubleshooting

### Complete Database Reset

If you need to completely reset your database:

1. Run `cleanup.sql` in SQL Editor
2. Verify all tables are gone in Table Editor
3. Verify storage buckets are deleted in Storage
4. Run `schema.sql` to recreate structure
5. Run `seed.sql` to add initial data

### Tables not created
- Check SQL Editor for error messages
- Ensure UUID extension is enabled
- Run schema.sql again

### RLS policies not working
- Verify RLS is enabled on all tables
- Check policy conditions
- Test with different user contexts

### Storage buckets not accessible
- Verify bucket policies are set
- Check CORS settings
- Ensure file size limits are appropriate

## Database Migrations

For future schema changes:

1. Create migration file: `supabase/migrations/YYYYMMDD_description.sql`
2. Test in dev project first
3. Apply to prod after testing
4. Keep migrations in version control

## Backup Strategy

### Free Tier
- Manual exports via Supabase dashboard
- Export weekly to local storage

### Pro Tier (when scaling)
- Automatic daily backups included
- Point-in-time recovery available
