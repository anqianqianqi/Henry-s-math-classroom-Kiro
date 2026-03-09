# What's Ready to Test Right Now

## Current Status

We've built the **backend foundation** for the class occurrences system:
- ✅ Database tables created
- ✅ Occurrence generation algorithm working
- ✅ Material utilities ready (but no UI yet)
- ❌ No UI components built yet

## What You CAN Test

### 1. Database & Mock Data

**Run the mock data script:**
```sql
-- File: supabase/seed-occurrences-test-data.sql
-- This creates a test class with 24 occurrences
```

**Verify it worked:**
```sql
-- Check class created
SELECT * FROM classes WHERE name = 'Algebra 1 - Spring 2026';

-- Check occurrences created (should be ~24)
SELECT COUNT(*) FROM class_occurrences 
WHERE class_id = (SELECT id FROM classes WHERE name = 'Algebra 1 - Spring 2026');

-- View first 10 occurrences
SELECT session_number, occurrence_date, topic, status
FROM class_occurrences
WHERE class_id = (SELECT id FROM classes WHERE name = 'Algebra 1 - Spring 2026')
ORDER BY session_number
LIMIT 10;
```

### 2. Occurrence Generation Algorithm

**Test in browser console:**
```javascript
// Open browser console on your app
import { generateOccurrences } from '@/lib/utils/occurrences'

const schedule = [
  { day: 'Monday', startTime: '15:00', endTime: '16:00' },
  { day: 'Wednesday', startTime: '15:00', endTime: '16:00' }
]

const occurrences = generateOccurrences(
  'test-class-id',
  schedule,
  new Date('2026-03-10'),
  new Date('2026-05-30')
)

console.log(`Generated ${occurrences.length} occurrences`)
console.log('First 5:', occurrences.slice(0, 5))
```

**Expected output:**
- 24 occurrences
- Sequential session numbers (1, 2, 3...)
- Alternating Monday/Wednesday dates
- All have status 'upcoming'

### 3. Display Helper Functions

**Test formatting functions:**
```javascript
import { 
  formatOccurrenceDisplay,
  getUpcomingOccurrences,
  getPastOccurrences,
  calculateOccurrenceCount
} from '@/lib/utils/occurrences'

// Test display formatting
const testOcc = {
  class_id: 'test',
  occurrence_date: '2026-03-10',
  start_time: '15:00:00',
  end_time: '16:00:00',
  session_number: 1,
  status: 'upcoming'
}

console.log(formatOccurrenceDisplay(testOcc))
// Expected: "Monday, March 10 • 3:00 PM - 4:00 PM"

// Test count calculation
const count = calculateOccurrenceCount(
  schedule,
  new Date('2026-03-10'),
  new Date('2026-05-30')
)
console.log(`Will generate ${count} sessions`)
// Expected: 24
```

### 4. RLS Policies

**Test as teacher (anqiluo@amazon.com):**
```sql
-- Should see the class
SELECT * FROM classes WHERE name = 'Algebra 1 - Spring 2026';

-- Should see all occurrences
SELECT COUNT(*) FROM class_occurrences 
WHERE class_id = (SELECT id FROM classes WHERE name = 'Algebra 1 - Spring 2026');
```

**Test as student (sarah@test.com):**
```sql
-- Should see the class (enrolled)
SELECT * FROM classes WHERE id IN (
  SELECT class_id FROM class_members WHERE user_id = auth.uid()
);

-- Should see all occurrences for enrolled classes
SELECT COUNT(*) FROM class_occurrences 
WHERE class_id IN (
  SELECT class_id FROM class_members WHERE user_id = auth.uid()
);
```

### 5. Existing Class Pages

**View the test class:**
1. Login as `anqiluo@amazon.com` / `test123`
2. Go to http://localhost:3000/classes
3. You should see "Algebra 1 - Spring 2026"
4. Click on it

**What you'll see:**
- Class name and description
- Schedule (Monday & Wednesday 3-4pm)
- Start/end dates
- Enrolled students (2)

**What you WON'T see yet:**
- List of occurrences (no UI built)
- Materials section (no UI built)
- Homework section (no UI built)

## What You CANNOT Test Yet

### No UI Components Built

These need to be built in Phase 6:
- ❌ SessionsList component (display occurrences)
- ❌ SessionDetail component (view single session)
- ❌ MaterialUpload component (upload files)
- ❌ MaterialsList component (download files)
- ❌ HomeworkForm component (create assignments)
- ❌ SubmissionForm component (submit homework)
- ❌ GradingInterface component (grade submissions)

### No Integration

These need to be done in Phase 7:
- ❌ Class detail page doesn't show occurrences
- ❌ Class creation doesn't trigger occurrence generation
- ❌ No tabs (Overview, Sessions, Materials, Grades)
- ❌ No widgets (upcoming sessions, recent materials)

## Quick Test Script

Run this to verify everything works:

```sql
-- 1. Create mock data
-- Run: supabase/seed-occurrences-test-data.sql

-- 2. Verify class created
SELECT 
  name,
  (SELECT COUNT(*) FROM class_occurrences WHERE class_id = classes.id) as occurrence_count,
  (SELECT COUNT(*) FROM class_members WHERE class_id = classes.id) as student_count
FROM classes 
WHERE name = 'Algebra 1 - Spring 2026';

-- Expected output:
-- name: "Algebra 1 - Spring 2026"
-- occurrence_count: 24
-- student_count: 2

-- 3. View occurrences by status
SELECT 
  status,
  COUNT(*) as count
FROM class_occurrences
WHERE class_id = (SELECT id FROM classes WHERE name = 'Algebra 1 - Spring 2026')
GROUP BY status;

-- Expected output:
-- status: "upcoming", count: 24 (or less if some dates are past)
-- status: "completed", count: 0 (or more if some dates are past)

-- 4. View first 5 sessions
SELECT 
  session_number,
  occurrence_date,
  TO_CHAR(occurrence_date, 'Day') as day_name,
  topic,
  status
FROM class_occurrences
WHERE class_id = (SELECT id FROM classes WHERE name = 'Algebra 1 - Spring 2026')
ORDER BY session_number
LIMIT 5;

-- Expected output:
-- Session 1: 2026-03-10 (Monday) - "Introduction to Variables"
-- Session 2: 2026-03-12 (Wednesday) - "Variables Practice"
-- Session 3: 2026-03-17 (Monday) - "Solving Linear Equations"
-- Session 4: 2026-03-19 (Wednesday) - "Linear Equations Practice"
-- Session 5: 2026-03-24 (Monday) - "Graphing Linear Functions"
```

## Summary

**What works:**
- ✅ Database schema
- ✅ Occurrence generation algorithm
- ✅ Mock data creation
- ✅ RLS policies
- ✅ Helper functions

**What's missing:**
- ❌ UI to display occurrences
- ❌ UI to upload/download materials
- ❌ UI for homework system
- ❌ Integration with class pages

**Next steps:**
1. Test the backend with SQL queries
2. Test the algorithms in browser console
3. Build UI components (Phase 6)
4. Integrate into class pages (Phase 7)

The foundation is solid! We just need to build the UI on top of it.
