# Implementation Tasks — TA Knowledge Base Redesign

## Phase 1 — Knowledge Files (human-authored, no code)

- [ ] 1. Create `TA-agent/topics/equation-solving/math-knowledge.md`
  - Mathematical intuition for equations (the questions a mathematician asks)
  - Henry's specific thinking habits extracted from correction log
  - What a complete correct solution looks like

- [ ] 2. Create `TA-agent/topics/equation-solving/grading-rules.md`
  - Full/partial/minimal mark criteria from Henry's observed grading
  - Henry's comment style: acknowledge → "但是" → question → suggest
  - Common failure modes with example responses from correction log

## Phase 2 — Test Dataset

- [ ] 3. Create `TA-agent/eval/equation-solving-test-cases.json`
  - At least 20 labeled cases from correction log
  - Covering range of equation problem types
  - Each with henry_grade, expected comment quality

## Phase 3 — Code: Topic Classifier + Updated Grading Route

- [ ] 4. Add `classifyTopic()` function to `app/api/ta/grade/route.ts`
  - Tag-match priority → keyword-match fallback → null
  - Returns `{ slug, confidence, method }`

- [ ] 5. Add `readTopicKnowledge()` function (per-request load)
  - Reads `topics/{slug}/math-knowledge.md` and `grading-rules.md`
  - Returns empty strings gracefully if files missing

- [ ] 6. Update `buildSystemPrompt()` to inject topic module
  - Add topic sections when module is loaded
  - Cap confidence at 0.75 when no module found

- [ ] 7. Extend grader output schema
  - Add `topic_module_used` field
  - Add `failed_at_step` free-text field

## Phase 4 — Anqi Critique Agent (3rd GPT call)

- [ ] 8. Create `ANQI_CRITIQUE_PROMPT` in grade route
  - Anqi's 5 questions: understand intent, proportionality, comment helpfulness, deeper question, what student does next
  - Output schema: `{ upheld, grade_revision, comment_assessment, revised_comment, anqi_question, what_ta_missed }`

- [ ] 9. Add `callAnqiCritique()` function
  - Called after existing critic (Call 2 → Call 3)
  - Non-fatal: if it fails, use existing output

- [ ] 10. Update final score/comment resolution
  - Anqi overrides comment when `comment_assessment != 'helpful'`
  - `anqi_question` always surfaced separately

## Phase 5 — Updated UI (3-tier display)

- [ ] 11. Update `taGrades` state type in `app/challenges/[id]/page.tsx`
  - Add `anqi` field: `{ upheld, comment_assessment, revised_comment, anqi_question }`

- [ ] 12. Update `askTA()` function to map new response fields

- [ ] 13. Update TA suggestion panel JSX
  - Show TA grade + Anqi review section
  - Show revised comment when `comment_assessment != 'helpful'`
  - Show `anqi_question` as optional deeper question Henry can add

## Phase 6 — Feedback Route (PATCH with collision guard)

- [ ] 14. Create `app/api/ta/grade/[id]/route.ts`
  - Export `PATCH` handler
  - SQL: `UPDATE ta_grades SET ... WHERE id = ? AND status = 'pending'`
  - Return 409 if 0 rows updated (collision)

- [ ] 15. Update correction log append logic
  - Extended format with `topic_module`, `ai_failed_at_step`, `what_ta_missed`
  - Only appends when DB update succeeds (prevents duplicates on 409)

## Phase 7 — Eval Script + Baseline Run

- [ ] 16. Create `TA-agent/eval/run-eval.py`
  - Runs all test cases through live `/api/ta/grade`
  - Reports overall + per-type accuracy
  - Saves baseline to `baselines.json`

- [ ] 17. Create `TA-agent/eval/baselines.json` (empty array initially)

- [ ] 18. Run initial eval, record baseline, iterate on knowledge files until 95%

## Phase 8 — Push to beta

- [ ] 19. Commit all new files to beta branch
  - Knowledge files, eval dataset, code changes
  - Run `supabase/add-ta-grades.sql` if not already run
