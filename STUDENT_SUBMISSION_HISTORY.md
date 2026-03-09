# Student Submission History & Grades - March 9, 2026

## What Students See

After submitting homework, students can now see:
- ✅ All their submission versions
- ✅ Submission timestamps
- ✅ Late status indicators
- ✅ Graded status badges
- ✅ Points earned (when graded)
- ✅ Teacher feedback (when graded)
- ✅ Ability to resubmit

## Visual Layout

### Before Submission
```
┌─────────────────────────────────────────┐
│ Homework Assignment                     │
├─────────────────────────────────────────┤
│ Practice Problems - Chapter 1           │
│ Complete problems 1-10                  │
│                                         │
│ Due: Mar 15, 2026 11:59 PM             │
│ Points: 100                             │
│ Type: file                              │
│                                         │
│ ┌─────────────────┐                    │
│ │ Submit Homework │                    │
│ └─────────────────┘                    │
└─────────────────────────────────────────┘
```

### After Submission (Not Yet Graded)
```
┌─────────────────────────────────────────┐
│ Homework Assignment                     │
├─────────────────────────────────────────┤
│ Practice Problems - Chapter 1           │
│ Complete problems 1-10                  │
│                                         │
│ Due: Mar 15, 2026 11:59 PM             │
│ Points: 100                             │
│ Type: file                              │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Your Submissions (1)                │ │
│ │                                     │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │ Version 1                       │ │ │
│ │ │ Mar 10, 2026 3:45 PM           │ │ │
│ │ │                                 │ │ │
│ │ │ 📎 View File                    │ │ │
│ │ └─────────────────────────────────┘ │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌──────────────────┐                   │
│ │ Resubmit Homework│                   │
│ └──────────────────┘                   │
└─────────────────────────────────────────┘
```

### After Teacher Grades
```
┌─────────────────────────────────────────┐
│ Homework Assignment                     │
├─────────────────────────────────────────┤
│ Practice Problems - Chapter 1           │
│ Complete problems 1-10                  │
│                                         │
│ Due: Mar 15, 2026 11:59 PM             │
│ Points: 100                             │
│ Type: file                              │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Your Submissions (1)                │ │
│ │                                     │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │ Version 1  [Graded]             │ │ │
│ │ │ Mar 10, 2026 3:45 PM           │ │ │
│ │ │                                 │ │ │
│ │ │ 📎 View File                    │ │ │
│ │ │                                 │ │ │
│ │ │ ─────────────────────────────── │ │ │
│ │ │ Grade: 95/100                   │ │ │
│ │ │                                 │ │ │
│ │ │ Feedback:                       │ │ │
│ │ │ "Great work! Just watch your   │ │ │
│ │ │  calculations on problem 7."   │ │ │
│ │ └─────────────────────────────────┘ │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌──────────────────┐                   │
│ │ Resubmit Homework│                   │
│ └──────────────────┘                   │
└─────────────────────────────────────────┘
```

### With Multiple Submissions (Late)
```
┌─────────────────────────────────────────┐
│ Your Submissions (2)                    │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Version 2  [Late] [Graded]          │ │
│ │ Mar 16, 2026 10:30 AM              │ │
│ │                                     │ │
│ │ 📎 View File                        │ │
│ │                                     │ │
│ │ ───────────────────────────────────  │ │
│ │ Grade: 85/100                       │ │
│ │                                     │ │
│ │ Feedback:                           │ │
│ │ "Better! Late penalty applied."    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Version 1  [Graded]                 │ │
│ │ Mar 10, 2026 3:45 PM               │ │
│ │                                     │ │
│ │ 📎 View File                        │ │
│ │                                     │ │
│ │ ───────────────────────────────────  │ │
│ │ Grade: 95/100                       │ │
│ │                                     │ │
│ │ Feedback:                           │ │
│ │ "Great work! Just watch your       │ │
│ │  calculations on problem 7."       │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Features in Detail

### Submission Cards
Each submission shows:
- **Version number** - Tracks resubmissions
- **Timestamp** - When it was submitted
- **Status badges**:
  - `Late` - Yellow badge if submitted after due date
  - `Graded` - Green badge if teacher has graded it
- **Content preview**:
  - File: Link to download/view
  - Text: First few lines of text
  - Link: Clickable URL

### Grade Display (Only When Published)
When teacher publishes a grade, students see:
- **Points earned** - Large display (e.g., "95/100")
- **Feedback** - Teacher's comments in italics
- Separated by a border line for clarity

### Resubmit Button
- Always available at the bottom
- Text changes:
  - "Submit Homework" - First submission
  - "Resubmit Homework" - After first submission
- Creates new version when clicked

## Code Implementation

### Data Loading
```typescript
// Load student's submissions
if (userRole === 'student' && hwData) {
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: subData } = await supabase
      .from('homework_submissions')
      .select(`
        *,
        homework_grades(*)
      `)
      .eq('assignment_id', hwData.id)
      .eq('student_id', user.id)
      .order('version', { ascending: false })
    
    setMySubmissions(subData || [])
  }
}
```

### Grade Check
```typescript
const grade = submission.homework_grades?.[0]
const isGraded = grade && grade.status === 'published'
```

Only shows grade if:
1. Grade exists
2. Status is 'published' (not 'draft')

### Display Logic
```typescript
{isGraded && grade && (
  <div className="mt-3 pt-3 border-t border-gray-300">
    <div className="flex items-center justify-between mb-2">
      <span>Grade:</span>
      <span className="text-lg font-semibold">
        {grade.points_earned}/{homework.points_possible}
      </span>
    </div>
    {grade.feedback && (
      <div className="mt-2">
        <span className="block mb-1">Feedback:</span>
        <p className="italic">"{grade.feedback}"</p>
      </div>
    )}
  </div>
)}
```

## Testing Workflow

### 1. Student Submits Homework
```bash
# Login as student
Email: sarah@test.com
Password: test123

# Navigate to class → session
# Click "Submit Homework"
# Upload file/enter text/paste link
# Click "Submit"
```

### 2. Student Sees Submission
After submitting, student immediately sees:
- Submission card with version 1
- Timestamp
- Content preview
- "Resubmit Homework" button
- NO grade yet (teacher hasn't graded)

### 3. Teacher Grades
```bash
# Login as teacher
Email: admin@test.com
Password: 123456

# Navigate to same session
# Click "View Submissions"
# Click on student's submission
# Enter points: 95
# Enter feedback: "Great work!"
# Click "Publish Grade"
```

### 4. Student Sees Grade
```bash
# Back to student account
# Refresh or navigate to session
# See submission card now shows:
  - [Graded] badge
  - Grade: 95/100
  - Feedback: "Great work!"
```

### 5. Student Resubmits (Optional)
```bash
# Click "Resubmit Homework"
# Upload new file
# Click "Submit"
# See Version 2 appear at top
# Version 1 still visible below
```

## Database Schema

### homework_submissions
```sql
id UUID
assignment_id UUID
student_id UUID
submission_type TEXT
file_url TEXT
text_content TEXT
link_url TEXT
comments TEXT
is_late BOOLEAN
version INTEGER
submitted_at TIMESTAMPTZ
```

### homework_grades
```sql
id UUID
submission_id UUID
graded_by UUID
points_earned INTEGER
feedback TEXT
status TEXT  -- 'draft' or 'published'
published_at TIMESTAMPTZ
```

## Privacy & Security

### What Students Can See
- ✅ Their own submissions only
- ✅ Published grades only (not drafts)
- ✅ All their submission versions
- ✅ Teacher feedback when published

### What Students Cannot See
- ❌ Other students' submissions
- ❌ Draft grades (teacher still working on it)
- ❌ Other students' grades
- ❌ Teacher's private notes

## Benefits

### For Students
- Clear submission history
- Know when work was submitted
- See all versions and grades
- Understand what to improve
- Track progress over time

### For Teachers
- Students can self-check status
- Reduces "Did you grade mine?" questions
- Feedback is preserved and visible
- Version tracking shows improvement

## Next Steps

1. Test the complete workflow
2. Add email notifications when graded
3. Add grade statistics (class average, etc.)
4. Add submission analytics
5. Consider adding:
   - Submission comments/questions
   - Peer review features
   - Rubric display
   - Grade appeals
