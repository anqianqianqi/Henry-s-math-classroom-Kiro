# Testing Class Occurrences & Materials System

## Prerequisites

Before running tests, ensure you have:

1. ✅ Run `supabase/add-class-occurrences-system.sql` (creates tables)
2. ✅ Created storage buckets (session-materials, homework-submissions)
3. ✅ Run `supabase/setup-storage-buckets.sql` (storage policies)
4. ✅ Test accounts exist:
   - Teacher: `anqiluo@amazon.com` (password: test123)
   - Students: `sarah@test.com`, `mike@test.com` (password: test123)

## Step 1: Create Mock Data

Run this SQL in Supabase SQL Editor:

```bash
# File: supabase/seed-occurrences-test-data.sql
```

This creates:
- ✅ Test class: "Algebra 1 - Spring 2026"
- ✅ Schedule: Monday & Wednesday 3-4pm
- ✅ ~24 occurrences (March 10 - May 30, 2026)
- ✅ 9 mock materials (3 per first 3 sessions)
- ✅ 2 enrolled students

**Expected Output:**
```
NOTICE: Created class: [UUID]
NOTICE: Created 24 occurrences
NOTICE: Created 9 materials
NOTICE: Enrolled sarah@test.com
NOTICE: Enrolled mike@test.com
```

## Step 2: Verify Data Created

### Check Class
```sql
SELECT * FROM classes WHERE name = 'Algebra 1 - Spring 2026';
```

Should return 1 row with:
- name: "Algebra 1 - Spring 2026"
- schedule: JSON array with Monday & Wednesday
- start_date: 2026-03-10
- end_date: 2026-05-30

### Check Occurrences
```sql
SELECT 
  session_number,
  occurrence_date,
  topic,
  status
FROM class_occurrences
WHERE class_id = (SELECT id FROM classes WHERE name = 'Algebra 1 - Spring 2026')
ORDER BY session_number
LIMIT 10;
```

Should return ~24 rows with:
- session_number: 1, 2, 3, 4...
- occurrence_date: 2026-03-10, 2026-03-12, 2026-03-17...
- topic: "Introduction to Variables", "Variables Practice"...
- status: "completed" (past) or "upcoming" (future)

### Check Materials
```sql
SELECT 
  co.session_number,
  sm.title,
  sm.file_type,
  sm.file_size
FROM session_materials sm
JOIN class_occurrences co ON sm.occurrence_id = co.id
WHERE co.class_id = (SELECT id FROM classes WHERE name = 'Algebra 1 - Spring 2026')
ORDER BY co.session_number;
```

Should return 9 rows (3 materials × 3 sessions):
- Lecture Notes (PDF, 2.4 MB)
- Practice Worksheet (PDF, 1 MB)
- Class Presentation (PPTX, 5 MB)

### Check Enrollments
```sql
SELECT 
  p.full_name,
  p.email
FROM class_members cm
JOIN profiles p ON cm.user_id = p.id
WHERE cm.class_id = (SELECT id FROM classes WHERE name = 'Algebra 1 - Spring 2026');
```

Should return 2 rows:
- Sarah (sarah@test.com)
- Mike (mike@test.com)

## Step 3: Test Teacher View

### Login as Teacher
1. Go to http://localhost:3000/login
2. Login as: `anqiluo@amazon.com` / `test123`

### View Classes
1. Go to http://localhost:3000/classes
2. You should see "Algebra 1 - Spring 2026"
3. Click on the class

### Expected to See:
- Class name and description
- Schedule: "Mondays 15:00 - 16:00, Wednesdays 15:00 - 16:00"
- Start/end dates
- 2 enrolled students

### Test Occurrence Generation (Manual)

Open browser console and run:
```javascript
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
console.log('First 3:', occurrences.slice(0, 3))
```

Expected output:
```
Generated 24 occurrences
First 3: [
  { session_number: 1, occurrence_date: '2026-03-10', ... },
  { session_number: 2, occurrence_date: '2026-03-12', ... },
  { session_number: 3, occurrence_date: '2026-03-17', ... }
]
```

## Step 4: Test Student View

### Login as Student
1. Logout
2. Login as: `sarah@test.com` / `test123`

### View Classes
1. Go to http://localhost:3000/classes
2. You should see "Algebra 1 - Spring 2026"
3. Click on the class

### Expected to See:
- Class information (read-only)
- No edit/delete buttons
- Same schedule and dates

## Step 5: Test Material Functions (Browser Console)

### Test File Validation
```javascript
import { validateFile } from '@/lib/utils/materials'

// Create mock file
const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' })
Object.defineProperty(validFile, 'size', { value: 1024 * 1024 }) // 1MB

const result = validateFile(validFile)
console.log('Valid file:', result)
// Expected: { valid: true }

// Test oversized file
const largeFile = new File(['content'], 'large.pdf', { type: 'application/pdf' })
Object.defineProperty(largeFile, 'size', { value: 51 * 1024 * 1024 }) // 51MB

const result2 = validateFile(largeFile)
console.log('Large file:', result2)
// Expected: { valid: false, error: "File is too large..." }
```

### Test Display Helpers
```javascript
import { getFileIcon, formatFileSize, getMaterialTypeLabel } from '@/lib/utils/materials'

console.log('PDF icon:', getFileIcon('application/pdf')) // 📄
console.log('Image icon:', getFileIcon('image/jpeg')) // 🖼️
console.log('File size:', formatFileSize(2457600)) // "2.34 MB"
console.log('Type label:', getMaterialTypeLabel('document')) // "Document"
```

## Step 6: Test RLS Policies

### Test Student Can't Upload
Login as student (sarah@test.com) and try:

```sql
-- This should FAIL (students can't upload)
INSERT INTO session_materials (
  occurrence_id,
  uploaded_by,
  title,
  file_url,
  file_type,
  file_size,
  material_type
) VALUES (
  (SELECT id FROM class_occurrences LIMIT 1),
  auth.uid(),
  'Test Material',
  'https://example.com/test.pdf',
  'application/pdf',
  1024,
  'document'
);
```

Expected: Permission denied error

### Test Student Can Read
```sql
-- This should SUCCEED (students can read materials from their classes)
SELECT * FROM session_materials
WHERE occurrence_id IN (
  SELECT id FROM class_occurrences 
  WHERE class_id IN (
    SELECT class_id FROM class_members WHERE user_id = auth.uid()
  )
);
```

Expected: Returns 9 materials

### Test Teacher Can Upload
Login as teacher (anqiluo@amazon.com) and try:

```sql
-- This should SUCCEED (teachers can upload)
INSERT INTO session_materials (
  occurrence_id,
  uploaded_by,
  title,
  file_url,
  file_type,
  file_size,
  material_type
) VALUES (
  (SELECT id FROM class_occurrences WHERE class_id = (SELECT id FROM classes WHERE name = 'Algebra 1 - Spring 2026') LIMIT 1),
  auth.uid(),
  'Test Upload',
  'https://example.com/test.pdf',
  'application/pdf',
  1024,
  'document'
);
```

Expected: Success, 1 row inserted

## Step 7: Test Occurrence Queries

### Get Upcoming Sessions
```sql
SELECT 
  session_number,
  occurrence_date,
  topic,
  status
FROM class_occurrences
WHERE class_id = (SELECT id FROM classes WHERE name = 'Algebra 1 - Spring 2026')
  AND occurrence_date >= CURRENT_DATE
  AND status = 'upcoming'
ORDER BY occurrence_date
LIMIT 5;
```

Expected: Next 5 upcoming sessions

### Get Past Sessions
```sql
SELECT 
  session_number,
  occurrence_date,
  topic,
  status
FROM class_occurrences
WHERE class_id = (SELECT id FROM classes WHERE name = 'Algebra 1 - Spring 2026')
  AND occurrence_date < CURRENT_DATE
ORDER BY occurrence_date DESC
LIMIT 5;
```

Expected: Last 5 completed sessions (if any)

### Get Materials for Session
```sql
SELECT 
  title,
  description,
  file_type,
  file_size,
  material_type,
  uploaded_at
FROM session_materials
WHERE occurrence_id = (
  SELECT id FROM class_occurrences 
  WHERE class_id = (SELECT id FROM classes WHERE name = 'Algebra 1 - Spring 2026')
  ORDER BY occurrence_date 
  LIMIT 1
);
```

Expected: 3 materials (Lecture Notes, Practice Worksheet, Class Presentation)

## Troubleshooting

### No occurrences created
- Check that class has schedule JSON
- Verify start_date and end_date are set
- Run seed script again

### No materials showing
- Check RLS policies are active
- Verify user is enrolled in class
- Check is_available = true

### Permission denied errors
- Verify user has correct role
- Check class membership
- Review RLS policies

### Can't see class
- Verify user is enrolled (class_members table)
- Check class is_active = true
- Verify RLS policies

## Cleanup

To remove test data:

```sql
-- Delete test class (CASCADE will delete occurrences and materials)
DELETE FROM classes WHERE name = 'Algebra 1 - Spring 2026';
```

## Success Criteria

✅ Mock data created successfully
✅ 24 occurrences generated
✅ 9 materials created
✅ 2 students enrolled
✅ Teacher can view class and occurrences
✅ Students can view class (read-only)
✅ RLS policies working (students can't upload)
✅ Occurrence generation algorithm works
✅ Material validation works
✅ Display helpers work

## Next Steps

After testing:
1. Build UI components (SessionsList, MaterialUpload, etc.)
2. Integrate into class detail page
3. Add occurrence generation trigger to class creation
4. Continue to Phase 4 (Homework System)
