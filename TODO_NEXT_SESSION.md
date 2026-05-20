# Next Session TODO - Scheduler & Template Improvements

## What was fixed this session:
- ✅ Tag management UI: removed extra tag line after groups, added search to groups, collapsible create form
- ✅ Cron scheduler: fixed auth (CRON_SECRET), fixed missing SUPABASE_SERVICE_ROLE_KEY in Vercel
- ✅ Generative challenge creation: dropped blocking unique index `idx_daily_challenges_template_title`
- ✅ Challenge date: scheduler now sets `challenge_date = today` when assigning
- ✅ RLS: fixed `daily_challenges` SELECT policy to allow all authenticated users
- ✅ Cron response: now returns challenge ID and title for debugging

## What to implement next:

### 1. Add Tag Picker to Generative Templates Page
- **File**: `app/admin/generative-templates/page.tsx`
- **What**: Add the `TagInput` component (from `components/TagInput.tsx`) to the template create/edit form
- **Why**: Teachers can't currently assign tags to templates from the UI — they need tags to link templates to schedules
- **DB**: `challenge_templates.tag_ids` column already exists (UUID array)

### 2. Show Scheduler Challenge History in Schedules Page
- **File**: `app/admin/schedules/page.tsx`
- **What**: Under each schedule card, show a list of challenges that were generated/assigned by that schedule
- **Data source**: `schedule_assignment_log` table joined with `daily_challenges`
- **Display**: Show date, challenge title, and link to challenge

### 3. Improve Duplicate Avoidance (Skip & Notify)
- **Current behavior**: When pool exhausted, resets log and cycles (repeats challenges)
- **New behavior**: When all challenges in the tag pool have been used AND no generative templates match, SKIP assignment and notify teacher
- **File**: `app/api/cron/scheduler/route.ts` — modify the fallback path
- **Notification**: Could be a simple flag on the schedule or an in-app notification

### 4. Template Tag Assignment Cannot Be Saved (Bug)
- The generative templates page may not be saving `tag_ids` properly
- Investigate the create/update flow in `app/admin/generative-templates/page.tsx`

## Current state of scheduler:
- Cron runs daily at 6:00 AM UTC via Vercel (`vercel.json`)
- Auth: `CRON_SECRET` env var in Vercel
- Schedule ID: `f3520fd3-9de4-4f61-9068-1d171c2cf1b1`
- Class ID: `76203ecc-fcff-4158-8d6d-6dc52621f596`
- Generative templates are working (creates new challenges with random params each day)
- Production URL: https://henrymathclassroom.com
- Manual trigger: `curl -H "Authorization: Bearer CRON_SECRET" https://henrymathclassroom.com/api/cron/scheduler`
