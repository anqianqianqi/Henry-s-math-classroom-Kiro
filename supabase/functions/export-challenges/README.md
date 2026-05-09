# Export Challenges Edge Function

Exports the `daily_challenges` table (with assignments and submissions) as JSON to S3.

## Setup

### 1. Install Supabase CLI (if not already)
```bash
npm install -g supabase
```

### 2. Login and link
```bash
supabase login
supabase link --project-ref thgaokonzsabpvhfbfdy
```

### 3. Set secrets (your AWS credentials)
```bash
supabase secrets set AWS_ACCESS_KEY_ID=your-key
supabase secrets set AWS_SECRET_ACCESS_KEY=your-secret
supabase secrets set AWS_REGION=us-east-1
supabase secrets set S3_BUCKET=your-bucket-name
```

### 4. Deploy the function
```bash
supabase functions deploy export-challenges
```

### 5. Test it manually
```bash
curl -X POST https://thgaokonzsabpvhfbfdy.supabase.co/functions/v1/export-challenges \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### 6. Schedule it (optional — runs daily at 2am UTC)

Run this in Supabase SQL Editor:
```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily export
SELECT cron.schedule(
  'export-challenges-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://thgaokonzsabpvhfbfdy.supabase.co/functions/v1/export-challenges',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Note: `pg_cron` and `pg_net` are available on Supabase Pro plan. On free tier, use an external cron service like cron-job.org to hit the function URL daily.

## Output

The function creates a file in S3 at:
```
s3://your-bucket/exports/daily_challenges_2026-05-09T02-00-00-000Z.json
```

Each export includes:
- All challenges with metadata
- Challenge assignments (which classes)
- All submissions with points and content
