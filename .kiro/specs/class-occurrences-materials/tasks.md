# Implementation Plan: Class Occurrences & Materials Management

## Overview

This implementation transforms the class detail page into a comprehensive learning management system by adding individual class session tracking (occurrences), session-specific materials, homework assignments, submissions, and grading capabilities. The system automatically generates class occurrences based on the class schedule and provides streamlined workflows for teachers and students.

The implementation follows a bottom-up approach: database schema → storage buckets → utility functions → React components → integration. Each task builds on previous work to ensure incremental progress with no orphaned code.

## Tasks

- [ ] 1. Set up database schema and storage infrastructure
  - [ ] 1.1 Create database tables for occurrences and materials
    - Create `class_occurrences` table with indexes
    - Create `session_materials` table with indexes
    - Add RLS policies for both tables
    - _Requirements: 1.1, 1.2, 2.1, 2.3_
  
  - [ ] 1.2 Create database tables for homework and grading
    - Create `homework_assignments` table with indexes
    - Create `homework_submissions` table with indexes
    - Create `homework_grades` table with indexes
    - Add RLS policies for all three tables
    - _Requirements: 3.1, 4.1, 5.1_
  
  - [ ] 1.3 Create storage buckets and access policies
    - Create `session-materials` bucket with RLS policies
    - Create `homework-submissions` bucket with RLS policies
    - Configure file size limits (50MB)
    - _Requirements: 2.2, 4.2_
  
  - [ ] 1.4 Add new permissions to RBAC system
    - Insert occurrence, material, homework, submission, and grade permissions
    - Assign permissions to teacher and student roles
    - _Requirements: Security requirements_

- [ ] 2. Implement occurrence generation algorithm
  - [ ] 2.1 Create occurrence generation utility function
    - Write `generateOccurrences()` function to parse schedule and generate sessions
    - Handle day-of-week mapping and date calculations
    - Implement sequential session numbering
    - _Requirements: 1.1_
  
  - [ ]* 2.2 Write property test for occurrence generation
    - **Property 1: Occurrence Generation Completeness**
    - **Validates: Requirements 1.1**
    - Test with random schedules and date ranges
  
  - [ ]* 2.3 Write unit tests for occurrence generation
    - Test specific examples (Monday class, Monday/Wednesday class)
    - Test edge cases (empty schedule, single day, long date range)
    - Test error conditions (invalid schedule format)
    - _Requirements: 1.1_

- [ ] 3. Implement occurrence management functions
  - [ ] 3.1 Create occurrence CRUD operations
    - Write functions to create, read, update, and delete occurrences
    - Implement status transition logic (upcoming → completed)
    - Add occurrence filtering by date and status
    - _Requirements: 1.2, 1.3, 1.4_
  
  - [ ]* 3.2 Write property tests for occurrence operations
    - **Property 2: Occurrence CRUD Operations**
    - **Property 3: Session Filtering by Date**
    - **Property 4: Automatic Status Transitions**
    - **Property 5: Sequential Session Numbering**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5**

- [ ] 4. Checkpoint - Verify occurrence system
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement material upload and management
  - [ ] 5.1 Create material upload utility functions
    - Write `uploadMaterial()` function for file upload to storage
    - Write `createMaterialRecord()` to save metadata to database
    - Implement file type validation and size checking
    - _Requirements: 2.1, 2.2, 2.5_
  
  - [ ] 5.2 Create material retrieval functions
    - Write `getMaterialsByOccurrence()` to fetch materials for a session
    - Write `downloadMaterial()` for file download
    - Implement access control checks
    - _Requirements: 2.3, 2.4_
  
  - [ ]* 5.3 Write property tests for material operations
    - **Property 6: Material Upload and Retrieval**
    - **Property 7: File Type Support**
    - **Property 8: Material Access Control**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
  
  - [ ]* 5.4 Write unit tests for material operations
    - Test file size validation (reject >50MB)
    - Test file type validation (accept PDF, DOC, PPT)
    - Test error handling (network errors, invalid files)
    - _Requirements: 2.2, 2.5_

- [ ] 6. Implement homework assignment system
  - [ ] 6.1 Create homework assignment CRUD functions
    - Write functions to create, read, update, and delete assignments
    - Implement due date validation
    - Add assignment filtering and sorting
    - _Requirements: 3.1, 3.2_
  
  - [ ] 6.2 Create homework submission functions
    - Write `createSubmission()` for file/text/link submissions
    - Implement late submission detection logic
    - Add submission versioning support
    - _Requirements: 3.3, 3.4, 3.5_
  
  - [ ]* 6.3 Write property tests for homework operations
    - **Property 9: Homework Assignment Creation**
    - **Property 10: Late Submission Detection**
    - **Property 11: Submission Type Handling**
    - **Property 12: Submission Versioning**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
  
  - [ ]* 6.4 Write unit tests for homework operations
    - Test submission before/after deadline
    - Test resubmission version incrementing
    - Test submission type validation
    - _Requirements: 3.3, 3.4, 3.5_

- [ ] 7. Implement grading system
  - [ ] 7.1 Create grading functions
    - Write `createGrade()` and `updateGrade()` functions
    - Implement draft/published status logic
    - Add grade visibility controls
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [ ] 7.2 Create grade calculation utilities
    - Write `calculateAverageGrade()` function
    - Write `calculateCompletionRate()` function
    - Implement aggregate statistics functions
    - _Requirements: 5.4, 6.1, 6.2_
  
  - [ ]* 7.3 Write property tests for grading operations
    - **Property 13: Grade Creation and Storage**
    - **Property 14: Grade Visibility Control**
    - **Property 15: Aggregate Statistics Accuracy**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 6.1, 6.2**
  
  - [ ]* 7.4 Write unit tests for grading operations
    - Test grade calculation with empty dataset (returns null)
    - Test average calculation with multiple grades
    - Test draft grade exclusion from student view
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 8. Checkpoint - Verify backend functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Create TypeScript interfaces and types
  - [ ] 9.1 Define data model interfaces
    - Create `ClassOccurrence`, `SessionMaterial`, `HomeworkAssignment` interfaces
    - Create `HomeworkSubmission`, `HomeworkGrade` interfaces
    - Add type exports to types/database.ts
    - _Requirements: All data model requirements_

- [ ] 10. Build SessionsList component
  - [ ] 10.1 Create SessionsList component with tabs
    - Build component with "Upcoming" and "Past" tabs
    - Implement session card display (date, time, session number)
    - Add materials count badge and homework status indicator
    - Fetch occurrences using Supabase client
    - _Requirements: 1.3_
  
  - [ ]* 10.2 Write unit tests for SessionsList component
    - Test rendering with upcoming sessions
    - Test rendering with past sessions
    - Test empty state display
    - _Requirements: 1.3_

- [ ] 11. Build SessionDetail component
  - [ ] 11.1 Create SessionDetail component
    - Build session info header (date, time, topic)
    - Add materials list section with download buttons
    - Add homework assignment section (if exists)
    - Implement role-based view (teacher vs student)
    - _Requirements: 1.3, 2.4, 3.1_
  
  - [ ]* 11.2 Write unit tests for SessionDetail component
    - Test teacher view with all sections
    - Test student view with appropriate sections
    - Test with/without homework assignment
    - _Requirements: 1.3, 2.4, 3.1_

- [ ] 12. Build MaterialUpload component
  - [ ] 12.1 Create MaterialUpload component for teachers
    - Build drag-and-drop file upload interface
    - Add file type and size validation
    - Implement upload progress indicator
    - Add title, description, and material type fields
    - Wire to `uploadMaterial()` function
    - _Requirements: 2.1, 2.2, 2.5_
  
  - [ ]* 12.2 Write unit tests for MaterialUpload component
    - Test file validation (type and size)
    - Test upload progress display
    - Test error message display
    - _Requirements: 2.1, 2.2, 2.5_

- [ ] 13. Build HomeworkForm component
  - [ ] 13.1 Create HomeworkForm component for teachers
    - Build form with title, description, due date fields
    - Add points possible and submission type selection
    - Add optional assignment file attachment
    - Wire to homework assignment CRUD functions
    - _Requirements: 3.1, 3.2_
  
  - [ ]* 13.2 Write unit tests for HomeworkForm component
    - Test form validation
    - Test assignment creation
    - Test assignment editing
    - _Requirements: 3.1, 3.2_

- [ ] 14. Build SubmissionForm component
  - [ ] 14.1 Create SubmissionForm component for students
    - Build form based on submission type (file/text/link)
    - Add comments/notes field
    - Implement resubmit capability
    - Add late submission warning
    - Wire to `createSubmission()` function
    - _Requirements: 3.3, 3.4, 3.5_
  
  - [ ]* 14.2 Write unit tests for SubmissionForm component
    - Test file upload submission
    - Test text submission
    - Test late submission warning display
    - _Requirements: 3.3, 3.4, 3.5_

- [ ] 15. Build GradingInterface component
  - [ ] 15.1 Create GradingInterface component for teachers
    - Build table view of all submissions
    - Add filter by status (submitted, graded, late)
    - Add sort by student name, submission date
    - Implement quick grade entry
    - Add feedback text area and draft/publish toggle
    - Wire to grading functions
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [ ]* 15.2 Write unit tests for GradingInterface component
    - Test submission list display
    - Test filtering and sorting
    - Test grade entry and publishing
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 16. Build ProgressDashboard component
  - [ ] 16.1 Create ProgressDashboard component
    - Build student view (sessions attended, completion rate, average grade)
    - Build teacher view (class statistics, individual progress)
    - Add upcoming deadlines section
    - Wire to grade calculation utilities
    - _Requirements: 6.1, 6.2_
  
  - [ ]* 16.2 Write unit tests for ProgressDashboard component
    - Test student view calculations
    - Test teacher view statistics
    - Test with empty data (no grades yet)
    - _Requirements: 6.1, 6.2_

- [ ] 17. Checkpoint - Verify component functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Integrate components into class detail page
  - [ ] 18.1 Redesign class detail page with tabs
    - Add tab navigation (Overview, Sessions, Materials, Grades)
    - Integrate SessionsList into Sessions tab
    - Create Materials tab with all materials view
    - Create Grades tab with role-based view
    - _Requirements: UI/UX requirements_
  
  - [ ] 18.2 Add upcoming sessions widget to Overview tab
    - Display next 3 upcoming sessions
    - Add quick links to session details
    - _Requirements: UI/UX requirements_
  
  - [ ] 18.3 Add recent materials widget to Overview tab
    - Display latest 5 materials
    - Add download buttons
    - _Requirements: UI/UX requirements_

- [ ] 19. Implement occurrence generation trigger
  - [ ] 19.1 Add occurrence generation to class creation/update
    - Call `generateOccurrences()` when class is created with schedule
    - Call `generateOccurrences()` when class schedule is updated
    - Handle occurrence regeneration (delete old, create new)
    - _Requirements: 1.1_
  
  - [ ]* 19.2 Write integration test for occurrence generation
    - Test class creation triggers occurrence generation
    - Test schedule update regenerates occurrences
    - _Requirements: 1.1_

- [ ] 20. Implement error handling and validation
  - [ ] 20.1 Add error handling for file uploads
    - Handle network errors with retry option
    - Display user-friendly error messages
    - Preserve form data on error
    - _Requirements: Error handling requirements_
  
  - [ ] 20.2 Add error handling for submissions
    - Check due date before allowing submission
    - Display clear deadline messages
    - Handle late submission rejection
    - _Requirements: Error handling requirements_
  
  - [ ] 20.3 Add error handling for grading
    - Validate points_earned <= points_possible
    - Handle concurrent modification conflicts
    - Display appropriate error messages
    - _Requirements: Error handling requirements_

- [ ] 21. Final integration testing
  - [ ]* 21.1 Write integration test for complete homework workflow
    - Test: Teacher creates assignment → Student submits → Teacher grades → Student views grade
    - Verify all data flows correctly through the system
    - _Requirements: All homework and grading requirements_
  
  - [ ]* 21.2 Write integration test for material workflow
    - Test: Teacher uploads material → File stored → Student downloads
    - Verify file storage and retrieval
    - _Requirements: All material requirements_
  
  - [ ]* 21.3 Write integration test for occurrence workflow
    - Test: Create class → Occurrences generated → Sessions displayed
    - Verify occurrence generation and display
    - _Requirements: All occurrence requirements_

- [ ] 22. Final checkpoint - Complete system verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties (15 properties total)
- Unit tests validate specific examples and edge cases
- Integration tests verify complete workflows
- All code uses TypeScript with Next.js and React
- Database uses Supabase PostgreSQL with RLS policies
- File storage uses Supabase Storage buckets
