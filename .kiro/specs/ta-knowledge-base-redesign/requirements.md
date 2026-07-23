# Requirements Document

## Introduction

This feature redesigns the TA (Teaching Assistant) grading agent's knowledge base for Henry's Math Classroom. The current flat-file structure (one `math-knowledge.md` for all topics) does not give the TA enough subject-specific depth to grade reliably. The redesign splits knowledge into two layers — topic-specific math knowledge and topic-specific grading rules — and adds a grading flow that loads the appropriate topic files at grade time. The first validated topic is 解方程 (Equation Solving). No expansion to other topics happens until the TA achieves 95%+ grading accuracy on equation-solving problems.

## Glossary

- **TA**: The AI Teaching Assistant grading agent described in `TA-agent/DESIGN.md`.
- **Knowledge_Base**: The set of Markdown files in `TA-agent/` that the TA reads on every invocation.
- **Topic_Module**: A subdirectory under `TA-agent/topics/{topic-slug}/` containing `math-knowledge.md` and `grading-rules.md` for one mathematical topic.
- **Math_Knowledge_File**: The `math-knowledge.md` file inside a Topic_Module. Describes how to identify the problem type, all valid solution strategies, logical solution layers, and Henry's known tricks for that topic.
- **Grading_Rules_File**: The `grading-rules.md` file inside a Topic_Module. Describes how Henry grades submissions for that topic: full-mark, partial-mark, and minimal-mark criteria, plus his comment style for that problem class.
- **Logical_Solution_Layer**: A problem-specific, step-by-step description of the solution approach at the reasoning level (e.g., "Step 1: count equations and unknowns; Step 2: choose an elimination pair; Step 3: reduce to 2×2 system; Step 4: back-substitute") — distinct from the arithmetic computation.
- **Topic_Classifier**: The component that identifies which Topic_Module applies to a given challenge.
- **Grading_Route**: The orchestration logic that loads global knowledge files plus the relevant Topic_Module before invoking the TA.
- **Equation_Solving_Module**: The specific Topic_Module at `TA-agent/topics/equation-solving/`.
- **Feedback_Loop**: The mechanism by which Henry's grade overrides are captured and linked to specific Logical_Solution_Layer steps for later Knowledge_Base refinement.
- **Accuracy_Validator**: The evaluation script and dataset that measures TA grading accuracy against Henry's ground-truth grades.
- **Henry**: The teacher who owns this classroom and whose grading decisions are the ground truth.
- **Correction_Log**: The existing `TA-agent/correction-log.md` file that records Henry's grade overrides.

---

## Requirements

### Requirement 1: Two-Layer Topic Module File Structure

**User Story:** As Henry, I want the knowledge base organized into topic-specific folders so that the TA has deep, relevant knowledge loaded for each problem type rather than a single generic math file.

#### Acceptance Criteria

1. THE Knowledge_Base SHALL contain a `topics/` subdirectory under `TA-agent/`.
2. WHEN a Topic_Module is created, THE Knowledge_Base SHALL include exactly two files within it: `math-knowledge.md` and `grading-rules.md`.
3. THE Math_Knowledge_File SHALL contain the following sections: problem-type identification signals, all valid solution strategies for that topic, a Logical_Solution_Layer template for each strategy, and Henry's known tricks distilled from past reference solutions.
4. THE Grading_Rules_File SHALL contain the following sections: grading criteria (full marks, partial marks, minimal marks) specific to the topic, identification of which Logical_Solution_Layer step a student failed at, and Henry's comment style for that topic's common failure modes.
5. THE Knowledge_Base SHALL preserve the existing global files (`grading-style.md`, `math-correctness.md`, `grading-protocol.md`) unchanged and at their existing paths.
6. WHEN a Topic_Module is added, THE Knowledge_Base SHALL NOT remove or alter any existing global knowledge file.

---

### Requirement 2: 解方程 (Equation Solving) Topic Module Content

**User Story:** As Henry, I want a complete equation-solving knowledge module so that the TA knows every valid approach, trick, and edge case for 解方程 problems before grading any of them.

#### Acceptance Criteria

1. THE Equation_Solving_Module SHALL cover the following problem sub-types: single-variable linear equations, single-variable equations with factors (zero-product property), systems of 2-variable linear equations, systems of 3-variable linear equations, and equations with a variable in the denominator.
2. FOR EACH sub-type, THE Math_Knowledge_File SHALL describe the Logical_Solution_Layer in explicit step form: identify structure → choose strategy → execute strategy → handle edge cases → verify.
3. THE Math_Knowledge_File SHALL document the elimination strategy for 3-variable linear systems as follows: count equations and unknowns, choose an elimination pair to remove one variable, reduce to a 2×2 system, solve the 2×2 system, back-substitute to find the third variable.
4. THE Math_Knowledge_File SHALL document the zero-product property strategy: rewrite the equation so one side is zero, factor the expression, set each factor equal to zero, solve each resulting simple equation, list all solutions.
5. THE Math_Knowledge_File SHALL document the denominator-variable edge-case rule: identify any expression in a denominator that contains the unknown, state the condition that expression must not equal zero, solve the equation, then verify no solution violates the denominator condition.
6. THE Math_Knowledge_File SHALL document the simplification trick of treating a complex repeated sub-expression as a single substitution variable (e.g., treating `(2x+1)` as `u`), solving for the substitution variable, then back-substituting.
7. THE Grading_Rules_File for equation-solving SHALL specify the following full-mark criteria: all solutions found, all cases covered, denominator conditions checked where applicable, and the answer in exact form.
8. THE Grading_Rules_File for equation-solving SHALL specify the following partial-mark trigger: the student uses a valid strategy but omits the b=0 (or equivalent denominator/factor) edge case — consistent with Henry's existing grading pattern documented in `correction-log.md` examples #3 and #5.
9. THE Grading_Rules_File for equation-solving SHALL specify the following minimal-mark trigger: the student sets up the equation type correctly but makes a fatal algebraic error (as defined in `math-correctness.md`) that prevents reaching a valid solution.
10. THE Grading_Rules_File SHALL describe Henry's comment style for each failure mode using question-and-hint format (e.g., "但是....還有一種可能....是不能除以b的") rather than direct correction.

---

### Requirement 3: Topic Classification

**User Story:** As a developer, I want the grading system to automatically identify the topic of a challenge so that the correct Topic_Module is loaded without Henry having to tag every problem manually.

#### Acceptance Criteria

1. WHEN a challenge is submitted for grading, THE Topic_Classifier SHALL determine the applicable Topic_Module by inspecting challenge tags first, then challenge title, then problem text, in that priority order.
2. WHEN a challenge carries a topic tag matching a known Topic_Module slug (e.g., `equation-solving`), THE Topic_Classifier SHALL select that module without inspecting the title or text.
3. WHEN no tag matches a known Topic_Module slug, THE Topic_Classifier SHALL attempt classification by matching keywords in the challenge title and problem text against each Topic_Module's identification signals documented in its Math_Knowledge_File.
4. WHEN THE Topic_Classifier cannot identify a matching Topic_Module, THE Grading_Route SHALL proceed using only the global knowledge files plus the TA's own LLM knowledge, SHALL cap the TA's confidence score at 0.75, SHALL have the TA produce a suggested solution that mimics the question-and-hint comment style from `grading-style.md`, and SHALL record the classification failure and the TA's suggested solution for Henry's review so Henry can decide whether to create a new Topic_Module.
5. THE Topic_Classifier SHALL return exactly one Topic_Module slug per challenge, or a null result with a reason string.

---

### Requirement 4: Topic-Aware Grading Route

**User Story:** As Henry, I want the TA to load topic-specific knowledge when grading so that it can generate the Logical_Solution_Layer for the specific problem and pinpoint exactly which step the student failed at.

#### Acceptance Criteria

1. WHEN a student submission is received for grading, THE Grading_Route SHALL load the global knowledge files (`grading-style.md`, `math-correctness.md`, `grading-protocol.md`) plus the Topic_Module identified by THE Topic_Classifier before invoking the TA.
2. WHEN the Topic_Module is loaded, THE TA SHALL generate a Logical_Solution_Layer for the specific problem instance (not just the generic template) before reading the student's submission — consistent with Step 1 of the existing `grading-protocol.md`.
3. WHEN evaluating a student's submission, THE TA SHALL map the student's work to the Logical_Solution_Layer step-by-step and identify the first step at which the student's path diverges from a correct solution.
4. THE TA's output SHALL include a `failed_at_step` field containing the name of the Logical_Solution_Layer step at which the student's work diverged, or `null` if the student's solution is correct.
5. THE TA's output SHALL include a `topic_module_used` field recording which Topic_Module was loaded for traceability.
6. WHEN the Topic_Module includes grading criteria for the identified failure mode, THE TA SHALL apply those topic-specific criteria in addition to the global `grading-style.md` rules.
7. WHEN no Topic_Module is loaded (classification failed), THE TA's confidence score SHALL not exceed 0.75, triggering the existing low-confidence review queue.

---

### Requirement 5: Feedback Loop for Knowledge Base Improvement

**User Story:** As Henry, I want my grade overrides linked to specific Logical_Solution_Layer steps so that I can see patterns in where the TA is making mistakes and improve the relevant knowledge file.

#### Acceptance Criteria

1. WHEN Henry overrides a TA grade, THE Feedback_Loop SHALL record the following in the Correction_Log: the `failed_at_step` the TA identified, the step Henry believes the student actually failed at (Henry's correction), the TA's original grade, and Henry's final grade.
2. THE Correction_Log entry format SHALL include a `topic_module` field so corrections are grouped by topic.
3. WHEN the Correction_Log contains 5 or more new entries for the same Topic_Module since the last Knowledge_Base update, THE Feedback_Loop SHALL generate a proposed diff to the relevant `grading-rules.md` file for Henry's review — consistent with the existing Knowledge Updater mechanism in `TA-agent/DESIGN.md`.
4. THE proposed diff SHALL reference the specific Logical_Solution_Layer steps that appear most frequently in the new corrections, so Henry can update the step descriptions or grading criteria at those steps.
5. THE Knowledge_Base files (both global and topic-specific) SHALL only be updated after Henry explicitly approves a proposed diff — no automatic writes.

---

### Requirement 6: Accuracy Validation for 解方程 — 95% Target

**User Story:** As Henry, I want a formal validation process that confirms the TA reaches 95%+ grading accuracy on equation-solving problems before any new topic module is added, so quality is proven before the knowledge base expands.

#### Acceptance Criteria

1. THE Accuracy_Validator SHALL maintain a labeled test dataset of equation-solving submissions with Henry's ground-truth grades, containing at least 20 test cases covering all five equation-solving sub-types defined in Requirement 2.
2. THE Accuracy_Validator SHALL define accuracy as: the fraction of test cases where the TA's grade matches Henry's grade exactly, expressed as a percentage.
3. WHEN the Accuracy_Validator is run, THE Accuracy_Validator SHALL report per-sub-type accuracy in addition to overall accuracy, so Henry can see which equation-solving sub-types still need improvement.
4. THE Knowledge_Base SHALL NOT include a Topic_Module for any topic other than equation-solving until THE Accuracy_Validator confirms 95%+ exact-match accuracy on the equation-solving test dataset.
5. WHEN the Accuracy_Validator reports accuracy below 95%, THE Accuracy_Validator SHALL list the test cases where the TA's grade diverged from Henry's grade, grouped by the `failed_at_step` field, to guide targeted improvements to the Equation_Solving_Module.
6. WHEN the Accuracy_Validator reports 95%+ accuracy on equation-solving, THE Accuracy_Validator SHALL log a milestone record with the date, model version, dataset size, and accuracy score to serve as a baseline for future topic additions.

---

### Requirement 7: Knowledge File Authoring and Update Discipline

**User Story:** As Henry, I want clear rules about who can change which knowledge files and how, so the TA's behavior is predictable and I stay in control of what it knows.

#### Acceptance Criteria

1. THE Math_Knowledge_File and THE Grading_Rules_File for each Topic_Module SHALL be human-authored (Henry or a developer), not auto-generated by the TA itself.
2. WHEN a topic's Math_Knowledge_File or Grading_Rules_File is updated, THE update SHALL be committed to version control with a message referencing the triggering correction entries, so the reason for every change is traceable.
3. THE Correction_Log SHALL be written automatically by the system when Henry submits a grade override, consistent with the existing mechanism in `TA-agent/DESIGN.md`.
4. THE proposed diff generated by the Feedback_Loop (Requirement 5, AC 3) SHALL be presented to Henry as a suggested change, not applied automatically — Henry's explicit approval is required before any file is written.
5. IF the Accuracy_Validator detects that a recent knowledge file update caused accuracy to drop below the last recorded baseline, THEN THE Accuracy_Validator SHALL alert Henry with the accuracy delta and the list of newly failing test cases so Henry can investigate and decide whether to revert the change or proceed with fixes.
