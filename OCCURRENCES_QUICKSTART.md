# Class Occurrences System - Quick Start

## What We Just Built

A complete learning management system foundation for Henry's Math Classroom that enables:
- 📅 Individual class sessions (auto-generated from schedule)
- 📚 Session-specific materials
- 📝 Homework assignments per session
- ✍️ Student submissions with versioning
- ✅ Teacher grading with feedback

## Phase 1: Database Foundation ✅ COMPLETE

### Files Created

1. **`supabase/add-class-occurrences-system.sql`** - Main database migration
   - 5 new tables
   - 14 new permissions
   - 20+ RLS policies

2. **`supabase/setup-storage-buckets.sql`** - Storage bucket policies
   - session-materials bucket
   - homework-submissions bucket

3. **`supabase/SETUP_OCCURRENCES_SYSTEM.md`** - Complete setup guide
   - Step-by-step instructions
   - Verification queries
   - Troubleshooting

4. **`types/database.ts`** - TypeScript types for all new tables

5. **`.kiro/specs/class-occurrences-materials/`** - Complete spec
   - requirements.md
   - design.md
   - tasks.md
   - IMPLEMENTATION_PLAN.md
   - PHASE1_COMPLETE.md

## How to Set Up (30 minutes)

### Step 1: Run Database Migration (5 min)
```bash
# Open Supabase SQL Editor
# Copy contents of: supabase/add-class-occurrences-system.sql
# Paste and execute
```

### Step 2: Create Storage Buckets (Choose One Method)

**Option A: Automated Script (1 min)**
```bash
node supabase/create-storage-buckets.js
```

**Option B: Manual Creation (5-10 min)**
1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Create `session-materials` (private, 50MB limit)
4. Create `homework-submissions` (private, 50MB limit)

See detailed guide: `supabase/MANUAL_BUCKET_CREATION.md`

### Step 3: Set Up Storage Policies (5 min)
```bash
# Open Supabase SQL Editor
# Copy contents of: supabase/setup-storage-buckets.sql
# Paste and execute
```

### Step 4: Verify Setup (10 min)
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('class_occurrences', 'session_materials', 'homework_assignments', 'homework_submissions', 'homework_grades');

-- Check permissions
SELECT name FROM permissions WHERE resource IN ('occurrence', 'material', 'homework', 'submission', 'grade');

-- Test creating an occurrence
INSERT INTO class_occurrences (class_id, occurrence_date, start_time, end_time, session_number)
VALUES ('YOUR_CLASS_ID', '2026-03-10', '15:00', '16:00', 1);
```

## What's Next?

### Phase 2: Occurrence Generation (Next)
Build the algorithm to auto-generate class sessions from schedule:
- Parse schedule JSONB (day, startTime, endTime)
- Calculate all matching dates between start_date and end_date
- Generate occurrence records with sequential numbering

### Phase 3: Material Management
Enable teachers to upload materials and students to download them

### Phase 4: Homework System
Teachers create assignments, students submit homework

### Phase 5: Grading System
Teachers grade submissions with feedback

### Phase 6: React Components
Build all UI components

### Phase 7: Integration
Wire everything together in class detail page

## Architecture Overview

```
Frontend (Next.js/React)
    ↓
Supabase Client
    ↓
PostgreSQL + RLS Policies
    ↓
Storage Buckets
```

### Data Flow Example: Material Upload
```
1. Teacher uploads file → MaterialUpload component
2. File sent to Supabase Storage → session-materials bucket
3. Get public URL
4. Create record in session_materials table
5. RLS policy checks: user_has_permission('material:upload')
6. Record saved, students can now download
```

## Key Features

### Automatic Occurrence Generation
When a class is created with schedule:
```json
{
  "schedule": [
    {"day": "Monday", "startTime": "15:00", "endTime": "16:00"},
    {"day": "Wednesday", "startTime": "15:00", "endTime": "16:00"}
  ],
  "start_date": "2026-01-05",
  "end_date": "2026-05-30"
}
```

System generates ~40 occurrences (2 per week × 20 weeks)

### Session-Specific Materials
Each occurrence can have multiple materials:
- PDFs, Word docs, PowerPoints
- Links to videos or external resources
- Teacher notes
- Class recordings

### Homework Workflow
1. Teacher creates assignment for a session
2. Students submit before due date
3. Late submissions flagged automatically
4. Students can resubmit (version tracking)
5. Teacher grades with feedback
6. Students view published grades

### Progress Tracking
- Students: completion rate, average grade, upcoming deadlines
- Teachers: class statistics, individual progress, submission rates

## Security Model

### Role-Based Access Control (RBAC)
- **Teachers**: Full control over their classes
- **Students**: Can submit homework, view own grades
- **Administrators**: Full access to all classes

### Row Level Security (RLS)
Every query automatically filtered by:
- Class membership
- User permissions
- Data ownership

Example: Students can only see their own submissions, but teachers can see all submissions for their classes.

## Database Schema

```
classes (existing)
  ↓
class_occurrences (NEW)
  ├── session_materials (NEW)
  └── homework_assignments (NEW)
       ↓
       homework_submissions (NEW)
         ↓
         homework_grades (NEW)
```

## Development Approach

We're using **Phased Rollout** (Option C):
- ✅ Phase 1: Database Foundation (DONE)
- 🔄 Phase 2: Occurrence Generation (NEXT)
- ⏳ Phase 3: Material Management
- ⏳ Phase 4: Homework System
- ⏳ Phase 5: Grading System
- ⏳ Phase 6: React Components
- ⏳ Phase 7: Integration
- ⏳ Phase 8: Polish & Testing

Each phase delivers incremental value and can be tested independently.

## Need Help?

See detailed documentation:
- **Setup**: `supabase/SETUP_OCCURRENCES_SYSTEM.md`
- **Design**: `.kiro/specs/class-occurrences-materials/design.md`
- **Requirements**: `.kiro/specs/class-occurrences-materials/requirements.md`
- **Tasks**: `.kiro/specs/class-occurrences-materials/tasks.md`
- **Implementation Plan**: `.kiro/specs/class-occurrences-materials/IMPLEMENTATION_PLAN.md`

## Ready to Continue?

Once you've completed the setup steps above, let me know and we'll move to Phase 2: Occurrence Generation!

The foundation is solid. Let's build something amazing! 🚀
