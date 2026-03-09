# Phase 6: React Components - IN PROGRESS

## What We're Building

UI components to display and interact with the occurrences and materials system.

## Components Created

### ✅ SessionsList Component (COMPLETE)

**File:** `components/SessionsList.tsx`

**Features:**
- Displays all class sessions (occurrences)
- Two tabs: Upcoming and Past
- Shows session number, topic, date/time, status
- Color-coded status badges (Upcoming, Completed, Cancelled)
- Click to select session (optional callback)
- Loading and error states
- Empty states with helpful messages
- Responsive design

**Props:**
```typescript
interface SessionsListProps {
  classId: string
  onSelectSession?: (sessionId: string) => void
}
```

**Integration:**
- ✅ Added to `app/classes/[id]/page.tsx`
- ✅ Displays below Members card
- ✅ Automatically loads occurrences for the class
- ✅ Uses existing Card and Button components

### ✅ SessionDetail Component (COMPLETE)

**File:** `components/SessionDetail.tsx`

**Features:**
- Session info header (date, time, topic, status badge, notes)
- Materials list section with download buttons
- Homework assignment section (if exists)
- Role-based view (teacher vs student)
- File icons based on MIME type
- File size formatting
- Empty states for no materials/homework
- Close button to return to sessions list

**Props:**
```typescript
interface SessionDetailProps {
  occurrenceId: string
  userRole: 'teacher' | 'student' | 'observer'
  onClose?: () => void
}
```

**What it shows:**
- Session number and topic
- Date/time formatted nicely
- Status badge (Completed/Cancelled)
- Session notes (if any)
- Materials with file icons, sizes, uploader names
- Homework title, description, due date, points
- Role-specific buttons (Upload/Submit/Edit/View)

**Integration:**
- ✅ Added to `app/classes/[id]/page.tsx`
- ✅ Shows when session is clicked from SessionsList
- ✅ Loads occurrence, materials, and homework data
- ✅ Determines user role (teacher/student)
- ✅ Handles download functionality

## How to Test

### 1. Prerequisites
Make sure you've run the database migration:
```sql
-- Run: supabase/add-class-occurrences-system.sql
```

### 2. Create a Test Class with Occurrences

**Option A: Use the occurrence generation utility**
```typescript
// In browser console or a test script
import { generateOccurrences } from '@/lib/utils/occurrences'

const occurrences = generateOccurrences(
  'YOUR_CLASS_ID',
  [
    { day: 'Monday', startTime: '15:00', endTime: '16:00' },
    { day: 'Wednesday', startTime: '15:00', endTime: '16:00' }
  ],
  new Date('2026-03-10'),
  new Date('2026-05-30')
)

// Then insert into database
await supabase.from('class_occurrences').insert(occurrences)
```

**Option B: Manual SQL**
```sql
-- Insert a few test occurrences
INSERT INTO class_occurrences (class_id, occurrence_date, start_time, end_time, session_number, topic, status)
VALUES 
  ('YOUR_CLASS_ID', '2026-03-10', '15:00', '16:00', 1, 'Introduction to Algebra', 'upcoming'),
  ('YOUR_CLASS_ID', '2026-03-12', '15:00', '16:00', 2, 'Linear Equations', 'upcoming'),
  ('YOUR_CLASS_ID', '2026-03-17', '15:00', '16:00', 3, 'Graphing Functions', 'upcoming');
```

### 3. View in Browser

1. Login as teacher (anqiluo@amazon.com)
2. Go to http://localhost:3000/classes
3. Click on a class
4. Scroll down to see "Class Sessions" card
5. You should see:
   - Two tabs: "Upcoming" and "Past"
   - List of sessions with numbers, topics, dates
   - Status badges
   - Click to switch between tabs

### 4. Expected Behavior

**Upcoming Tab:**
- Shows sessions with occurrence_date >= today
- Excludes cancelled sessions
- Sorted by date (earliest first)
- Blue "Upcoming" badge

**Past Tab:**
- Shows sessions with occurrence_date < today
- Includes all statuses
- Sorted by date (most recent first)
- Green "Completed" badge

**Empty States:**
- "No upcoming sessions" with calendar emoji
- "No past sessions yet" with checkmark emoji

**Loading State:**
- Animated skeleton while fetching data

**Error State:**
- Error message with "Try Again" button

### ✅ MaterialUpload Component (COMPLETE)

**File:** `components/MaterialUpload.tsx`

**Features:**
- Drag-and-drop file upload interface
- File type and size validation (50MB limit)
- Upload progress indicator
- Title and description fields
- Material type selection (document/link/note/recording)
- Auto-fill title from filename
- Visual feedback for drag state
- Error handling with user-friendly messages

**Props:**
```typescript
interface MaterialUploadProps {
  occurrenceId: string
  classId: string
  onUploadComplete: () => void
  onCancel?: () => void
}
```

**What it does:**
- Validates file type (PDF, DOC, PPT, images, videos, etc.)
- Validates file size (max 50MB)
- Shows upload progress bar
- Uploads to Supabase Storage
- Creates database record in session_materials
- Calls onUploadComplete when done

**Integration:**
- ✅ Integrated into SessionDetail component
- ✅ Shows when teacher clicks "Upload Material" button
- ✅ Hides and refreshes materials list on success
- ✅ Uses uploadMaterial() utility function

## Next Components to Build

### ⏳ GradingInterface Component (NEXT)
**Purpose:** Teacher interface for grading submissions

**Features:**
- Table view of all submissions
- Filter by status (submitted, graded, late)
- Sort by student name, submission date
- Quick grade entry
- Feedback text area
- Draft/publish toggle

**File:** `components/GradingInterface.tsx`

### ⏳ ProgressDashboard Component
**Purpose:** Display student progress and class statistics

**Features:**
- Student view: attendance, completion, grades
- Teacher view: class statistics
- Upcoming deadlines

**File:** `components/ProgressDashboard.tsx`

**Overall Progress:** 43% (3.71/8 phases)

## Testing Checklist

- [ ] SessionsList displays on class detail page
- [ ] Upcoming tab shows future sessions
- [ ] Past tab shows past sessions
- [ ] Session numbers are sequential
- [ ] Dates are formatted correctly
- [ ] Status badges show correct colors
- [ ] Empty states display when no sessions
- [ ] Loading state shows while fetching
- [ ] Error state shows on failure
- [ ] Tabs switch correctly
- [ ] Session count is accurate

## Known Issues

None yet - component just created!

## Next Steps

1. Test SessionsList component
2. Build SessionDetail component
3. Build MaterialUpload component
4. Build MaterialsList component
5. Wire them together

## Files Modified

- ✅ Created `components/SessionsList.tsx` (200+ lines)
- ✅ Created `components/SessionDetail.tsx` (400+ lines)
- ✅ Created `components/MaterialUpload.tsx` (300+ lines)
- ✅ Created `components/HomeworkForm.tsx` (250+ lines)
- ✅ Created `components/SubmissionForm.tsx` (350+ lines)
- ✅ Updated `app/classes/[id]/page.tsx` (added SessionsList, SessionDetail, session selection logic, user role detection)

## Dependencies

- `@/lib/supabase/client` - Database queries
- `@/lib/utils/occurrences` - formatOccurrenceDisplay()
- `@/components/ui/Card` - Card component
- `@/components/ui/Button` - Button component

## Styling

Uses Tailwind CSS classes:
- Blue theme for upcoming sessions
- Green theme for completed sessions
- Red theme for cancelled sessions
- Gray theme for past/inactive
- Hover effects on clickable items
- Responsive spacing and layout

Ready to test! 🎉
