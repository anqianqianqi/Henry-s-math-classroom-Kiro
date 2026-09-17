# Mega Teaching Material Workflow — Master Plan

## What This Is

Henry picks any challenge, clicks "Start Mega", and a 4-agent AI pipeline produces a
complete teaching material package. Each agent has one job. Henry reviews and approves
between every step. Zero cost until an API key is added — the workflow is first validated
manually in Kiro chat, then wired to Claude API.

---

## Two Phases

### Phase A — Manual Validation (in Kiro chat, zero API cost)
Run the full 4-agent workflow by hand in this chat using a real challenge.
Each agent's output is saved as a `.md` file. Henry reviews, edits, approves.
When all 4 steps are approved, the prompts and output shapes are locked.
**Gate to Phase B: Henry approves all 4 steps and is happy with the final Mega.**

### Phase B — Code Implementation (API key required)
Build the database, API routes, and UI to run this workflow in the browser.
The prompts and output shapes from Phase A are copied directly into the code.
**Gate to done: end-to-end browser test passes on 3 different challenges.**

---

## Phase A — Manual Workflow Validation

### Step A1 — Input Setup
**What:** Create a test run folder with the input challenge documented.
**Who does it:** Kiro
**Deliverable:** `mega-workflow/test-run-001/input.md` ✅ DONE
**Done when:** File exists with challenge title, body, and source.

---

### Step A2 — Agent 1: Math Solver
**What:** Kiro acts as the Math Solver Agent. Receives only the raw challenge.
Produces the correct answer, step-by-step solution, common mistakes, difficulty note.
**Who does it:** Kiro (acting as Agent 1)
**Deliverable:** `mega-workflow/test-run-001/step1-math-solver.md` ✅ DONE (pending Henry approval)

The file contains:
- Raw agent output (JSON shape)
- Henry's review checkboxes (approve / edit / re-run)
- Space for Henry's edits
- Final approved output

**Done when:** Henry marks ✅ Approved in the file or in chat.

**What gets locked after approval:**
- The exact JSON output shape for Step 1: `{ answer, solution_steps[], common_mistakes[], difficulty_note }`
- The system prompt wording for Agent 1 (saved in `mega-workflow/agents/agent1-math-solver.md`)

---

### Step A3 — Agent 2: Math Takeaway
**What:** Kiro acts as the Math Takeaway Agent. Receives the challenge + approved Step 1 output.
Produces the core concept, student insight, teaching angle, prior knowledge connection.
**Who does it:** Kiro (acting as Agent 2) — only runs after Henry approves Step 1
**Deliverable:** `mega-workflow/test-run-001/step2-math-takeaway.md`

The file contains:
- Exact inputs passed to the agent (challenge + step1 approved output)
- Raw agent output (JSON shape)
- Henry's review checkboxes
- Final approved output

**Done when:** Henry marks ✅ Approved.

**What gets locked after approval:**
- The exact JSON output shape for Step 2: `{ core_concept, student_insight, teaching_angle, connection_to_prior_knowledge }`
- The system prompt wording for Agent 2 (saved in `mega-workflow/agents/agent2-math-takeaway.md`)

---

### Step A4 — Agent 3: Story Brainstorm
**What:** Kiro acts as the Story Brainstorm Agent. Receives the challenge + approved Steps 1 and 2.
Produces exactly 3 story pitches with character, scenario, and why-it-works.
**Who does it:** Kiro (acting as Agent 3) — only runs after Henry approves Step 2
**Deliverable:** `mega-workflow/test-run-001/step3-story-brainstorm.md`

The file contains:
- Exact inputs passed to the agent
- All 3 story pitches (raw agent output)
- Henry's selection (which pitch, or edited version)
- Final selected pitch

**Done when:** Henry selects one of the 3 pitches (or edits and selects).

**What gets locked after approval:**
- The exact JSON output shape for Step 3: `{ pitches: [{ title, character, scenario, why_it_works }] }`
- Which pitch Henry selected and why (notes for prompt improvement)
- The system prompt wording for Agent 3 (saved in `mega-workflow/agents/agent3-story-brainstorm.md`)

---

### Step A5 — Agent 4: Mega Generator
**What:** Kiro acts as the Mega Generator Agent. Receives everything from Steps 1, 2, and the selected story pitch.
Produces the final complete Mega document with all 6 sections.
**Who does it:** Kiro (acting as Agent 4) — only runs after Henry selects a story in Step 3
**Deliverable:** `mega-workflow/test-run-001/step4-mega-generator.md`

The file contains:
- Exact inputs passed to the agent
- Raw agent output (all 6 sections)
- Henry's review checkboxes
- Final approved Mega

**Done when:** Henry marks ✅ Approved on the full Mega.

**What gets locked after approval:**
- The exact JSON output shape for Step 4: `{ story_intro, challenge, solution[], key_insight, common_traps[], challenge_yourself }`
- The system prompt wording for Agent 4 (saved in `mega-workflow/agents/agent4-mega-generator.md`)

---

### Step A6 — Lock Agent Definitions
**What:** Write one `.md` file per agent capturing the final validated system prompt,
input contract, output contract, and example input/output from this test run.
These become the source of truth for the code implementation.
**Who does it:** Kiro
**Deliverables (4 files):**
- `mega-workflow/agents/agent1-math-solver.md`
- `mega-workflow/agents/agent2-math-takeaway.md`
- `mega-workflow/agents/agent3-story-brainstorm.md`
- `mega-workflow/agents/agent4-mega-generator.md`

Each file contains:
```
# Agent N — [Name]

## Job (one sentence)
## System Prompt (exact text)
## Input Contract (what it receives)
## Output Contract (JSON shape + field descriptions)
## Example Input (from test-run-001)
## Example Output (approved output from test-run-001)
## Notes / Prompt Improvements (anything Henry flagged)
```

**Done when:** All 4 agent definition files exist and match the approved test run outputs.

---

### Step A7 — Write Final Mega Document
**What:** Assemble the approved Step 4 output into a clean, readable teaching document.
This is what Henry would actually use in class — not the JSON, but the formatted version.
**Who does it:** Kiro
**Deliverable:** `mega-workflow/test-run-001/FINAL-MEGA.md`

Format:
```
# [Story Title]

[Story intro paragraph]

---
## The Challenge
[Challenge text]

---
## Solution
1. [step 1]
2. [step 2]
...

---
## The Key Insight
[Henry's teaching moment]

---
## Watch Out For
- [trap 1]
- [trap 2]

---
## Challenge Yourself
[Follow-up question]
```

**Done when:** File exists and reads as a complete, coherent teaching document.
**Gate to Phase B:** Henry reads the final Mega and says it's good enough to productise.

---

## Phase B — Code Implementation

### Step B1 — Database Migration
**What:** Write the SQL to create the `mega_workflows` table.
**Deliverable:** `supabase/add-mega-workflows.sql`
**Done when:** File is valid SQL. Running it on Supabase creates the table with all
columns, indexes, and RLS policies matching the design doc.

---

### Step B2 — TypeScript Types
**What:** Write the TypeScript interfaces that match the agent output shapes locked in Phase A.
**Deliverable:** `lib/mega/types.ts`
**Done when:** File compiles with no errors. All 4 step output shapes and `MegaWorkflow`
interface are exported and match the JSON shapes from the agent definition files.

---

### Step B3 — Agent Prompts in Code
**What:** Copy the 4 validated system prompts from the agent definition files into TypeScript constants.
**Deliverable:** `lib/mega/prompts.ts`
**Done when:** File exports 4 named string constants — one per agent — that exactly match
the prompts in `mega-workflow/agents/agent*.md`.

---

### Step B4 — Claude Caller + Step Runners
**What:** Write the function that calls the Anthropic Claude API plus 4 step runner functions.
Uses raw `fetch` to `https://api.anthropic.com/v1/messages` — same pattern as existing
OpenAI calls in this codebase. No SDK.
**Deliverable:** `lib/mega/agents.ts`
**Done when:** Each `runStep1()` through `runStep4()` function calls Claude with the correct
system prompt, passes the correct inputs, and returns a typed output matching the interfaces
in `lib/mega/types.ts`. Vision support included for challenges with `image_url`.

---

### Step B5 — API Route: Create + List Workflows
**What:** Next.js route that creates a workflow row and lists existing workflows.
**Deliverable:** `app/api/mega/route.ts`
**Done when:**
- `GET /api/mega` returns `{ ok: true, workflows: [...] }` for authenticated teacher
- `POST /api/mega` with `{ challenge_id, source }` creates a row and returns `{ ok: true, workflow_id }`
- Both return `{ error }` with correct status codes on failure
- Auth uses exact same dual-token pattern as `app/api/ta/grade/route.ts`

---

### Step B6 — API Route: Fetch Workflow State
**What:** Route to load a single workflow's full state.
**Deliverable:** `app/api/mega/[id]/route.ts`
**Done when:** `GET /api/mega/[id]` returns `{ ok: true, workflow: { ...all columns } }`.
Returns 404 if workflow not found or belongs to different user (non-admin).

---

### Step B7 — API Route: Run Agent + Approve Step
**What:** The core route — runs an agent for a given step (POST) and saves Henry's
approved output (PATCH). Includes reset action and optimistic lock on approve.
**Deliverable:** `app/api/mega/[id]/step/[step]/route.ts`
**Done when:**
- `POST` calls the correct `runStep{n}()` function, saves raw output, returns it
- `PATCH` saves approved output, advances status with optimistic lock (`WHERE status = 'step{n}_pending'`)
- `PATCH` with `{ action: 'reset', from_step: N }` clears steps N through 4
- Returns 409 on race condition
- Returns 400 if steps are attempted out of order

---

### Step B8 — Admin Index Page
**What:** The list page where Henry sees all his Mega workflows and starts new ones.
**Deliverable:** `app/admin/mega-materials/page.tsx`
**Done when:**
- Page loads for authenticated teacher/admin, redirects to `/login` otherwise
- Lists all workflows with challenge title, status badge, last updated time
- "New Mega" button opens a challenge picker modal
- Picker searches both `daily_challenges` and `challenge_bank` tables
- Selecting a challenge creates a workflow and navigates to the workflow page

---

### Step B9 — Workflow Page (4-step UI)
**What:** The main workflow page where Henry runs each step, reviews output, and approves.
**Deliverable:** `app/admin/mega-materials/[id]/page.tsx`
**Done when:**
- Progress stepper shows which steps are done / active / locked
- Each step panel has: Run button → spinner while running → output display → Approve/Edit/Re-run
- Step 3 shows 3 story pitch cards; a pitch must be selected before Approve enables
- Edit mode replaces output fields with inline textareas
- Approved steps collapse with a green checkmark and "Reset from here" option
- Reset shows confirmation before clearing downstream steps
- Page state restores correctly on browser refresh

---

### Step B10 — Navigation Link
**What:** Add "📚 Mega Materials" link to the admin section of the main page.
**Deliverable:** One line added to `app/page.tsx` (or wherever admin links live)
**Done when:** Henry can reach `/admin/mega-materials` by clicking a link from the homepage.

---

### Step B11 — End-to-End Browser Test
**What:** Manually run the full workflow in the browser on the same test challenge
used in Phase A, verify the output matches what Kiro produced manually.
**Deliverable:** Annotated test notes in `mega-workflow/test-run-002/` (browser run)
**Done when all 6 checks pass:**
1. ✅ Full happy path: all 4 steps run, approve, final Mega reads well
2. ✅ Refresh mid-workflow: state restores correctly
3. ✅ Re-run: new output appears, prior approved output unchanged
4. ✅ Reset from step 2: steps 2–4 cleared, can redo
5. ✅ Double-click Approve: second click is no-op
6. ✅ Challenge with image: step 1 uses vision, output is sensible

---

## File Map — What Exists vs. What Needs to Be Created

### Phase A files (no API key needed)
| File | Status |
|------|--------|
| `mega-workflow/MASTER-PLAN.md` | ✅ This file |
| `mega-workflow/test-run-001/input.md` | ✅ Done |
| `mega-workflow/test-run-001/step1-math-solver.md` | ✅ Approved |
| `mega-workflow/test-run-001/step2-math-takeaway.md` | ✅ Approved |
| `mega-workflow/test-run-001/step3-story-brainstorm.md` | ✅ Approved (Pitch A selected) |
| `mega-workflow/test-run-001/step4-mega-generator.md` | ✅ Approved |
| `mega-workflow/test-run-001/FINAL-MEGA.md` | ✅ Done |
| `mega-workflow/agents/agent1-math-solver.md` | ✅ Locked |
| `mega-workflow/agents/agent2-math-takeaway.md` | ✅ Locked |
| `mega-workflow/agents/agent3-story-brainstorm.md` | ✅ Locked |
| `mega-workflow/agents/agent4-mega-generator.md` | ✅ Locked |

### Phase B files (API key required)
| File | Status |
|------|--------|
| `supabase/add-mega-workflows.sql` | ⏳ Phase B |
| `lib/mega/types.ts` | ⏳ Phase B |
| `lib/mega/prompts.ts` | ⏳ Phase B |
| `lib/mega/agents.ts` | ⏳ Phase B |
| `app/api/mega/route.ts` | ⏳ Phase B |
| `app/api/mega/[id]/route.ts` | ⏳ Phase B |
| `app/api/mega/[id]/step/[step]/route.ts` | ⏳ Phase B |
| `app/admin/mega-materials/page.tsx` | ⏳ Phase B |
| `app/admin/mega-materials/[id]/page.tsx` | ⏳ Phase B |
| `app/page.tsx` (nav link) | ⏳ Phase B |

---

## Current Status

**PHASE A COMPLETE ✅**

All 4 steps approved. All 4 agent definitions locked. Final Mega written.
The prompts, output shapes, and field contracts are validated and ready to copy into code.

**Gate to Phase B:** ✅ Passed — Henry approved all 4 steps and the final Mega.

**Next action:** Add `ANTHROPIC_API_KEY` to `.env.local` and begin Phase B (Task B1 — DB migration).
