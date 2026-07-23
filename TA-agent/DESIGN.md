# TA Agent — System Design

## Overview

A background grading assistant that learns to grade like Henry over time.
It is structured as a three-layer system:

- **Layer 1: Math Knowledge** — what is correct math, what are valid approaches, what are fatal errors
- **Layer 2: Grading Workflow** — analyze the problem, evaluate the submission, output a grade with reasoning
- **Layer 3: Learning Loop** — Henry reviews low-confidence grades, his feedback updates the knowledge base

---

## Knowledge Files (Persistent, version-controlled in Git)

These are the files the agent reads on every invocation. They are the agent's "memory".
They grow over time as Henry provides feedback. All updates are stored in Git history.

```
TA-agent/
  math-knowledge.md      ← Layer 1: math tricks, valid approaches, what AI knows about math
  math-correctness.md    ← Layer 1: zero-tolerance rules — what is mathematically never acceptable
  grading-style.md       ← Layer 2: Henry's grading philosophy, rubrics, point distribution
  correction-log.md      ← Layer 3: timestamped record of Henry's grade overrides
```

**Critical rule**: Only the `correction-log.md` is written automatically (by the system
when Henry submits feedback). The other three files are updated by a dedicated
"Knowledge Updater" agent that proposes changes — but Henry must approve before
they are committed.

---

## Agent Architecture: The 8-Step Thinking Protocol

Rather than a simple manager/specialist pattern, the TA follows a deliberate 8-step reasoning sequence for every submission. The full protocol is in `grading-protocol.md`.

**In brief:**

1. **Understand the math** — before reading the student, derive the correct solution independently
2. **Read the student neutrally** — understand what they did without judgment yet
3. **Diagnose the deviation** — find exactly where and why their path diverged
4. **Think like Henry** — apply Henry's grading values (insight over form, brevity is fine, guide not correct)
5. **Continue their path** — follow the student's method forward: does it work if done correctly?
6. **Check for better solutions** — optional, for generating useful comments only, not for scoring
7. **Assign the grade** — only after all the above
8. **Write Henry's comment** — acknowledging what's right, asking a guiding question, never giving the answer directly

The key insight in this design: **the TA tries to understand what the student was thinking before making any judgment.** A brief correct answer ("3进制大") should score full marks. A long wrong answer should score low. What matters is whether the core mathematical insight is present.

---

## The Grading Workflow (Step by Step)

### Trigger
A new student submission arrives. Runs automatically as background job.

### Step 1 — Problem Analyst
**Input:**
- Problem text (title + description)
- `math-knowledge.md` (full content)
- `math-correctness.md` (full content)

**Instructions to the AI:**
```
You are a math expert. Given this problem, derive:
1. All valid solution approaches (algebraic, geometric, numerical, etc.)
2. What a full-credit solution looks like for each approach
3. What partial-credit scenarios look like
4. Common mistakes students make on this type of problem
5. Any fatal errors that would invalidate an otherwise correct-looking solution

Be specific to THIS problem. Do not be generic.
Output as structured JSON.
```

**Output (stored in DB as `challenge_ai_analysis`):**
```json
{
  "valid_approaches": [
    {
      "name": "algebraic substitution",
      "full_solution": "...",
      "key_steps": ["...", "..."],
      "partial_credit_checkpoints": ["...", "..."]
    }
  ],
  "common_mistakes": ["...", "..."],
  "fatal_error_triggers": ["...", "..."]
}
```

**This runs ONCE per challenge, not per submission. Cached in DB.**

---

### Step 2 — Grader
**Input:**
- Problem text
- `challenge_ai_analysis` from Step 1 (reference only — not a constraint)
- Student submission (text and/or image description)
- `grading-style.md` (full content)
- `math-correctness.md` (full content)

**Instructions to the AI:**
```
You are grading a student's math submission. Your job is to evaluate
whether the student's work is mathematically correct — NOT to check
whether it matches a pre-approved solution.

The "solution analysis" provided is background context showing known
valid approaches. A student's submission may be correct even if it
uses a completely different method. Judge the math, not the method.

STEP A — Understand what the student did:
  Read the student's submission carefully.
  What approach did they take? Describe it in your own words.
  Do NOT start by comparing to the known approaches — form your own
  understanding of the student's reasoning first.

STEP B — Verify their math independently:
  Work through their logic step by step.
  Ask: "Is each step mathematically valid given the previous step?"
  Ask: "Does their reasoning lead to a correct conclusion?"
  Check against math-correctness.md for fatal errors.

  IMPORTANT: If the student reached the right answer by a method not
  in the solution analysis, that is STILL CORRECT. Give full credit.
  If their method is unfamiliar to you, reason through it carefully
  before concluding it is wrong.

STEP C — Cross-reference with solution analysis (optional check only):
  Now look at the known approaches.
  If the student's method matches one — good, use it as a benchmark.
  If it does NOT match — this is NOT grounds for penalization.
  Only note it if it helps explain your grade.

STEP D — Award points:
  Use the partial credit guidelines from grading-style.md.
  Base points on correctness of reasoning, not on which method was used.
  Apply zero-tolerance rules from math-correctness.md where relevant.

STEP E — Write reasoning:
  Explain your grade in 2–4 sentences.
  If the student used an unexpected approach that was correct,
  explicitly acknowledge it: "This solution uses [approach] which wasn't
  the expected method, but is mathematically valid."

STEP F — Assign confidence:
  Reduce confidence if:
  - The student's approach is one you haven't fully verified
  - You found yourself unsure whether their method is valid
  - The submission was hard to parse
  A novel-but-correct approach should not reduce confidence once verified.

Output as structured JSON.
```

**Output:**
```json
{
  "score": 8,
  "max_score": 10,
  "approach_used": "algebraic substitution",
  "what_was_correct": "...",
  "what_was_wrong": "...",
  "reasoning": "...",
  "fatal_errors_found": [],
  "confidence": 0.91
}
```

---

### Step 3 — Self-Critique
**Input:**
- The draft grade from Step 2
- Problem text + `challenge_ai_analysis`

**Instructions to the AI:**
```
You just graded a submission and gave it X/Y points. Review your own decision:

1. Did you penalize the student for using a method that wasn't in the
   "known approaches" list? If so, reconsider — the known approaches are
   not exhaustive. Ask yourself: "Is this student's method mathematically
   valid on its own merits?" If yes, do not penalize it.

2. Did the student reach the correct answer via an unexpected path?
   If their final answer is correct AND their reasoning is sound, they
   should receive full credit regardless of method.

3. Is your score consistent with your stated reasoning?
   (e.g. if you said "mostly correct" but gave 40%, that's inconsistent)

4. Did you correctly apply the zero-tolerance fatal error rules from
   math-correctness.md? Fatal errors should be penalized, but only actual
   fatal errors — not just unfamiliar notation or presentation.

5. Would you give the same grade if you saw this submission fresh?

If any of these checks reveal a problem, revise your grade.
Output your final grade (may be same or different from draft).
State whether you changed it and why.
```

**Output:**
```json
{
  "final_score": 8,
  "changed_from_draft": false,
  "critique_notes": "Grade is consistent. Student's approach was valid.",
  "final_confidence": 0.91
}
```

---

### Step 4 — Route Based on Confidence

```
confidence >= 0.85  →  Grade saved, shown to Henry as "AI suggested"
                        Henry can accept with one click or override
                        
confidence < 0.85   →  Grade flagged for review
                        Henry sees it in a "Needs Review" queue
                        Henry must actively decide: accept or override
```

**The grading manager decides routing** — it receives the final output from
Self-Critique and calls either `save_grade` (high confidence) or `flag_for_review`
(low confidence).

---

## The Learning Loop

### Trigger
Henry overrides an AI grade OR reviews a flagged grade and provides feedback.

### What gets recorded
Every Henry override writes to `correction-log.md`:

```markdown
### Correction #N — 2026-07-20
**Problem**: Find all x such that x² - 5x + 6 = 0
**Student submission**: "x = 2 and x = 3 by factoring (x-2)(x-3)=0"
**AI grade**: 9/10 — "Correct factoring, slight presentation issue"
**Henry's grade**: 10/10
**Henry's note**: "Perfect answer. Don't penalize for not showing checking step."
**Lesson type**: grading-style (too strict on checking step requirement)
```

### Knowledge Updater (runs weekly or on-demand)
Reads the correction log and current knowledge files, then proposes diffs:

```
Recent corrections suggest the grading-style.md should be updated:
- 3 corrections where AI penalized for not showing checking step
  → Proposed addition to grading-style.md:
  "Do not require students to verify their answer by substitution
   unless the problem explicitly asks for it."

Accept? [Yes] [No] [Edit]
```

Henry reviews proposals. Approved ones are committed to Git.
This is the only path where the knowledge files grow.

---

## Decision Rules Summary

| Condition | Action |
|---|---|
| `challenge_ai_analysis` exists | Skip Step 1, go straight to Step 2 |
| `challenge_ai_analysis` missing | Run Step 1 first, then Step 2 |
| `confidence >= 0.85` | Auto-save as "AI suggested", Henry can accept |
| `confidence < 0.85` | Flag for review, Henry must decide |
| Henry accepts AI grade | No learning action needed |
| Henry overrides AI grade | Write to correction-log.md |
| Correction log has ≥ 5 new entries | Trigger Knowledge Updater |

---

## Files in This Directory

| File | Purpose | Updated by |
|---|---|---|
| `math-knowledge.md` | Math tricks, valid approaches, problem-solving strategies | Henry (via Knowledge Updater proposals) |
| `math-correctness.md` | Fatal errors, zero-tolerance rules | Henry (via Knowledge Updater proposals) |
| `grading-style.md` | Henry's grading philosophy and rubrics | Henry (via Knowledge Updater proposals) |
| `correction-log.md` | Timestamped record of every Henry override | System (automatic) |
| `DESIGN.md` | This file | Manual |

---

## Phase Plan

**Phase 1 (MVP)**: Steps 1 + 2 only. Manual trigger from admin UI. Henry reviews every grade.
Build the Problem Analyst and Grader agents. No learning loop yet.

**Phase 2**: Add Step 3 (Self-Critique) + confidence-based routing.
Auto-trigger on new submissions. Henry only reviews <85% confidence grades.

**Phase 3**: Learning loop. Knowledge Updater agent.
Henry's corrections feed back into the knowledge files with his approval.
Track AI accuracy over time.
