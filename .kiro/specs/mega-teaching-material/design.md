# Mega Teaching Material Workflow — Design

## Overview

A 4-step human-in-the-loop AI pipeline that turns any challenge into a complete teaching material package ("Mega"). Each step is a dedicated AI agent with its own system prompt. Between steps, Henry reviews and approves before the next agent runs. The workflow state persists in the database so Henry can close and resume at any time.

---

## Architecture

```
Admin UI (/admin/mega-materials)
  │
  ├── Challenge Picker → creates mega_workflows row
  │
  └── Workflow Page (/admin/mega-materials/[id])
        │
        ├── Step 1 Panel  ── POST /api/mega/[id]/step/1 ── Math Solver Agent
        │        ↓ approve
        ├── Step 2 Panel  ── POST /api/mega/[id]/step/2 ── Math Takeaway Agent
        │        ↓ approve
        ├── Step 3 Panel  ── POST /api/mega/[id]/step/3 ── Story Brainstorm Agent
        │        ↓ select story
        └── Step 4 Panel  ── POST /api/mega/[id]/step/4 ── Mega Generator Agent
                 ↓ approve
              COMPLETED
```

---

## Database Schema

```sql
CREATE TABLE mega_workflows (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id     UUID REFERENCES daily_challenges(id),
  bank_item_id     UUID REFERENCES challenge_bank(id),
  created_by       UUID NOT NULL REFERENCES profiles(id),
  status           TEXT NOT NULL DEFAULT 'step1_pending'
                   CHECK (status IN (
                     'step1_pending', 'step1_done',
                     'step2_pending', 'step2_done',
                     'step3_pending', 'step3_done',
                     'step4_pending', 'completed'
                   )),
  -- Challenge snapshot (so workflow doesn't break if challenge is edited)
  challenge_title  TEXT NOT NULL,
  challenge_body   TEXT NOT NULL,

  -- Step outputs (each is the APPROVED version, after any Henry edits)
  step1_output     JSONB,   -- { answer, solution_steps, common_mistakes, difficulty_note }
  step2_output     JSONB,   -- { core_concept, student_insight, teaching_angle, connection_to_prior_knowledge }
  step3_output     JSONB,   -- { selected_pitch: { title, character, scenario, why_it_works }, all_pitches: [...] }
  step4_output     JSONB,   -- { story_intro, challenge, solution, key_insight, common_traps, challenge_yourself }

  -- Raw agent outputs before Henry's edits (for audit/improvement)
  step1_raw        JSONB,
  step2_raw        JSONB,
  step3_raw        JSONB,
  step4_raw        JSONB,

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

Both `challenge_id` and `bank_item_id` are nullable — exactly one must be set. The challenge title/body snapshot ensures the workflow remains coherent even if the original challenge is edited later.

---

## API Routes

All routes require teacher/admin auth (same pattern as existing TA routes).

```
GET  /api/mega                     → list mega workflows for current user
POST /api/mega                     → create workflow (body: { challenge_id? | bank_item_id? })
GET  /api/mega/[id]                → fetch workflow state
POST /api/mega/[id]/step/[1-4]     → run the agent for that step
PATCH /api/mega/[id]/step/[1-4]    → save Henry's approved output (after editing)
```

### POST /api/mega/[id]/step/[n] — Run Agent

- Validates that the workflow is in the correct `status` for that step (prevents skipping)
- Calls the agent with the appropriate context
- Saves raw output to `step{n}_raw`
- Does NOT advance status — that only happens on PATCH (approve)
- Returns the raw agent output for Henry to review

### PATCH /api/mega/[id]/step/[n] — Approve

- Body: the (possibly edited) step output JSON
- Saves to `step{n}_output`
- Advances `status` to `step{n+1}_pending` (or `completed` for step 4)
- Returns updated workflow

---

## Agent Designs

Each agent is a single `callClaude()` invocation with a dedicated system prompt.

### Agent 1 — Math Solver

**Model:** `claude-sonnet-4-5`
**Max tokens:** 2000
**Temperature:** 0.1 (low — we want correct, not creative)

**System prompt:**
```
You are a precise math expert. Your only job is to solve a math problem and explain it clearly.

You will receive a math challenge. You must:
1. Find the correct answer(s)
2. Write a clear step-by-step solution
3. Identify 2-4 common mistakes students make on this type of problem
4. Write a brief note on what makes this problem easy or tricky

Output ONLY valid JSON — no markdown:
{
  "answer": "the correct answer(s)",
  "solution_steps": ["step 1", "step 2", ...],
  "common_mistakes": ["mistake 1", "mistake 2", ...],
  "difficulty_note": "one sentence"
}
```

**User message:** `Challenge: {title}\n\n{description}`

---

### Agent 2 — Math Takeaway

**Model:** `claude-sonnet-4-5`
**Max tokens:** 2000
**Temperature:** 0.3

**System prompt:**
```
You are a math education expert. You identify the single most important thing
a student should learn from a math problem. You think about what makes a concept
"click" for a young learner.

You will receive a math challenge and its solution. Extract the core mathematical
takeaway — not the procedure, but the insight.

Output ONLY valid JSON:
{
  "core_concept": "one sentence — the mathematical insight this problem teaches",
  "student_insight": "what a student who truly understands this would say in their own words",
  "teaching_angle": "the most effective way to present this insight — what question or activity causes the aha moment",
  "connection_to_prior_knowledge": "what the student must already know for this to make sense"
}
```

**User message:** `Challenge: {title}\n\n{description}\n\nSolution:\n{step1_output}`

---

### Agent 3 — Story Brainstorm

**Model:** `claude-sonnet-4-5`
**Max tokens:** 2000
**Temperature:** 0.9 (high — we want creative variety)

**System prompt:**
```
You are a creative writer for a children's math classroom. You create fun, cute,
engaging stories that make math feel like an adventure. Your characters are
imaginative — animals, mythical creatures, young inventors, chefs, explorers —
never just "a student doing homework."

You will receive a math challenge and its core learning takeaway. Generate exactly
3 story pitches that make this math come alive. Each story must:
- Feature a cute, memorable character
- Have the math arise NATURALLY from the story (not forced)
- Make the core concept feel obvious once the story unfolds
- Be appropriate for a young learner (elementary/middle school)

Output ONLY valid JSON:
{
  "pitches": [
    {
      "title": "short catchy story name",
      "character": "who the main character is",
      "scenario": "2-3 sentences: the story setup and how the math arises naturally",
      "why_it_works": "one sentence: why this story makes the core concept click"
    },
    { ... },
    { ... }
  ]
}
```

**User message:** `Challenge: {title}\n\n{description}\n\nCore concept to illustrate: {step2_output.core_concept}\n\nTeaching angle: {step2_output.teaching_angle}`

---

### Agent 4 — Mega Generator

**Model:** `claude-sonnet-4-5`
**Max tokens:** 4000
**Temperature:** 0.4

**System prompt:**
```
You are a master teaching material creator for Henry's Math Classroom. You take
a math problem, its solution, the learning takeaway, and a story concept, and
assemble them into a complete, polished teaching document called a "Mega."

A Mega has exactly these sections, in this order:
1. Story Intro (3-5 sentences using the approved story)
2. The Challenge (the original problem, formatted cleanly)
3. Step-by-Step Solution (adapted to speak in the story's voice where natural)
4. The Key Insight (written as something Henry says to the class — warm, direct)
5. Common Traps (the common mistakes, framed as "Watch out for...")
6. Challenge Yourself (one follow-up question that extends the thinking)

Output ONLY valid JSON:
{
  "story_intro": "...",
  "challenge": "...",
  "solution": ["step 1", "step 2", ...],
  "key_insight": "...",
  "common_traps": ["trap 1", "trap 2", ...],
  "challenge_yourself": "..."
}
```

**User message:**
```
Challenge: {title}
{description}

Step-by-step solution: {step1_output.solution_steps}
Common mistakes: {step1_output.common_mistakes}
Core concept: {step2_output.core_concept}
Key insight: {step2_output.student_insight}
Teaching angle: {step2_output.teaching_angle}

Selected story:
Character: {step3_output.selected_pitch.character}
Scenario: {step3_output.selected_pitch.scenario}
```

---

## Frontend Pages

### `/admin/mega-materials` — Index

- Lists all mega workflows (created by current user)
- Shows challenge name, status badge, last updated
- "New Mega" button → opens challenge picker modal
- Challenge picker: searchable list of daily_challenges + challenge_bank rows

### `/admin/mega-materials/[id]` — Workflow

Layout:
```
┌─────────────────────────────────────────────────────┐
│  Challenge: "Which is smallest? A.2100 B.550 ..."   │ ← always visible
├─────────────────────────────────────────────────────┤
│  ① Math Solver  ② Takeaway  ③ Story  ④ Mega         │ ← stepper
├─────────────────────────────────────────────────────┤
│  [Completed steps — collapsed, click to expand]     │
│                                                     │
│  [Current step — expanded, full output displayed]   │
│    [Edit]  [Re-run]        [✓ Approve →]            │
└─────────────────────────────────────────────────────┘
```

Step 3 UI difference: shows 3 story pitch cards side-by-side. Henry clicks one to select. Each card has a small "Edit" link. "Re-run" generates 3 new pitches.

---

## File Structure

```
app/
  admin/
    mega-materials/
      page.tsx              ← index (list + challenge picker)
      [id]/
        page.tsx            ← workflow page

app/api/
  mega/
    route.ts                ← GET list, POST create
    [id]/
      route.ts              ← GET workflow state
      step/
        [step]/
          route.ts          ← POST run agent, PATCH approve

lib/
  mega/
    agents.ts               ← callAgent(step, context) — Claude calls
    prompts.ts              ← all 4 system prompts
    types.ts                ← Step1Output, Step2Output, Step3Output, Step4Output, MegaWorkflow

supabase/
  add-mega-workflows.sql    ← migration
```

---

## Self-Critique and Flaw Analysis

### Flaw 1: What if the challenge has an image?
The Math Solver Agent currently only receives text. Many challenges in this app have an `image_url` (graph, diagram). If the challenge has an image, the agent won't see it and may give a wrong answer.

**Fix:** In `POST /api/mega` (create), check if the challenge has an `image_url`. If it does, flag `has_image: true` on the workflow row. In Step 1, if `has_image` is true, use Claude's vision capability — send the image URL as a message content block alongside the text. Add a warning badge on the Step 1 UI: "This challenge has an image — the solution is based on the AI's reading of it."

### Flaw 2: Race condition on approve
If Henry double-clicks Approve, two PATCH requests could fire simultaneously and both advance the status. The second would try to advance from `step{n}_done` to `step{n+1}_pending` again, potentially skipping a step.

**Fix:** Use a status guard in the PATCH handler: `UPDATE mega_workflows SET ... WHERE id = ? AND status = 'step{n}_pending'`. If 0 rows updated, return 409. (Same pattern as `ta_grades` already in this codebase.)

### Flaw 3: Step 3 selected story not clearly distinguished from all_pitches
Storing both `selected_pitch` and `all_pitches` in `step3_output` is the right call, but the PATCH handler needs to explicitly validate that `selected_pitch` is one of `all_pitches` (or a user-edited version of one). Without validation, the step3_output could be structurally invalid.

**Fix:** The PATCH handler for step 3 validates that `step3_output` has both `selected_pitch` and `all_pitches` keys, and that `selected_pitch` has all required fields (`title`, `character`, `scenario`, `why_it_works`). Loose match — we don't require it to be identical to one of the three (since Henry can edit).

### Flaw 4: No way to regenerate a completed step
Once Henry approves step 2, later steps build on it. But what if he realizes after approving step 4 that step 2's core concept was off? There's no way to go back and redo from step 2.

**Fix:** Add a "Reset from this step" button on each completed step card. Clicking it sets the workflow status back to `step{n}_pending` and clears the outputs for all later steps. Add a confirmation dialog: "This will clear Steps 3 and 4. Continue?"

### Flaw 5: Challenge picker doesn't distinguish bank items from daily challenges
Both `challenge_id` and `bank_item_id` are in the schema, but the UI picker mixes them. If Henry selects from the list, the API needs to know which table to fetch from.

**Fix:** The challenge picker returns objects with a `source: 'daily_challenge' | 'bank_item'` field alongside the `id`. The POST /api/mega handler sets exactly one of `challenge_id` or `bank_item_id` based on this, and the challenge snapshot (title + body) is copied from the correct table.

### Flaw 6: No loading state for agent calls
Agent calls take 5-20 seconds. If there's no visible loading state, Henry will think it's broken and click Re-run multiple times.

**Fix:** On clicking "Run" or "Re-run", immediately disable the button and show a spinner with a label like "🤖 Solving..." / "🤖 Brainstorming stories...". The POST endpoint uses streaming (SSE) or the UI polls the workflow state. For MVP, a simple non-streaming POST with a spinner is sufficient — add streaming in v2.

### Flaw 7: RLS — who can see whose mega workflows?
Currently unspecified. A teacher should see their own workflows. An admin should see all.

**Fix:** RLS policy:
- Teacher: `SELECT WHERE created_by = auth.uid()`
- Admin: `SELECT` all rows
- All writes: service role only (same pattern as ta_grades)

---

## Implementation Order

1. `supabase/add-mega-workflows.sql` — migration
2. `lib/mega/types.ts` — TypeScript types
3. `lib/mega/prompts.ts` — all 4 system prompts
4. `lib/mega/agents.ts` — `callAgent()` with Claude API
5. `app/api/mega/route.ts` — create + list
6. `app/api/mega/[id]/route.ts` — fetch state
7. `app/api/mega/[id]/step/[step]/route.ts` — run + approve
8. `app/admin/mega-materials/page.tsx` — index + challenge picker
9. `app/admin/mega-materials/[id]/page.tsx` — workflow UI (all 4 step panels)
10. Manual test: run all 4 steps on the example challenge
