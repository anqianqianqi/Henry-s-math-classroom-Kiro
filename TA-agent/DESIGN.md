# TA Agent — System Design (v2)

## Overview

A background grading assistant that grades like Henry. Built as a 3-node graph
where each node has a single job, a dedicated context window, and a model matched
to its complexity.

```
[Node 1: Problem Analyst] ──→ [Node 0: Image Parser] ──→ [Node 2: Grader] ──→ [Node 3: Verifier] ──→ [Router]
        (once per challenge,      (image submissions only,        ↑                    |
         result stored in DB)      poor quality → skip to flag)   └────────────────────┘
                                                                   (if REVISE, max 2 retries)
```

---

## Principles

**The LLM is the knowledge base.** The model already knows more math than any
`math-knowledge.md` file we could write. What Henry contributes is:
- His grading *preferences* (what he values, how he distributes points)
- His zero-tolerance *rules* (specific to his class, not generic math)

Both live in two plain text files. Henry edits them directly when his grading
style changes. No agent needed to maintain them.

**Context isolation = agent independence.** Each node is a fresh API call with
exactly the context it needs and nothing more. The Verifier deliberately gets
*less* context than the Grader — it cannot see the Grader's reasoning chain,
which is what makes the audit genuine rather than rubber-stamping.

**Permanent DB storage, not ephemeral cache.** Node 1's output (`challenge_ai_analysis`)
is stored as a DB row permanently. If you come back to the same challenge tomorrow
or next month, Node 1 is skipped — the row is already there. Node 1 only re-runs
if the challenge text is edited (row deleted by the system) or manually cleared.

---

## Knowledge Files

Two files. Henry edits them. No agent updates them.

```
TA-agent/
  grading-style.md      ← Henry's grading philosophy, rubrics, point distribution
  math-correctness.md   ← Zero-tolerance rules specific to Henry's class
  correction-log.md     ← Auto-appended record of Henry's grade overrides (read-only by system)
```

`correction-log.md` is append-only and written automatically whenever Henry overrides
a grade. Henry reads it periodically and decides whether to update the other two files
directly. No automated proposal system.

---

## Node Specifications

### Node 0 — Image Parser
**Runs:** Only when the submission contains one or more images. Skipped entirely for text-only submissions.
**Model:** `gpt-4o` (vision capability required)

**Context window:**
- System prompt: "You are transcribing a student's handwritten math submission. Your only job is to read and transcribe — do not evaluate or grade."
- The image(s) from the student submission

**Does NOT receive:** problem text, grading style, any prior output

**Output (JSON):**
```json
{
  "transcription": "Student wrote: x^2 - 5x + 6 = 0, factored as (x-2)(x-3) = 0, so x = 2 and x = 3",
  "parse_quality": "good | partial | poor",
  "unreadable_regions": ["bottom right corner unclear", "step 3 partially cut off"],
  "parse_confidence": 0.91
}
```

**Routing:**
- `parse_quality = "good"` → pass transcription to Node 2 as `image_transcription`, proceed normally
- `parse_quality = "partial"` → pass transcription to Node 2 with a warning flag, Node 2 grades with caveat
- `parse_quality = "poor"` → **skip Node 2 and Node 3 entirely**, route directly to "flag for Henry" with reason `"image_unreadable"`

The transcription is stored in the shared state and shown to Henry in the grading UI alongside the original image. This lets Henry immediately see what the AI understood vs. what the student actually wrote.

---

### Node 1 — Problem Analyst
**Runs:** Once per challenge. Output stored in DB as `challenge_ai_analysis`.
**Model:** `gpt-4o-mini` (deterministic structured extraction, no nuanced judgment needed)

**Context window:**
- System prompt: "You are a math expert..."
- `math-correctness.md` (fatal error reference)
- Problem text (title + description)

**Does NOT receive:** student submissions, grading style, any prior output

**Output (JSON, stored in DB):**
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

**Routing:** If `challenge_ai_analysis` row exists in DB → skip Node 1, go straight to Node 2.

---

### Node 2 — Grader
**Runs:** Once per student submission (or on retry after Verifier REVISE).
**Model:** `gpt-4o` or `claude-sonnet` (deepest reasoning, most consequential output)

**Context window:**
- System prompt: the full 8-step grading protocol from `grading-protocol.md`
- `grading-style.md`
- `math-correctness.md`
- Problem text
- `challenge_ai_analysis` (structured JSON from Node 1 — reference only, not a constraint)
- Student submission (text and/or image)
- `image_transcription` (from Node 0, if submission included images — labeled as "AI's reading of the image")
- If `parse_quality = "partial"`: a note prepended to context: "Warning: image was partially unreadable. Grade based on what was legible; do not penalize for steps that may have been in unreadable regions."
- On retry: Verifier's critique from previous attempt (appended at end)

**Does NOT receive:** other students' submissions, correction log, any system metadata

**Output (JSON):**
```json
{
  "step1_math_understanding": "...",
  "step2_student_approach": "...",
  "step3_deviation": "...",
  "step4_henry_perspective": "...",
  "step5_path_continuation": "...",
  "step6_better_solution": "...",
  "score": 8,
  "max_score": 10,
  "confidence": 0.91,
  "comment": "The comment Henry would write to this student"
}
```

---

### Node 3 — Verifier
**Runs:** Once per grader output (independent audit).
**Model:** `gpt-4o-mini` (simple checklist evaluation, not deep reasoning)

**Context window:**
- System prompt: adversarial auditor framing (see below)
- Problem text
- Student submission
- Grader's output: `score`, `max_score`, `reasoning` text only
- `math-correctness.md`

**Does NOT receive:** grader's 8-step reasoning chain, `grading-style.md`,
`challenge_ai_analysis`, correction log, anything about "what the grader was thinking"

The Verifier gets LESS context than the Grader deliberately. Passing the full
reasoning chain would cause it to anchor on the grader's logic and rubber-stamp it.

**System prompt:**
```
You are an independent auditor of a math grade. You did NOT produce this grade.
Your job is to find flaws, not confirm the grade.

Check these 5 things:
1. Did the grader penalize a method just because it was unexpected or unfamiliar?
   A correct answer by any method earns full credit.
2. Did the grader miss a fatal error that should have been applied?
   Check math-correctness.md.
3. Is the score consistent with the stated reasoning?
   (e.g. "mostly correct" → 40% is inconsistent)
4. Did the grader correctly verify the student's final answer by substitution?
5. Would you arrive at a materially different score starting fresh?

Output: APPROVE or REVISE.
If REVISE, state the specific reason in one sentence.
Do not be vague. "Grade seems off" is not acceptable. Name the specific check that failed.
```

**Output (JSON):**
```json
{
  "verdict": "APPROVE",
  "reason": null
}
```
or
```json
{
  "verdict": "REVISE",
  "reason": "Grader deducted 2 points for using matrix method but it is mathematically valid."
}
```

---

### Router
**Decision logic:**

```
Verifier verdict = APPROVE AND confidence >= 0.85
  → Save grade as "AI suggested", Henry can accept with one click

Verifier verdict = APPROVE AND confidence < 0.85
  → Flag for review, Henry must actively decide

Verifier verdict = REVISE AND retry_count < 2
  → Send back to Node 2 with verifier critique appended, increment retry_count

Verifier verdict = REVISE AND retry_count >= 2
  → Flag for review regardless of confidence
    (two retries without agreement = human judgment needed)
```

---

## Shared State Object

The object flowing between nodes:

```json
{
  "challenge_id": "...",
  "submission_id": "...",
  "problem": "...",
  "student_submission": "...",
  "has_images": true,
  "image_transcription": "...",
  "parse_quality": "good | partial | poor | null",
  "parse_confidence": 0.91,
  "challenge_ai_analysis": { ... },
  "grader_output": { ... },
  "verifier_verdict": "APPROVE | REVISE | null",
  "verifier_critique": "... | null",
  "retry_count": 0,
  "final_grade": { ... },
  "routing_decision": "save | flag | null",
  "flag_reason": "image_unreadable | low_confidence | verifier_disagreement | null"
}
```

---

## The Learning Loop

**Trigger:** Henry overrides a grade OR reviews a flagged grade.

**What happens automatically:**
```markdown
### Correction #N — 2026-08-04
**Problem**: Find all x such that x² - 5x + 6 = 0
**Student submission**: "x = 2 and x = 3 by factoring (x-2)(x-3)=0"
**AI grade**: 9/10 — "Correct factoring, slight presentation issue"
**Henry's grade**: 10/10
**Henry's note**: "Perfect answer. Don't penalize for not showing checking step."
```

**What Henry does (manually, when he has time):**
Read `correction-log.md`, decide if a pattern has emerged, edit `grading-style.md`
or `math-correctness.md` directly. The next invocation of Node 2 picks up the
updated file automatically.

No automated proposal system. No Knowledge Updater agent. Henry is the loop.

---

## Model Selection Summary

| Node | Model | Why |
|---|---|---|
| Image Parser | `gpt-4o` | Vision capability required for handwriting transcription |
| Problem Analyst | `gpt-4o-mini` | Structured JSON extraction, deterministic, runs once per challenge |
| Grader | `gpt-4o` / `claude-sonnet` | Deepest reasoning required, most consequential output |
| Verifier | `gpt-4o-mini` | Simple 5-question checklist, binary output, cheaper is fine |

---

## Decision Rules Summary

| Condition | Action |
|---|---|
| Submission is text-only | Skip Node 0 |
| Submission has images, `parse_quality = "good"` | Pass transcription to Node 2, proceed normally |
| Submission has images, `parse_quality = "partial"` | Pass transcription + warning to Node 2, always flag for Henry regardless of confidence |
| Submission has images, `parse_quality = "poor"` | Skip Node 2 and Node 3, flag immediately with reason `image_unreadable` |
| `challenge_ai_analysis` exists in DB | Skip Node 1 |
| `challenge_ai_analysis` missing | Run Node 1, store result, proceed to Node 2 |
| Verifier: APPROVE + confidence >= 0.85 | Auto-save as "AI suggested" |
| Verifier: APPROVE + confidence < 0.85 | Flag for Henry review |
| Verifier: REVISE + retry_count < 2 | Retry Node 2 with critique, increment retry_count |
| Verifier: REVISE + retry_count >= 2 | Flag for Henry review |
| Henry accepts AI grade | Append nothing to correction-log |
| Henry overrides AI grade | Append to correction-log.md |

---

## Grading UI — Image Transcription Display

When a submission has images, Henry's grading interface shows:

```
┌─────────────────────────────────────────┐
│ Student Submission                       │
│ [image thumbnail]                        │
│                                          │
│ 🤖 AI read this as:                      │
│ "x^2 - 5x + 6 = 0                       │
│  factored: (x-2)(x-3) = 0               │
│  x = 2 and x = 3"                       │
│                                          │
│ Parse quality: good ✓                    │
│ (or "partial ⚠️ — step 3 may be missing") │
│ (or "unreadable ✗ — AI could not grade") │
└─────────────────────────────────────────┘
```

This gives Henry immediate context to assess whether the AI's grade was based on a correct reading. If the transcription is wrong, Henry knows the grade is unreliable before even looking at the score.

---

## Files in This Directory

| File | Purpose | Updated by |
|---|---|---|
| `grading-style.md` | Henry's grading philosophy and rubrics | Henry (directly) |
| `math-correctness.md` | Fatal errors, zero-tolerance rules | Henry (directly) |
| `correction-log.md` | Record of every Henry override | System (auto-append) |
| `grading-protocol.md` | The 8-step thinking process for Node 2 | Manual |
| `DESIGN.md` | This file | Manual |

---

## Phase Plan

**Phase 1 (MVP):** Node 1 + Node 2 only. Manual trigger from admin UI. Henry reviews every grade.

**Phase 2:** Add Node 3 (Verifier) + confidence-based routing.
Auto-trigger on new submissions. Henry only reviews flagged grades.

**Phase 3:** Retry loop (up to 2 retries on REVISE).
Track AI vs Henry agreement rate over time to tune confidence threshold.
