# Requirements Document

## Introduction

This feature adds a Challenge Pool system to the Henry Math Classroom app. Teachers can create challenges without immediately assigning them to a class or date — saving them as drafts in a "pool." From the pool page, teachers can review, edit, delete, and publish drafts by assigning a date and one or more classes. Students are unaffected and continue to see only scheduled or published challenges.

The implementation requires adding a `status` column (`'draft' | 'scheduled' | 'published'`) to the `daily_challenges` table, defaulting to `'scheduled'` to preserve existing data.

## Glossary

- **Challenge**: A row in the `daily_challenges` table representing a math problem assigned to students.
- **Draft**: A challenge with `status = 'draft'`. Has no assigned date or class. Not visible to students.
- **Scheduled Challenge**: A challenge with `status = 'scheduled'`. Has a `challenge_date` and at least one `challenge_assignments` row. Visible to students on or after its date.
- **Published Challenge**: A challenge with `status = 'published'`. Treated identically to `scheduled` for student visibility.
- **Challenge Pool**: The collection of all draft challenges belonging to the authenticated teacher.
- **Pool Page**: The teacher-only page at `/challenges/pool` that displays and manages the Challenge Pool.
- **Challenge_Form**: The challenge creation/editing form at `/challenges/new` and `/challenges/[id]/edit`.
- **Challenge_Pool_Page**: The Next.js page component rendered at `/challenges/pool`.
- **Challenge_Service**: The Supabase data-access layer (client-side queries) used by challenge pages.
- **Teacher**: An authenticated user with the `teacher` or `administrator` role in `user_roles`.
- **Student**: An authenticated user without a `teacher` or `administrator` role.

---

## Requirements

### Requirement 1: Draft Status on Daily Challenges

**User Story:** As a teacher, I want to save a challenge without a date or class assignment, so that I can prepare content in advance and publish it when ready.

#### Acceptance Criteria

1. THE `daily_challenges` table SHALL include a `status` column of type `TEXT` with allowed values `'draft'`, `'scheduled'`, and `'published'`, defaulting to `'scheduled'`.
2. WHEN the `status` column is added via migration, THE `daily_challenges` table SHALL set `status = 'scheduled'` for all pre-existing rows so that no existing challenge visibility is changed.
3. THE Challenge_Service SHALL enforce that a challenge with `status = 'draft'` has no `challenge_date` required at the database level (the column remains nullable for drafts).

---

### Requirement 2: Save Challenge as Draft

**User Story:** As a teacher, I want to save a new challenge as a draft from the creation form, so that I can add it to the pool without publishing it immediately.

#### Acceptance Criteria

1. WHEN a teacher submits the Challenge_Form with the "Save as Draft" action, THE Challenge_Form SHALL create a `daily_challenges` row with `status = 'draft'` and no `challenge_date`.
2. WHEN a teacher submits the Challenge_Form with the "Save as Draft" action, THE Challenge_Form SHALL NOT require a `challenge_date` or class selection.
3. WHEN a teacher submits the Challenge_Form with the existing "Create Challenge" action, THE Challenge_Form SHALL continue to require a `challenge_date` and SHALL create the row with `status = 'scheduled'`.
4. WHEN a draft is saved successfully, THE Challenge_Form SHALL redirect the teacher to `/challenges/pool`.
5. IF the title or description fields are empty when saving as draft, THEN THE Challenge_Form SHALL display a validation error and SHALL NOT submit the form.

---

### Requirement 3: Challenge Pool Page

**User Story:** As a teacher, I want a dedicated page that shows all my draft challenges, so that I can manage unpublished content in one place.

#### Acceptance Criteria

1. THE Challenge_Pool_Page SHALL be accessible only to users with the `teacher` or `administrator` role; other users SHALL be redirected to `/dashboard`.
2. THE Challenge_Pool_Page SHALL display all `daily_challenges` rows where `status = 'draft'` and `created_by` equals the authenticated teacher's user ID.
3. WHEN the pool is empty, THE Challenge_Pool_Page SHALL display an empty-state message and a link to create a new challenge.
4. FOR EACH draft challenge displayed, THE Challenge_Pool_Page SHALL show the challenge title, description (truncated to 150 characters), tags, and max points.
5. THE Challenge_Pool_Page SHALL provide a navigation link back to `/challenges`.

---

### Requirement 4: Edit Draft from Pool

**User Story:** As a teacher, I want to edit a draft challenge from the pool, so that I can refine it before publishing.

#### Acceptance Criteria

1. WHEN a teacher clicks "Edit" on a draft in the Challenge_Pool_Page, THE Challenge_Pool_Page SHALL navigate to `/challenges/[id]/edit`.
2. WHEN the edit form is loaded for a draft challenge, THE Challenge_Form SHALL pre-populate all existing fields (title, description, tags, max points, image).
3. WHEN a teacher saves edits to a draft, THE Challenge_Form SHALL update the `daily_challenges` row and keep `status = 'draft'`.
4. WHEN edits are saved successfully, THE Challenge_Form SHALL redirect the teacher back to `/challenges/pool`.

---

### Requirement 5: Delete Draft from Pool

**User Story:** As a teacher, I want to delete a draft challenge from the pool, so that I can remove content I no longer need.

#### Acceptance Criteria

1. WHEN a teacher clicks "Delete" on a draft in the Challenge_Pool_Page, THE Challenge_Pool_Page SHALL display a confirmation prompt before deleting.
2. WHEN the teacher confirms deletion, THE Challenge_Service SHALL delete the `daily_challenges` row and all associated `challenge_assignments` rows via cascade.
3. WHEN deletion succeeds, THE Challenge_Pool_Page SHALL remove the deleted challenge from the displayed list without a full page reload.
4. IF deletion fails due to a database error, THEN THE Challenge_Pool_Page SHALL display an error message and SHALL NOT remove the challenge from the list.

---

### Requirement 6: Publish Draft from Pool

**User Story:** As a teacher, I want to publish a draft by assigning a date and one or more classes, so that students can see and submit the challenge.

#### Acceptance Criteria

1. WHEN a teacher clicks "Publish" on a draft in the Challenge_Pool_Page, THE Challenge_Pool_Page SHALL display an inline publish form containing a date picker and a multi-select class list.
2. THE publish form SHALL list all active classes from the `classes` table.
3. WHEN a teacher submits the publish form, THE Challenge_Service SHALL update the `daily_challenges` row: set `challenge_date` to the chosen date and set `status = 'scheduled'`.
4. WHEN a teacher submits the publish form, THE Challenge_Service SHALL insert one `challenge_assignments` row per selected class, linking the challenge to each class.
5. IF the teacher submits the publish form without selecting a date, THEN THE Challenge_Pool_Page SHALL display a validation error and SHALL NOT publish the challenge.
6. IF the teacher submits the publish form without selecting at least one class, THEN THE Challenge_Pool_Page SHALL display a validation error and SHALL NOT publish the challenge.
7. WHEN publishing succeeds, THE Challenge_Pool_Page SHALL remove the challenge from the draft list and SHALL display a success confirmation.
8. IF publishing fails due to a database error, THEN THE Challenge_Pool_Page SHALL display an error message and SHALL NOT change the challenge's status.

---

### Requirement 7: Student Visibility Unchanged

**User Story:** As a student, I want to see only scheduled or published challenges, so that draft content does not appear in my challenge list.

#### Acceptance Criteria

1. WHEN a student loads the challenges list, THE Challenge_Service SHALL query `daily_challenges` filtered to rows where `status IN ('scheduled', 'published')`.
2. THE Challenge_Service SHALL NOT return challenges with `status = 'draft'` to student queries under any condition.
3. WHEN a student attempts to navigate directly to `/challenges/pool`, THE Challenge_Pool_Page SHALL redirect the student to `/dashboard`.

---

### Requirement 8: Teacher Navigation to Pool

**User Story:** As a teacher, I want easy access to the challenge pool from the main challenges page, so that I can quickly switch between managing drafts and published challenges.

#### Acceptance Criteria

1. WHEN a teacher views the `/challenges` page, THE challenges page header SHALL display a "Pool" button that navigates to `/challenges/pool`.
2. THE "Pool" button SHALL be visible only to users with the `teacher` or `administrator` role.
3. WHEN the Challenge_Pool_Page is loaded, THE Challenge_Pool_Page header SHALL display a "New Draft" button that navigates to `/challenges/new`.
