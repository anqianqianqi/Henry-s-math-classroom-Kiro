# Class Occurrences & Materials Management - Design Document

## Overview

This feature transforms the class detail page from a simple overview into a comprehensive learning management system by adding individual class session tracking (occurrences), session-specific materials, homework assignments, submissions, and grading capabilities.

The system automatically generates class occurrences based on the class schedule (e.g., "Monday 3-4pm, Wednesday 3-4pm" from start_date to end_date), allowing teachers to organize materials and homework per session. Students can access materials, submit homework, and view grades with feedback. The design emphasizes simplicity and usability while maintaining the existing RBAC security model.

### Key Design Goals

1. **Automatic Occurrence Generation**: Parse class schedule and generate individual sessions
2. **Session-Centric Organization**: Materials and homework organized by session
3. **Streamlined Workflows**: Simple upload, submission, and grading interfaces
4. **Progress Visibility**: Clear tracking for students and teachers
5. **Security**: Leverage existing RLS policies and RBAC system
6. **Performance**: Efficient queries and file storage

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
├─────────────────────────────────────────────────────────────┤
│  Class Detail Page (Enhanced)                               │
│  ├── Overview Tab                                           │
│  ├── Sessions Tab (NEW)                                     │
│  │   ├── Upcoming Sessions List                            │
│  │   ├── Past Sessions List                                │
│  │   └── Session Detail View                               │
│  │       ├── Materials Section                             │
│  │       ├── Homework Section                              │
│  │       └── Submissions (Teacher View)                    │
│  ├── Materials Tab (NEW)                                    │
│  └── Grades Tab (NEW)                                       │
│      ├── Student View: My Grades                           │
│      └── Teacher View: All Grades                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Client Layer                       │
├─────────────────────────────────────────────────────────────┤
│  - Occurrence queries                                        │
│  - Material upload/download                                  │
│  - Homework CRUD operations                                  │
│  - Submission management                                     │
│  - Grading operations                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Backend                          │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL Database                                         │
│  ├── class_occurrences                                      │
│  ├── session_materials                                      │
│  ├── homework_assignments                                   │
│  ├── homework_submissions                                   │
│  └── homework_grades                                        │
│                                                              │
│  Storage Buckets                                             │
│  ├── session-materials                                      │
│  └── homework-submissions                                   │
│                                                              │
│  RLS Policies (Security)                                     │
│  └── Leverage existing RBAC system                          │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Occurrence Generation Flow
```
Class Creation/Update
    │
    ├─> Parse schedule JSON
    │   (e.g., [{day: "Monday", startTime: "15:00", endTime: "16:00"}])
    │
    ├─> Calculate occurrences between start_date and end_date
    │   - For each schedule slot
    │   - Find all matching weekdays in date range
    │   - Generate occurrence records
    │
    └─> Insert into class_occurrences table
        - occurrence_date, start_time, end_time
        - session_number (sequential)
        - status: 'upcoming'
```

#### Material Upload Flow
```
Teacher uploads file
    │
    ├─> Upload to Supabase Storage (session-materials bucket)
    │   - Path: {class_id}/{occurrence_id}/{filename}
    │   - Get public URL
    │
    ├─> Create session_materials record
    │   - occurrence_id, file_url, metadata
    │
    └─> Display in session detail view
```

#### Homework Submission Flow
```
Student submits homework
    │
    ├─> Upload file to Storage (homework-submissions bucket)
    │   - Path: {assignment_id}/{student_id}/{filename}
    │
    ├─> Create homework_submissions record
    │   - assignment_id, student_id, file_url
    │   - Check if late (submitted_at > due_date)
    │
    └─> Notify teacher (future: email notification)
```

#### Grading Flow
```
Teacher grades submission
    │
    ├─> Create/update homework_grades record
    │   - submission_id, points_earned, feedback
    │   - status: 'draft' or 'published'
    │
    ├─> If published
    │   - Set published_at timestamp
    │   - Notify student (future: email notification)
    │
    └─> Update student's grade view
```

## Components and Interfaces

### Frontend Components

#### 1. SessionsList Component
**Purpose**: Display upcoming and past class sessions

**Props**:
```typescript
interface SessionsListProps {
  classId: string
  userRole: 'teacher' | 'student' | 'observer'
}
```

**Features**:
- Tabs for "Upcoming" and "Past" sessions
- Session cards showing:
  - Date, time, session number
  - Materials count badge
  - Homework status indicator
  - Click to view details
- Empty states with helpful messages

#### 2. SessionDetail Component
**Purpose**: Show detailed view of a single session

**Props**:
```typescript
interface SessionDetailProps {
  occurrenceId: string
  userRole: 'teacher' | 'student' | 'observer'
}
```

**Sections**:
- Session info header (date, time, topic)
- Materials list with download buttons
- Homework assignment (if exists)
- Submission form (student view)
- Submissions list (teacher view)

#### 3. MaterialUpload Component
**Purpose**: Teacher interface for uploading materials

**Props**:
```typescript
interface MaterialUploadProps {
  occurrenceId: string
  onUploadComplete: () => void
}
```

**Features**:
- Drag-and-drop file upload
- File type validation (PDF, DOC, PPT, etc.)
- Size limit enforcement (50MB)
- Progress indicator
- Title and description fields
- Material type selection

#### 4. HomeworkForm Component
**Purpose**: Teacher interface for creating homework assignments

**Props**:
```typescript
interface HomeworkFormProps {
  occurrenceId: string
  onSave: () => void
}
```

**Fields**:
- Title (required)
- Description/instructions (rich text)
- Due date (date + time picker)
- Points possible
- Submission type (file, text, link)
- Optional assignment file attachment

#### 5. SubmissionForm Component
**Purpose**: Student interface for submitting homework

**Props**:
```typescript
interface SubmissionFormProps {
  assignmentId: string
  existingSubmission?: Submission
  onSubmit: () => void
}
```

**Features**:
- File upload (based on submission_type)
- Text editor (if text submission)
- Link input (if link submission)
- Comments/notes field
- Resubmit capability (before due date)
- Late submission warning

#### 6. GradingInterface Component
**Purpose**: Teacher interface for grading submissions

**Props**:
```typescript
interface GradingInterfaceProps {
  assignmentId: string
}
```

**Features**:
- Table view of all submissions
- Filter by status (submitted, graded, late)
- Sort by student name, submission date
- Quick grade entry
- Feedback text area
- Draft/publish toggle
- Bulk actions (export grades)

#### 7. ProgressDashboard Component
**Purpose**: Display student progress and class statistics

**Props**:
```typescript
interface ProgressDashboardProps {
  classId: string
  userId?: string // If viewing specific student
  userRole: 'teacher' | 'student'
}
```

**Student View**:
- Sessions attended / total
- Homework completion rate
- Average grade
- Upcoming deadlines

**Teacher View**:
- Class-wide statistics
- Individual student progress table
- Submission rates chart
- Grade distribution

### API Patterns

All data access uses Supabase client with RLS policies. No custom API routes needed.

#### Example: Fetch Upcoming Sessions
```typescript
const { data: sessions } = await supabase
  .from('class_occurrences')
  .select('*')
  .eq('class_id', classId)
  .eq('status', 'upcoming')
  .gte('occurrence_date', new Date().toISOString())
  .order('occurrence_date', { ascending: true })
  .limit(5)
```

#### Example: Upload Material
```typescript
// 1. Upload file
const filePath = `${classId}/${occurrenceId}/${file.name}`
const { data: uploadData, error: uploadError } = await supabase.storage
  .from('session-materials')
  .upload(filePath, file)

// 2. Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('session-materials')
  .getPublicUrl(filePath)

// 3. Create record
const { data: material } = await supabase
  .from('session_materials')
  .insert({
    occurrence_id: occurrenceId,
    uploaded_by: userId,
    title: title,
    file_url: publicUrl,
    file_type: file.type,
    file_size: file.size,
    material_type: materialType
  })
```

## Data Models

### Database Schema

#### class_occurrences
```sql
CREATE TABLE class_occurrences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  occurrence_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  session_number INTEGER NOT NULL,
  topic TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming' 
    CHECK (status IN ('upcoming', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_occurrences_class ON class_occurrences(class_id);
CREATE INDEX idx_occurrences_date ON class_occurrences(occurrence_date);
CREATE INDEX idx_occurrences_status ON class_occurrences(status);
```

**Notes**:
- `session_number`: Sequential number (1, 2, 3...) for display
- `status`: Automatically updated based on occurrence_date
- `topic`: Optional session-specific topic/title

#### session_materials
```sql
CREATE TABLE session_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  occurrence_id UUID REFERENCES class_occurrences(id) ON DELETE CASCADE NOT NULL,
  uploaded_by UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  material_type TEXT NOT NULL DEFAULT 'document'
    CHECK (material_type IN ('document', 'link', 'note', 'recording')),
  is_available BOOLEAN DEFAULT TRUE,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_materials_occurrence ON session_materials(occurrence_id);
CREATE INDEX idx_materials_uploaded_by ON session_materials(uploaded_by);
```

**Notes**:
- `file_url`: Supabase Storage public URL or external link
- `file_type`: MIME type (e.g., 'application/pdf')
- `material_type`: Category for filtering/display
- `is_available`: Teacher can hide materials temporarily

#### homework_assignments
```sql
CREATE TABLE homework_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  occurrence_id UUID REFERENCES class_occurrences(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  points_possible INTEGER NOT NULL DEFAULT 100,
  submission_type TEXT NOT NULL DEFAULT 'file'
    CHECK (submission_type IN ('file', 'text', 'link')),
  assignment_file_url TEXT,
  allow_late BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assignments_occurrence ON homework_assignments(occurrence_id);
CREATE INDEX idx_assignments_due_date ON homework_assignments(due_date);
```

**Notes**:
- `due_date`: Includes time for precise deadlines
- `assignment_file_url`: Optional file attached to assignment (e.g., worksheet)
- `allow_late`: If false, submissions after due_date are rejected

#### homework_submissions
```sql
CREATE TABLE homework_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES homework_assignments(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  submission_type TEXT NOT NULL
    CHECK (submission_type IN ('file', 'text', 'link')),
  file_url TEXT,
  text_content TEXT,
  link_url TEXT,
  comments TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  is_late BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  UNIQUE(assignment_id, student_id, version)
);

CREATE INDEX idx_submissions_assignment ON homework_submissions(assignment_id);
CREATE INDEX idx_submissions_student ON homework_submissions(student_id);
CREATE INDEX idx_submissions_late ON homework_submissions(is_late);
```

**Notes**:
- `version`: Allows tracking resubmissions (latest version is used)
- `is_late`: Calculated on insert (submitted_at > due_date)
- Only one of file_url, text_content, or link_url should be populated

#### homework_grades
```sql
CREATE TABLE homework_grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES homework_submissions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  graded_by UUID REFERENCES profiles(id) NOT NULL,
  points_earned INTEGER NOT NULL,
  feedback TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  graded_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_grades_submission ON homework_grades(submission_id);
CREATE INDEX idx_grades_status ON homework_grades(status);
```

**Notes**:
- `status`: 'draft' grades not visible to students
- `published_at`: Set when status changes to 'published'
- One grade per submission (UNIQUE constraint)

### TypeScript Interfaces

```typescript
interface ClassOccurrence {
  id: string
  class_id: string
  occurrence_date: string // ISO date
  start_time: string // HH:MM:SS
  end_time: string // HH:MM:SS
  session_number: number
  topic?: string
  status: 'upcoming' | 'completed' | 'cancelled'
  notes?: string
  created_at: string
  updated_at: string
}

interface SessionMaterial {
  id: string
  occurrence_id: string
  uploaded_by: string
  title: string
  description?: string
  file_url: string
  file_type: string
  file_size: number
  material_type: 'document' | 'link' | 'note' | 'recording'
  is_available: boolean
  uploaded_at: string
}

interface HomeworkAssignment {
  id: string
  occurrence_id: string
  created_by: string
  title: string
  description: string
  due_date: string // ISO timestamp
  points_possible: number
  submission_type: 'file' | 'text' | 'link'
  assignment_file_url?: string
  allow_late: boolean
  created_at: string
  updated_at: string
}

interface HomeworkSubmission {
  id: string
  assignment_id: string
  student_id: string
  submission_type: 'file' | 'text' | 'link'
  file_url?: string
  text_content?: string
  link_url?: string
  comments?: string
  submitted_at: string
  is_late: boolean
  version: number
}

interface HomeworkGrade {
  id: string
  submission_id: string
  graded_by: string
  points_earned: number
  feedback?: string
  status: 'draft' | 'published'
  graded_at: string
  published_at?: string
  updated_at: string
}
```

### Occurrence Generation Algorithm

```typescript
function generateOccurrences(
  classId: string,
  schedule: Array<{day: string, startTime: string, endTime: string}>,
  startDate: Date,
  endDate: Date
): ClassOccurrence[] {
  const occurrences: ClassOccurrence[] = []
  let sessionNumber = 1
  
  // Map day names to numbers (0 = Sunday, 1 = Monday, etc.)
  const dayMap: Record<string, number> = {
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
    'Thursday': 4, 'Friday': 5, 'Saturday': 6
  }
  
  // For each schedule slot
  for (const slot of schedule) {
    const targetDay = dayMap[slot.day]
    
    // Find all dates matching this day of week
    let currentDate = new Date(startDate)
    
    // Advance to first occurrence of target day
    while (currentDate.getDay() !== targetDay) {
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    // Generate occurrences for this day
    while (currentDate <= endDate) {
      occurrences.push({
        id: uuid(),
        class_id: classId,
        occurrence_date: currentDate.toISOString().split('T')[0],
        start_time: slot.startTime,
        end_time: slot.endTime,
        session_number: sessionNumber++,
        status: 'upcoming',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      
      // Move to next week
      currentDate.setDate(currentDate.getDate() + 7)
    }
  }
  
  // Sort by date
  occurrences.sort((a, b) => 
    new Date(a.occurrence_date).getTime() - new Date(b.occurrence_date).getTime()
  )
  
  // Renumber sessions sequentially
  occurrences.forEach((occ, index) => {
    occ.session_number = index + 1
  })
  
  return occurrences
}
```

### Storage Structure

#### session-materials bucket
```
session-materials/
  {class_id}/
    {occurrence_id}/
      {filename}
```

#### homework-submissions bucket
```
homework-submissions/
  {assignment_id}/
    {student_id}/
      v{version}_{filename}
```

## Security and RLS Policies

### Leveraging Existing RBAC

The feature uses the existing permission system. New permissions to add:

```sql
-- New permissions
INSERT INTO permissions (name, description, resource, action) VALUES
  ('occurrence:manage', 'Manage class occurrences', 'occurrence', 'manage'),
  ('material:upload', 'Upload session materials', 'material', 'upload'),
  ('material:read', 'View session materials', 'material', 'read'),
  ('material:delete', 'Delete session materials', 'material', 'delete'),
  ('homework:create', 'Create homework assignments', 'homework', 'create'),
  ('homework:read', 'View homework assignments', 'homework', 'read'),
  ('homework:update', 'Update homework assignments', 'homework', 'update'),
  ('homework:delete', 'Delete homework assignments', 'homework', 'delete'),
  ('submission:create', 'Submit homework', 'submission', 'create'),
  ('submission:read_own', 'View own submissions', 'submission', 'read_own'),
  ('submission:read_all', 'View all submissions', 'submission', 'read_all'),
  ('grade:create', 'Grade submissions', 'grade', 'create'),
  ('grade:read_own', 'View own grades', 'grade', 'read_own'),
  ('grade:read_all', 'View all grades', 'grade', 'read_all');
```

### RLS Policies

#### class_occurrences
```sql
-- Users can read occurrences for their classes
CREATE POLICY "Users can read class occurrences"
  ON class_occurrences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_members
      WHERE class_id = class_occurrences.class_id
        AND user_id = auth.uid()
    )
  );

-- Teachers can manage occurrences for their classes
CREATE POLICY "Teachers can manage occurrences"
  ON class_occurrences FOR ALL
  USING (
    user_has_permission(auth.uid(), 'occurrence:manage', class_id)
  );
```

#### session_materials
```sql
-- Users can read materials for their class sessions
CREATE POLICY "Users can read session materials"
  ON session_materials FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_occurrences co
      JOIN class_members cm ON co.class_id = cm.class_id
      WHERE co.id = session_materials.occurrence_id
        AND cm.user_id = auth.uid()
    )
    AND is_available = TRUE
  );

-- Teachers can upload materials
CREATE POLICY "Teachers can upload materials"
  ON session_materials FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM class_occurrences co
      WHERE co.id = occurrence_id
        AND user_has_permission(auth.uid(), 'material:upload', co.class_id)
    )
  );

-- Teachers can delete their materials
CREATE POLICY "Teachers can delete materials"
  ON session_materials FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM class_occurrences co
      WHERE co.id = occurrence_id
        AND user_has_permission(auth.uid(), 'material:delete', co.class_id)
    )
  );
```

#### homework_assignments
```sql
-- Users can read assignments for their class sessions
CREATE POLICY "Users can read homework assignments"
  ON homework_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_occurrences co
      JOIN class_members cm ON co.class_id = cm.class_id
      WHERE co.id = homework_assignments.occurrence_id
        AND cm.user_id = auth.uid()
    )
  );

-- Teachers can create/update/delete assignments
CREATE POLICY "Teachers can manage assignments"
  ON homework_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM class_occurrences co
      WHERE co.id = occurrence_id
        AND user_has_permission(auth.uid(), 'homework:create', co.class_id)
    )
  );
```

#### homework_submissions
```sql
-- Students can create their own submissions
CREATE POLICY "Students can create submissions"
  ON homework_submissions FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND user_has_permission(auth.uid(), 'submission:create')
    AND EXISTS (
      SELECT 1 FROM homework_assignments ha
      JOIN class_occurrences co ON ha.occurrence_id = co.id
      JOIN class_members cm ON co.class_id = cm.class_id
      WHERE ha.id = assignment_id
        AND cm.user_id = auth.uid()
    )
  );

-- Students can read their own submissions
CREATE POLICY "Students can read own submissions"
  ON homework_submissions FOR SELECT
  USING (
    student_id = auth.uid()
  );

-- Teachers can read all submissions for their classes
CREATE POLICY "Teachers can read all submissions"
  ON homework_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM homework_assignments ha
      JOIN class_occurrences co ON ha.occurrence_id = co.id
      WHERE ha.id = assignment_id
        AND user_has_permission(auth.uid(), 'submission:read_all', co.class_id)
    )
  );
```

#### homework_grades
```sql
-- Students can read their own published grades
CREATE POLICY "Students can read own grades"
  ON homework_grades FOR SELECT
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM homework_submissions hs
      WHERE hs.id = submission_id
        AND hs.student_id = auth.uid()
    )
  );

-- Teachers can create/update grades
CREATE POLICY "Teachers can manage grades"
  ON homework_grades FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM homework_submissions hs
      JOIN homework_assignments ha ON hs.assignment_id = ha.id
      JOIN class_occurrences co ON ha.occurrence_id = co.id
      WHERE hs.id = submission_id
        AND user_has_permission(auth.uid(), 'grade:create', co.class_id)
    )
  );
```

### Storage Bucket Policies

#### session-materials bucket
```sql
-- Teachers can upload to their class folders
CREATE POLICY "Teachers can upload materials"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'session-materials'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM classes
      WHERE user_has_permission(auth.uid(), 'material:upload', id)
    )
  );

-- Class members can download materials
CREATE POLICY "Class members can download materials"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'session-materials'
    AND (storage.foldername(name))[1] IN (
      SELECT class_id::text FROM class_members
      WHERE user_id = auth.uid()
    )
  );
```

#### homework-submissions bucket
```sql
-- Students can upload to their submission folders
CREATE POLICY "Students can upload submissions"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'homework-submissions'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Students can read their own submissions
CREATE POLICY "Students can read own submissions"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'homework-submissions'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Teachers can read all submissions for their assignments
CREATE POLICY "Teachers can read submissions"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'homework-submissions'
    AND (storage.foldername(name))[1] IN (
      SELECT ha.id::text
      FROM homework_assignments ha
      JOIN class_occurrences co ON ha.occurrence_id = co.id
      WHERE user_has_permission(auth.uid(), 'submission:read_all', co.class_id)
    )
  );
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Occurrence Generation Completeness

For any class with a valid schedule (array of day/time slots) and date range (start_date to end_date), generating occurrences should create exactly one occurrence for each matching weekday in the date range, with sequential session numbers starting from 1.

**Validates: Requirements - Class Occurrences #1**

### Property 2: Occurrence CRUD Operations

For any class occurrence, adding a new occurrence should increase the total count by 1, editing an occurrence should preserve its ID while updating specified fields, and cancelling an occurrence should set its status to 'cancelled' without deleting the record.

**Validates: Requirements - Class Occurrences #2**

### Property 3: Session Filtering by Date

For any class and any reference date, querying upcoming sessions should return only occurrences where occurrence_date >= reference date, and querying past sessions should return only occurrences where occurrence_date < reference date.

**Validates: Requirements - Class Occurrences #3**

### Property 4: Automatic Status Transitions

For any class occurrence, if the occurrence_date is in the past and status is 'upcoming', the system should transition the status to 'completed'.

**Validates: Requirements - Class Occurrences #4**

### Property 5: Sequential Session Numbering

For any class, all occurrences should have unique, sequential session numbers (1, 2, 3, ..., N) ordered by occurrence_date and start_time, where N is the total number of occurrences.

**Validates: Requirements - Class Occurrences #5**

### Property 6: Material Upload and Retrieval

For any session material uploaded by a teacher, creating the material record should link it to the correct occurrence_id, store the file URL, and make it retrievable by querying with that occurrence_id.

**Validates: Requirements - Materials #1, #4**

### Property 7: File Type Support

For any file with a valid MIME type (PDF, DOC, PPT, image, etc.), uploading it as a session material should succeed and store the correct file_type field matching the file's MIME type.

**Validates: Requirements - Materials #2**

### Property 8: Material Access Control

For any student enrolled in a class, querying materials for that class's sessions should return all available materials (is_available = true), and materials for other classes should not be accessible.

**Validates: Requirements - Materials #3**

### Property 9: Homework Assignment Creation

For any homework assignment created for a session, the assignment record should be linked to the correct occurrence_id and store all required fields (title, description, due_date, points_possible, submission_type).

**Validates: Requirements - Homework #1**

### Property 10: Late Submission Detection

For any homework submission, if submitted_at > due_date, then is_late should be true; otherwise is_late should be false.

**Validates: Requirements - Homework #2, #4**

### Property 11: Submission Type Handling

For any homework submission, the submission should store content in exactly one field based on submission_type: file_url for 'file', text_content for 'text', or link_url for 'link'.

**Validates: Requirements - Homework #3**

### Property 12: Submission Versioning

For any student resubmitting homework for the same assignment, the new submission should have a version number incremented by 1 from the previous highest version for that student and assignment.

**Validates: Requirements - Homework #5**

### Property 13: Grade Creation and Storage

For any homework submission graded by a teacher, creating a grade record should link it to the correct submission_id and store both points_earned and optional feedback text.

**Validates: Requirements - Grading #1, #2**

### Property 14: Grade Visibility Control

For any homework grade, if status is 'draft', students should not be able to read it; if status is 'published', the student who owns the submission should be able to read it.

**Validates: Requirements - Grading #4**

### Property 15: Aggregate Statistics Accuracy

For any set of homework submissions and grades for a student, calculating completion rate (submitted / total assignments) and average grade (sum of points_earned / count of graded submissions) should produce mathematically correct results.

**Validates: Requirements - Grading #5, Progress #3, #4**

## Error Handling

### File Upload Errors

**Scenario**: File upload fails due to network error, size limit, or invalid type

**Handling**:
- Display user-friendly error message
- Preserve form data (don't clear title/description)
- Provide retry option
- Log error details for debugging

**Example**:
```typescript
try {
  const { error } = await supabase.storage
    .from('session-materials')
    .upload(filePath, file)
  
  if (error) throw error
} catch (err) {
  if (err.message.includes('size')) {
    setError('File is too large. Maximum size is 50MB.')
  } else if (err.message.includes('type')) {
    setError('File type not supported. Please upload PDF, DOC, or PPT.')
  } else {
    setError('Upload failed. Please check your connection and try again.')
  }
  console.error('Upload error:', err)
}
```

### Submission Deadline Errors

**Scenario**: Student attempts to submit after due date when allow_late is false

**Handling**:
- Check due_date before allowing submission
- Display clear message about deadline
- Show when assignment was due
- Suggest contacting teacher if needed

**Example**:
```typescript
const now = new Date()
const dueDate = new Date(assignment.due_date)

if (now > dueDate && !assignment.allow_late) {
  return {
    error: 'This assignment is past due and late submissions are not allowed.',
    dueDate: assignment.due_date
  }
}
```

### Occurrence Generation Errors

**Scenario**: Invalid schedule data or date range

**Handling**:
- Validate schedule format before generation
- Check that end_date >= start_date
- Handle edge cases (no matching days, very long ranges)
- Provide clear validation messages

**Example**:
```typescript
function validateSchedule(schedule, startDate, endDate) {
  if (!schedule || schedule.length === 0) {
    throw new Error('Schedule must have at least one time slot')
  }
  
  if (new Date(endDate) < new Date(startDate)) {
    throw new Error('End date must be after start date')
  }
  
  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  for (const slot of schedule) {
    if (!validDays.includes(slot.day)) {
      throw new Error(`Invalid day: ${slot.day}`)
    }
    if (!slot.startTime || !slot.endTime) {
      throw new Error('Each schedule slot must have start and end times')
    }
  }
}
```

### Grade Calculation Errors

**Scenario**: Division by zero, missing data, or invalid points

**Handling**:
- Check for empty datasets before calculating averages
- Validate points_earned <= points_possible
- Handle null/undefined grades gracefully
- Return 0 or null for empty datasets (not NaN)

**Example**:
```typescript
function calculateAverageGrade(grades: HomeworkGrade[]): number | null {
  const validGrades = grades.filter(g => 
    g.status === 'published' && 
    g.points_earned !== null
  )
  
  if (validGrades.length === 0) {
    return null // No grades yet
  }
  
  const sum = validGrades.reduce((acc, g) => acc + g.points_earned, 0)
  return sum / validGrades.length
}
```

### RLS Policy Errors

**Scenario**: User attempts unauthorized action

**Handling**:
- RLS policies silently filter results (no error thrown)
- For mutations, check permissions before attempting
- Display appropriate "access denied" messages
- Log unauthorized attempts for security monitoring

**Example**:
```typescript
// Check permission before attempting upload
const { data: hasPermission } = await supabase
  .rpc('user_has_permission', {
    p_user_id: userId,
    p_permission_name: 'material:upload',
    p_class_id: classId
  })

if (!hasPermission) {
  setError('You do not have permission to upload materials to this class.')
  return
}
```

### Concurrent Modification Errors

**Scenario**: Two users edit the same record simultaneously

**Handling**:
- Use optimistic locking with updated_at timestamps
- Detect conflicts on save
- Prompt user to refresh and retry
- For grades, last write wins (teacher's latest grade is authoritative)

**Example**:
```typescript
const { data, error } = await supabase
  .from('homework_assignments')
  .update({ 
    title: newTitle,
    updated_at: new Date().toISOString()
  })
  .eq('id', assignmentId)
  .eq('updated_at', originalUpdatedAt) // Optimistic lock

if (error || !data) {
  setError('This assignment was modified by another user. Please refresh and try again.')
}
```

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Together, these provide comprehensive coverage where unit tests catch concrete bugs and property tests verify general correctness.

### Property-Based Testing

**Library**: Use `fast-check` for TypeScript/JavaScript property-based testing

**Configuration**:
- Minimum 100 iterations per property test (due to randomization)
- Each test must reference its design document property
- Tag format: `Feature: class-occurrences-materials, Property {number}: {property_text}`

**Example Property Test**:
```typescript
import fc from 'fast-check'

// Feature: class-occurrences-materials, Property 1: Occurrence Generation Completeness
test('generates correct number of occurrences for any valid schedule', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({
        day: fc.constantFrom('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'),
        startTime: fc.constantFrom('09:00', '10:00', '14:00', '15:00'),
        endTime: fc.constantFrom('10:00', '11:00', '15:00', '16:00')
      }), { minLength: 1, maxLength: 3 }),
      fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-01') }),
      fc.date({ min: new Date('2024-06-02'), max: new Date('2024-12-31') }),
      (schedule, startDate, endDate) => {
        const occurrences = generateOccurrences('test-class-id', schedule, startDate, endDate)
        
        // Count expected occurrences manually
        let expectedCount = 0
        for (const slot of schedule) {
          let current = new Date(startDate)
          const dayMap = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5 }
          const targetDay = dayMap[slot.day]
          
          while (current.getDay() !== targetDay && current <= endDate) {
            current.setDate(current.getDate() + 1)
          }
          
          while (current <= endDate) {
            expectedCount++
            current.setDate(current.getDate() + 7)
          }
        }
        
        expect(occurrences.length).toBe(expectedCount)
        
        // Verify sequential numbering
        occurrences.forEach((occ, index) => {
          expect(occ.session_number).toBe(index + 1)
        })
      }
    ),
    { numRuns: 100 }
  )
})

// Feature: class-occurrences-materials, Property 10: Late Submission Detection
test('correctly flags late submissions for any due date', () => {
  fc.assert(
    fc.property(
      fc.date(),
      fc.integer({ min: -7, max: 7 }), // Days offset from due date
      (dueDate, daysOffset) => {
        const submittedAt = new Date(dueDate)
        submittedAt.setDate(submittedAt.getDate() + daysOffset)
        
        const isLate = submittedAt > dueDate
        
        // Simulate submission creation
        const submission = {
          submitted_at: submittedAt.toISOString(),
          is_late: submittedAt > dueDate
        }
        
        expect(submission.is_late).toBe(isLate)
      }
    ),
    { numRuns: 100 }
  )
})

// Feature: class-occurrences-materials, Property 15: Aggregate Statistics Accuracy
test('calculates correct average grade for any set of grades', () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          points_earned: fc.integer({ min: 0, max: 100 }),
          points_possible: fc.constant(100),
          status: fc.constantFrom('published', 'draft')
        }),
        { minLength: 1, maxLength: 20 }
      ),
      (grades) => {
        const publishedGrades = grades.filter(g => g.status === 'published')
        
        if (publishedGrades.length === 0) {
          expect(calculateAverageGrade(grades)).toBeNull()
        } else {
          const expectedAvg = publishedGrades.reduce((sum, g) => sum + g.points_earned, 0) / publishedGrades.length
          expect(calculateAverageGrade(grades)).toBeCloseTo(expectedAvg, 2)
        }
      }
    ),
    { numRuns: 100 }
  )
})
```

### Unit Testing

**Focus Areas**:
- Specific examples of occurrence generation (e.g., "Monday/Wednesday class from Jan 1 to Jan 31")
- Edge cases (empty schedule, single day, very long date range)
- Error conditions (invalid file types, oversized files, missing permissions)
- Integration points (file upload → database record creation)

**Example Unit Tests**:
```typescript
describe('Occurrence Generation', () => {
  test('generates 8 occurrences for Monday class in 8-week period', () => {
    const schedule = [{ day: 'Monday', startTime: '15:00', endTime: '16:00' }]
    const startDate = new Date('2024-01-01') // Monday
    const endDate = new Date('2024-02-26') // 8 weeks later
    
    const occurrences = generateOccurrences('class-1', schedule, startDate, endDate)
    
    expect(occurrences).toHaveLength(8)
    expect(occurrences[0].occurrence_date).toBe('2024-01-01')
    expect(occurrences[7].occurrence_date).toBe('2024-02-19')
  })
  
  test('handles empty schedule gracefully', () => {
    expect(() => {
      generateOccurrences('class-1', [], new Date(), new Date())
    }).toThrow('Schedule must have at least one time slot')
  })
})

describe('File Upload', () => {
  test('rejects files larger than 50MB', async () => {
    const largeFile = new File(['x'.repeat(51 * 1024 * 1024)], 'large.pdf')
    
    const result = await uploadMaterial(largeFile, 'occurrence-1')
    
    expect(result.error).toContain('too large')
  })
  
  test('accepts valid PDF file', async () => {
    const validFile = new File(['PDF content'], 'test.pdf', { type: 'application/pdf' })
    
    const result = await uploadMaterial(validFile, 'occurrence-1')
    
    expect(result.error).toBeNull()
    expect(result.data.file_type).toBe('application/pdf')
  })
})

describe('Grade Calculations', () => {
  test('returns null for student with no grades', () => {
    const average = calculateAverageGrade([])
    expect(average).toBeNull()
  })
  
  test('calculates correct average for multiple grades', () => {
    const grades = [
      { points_earned: 85, status: 'published' },
      { points_earned: 90, status: 'published' },
      { points_earned: 95, status: 'published' }
    ]
    
    const average = calculateAverageGrade(grades)
    expect(average).toBe(90)
  })
  
  test('excludes draft grades from average', () => {
    const grades = [
      { points_earned: 85, status: 'published' },
      { points_earned: 50, status: 'draft' }, // Should be excluded
      { points_earned: 95, status: 'published' }
    ]
    
    const average = calculateAverageGrade(grades)
    expect(average).toBe(90) // (85 + 95) / 2
  })
})
```

### Integration Testing

**Scenarios to Test**:
1. Complete homework workflow: Create assignment → Student submits → Teacher grades → Student views grade
2. Material upload workflow: Teacher uploads → File stored → Student downloads
3. Occurrence generation workflow: Create class → Occurrences generated → Sessions displayed
4. Permission enforcement: Student attempts teacher action → Blocked by RLS

**Example Integration Test**:
```typescript
describe('Homework Workflow Integration', () => {
  test('complete homework lifecycle', async () => {
    // Setup
    const teacher = await createTestUser('teacher')
    const student = await createTestUser('student')
    const classData = await createTestClass(teacher.id)
    await enrollStudent(student.id, classData.id)
    const occurrence = await createOccurrence(classData.id)
    
    // Teacher creates assignment
    const assignment = await createHomeworkAssignment({
      occurrence_id: occurrence.id,
      created_by: teacher.id,
      title: 'Test Assignment',
      due_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      points_possible: 100
    })
    expect(assignment.id).toBeDefined()
    
    // Student submits
    const submission = await createSubmission({
      assignment_id: assignment.id,
      student_id: student.id,
      text_content: 'My answer',
      submission_type: 'text'
    })
    expect(submission.is_late).toBe(false)
    
    // Teacher grades
    const grade = await createGrade({
      submission_id: submission.id,
      graded_by: teacher.id,
      points_earned: 85,
      feedback: 'Good work!',
      status: 'published'
    })
    expect(grade.id).toBeDefined()
    
    // Student views grade
    const studentGrades = await getGradesForStudent(student.id)
    expect(studentGrades).toHaveLength(1)
    expect(studentGrades[0].points_earned).toBe(85)
  })
})
```

### Performance Testing

**Metrics to Monitor**:
- Occurrence generation time for large date ranges (e.g., 1 year)
- Query performance for classes with 100+ sessions
- File upload time for 50MB files
- Grade calculation time for classes with 50+ students

**Acceptance Criteria**:
- Occurrence generation: < 1 second for 1 year of daily classes (365 occurrences)
- Session list query: < 500ms for 100 sessions
- File upload: Progress indicator updates every 100ms
- Grade calculations: < 100ms for 50 students

### Manual Testing Checklist

**Teacher Workflows**:
- [ ] Create class with schedule → Verify occurrences generated
- [ ] Upload material to session → Verify file accessible
- [ ] Create homework assignment → Verify students can see it
- [ ] Grade submission → Verify grade visible to student
- [ ] Edit occurrence → Verify changes reflected
- [ ] Cancel occurrence → Verify status updated

**Student Workflows**:
- [ ] View upcoming sessions → Verify correct filtering
- [ ] Download material → Verify file downloads
- [ ] Submit homework before deadline → Verify not marked late
- [ ] Submit homework after deadline → Verify marked late
- [ ] View grades → Verify only published grades visible
- [ ] Resubmit homework → Verify version incremented

**Edge Cases**:
- [ ] Class with no schedule → No occurrences generated
- [ ] Very long date range (5 years) → Performance acceptable
- [ ] Upload 50MB file → Success with progress indicator
- [ ] Upload 51MB file → Rejected with clear error
- [ ] Submit after deadline with allow_late=false → Rejected
- [ ] Teacher grades own submission → Blocked by business logic

