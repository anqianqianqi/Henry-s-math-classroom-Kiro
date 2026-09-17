# Mega Teaching Material Workflow — Requirements

## End Goal

Henry (admin/teacher) takes any existing challenge in the system and, with one click, triggers a 4-step AI pipeline that produces a complete **"Mega" teaching material package** for that challenge. Each step is run by a separate AI agent. After each step, Henry reviews the output and either approves it (the next agent runs) or edits and re-runs. The final output is a rich teaching document attached to the challenge that Henry can use in class or share.

This feature is built into Henry's Math Classroom website at `/admin/mega-materials`. It is admin-only. The LLM used is Claude (via Kiro), not OpenAI.

---

## Glossary

- **Challenge**: An existing problem in the `daily_challenges` or `challenge_bank` table.
- **Mega**: The complete teaching material package generated for one challenge.
- **Agent**: A single LLM call with a specific system prompt and job. Each agent is independent and only receives what it needs.
- **Step**: One stage of the workflow, run by one agent. There are 4 steps.
- **Approval Gate**: The point between steps where Henry reviews the current step's output and must explicitly approve before the next step runs.
- **Workflow State**: The persisted record of a Mega in progress — which step it's on, what each agent produced, what Henry edited/approved.

---

## Requirements

### Requirement 1: Workflow Trigger

**User Story:** As Henry (admin), I want to pick any challenge and start a Mega workflow for it, so that I can generate rich teaching materials from any problem in my bank.

#### Acceptance Criteria

1. WHEN Henry is on the admin mega-materials page, THE system SHALL display a list of challenges (from both `daily_challenges` and `challenge_bank`) he can select from.
2. WHEN Henry selects a challenge and clicks "Start Mega", THE system SHALL create a new `mega_workflows` DB row with `status = 'step1_pending'` and navigate to the workflow UI for that mega.
3. WHEN a mega workflow already exists for a challenge, THE system SHALL show it and allow Henry to resume from where it left off.
4. THE trigger SHALL be accessible only to users with `administrator` or `teacher` role.

---

### Requirement 2: Step 1 — Math Solver Agent

**User Story:** As Henry, I want the AI to solve the challenge correctly and explain its reasoning before anything else is built on top of it, so that all downstream materials are grounded in the right answer.

#### Acceptance Criteria

1. WHEN step 1 is triggered, THE Math Solver Agent SHALL receive only the challenge title and description — no prior agent outputs.
2. THE agent SHALL output:
   - `answer`: the correct answer(s)
   - `solution_steps`: a clear step-by-step solution a student could follow
   - `common_mistakes`: 2–4 mistakes students typically make on this type of problem
   - `difficulty_note`: a brief note on what makes this problem easy or tricky
3. THE agent SHALL NOT receive grading rules, Henry's style, or any other context — only the raw math problem.
4. WHEN step 1 completes, THE UI SHALL display the agent's output and present Henry with: **Approve**, **Edit + Approve**, or **Re-run**.
5. WHEN Henry approves (with or without edits), THE system SHALL save the step 1 output to the `mega_workflows` row and advance status to `'step2_pending'`.
6. WHEN Henry re-runs, THE system SHALL call the agent again with the same challenge — Henry can re-run as many times as needed.

---

### Requirement 3: Step 2 — Math Takeaway Agent

**User Story:** As Henry, I want the AI to identify the single most important thing a student should learn from this challenge, so that the story and materials in later steps stay focused on that insight.

#### Acceptance Criteria

1. WHEN step 2 is triggered, THE Math Takeaway Agent SHALL receive the challenge + the **approved** step 1 output.
2. THE agent SHALL output:
   - `core_concept`: one sentence — the mathematical insight this challenge is really about (e.g. "Comparing multi-digit numbers by leading digit value, not number of digits")
   - `student_insight`: what a student who truly understands this problem would be able to say about it in their own words
   - `teaching_angle`: the most effective way to present this insight to a young learner — what question or activity unlocks the aha moment
   - `connection_to_prior_knowledge`: what the student must already know for this to make sense
3. THE approval gate rules from Requirement 2 (Approve / Edit+Approve / Re-run) SHALL apply identically.
4. WHEN approved, THE system SHALL save step 2 output and advance to `'step3_pending'`.

---

### Requirement 4: Step 3 — Story Brainstorm Agent

**User Story:** As Henry, I want the AI to generate fun and cute story ideas that make the math come alive, so that the final Mega has an engaging narrative wrapper for students.

#### Acceptance Criteria

1. WHEN step 3 is triggered, THE Story Brainstorm Agent SHALL receive the challenge + approved step 1 output + approved step 2 output.
2. THE agent SHALL generate exactly **3 story pitches**. Each pitch contains:
   - `title`: a short catchy name for the story
   - `character`: who the main character is (must be a student-friendly, cute character — not just "a student")
   - `scenario`: 2–3 sentences describing the story setup and how the math arises naturally in it
   - `why_it_works`: one sentence explaining why this story effectively illustrates the core concept from step 2
3. THE UI SHALL display all 3 pitches. Henry can:
   - **Select one** as-is
   - **Edit a pitch** and select it
   - **Re-run** to get 3 new pitches
4. WHEN Henry selects a pitch, THE system SHALL save the selected story pitch to the `mega_workflows` row and advance to `'step4_pending'`.

---

### Requirement 5: Step 4 — Mega Generator Agent

**User Story:** As Henry, I want the AI to produce the final, complete teaching material document using everything approved in the previous steps, so that I have a ready-to-use Mega for class.

#### Acceptance Criteria

1. WHEN step 4 is triggered, THE Mega Generator Agent SHALL receive the challenge + all 3 approved prior outputs.
2. THE agent SHALL produce a structured Mega document with these sections:
   - **Story intro** (3–5 sentences): the story from step 3 used to introduce the challenge
   - **The challenge** (verbatim from the original, formatted cleanly)
   - **Step-by-step solution** (from step 1, adapted into the story's language if possible)
   - **The key insight** (from step 2, written as something Henry says to the class)
   - **Common traps** (from step 1 common_mistakes, framed as "Watch out for...")
   - **Challenge yourself** (1 follow-up question that extends the thinking)
3. THE approval gate rules SHALL apply. Henry can edit any section inline.
4. WHEN Henry approves the final Mega, THE system SHALL:
   - Save the complete mega document to the `mega_workflows` row with `status = 'completed'`
   - Make the mega viewable/downloadable
5. THE completed Mega SHALL be accessible at `/admin/mega-materials/[id]`.

---

### Requirement 6: Workflow State Persistence

**User Story:** As Henry, I want to be able to close the browser mid-workflow and come back to exactly where I left off, so that I don't lose work if the session ends.

#### Acceptance Criteria

1. THE system SHALL persist every agent output and every Henry edit to the `mega_workflows` DB table immediately after it is produced or saved.
2. WHEN Henry navigates back to an in-progress workflow, THE system SHALL restore the exact state — showing completed steps with their approved output, and the current step's pending state.
3. THE workflow state SHALL be stored in one `mega_workflows` row per challenge, with JSONB columns for each step's output.
4. IF Henry starts a new mega for a challenge that already has a completed one, THE system SHALL create a new row (multiple megas per challenge are allowed).

---

### Requirement 7: LLM Provider

**User Story:** As Henry, I want the workflow to use Claude (via the Kiro/Anthropic API), not OpenAI, so that I can control costs and model choice.

#### Acceptance Criteria

1. ALL 4 agents SHALL call the Anthropic Claude API (`claude-sonnet-4-5` or later), not OpenAI.
2. THE API route SHALL read the Anthropic API key from `process.env.ANTHROPIC_API_KEY`.
3. THE system SHALL handle API errors gracefully — if a step fails, THE UI SHALL show the error and offer a Re-run button.
4. Agent calls SHALL use `max_tokens: 2000` for steps 1–3 and `max_tokens: 4000` for step 4.

---

### Requirement 8: Admin UI

**User Story:** As Henry, I want a clean, focused UI for the workflow so that reviewing and approving each step feels natural and not cluttered.

#### Acceptance Criteria

1. THE workflow page SHALL show a **progress stepper** at the top (Step 1 → 2 → 3 → 4) indicating completed, current, and locked steps.
2. EACH step's output SHALL be displayed in a readable card with clear section labels.
3. EDIT mode SHALL be an inline textarea that replaces the display text — no modal.
4. THE **Approve** button SHALL be visually prominent (primary color). Re-run SHALL be secondary. Edit SHALL be a small text link.
5. COMPLETED steps SHALL be collapsible — Henry can expand them to review but they don't dominate the page.
6. THE challenge title and description SHALL always be visible at the top of the page as a reference anchor.
