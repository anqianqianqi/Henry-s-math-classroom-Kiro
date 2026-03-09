# Class Occurrences & Materials - Implementation Plan

## Current State Analysis

### Existing Infrastructure
- ✅ RBAC system with permissions, roles, and RLS policies
- ✅ Classes table with schedule (JSONB), start_date, end_date
- ✅ Class members and user roles system
- ✅ Storage buckets (class-covers already exists)
- ✅ Helper function: `user_has_permission()`
- ✅ Class creation flow with schedule slots

### What We're Building
Transform the class detail page into a learning management system with:
1. Individual class sessions (occurrences) auto-generated from schedule
2. Session-specific materials upload/download
3. Homework assignments per session
4. Student submission workflow
5. Teacher grading with feedback
6. Progress tracking dashboards

## Implementation Strategy

### Phase 1: Database Foundation (Tasks 1-4)
**Goal**: Set up all database tables, storage buckets, and permissions

**Why First**: Everything else depends on these tables existing. We need the data layer before building any UI or logic.

**Tasks**:
- Create 5 new tables: `class_occurrences`, `session_materials`, `homework_assignments`, `homework_submissions`, `homework_grades`
- Create 2 storage buckets: `session-materials`, `homework-submissions`
- Add RLS policies for all tables and buckets
- Add new permissions to RBAC system

**Deliverable**: Single SQL migration file that can be run in Supabase SQL Editor

**Testing**: Run migration, verify tables exist, test RLS policies with different user roles

---

### Phase 2: Occurrence Generation (Tasks 2-3)
**Goal**: Implement the algorithm to auto-generate class sessions from schedule

**Why Second**: This is the core logic that everything else builds on. Sessions must exist before we can attach materials/homework to them.

**Tasks**:
- Write `generateOccurrences()` utility function
- Parse schedule JSONB (array of {day, startTime, endTime})
- Calculate all matching dates between start_date and end_date
- Generate occurrence records with sequential session numbers
- Write property tests and unit tests

**Deliverable**: 
- `lib/utils/occurrences.ts` with generation logic
- Test file with property-based tests
- Integration into class creation/update flow

**Testing**: 
- Test with various schedules (Monday only, Mon/Wed/Fri, etc.)
- Test edge cases (single day, long date range, no end date)
- Verify session numbering is sequential

---

### Phase 3: Material Management (Task 5)
**Goal**: Enable teachers to upload materials and students to download them

**Why Third**: Materials are simpler than homework (no submissions/grading). Good to build this workflow first.

**Tasks**:
- Create material upload utility functions
- Implement file validation (type, size)
- Create material retrieval functions
- Write tests for upload/download flow

**Deliverable**:
- `lib/utils/materials.ts` with upload/download functions
- File validation logic
- Tests for material operations

**Testing**:
- Upload various file types (PDF, DOC, PPT)
- Test size limits (reject >50MB)
- Verify RLS policies (students can't upload, teachers can)

---

### Phase 4: Homework System (Task 6)
**Goal**: Teachers create assignments, students submit homework

**Why Fourth**: More complex than materials (has submissions, versioning, late detection). Builds on material upload patterns.

**Tasks**:
- Create homework assignment CRUD functions
- Implement submission creation with late detection
- Add submission versioning support
- Write property tests for late submission logic

**Deliverable**:
- `lib/utils/homework.ts` with assignment and submission functions
- Late submission detection logic
- Versioning support for resubmissions
- Tests for homework operations

**Testing**:
- Create assignment, submit before/after deadline
- Test resubmission (version increments)
- Verify late flag is set correctly

---

### Phase 5: Grading System (Task 7)
**Goal**: Teachers grade submissions with feedback, students view grades

**Why Fifth**: Depends on homework submissions existing. Final piece of the backend logic.

**Tasks**:
- Create grading CRUD functions
- Implement draft/published status
- Create grade calculation utilities (average, completion rate)
- Write property tests for statistics accuracy

**Deliverable**:
- `lib/utils/grading.ts` with grading functions
- Grade calculation utilities
- Tests for grading operations

**Testing**:
- Grade submission, verify student can't see draft
- Publish grade, verify student can see it
- Test average calculation with various datasets

---

### Phase 6: React Components (Tasks 10-16)
**Goal**: Build all UI components for the feature

**Why Sixth**: Backend is complete, now we build the UI layer. Components can be built in parallel.

**Components to Build**:
1. `SessionsList` - Display upcoming/past sessions
2. `SessionDetail` - Show session info, materials, homework
3. `MaterialUpload` - Teacher upload interface
4. `HomeworkForm` - Teacher create assignment
5. `SubmissionForm` - Student submit homework
6. `GradingInterface` - Teacher grade submissions
7. `ProgressDashboard` - Student/teacher progress view

**Deliverable**:
- 7 new React components in `components/` directory
- TypeScript interfaces in `types/database.ts`
- Unit tests for each component

**Testing**:
- Test each component in isolation
- Test role-based rendering (teacher vs student views)
- Test empty states and error handling

---

### Phase 7: Integration (Tasks 18-19)
**Goal**: Wire everything together in the class detail page

**Why Seventh**: All pieces exist, now we assemble them into the final experience.

**Tasks**:
- Redesign class detail page with tabs (Overview, Sessions, Materials, Grades)
- Add upcoming sessions widget to Overview
- Add recent materials widget to Overview
- Trigger occurrence generation on class create/update

**Deliverable**:
- Updated `app/classes/[id]/page.tsx` with new tab layout
- Updated `app/classes/new/page.tsx` to trigger occurrence generation
- Updated `app/classes/[id]/edit/page.tsx` to handle schedule changes

**Testing**:
- Create class, verify occurrences generated
- Update schedule, verify occurrences regenerated
- Navigate through all tabs, verify data loads correctly

---

### Phase 8: Polish & Testing (Tasks 20-22)
**Goal**: Error handling, integration tests, final verification

**Why Last**: Everything works, now we make it robust and production-ready.

**Tasks**:
- Add comprehensive error handling
- Write integration tests for complete workflows
- Performance testing with large datasets
- Manual testing checklist

**Deliverable**:
- Error handling for all edge cases
- Integration tests for end-to-end workflows
- Performance benchmarks
- Manual testing report

**Testing**:
- Test complete homework workflow (create → submit → grade → view)
- Test material workflow (upload → download)
- Test with 100+ sessions, 50+ students
- Test error scenarios (network failures, permission denials)

---

## Recommended Approach

### Option A: Full Implementation (All Tasks)
- **Timeline**: 3-4 days
- **Pros**: Complete feature with all functionality
- **Cons**: Longer development time
- **Best For**: Production-ready feature

### Option B: MVP Implementation (Skip Optional Tests)
- **Timeline**: 1-2 days
- **Skip**: Tasks marked with `*` (property tests, some unit tests)
- **Pros**: Faster to market, core functionality works
- **Cons**: Less test coverage, may have edge case bugs
- **Best For**: Quick prototype or demo

### Option C: Phased Rollout
- **Phase 1**: Occurrences + Materials only (Tasks 1-5, 9-12, 18)
- **Phase 2**: Add Homework + Submissions (Tasks 6, 13-14, 19)
- **Phase 3**: Add Grading + Progress (Tasks 7, 15-16, 20-22)
- **Timeline**: 1 day per phase
- **Pros**: Incremental value, easier to test
- **Cons**: Multiple deployment cycles
- **Best For**: Iterative development with user feedback

---

## My Recommendation: Option C (Phased Rollout)

**Why**: 
1. You get value faster (occurrences + materials in 1 day)
2. Easier to test and debug smaller chunks
3. Can gather user feedback before building grading
4. Less overwhelming than building everything at once

**Phase 1 Focus** (Recommended to start):
- Database tables for occurrences and materials
- Occurrence generation algorithm
- Material upload/download
- Basic UI to view sessions and materials
- **Result**: Teachers can organize materials by session, students can access them

Would you like to proceed with Phase 1, or do you prefer a different approach?

---

## Next Steps

1. **Decide on approach** (A, B, or C)
2. **Review database schema** - Make sure table structure works for your needs
3. **Start Phase 1** - Create migration file and test it
4. **Build incrementally** - One task at a time, test as you go

Let me know which approach you'd like to take!
