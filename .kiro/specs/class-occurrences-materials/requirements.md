# Class Occurrences & Materials Management - Requirements

## Overview
A comprehensive system for managing individual class sessions (occurrences), their associated materials, homework assignments, and student submissions with grading capabilities. This transforms the class view from a simple overview into a structured learning management system.

## Problem Statement
Currently, the class detail page shows basic class information but lacks:
- Individual class session tracking (occurrences)
- Session-specific materials organization
- Homework assignment and submission workflow
- Grading and feedback system
- Progress tracking for students

Students need to easily find materials for each class session, track upcoming sessions, and submit homework. Teachers need to organize materials per session, assign homework, and grade submissions efficiently.

## User Roles

### Student
- View upcoming and past class sessions
- Access materials for each session
- Submit homework for each session
- View grades and feedback on submissions
- Track progress through the course

### Teacher
- Create and manage class occurrences (sessions)
- Upload materials for specific sessions
- Create homework assignments per session
- Grade student submissions
- Provide feedback and comments
- Track student progress

### Administrator
- View all class occurrences across all classes
- Monitor homework submission rates
- Access grading analytics

## Core Features

### 1. Class Occurrences (Sessions)

#### Automatic Generation
- When a class is created with a schedule, automatically generate occurrences
- Based on schedule (e.g., "Monday 3-4pm, Wednesday 3-4pm")
- From start_date to end_date
- Each occurrence has a specific date and time

#### Manual Management
- Teachers can add individual occurrences
- Edit occurrence date/time
- Cancel/reschedule occurrences
- Mark occurrences as completed

#### Occurrence Display
- **Upcoming Sessions**: Next 5 upcoming occurrences
- **Past Sessions**: Chronological list of completed sessions
- **Session Details**:
  - Date and time
  - Session number (e.g., "Session 5 of 24")
  - Topic/title (optional)
  - Status (upcoming, completed, cancelled)
  - Materials count
  - Homework status (assigned, submitted, graded)

### 2. Session Materials

#### Material Types
- **Documents**: PDF, Word, PowerPoint
- **Links**: External resources, videos
- **Notes**: Text notes from teacher
- **Recordings**: Class recording links

#### Material Management
- **Upload**: Teachers upload materials for specific sessions
- **Organization**: Materials grouped by session
- **Access Control**: 
  - Materials visible to students after session starts
  - Or teacher can make available early
- **Download**: Students can download materials
- **Preview**: In-browser preview for PDFs

#### Material Display
- List view with icons for file types
- File name, size, upload date
- Download button
- Preview button (for supported types)

### 3. Homework Assignments

#### Assignment Creation
- **Per Session**: Each session can have homework
- **Assignment Details**:
  - Title
  - Description/instructions
  - Due date
  - Points possible
  - Attachment (optional assignment file)
  - Submission type (file upload, text, link)

#### Assignment Display
- Show in session detail
- Highlight upcoming due dates
- Status indicators (not started, in progress, submitted, graded)

### 4. Homework Submissions

#### Student Submission
- **Submit Work**:
  - Upload file(s)
  - Enter text response
  - Provide link
  - Add comments/notes
- **Resubmit**: Before due date or if teacher allows
- **Late Submission**: Flag late submissions
- **Submission History**: Track all submission attempts

#### Submission Display
- Submission status
- Submitted date/time
- Files/content submitted
- Grade (if graded)
- Teacher feedback

### 5. Grading System

#### Grading Interface
- **Teacher View**:
  - List all submissions for an assignment
  - Filter by status (submitted, graded, late)
  - Sort by student name, submission date
  - Bulk actions (download all, export grades)

#### Grading Features
- **Grade Entry**:
  - Points earned / points possible
  - Letter grade (optional)
  - Pass/Fail (optional)
- **Feedback**:
  - Text comments
  - Inline annotations (future)
  - Rubric scoring (future)
- **Status**: Draft, Published
- **Notifications**: Student notified when grade published

#### Grade Display
- Student sees grade and feedback
- Grade history
- Overall class grade calculation

### 6. Progress Tracking

#### Student Progress
- Sessions attended / total sessions
- Homework completion rate
- Average grade
- Upcoming deadlines

#### Teacher Dashboard
- Class-wide statistics
- Individual student progress
- Submission rates
- Grade distribution

## User Stories

### As a Student

1. **View Class Sessions**
   - I want to see all upcoming class sessions
   - So I can plan my schedule and prepare

2. **Access Session Materials**
   - I want to download materials for each session
   - So I can study and complete assignments

3. **Submit Homework**
   - I want to upload my homework for each session
   - So I can complete my assignments on time

4. **View Grades**
   - I want to see my grades and teacher feedback
   - So I can understand my performance and improve

5. **Track Progress**
   - I want to see my overall progress in the class
   - So I can stay on track and identify areas needing attention

### As a Teacher

1. **Manage Sessions**
   - I want to create and organize class sessions
   - So students know when classes occur and what to expect

2. **Upload Materials**
   - I want to upload materials for specific sessions
   - So students have the resources they need

3. **Assign Homework**
   - I want to create homework assignments for each session
   - So students can practice and demonstrate learning

4. **Grade Submissions**
   - I want to review and grade student submissions
   - So I can provide feedback and track student progress

5. **Monitor Progress**
   - I want to see class-wide and individual progress
   - So I can identify struggling students and adjust teaching

### As an Administrator

1. **System Overview**
   - I want to see all class occurrences across the platform
   - So I can monitor system usage and activity

2. **Analytics**
   - I want to view submission and grading statistics
   - So I can ensure quality and identify issues

## Acceptance Criteria

### Class Occurrences
- [ ] Occurrences auto-generated from class schedule
- [ ] Teachers can manually add/edit/cancel occurrences
- [ ] Students see upcoming and past sessions
- [ ] Session status updates automatically (upcoming → completed)
- [ ] Session count displayed (e.g., "Session 5 of 24")

### Materials
- [ ] Teachers can upload materials for specific sessions
- [ ] Multiple file types supported (PDF, DOC, PPT, links)
- [ ] Students can download materials
- [ ] Materials organized by session
- [ ] File size limits enforced (e.g., 50MB per file)

### Homework
- [ ] Teachers can create homework per session
- [ ] Due dates enforced
- [ ] Students can submit files, text, or links
- [ ] Late submissions flagged
- [ ] Submission history tracked

### Grading
- [ ] Teachers can grade submissions
- [ ] Points and comments supported
- [ ] Students notified when graded
- [ ] Grades visible to students
- [ ] Grade statistics calculated

### Progress
- [ ] Student progress dashboard
- [ ] Teacher class analytics
- [ ] Completion rates tracked
- [ ] Grade averages calculated

## Database Schema Requirements

### New Tables

#### `class_occurrences`
```sql
- id (UUID, PK)
- class_id (UUID, FK → classes)
- occurrence_date (DATE)
- start_time (TIME)
- end_time (TIME)
- session_number (INTEGER)
- topic (TEXT, optional)
- status (TEXT: upcoming, completed, cancelled)
- notes (TEXT, optional)
- created_at (TIMESTAMPTZ)
```

#### `session_materials`
```sql
- id (UUID, PK)
- occurrence_id (UUID, FK → class_occurrences)
- uploaded_by (UUID, FK → profiles)
- title (TEXT)
- description (TEXT, optional)
- file_url (TEXT)
- file_type (TEXT)
- file_size (INTEGER)
- material_type (TEXT: document, link, note, recording)
- is_available (BOOLEAN)
- uploaded_at (TIMESTAMPTZ)
```

#### `homework_assignments`
```sql
- id (UUID, PK)
- occurrence_id (UUID, FK → class_occurrences)
- created_by (UUID, FK → profiles)
- title (TEXT)
- description (TEXT)
- due_date (TIMESTAMPTZ)
- points_possible (INTEGER)
- submission_type (TEXT: file, text, link)
- assignment_file_url (TEXT, optional)
- allow_late (BOOLEAN)
- created_at (TIMESTAMPTZ)
```

#### `homework_submissions`
```sql
- id (UUID, PK)
- assignment_id (UUID, FK → homework_assignments)
- student_id (UUID, FK → profiles)
- submission_type (TEXT)
- file_url (TEXT, optional)
- text_content (TEXT, optional)
- link_url (TEXT, optional)
- comments (TEXT, optional)
- submitted_at (TIMESTAMPTZ)
- is_late (BOOLEAN)
- version (INTEGER)
```

#### `homework_grades`
```sql
- id (UUID, PK)
- submission_id (UUID, FK → homework_submissions)
- graded_by (UUID, FK → profiles)
- points_earned (INTEGER)
- feedback (TEXT)
- status (TEXT: draft, published)
- graded_at (TIMESTAMPTZ)
- published_at (TIMESTAMPTZ, optional)
```

## Technical Requirements

### Performance
- Class occurrence list loads in < 1 second
- Material downloads start immediately
- Submission upload with progress indicator
- Grading interface responsive for 100+ submissions

### Storage
- Materials stored in Supabase Storage
- Bucket: `session-materials`
- Homework submissions in: `homework-submissions`
- File size limit: 50MB per file
- Total storage per class: 5GB

### Security
- RLS policies for all tables
- Students can only see their own submissions
- Teachers can see all submissions for their classes
- Admins can see all data
- File access controlled by RLS

### Notifications
- Email when homework assigned
- Email when homework graded
- In-app notifications for deadlines
- Reminder 24 hours before due date

## UI/UX Requirements

### Class Detail Page Redesign
- **Header**: Class name, schedule, progress
- **Tabs**:
  - Overview (description, teacher info)
  - Sessions (list of occurrences)
  - Materials (all materials)
  - Grades (student view: my grades, teacher view: all grades)
- **Upcoming Sessions Widget**: Next 3 sessions
- **Recent Materials Widget**: Latest 5 materials

### Session Detail View
- Session info (date, time, number)
- Materials list with download buttons
- Homework section (if assigned)
- Submission form (if student)
- Submission list (if teacher)

### Grading Interface
- Table view of submissions
- Quick grade entry
- Feedback text area
- Publish button
- Export grades button

## Future Enhancements (Out of Scope)

- Attendance tracking
- Live class integration (Zoom, etc.)
- Rubric-based grading
- Peer review
- Discussion forums per session
- Quiz/test creation
- Gradebook export (CSV, Excel)
- Parent portal access
- Mobile app
- Offline access to materials

## Success Metrics

- 90% of students access materials within 24 hours of session
- 80% homework submission rate
- Average grading turnaround < 48 hours
- Student satisfaction score > 4/5
- Teacher time savings: 30% reduction in material organization time
