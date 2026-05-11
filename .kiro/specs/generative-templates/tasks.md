# Implementation Plan: Generative Challenge Templates

## Overview

Implement generative challenge templates that allow teachers to create parameterized challenge patterns producing randomized math problems. The implementation extends the existing `challenge_templates` and `daily_challenges` tables, adds a core generation module, integrates with the scheduler, and provides an admin UI for template management.

## Tasks

- [x] 1. Database migration for generative template fields
  - [x] 1.1 Create `supabase/add-generative-templates.sql` migration file
    - Add `is_generative` (boolean, default false), `title_template` (text), `description_template` (text), `variables` (JSONB), `answer_formula` (text), `max_points` (integer, default 10), and `tag_ids` (UUID[]) columns to `challenge_templates`
    - Add `template_id` (UUID FK to challenge_templates) and `expected_answer` (text) columns to `daily_challenges`
    - Create partial unique index on `(template_id, title)` WHERE `template_id IS NOT NULL`
    - Add RLS policies so only teachers can create/modify generative templates
    - Grant appropriate access permissions
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 11.3_

- [x] 2. Implement core challenge generator module
  - [x] 2.1 Create `lib/challenge-generator.ts` with types and interfaces
    - Define `Variable`, `GenerativeTemplate`, and `GeneratedChallenge` interfaces
    - Export all public types
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 Implement `generateValues()` function
    - Handle `random_int`: generate integer in [min, max] inclusive
    - Handle `random_float`: generate number in [min, max] with specified decimal places
    - Handle `random_choice`: select random item from options array
    - Return object with same keys as input variables
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 2.3 Write property tests for `generateValues()` using fast-check
    - **Property 1: Generated values satisfy variable constraints**
    - **Property 2: Key preservation**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [x] 2.4 Implement `fillTemplate()` function
    - Replace all `{{variable_name}}` patterns with corresponding values
    - Replace missing keys with the key name as literal string
    - Do not mutate the original template string
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.5 Write property tests for `fillTemplate()` using fast-check
    - **Property 3: Template completeness**
    - **Property 4: Missing key fallback**
    - **Property 5: Template immutability**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

  - [x] 2.6 Implement `evaluateFormula()` function
    - Substitute all `{{variable}}` placeholders with numeric values
    - Validate expression against arithmetic allowlist regex `/^[\d\s+\-*/%().]+$/`
    - Return empty string for unsafe or invalid expressions
    - Never throw exceptions
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 11.1_

  - [ ]* 2.7 Write property tests for `evaluateFormula()` using fast-check
    - **Property 6: Formula safety**
    - **Property 7: Formula no-throw guarantee**
    - **Property 8: Formula determinism**
    - **Validates: Requirements 3.3, 3.4, 3.5, 11.1**

  - [x] 2.8 Implement `previewChallenge()` function
    - Generate values, fill templates, evaluate formula
    - Return `GeneratedChallenge` object without any database interaction
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 2.9 Implement `generateChallenge()` async function
    - Generate values and fill templates
    - Perform deduplication check against `(template_id, title)`
    - Return existing challenge ID if duplicate found
    - Insert new daily challenge record if no duplicate
    - Return null on database error without throwing
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement template validation logic
  - [x] 4.1 Create validation utilities for generative templates
    - Validate that `title_template`, `description_template`, `variables`, and `answer_formula` are non-null when `is_generative` is true
    - Validate all `{{variable}}` references in templates have matching keys in variables
    - Validate `random_int` has `min <= max`
    - Validate `random_float` has `decimals` in range 0-10
    - Validate `random_choice` has at least 2 options
    - Validate at least one variable is defined
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 11.4_

  - [ ]* 4.2 Write property tests for template validation
    - **Property 10: Variable reference validation**
    - **Property 11: JSONB structure validation**
    - **Validates: Requirements 5.2, 11.4**

- [x] 5. Implement Admin UI for generative templates
  - [x] 5.1 Create `app/admin/generative-templates/page.tsx` with list view
    - Display all generative templates with title pattern, variable count, and generated challenge count
    - Add Edit and Delete buttons per template
    - Add "Create" button to navigate to create form
    - Add "Generate" button per template for manual generation
    - _Requirements: 6.1, 6.4, 6.5_

  - [x] 5.2 Implement create/edit form with variable builder
    - Title template input with `{{variable}}` syntax
    - Description template textarea
    - Variable definitions section: add/remove variables with name, type, min, max, options, decimals
    - Answer formula input
    - Max points number input
    - Tag picker (reuse existing TagInput component)
    - Form validation using react-hook-form + zod with the validation logic from task 4.1
    - _Requirements: 6.2, 6.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 5.3 Implement preview panel
    - "Preview" button generates 3 sample challenges using `previewChallenge()`
    - Display title, description, expected answer, and variable values for each sample
    - No database persistence during preview
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 5.4 Implement "Generate Now" functionality
    - Call `generateChallenge()` when teacher clicks "Generate Now"
    - Show success notification with new challenge title on success
    - Show error notification if generation returns null
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Scheduler integration for generative templates
  - [x] 7.1 Extend `lib/scheduler.ts` to handle generative templates
    - When a schedule's tags match generative templates, call `generateChallenge()` instead of directly assigning
    - If multiple generative templates match, select one at random
    - Create challenge assignment and log entry on success
    - Log failure and continue processing on null result
    - Fall back to existing non-generative logic when no generative templates match
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 7.2 Write unit tests for scheduler generative integration
    - Test that generative templates are detected and used
    - Test fallback to non-generative logic
    - Test error handling when generation fails
    - _Requirements: 9.1, 9.4, 9.5_

- [x] 8. Integration with challenges/new page
  - [x] 8.1 Add "Generate from Template" option to `app/challenges/new/page.tsx`
    - Add a section or button that allows generating a challenge from an existing generative template
    - Show template picker with available generative templates
    - Call `generateChallenge()` and redirect to the new challenge on success
    - _Requirements: 8.1, 4.1_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- The project uses TypeScript, Next.js 13+ (app router), Supabase, react-hook-form + zod, and Vitest for testing
- fast-check needs to be added as a dev dependency for property-based tests
