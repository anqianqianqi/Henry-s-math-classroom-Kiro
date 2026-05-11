# Requirements Document

## Introduction

Generative Challenge Templates enable teachers to create parameterized challenge patterns that produce randomized math problems. The system extends the existing `challenge_templates` table with generative fields, provides an admin UI for template management, integrates with the scheduler for auto-generation, and ensures deduplication of generated challenges. This feature allows unlimited practice problem generation from a single template definition.

## Glossary

- **Generator**: The core module (`lib/challenge-generator.ts`) responsible for producing randomized challenge instances from templates
- **Generative_Template**: A challenge template record with `is_generative = true` that defines title/description patterns, variables, and an answer formula
- **Variable**: A named parameter within a template that is replaced with a random value during generation; types include `random_int`, `random_choice`, and `random_float`
- **Template_String**: A text pattern containing `{{variable_name}}` placeholders that are substituted during generation
- **Answer_Formula**: A mathematical expression using `{{variable}}` placeholders that computes the expected answer for a generated challenge
- **Deduplication**: The mechanism that prevents creating duplicate challenges by checking the `(template_id, title)` unique index
- **Admin_UI**: The teacher-facing interface at `/admin/generative-templates` for creating, editing, previewing, and generating challenges from templates
- **Scheduler**: The existing scheduling system (`lib/scheduler.ts`) extended to support automatic challenge generation from generative templates
- **Safe_Evaluator**: The formula evaluation function that restricts execution to arithmetic-only expressions via an allowlist regex

## Requirements

### Requirement 1: Variable Value Generation

**User Story:** As a teacher, I want the system to generate random values within my specified constraints, so that each challenge instance is unique but mathematically valid.

#### Acceptance Criteria

1. WHEN generating a value for a `random_int` variable, THE Generator SHALL produce an integer where `min <= value <= max`
2. WHEN generating a value for a `random_float` variable, THE Generator SHALL produce a number where `min <= value <= max` with exactly the specified number of decimal places
3. WHEN generating a value for a `random_choice` variable, THE Generator SHALL select one item from the provided options array
4. WHEN generating values for a template, THE Generator SHALL return an object with exactly the same keys as the input variables definition
5. WHEN a `random_int` variable has `min` equal to `max`, THE Generator SHALL produce that single value

### Requirement 2: Template String Substitution

**User Story:** As a teacher, I want my template patterns to be filled with generated values, so that each challenge has a complete, readable title and description.

#### Acceptance Criteria

1. WHEN filling a Template_String with values, THE Generator SHALL replace all `{{variable_name}}` patterns with their corresponding values
2. WHEN all referenced variables have corresponding values, THE Generator SHALL produce output containing no remaining `{{...}}` patterns
3. WHEN a Template_String references a variable not present in the values object, THE Generator SHALL replace the placeholder with the variable name as a literal string
4. WHEN filling a Template_String, THE Generator SHALL leave the original template string unmodified

### Requirement 3: Formula Evaluation

**User Story:** As a teacher, I want the system to compute the correct answer from my formula, so that challenges can be auto-graded.

#### Acceptance Criteria

1. WHEN evaluating an Answer_Formula, THE Safe_Evaluator SHALL first substitute all `{{variable}}` placeholders with their numeric values
2. WHEN the substituted formula contains only digits, whitespace, arithmetic operators (`+`, `-`, `*`, `/`, `%`), parentheses, and decimal points, THE Safe_Evaluator SHALL evaluate the expression and return the string result
3. WHEN the substituted formula contains characters outside the arithmetic allowlist, THE Safe_Evaluator SHALL return an empty string without executing the expression
4. WHEN the substituted formula is syntactically invalid, THE Safe_Evaluator SHALL return an empty string without throwing an exception
5. WHEN evaluating a valid formula, THE Safe_Evaluator SHALL produce a deterministic result for the same input values

### Requirement 4: Challenge Generation and Deduplication

**User Story:** As a teacher, I want the system to create unique challenges from my templates without duplicates, so that students always get fresh problems.

#### Acceptance Criteria

1. WHEN generating a challenge from a Generative_Template, THE Generator SHALL create a daily challenge record with the filled title, description, expected answer, template_id, max_points, tag_ids, and today's date
2. WHEN a daily challenge with the same `template_id` and `title` already exists, THE Generator SHALL return the existing challenge ID without creating a new record
3. WHEN the database insert fails, THE Generator SHALL return null without throwing an exception
4. WHEN generating a challenge, THE Generator SHALL set the `created_by` field to the provided user ID
5. WHEN deduplication detects an existing challenge, THE Generator SHALL not modify the existing record

### Requirement 5: Template Validation

**User Story:** As a teacher, I want the system to validate my templates before saving, so that I avoid creating templates that produce errors during generation.

#### Acceptance Criteria

1. WHEN a template has `is_generative` set to true, THE Admin_UI SHALL require non-null values for `title_template`, `description_template`, `variables`, and `answer_formula`
2. WHEN a Template_String references a `{{variable}}` not defined in the variables object, THE Admin_UI SHALL display a validation error before saving
3. WHEN a `random_int` variable has `min` greater than `max`, THE Admin_UI SHALL display a validation error
4. WHEN a `random_float` variable has `decimals` outside the range 0 to 10, THE Admin_UI SHALL display a validation error
5. WHEN a `random_choice` variable has fewer than 2 options, THE Admin_UI SHALL display a validation error
6. WHEN a template has zero variables defined, THE Admin_UI SHALL display a validation error

### Requirement 6: Admin UI Template Management

**User Story:** As a teacher, I want a dedicated interface to create, edit, and manage my generative templates, so that I can efficiently produce challenge patterns.

#### Acceptance Criteria

1. WHEN a teacher navigates to `/admin/generative-templates`, THE Admin_UI SHALL display a list of all generative templates with title pattern, variable count, and generated challenge count
2. WHEN a teacher clicks "Create", THE Admin_UI SHALL display a form with fields for title template, description template, variable definitions, answer formula, max points, and tags
3. WHEN a teacher submits a valid template form, THE Admin_UI SHALL save the template to the database with `is_generative` set to true
4. WHEN a teacher clicks "Edit" on a template, THE Admin_UI SHALL populate the form with the existing template data for modification
5. WHEN a teacher clicks "Delete" on a template, THE Admin_UI SHALL remove the template record from the database

### Requirement 7: Challenge Preview

**User Story:** As a teacher, I want to preview sample challenges before generating them, so that I can verify my template produces correct results.

#### Acceptance Criteria

1. WHEN a teacher clicks "Preview", THE Admin_UI SHALL display 3 sample generated challenges with title, description, and expected answer
2. WHEN generating preview challenges, THE Generator SHALL not persist any records to the database
3. WHEN previewing, THE Admin_UI SHALL show the generated variable values alongside each sample challenge

### Requirement 8: Manual Challenge Generation

**User Story:** As a teacher, I want to manually generate a challenge from a template on demand, so that I can create specific challenges outside the automatic schedule.

#### Acceptance Criteria

1. WHEN a teacher clicks "Generate Now" on a template, THE Admin_UI SHALL call the Generator to create and persist a new challenge
2. WHEN generation succeeds, THE Admin_UI SHALL display a success notification with the new challenge title
3. IF generation returns null due to a database error, THEN THE Admin_UI SHALL display an error notification to the teacher

### Requirement 9: Scheduler Integration

**User Story:** As a teacher, I want the scheduler to automatically generate challenges from my generative templates, so that students receive fresh problems without manual intervention.

#### Acceptance Criteria

1. WHEN the Scheduler encounters a template with `is_generative` set to true, THE Scheduler SHALL call the Generator instead of directly assigning an existing challenge
2. WHEN the Generator produces a challenge ID, THE Scheduler SHALL create a challenge assignment for the target class
3. WHEN the Generator produces a challenge ID, THE Scheduler SHALL log the assignment in the schedule assignment log
4. IF the Generator returns null, THEN THE Scheduler SHALL log the failure and continue processing remaining schedules
5. WHEN multiple generative templates match a schedule's tags, THE Scheduler SHALL select one template at random

### Requirement 10: Database Schema Extension

**User Story:** As a developer, I want the database schema extended with generative fields, so that templates and generated challenges are properly stored and indexed.

#### Acceptance Criteria

1. THE challenge_templates table SHALL include columns: `is_generative` (boolean, default false), `title_template` (text, nullable), `description_template` (text, nullable), `variables` (JSONB, nullable), `answer_formula` (text, nullable), `max_points` (integer, default 10), and `tag_ids` (UUID array)
2. THE daily_challenges table SHALL include columns: `template_id` (UUID, nullable, FK to challenge_templates) and `expected_answer` (text, nullable)
3. THE database SHALL maintain a partial unique index on `(template_id, title)` where `template_id IS NOT NULL` to enforce deduplication
4. WHEN `is_generative` is false on a template, THE system SHALL continue to function identically to the pre-existing behavior (backward compatibility)

### Requirement 11: Security Constraints

**User Story:** As a system administrator, I want the generative template system to be secure against injection attacks, so that malicious formulas cannot execute arbitrary code.

#### Acceptance Criteria

1. WHEN evaluating a formula, THE Safe_Evaluator SHALL reject any expression not matching the arithmetic allowlist pattern `/^[\d\s+\-*/%().]+$/`
2. THE Admin_UI SHALL render all generated challenge text through React's auto-escaping to prevent XSS
3. THE database SHALL enforce RLS policies so that only users with teacher role can create or modify generative templates
4. WHEN receiving a `variables` JSONB payload, THE system SHALL validate its structure on the application layer before database insertion
