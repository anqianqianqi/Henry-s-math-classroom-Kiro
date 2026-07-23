# Design Document — TA Knowledge Base Redesign (Revised)

## Overview

The previous design made a category error: it tried to pre-define *how* equations are solved by enumerating sub-types and step templates. That approach is fragile, requires constant maintenance, and doesn't match how Henry thinks.

This revised design is built on a different principle: **give the TA mathematical intuition, not a lookup table.** The knowledge files teach the TA *how to think about math* — the same way you would teach a new human TA by having them read Henry's notes and observe his feedback over time. The TA then applies that intuition freely to any problem it encounters.

The two knowledge files per topic are:

- **`math-knowledge.md`** — mathematical intuition for this topic. Not a list of sub-types. Not solution templates. The underlying principles, the questions a good mathematician asks when they see this kind of problem, and the habits of thinking Henry embodies.

- **`grading-rules.md`** — how Henry grades and guides. Extracted directly from his correction log and comment patterns. Not rules like "if zero-product then give 2/3" — but the *spirit* of how Henry reads student work and responds.

---

## 1. File System Layout

No change to the structure. The problem was the content philosophy, not the layout.

```
TA-agent/
  topics/
    equation-solving/
      math-knowledge.md      ← Mathematical intuition for equations
      grading-rules.md       ← Henry's grading style for equations
  eval/
    equation-solving-test-cases.json
    run-eval.py
    baselines.json
  grading-style.md           ← UNCHANGED
  math-correctness.md        ← UNCHANGED
  grading-protocol.md        ← UNCHANGED
  correction-log.md          ← UNCHANGED (extended with topic field on new entries)
```

---

## 2. What `math-knowledge.md` Actually Contains

This is the most important change from the previous design. The file is **not** a structured taxonomy of equation types with step-by-step templates. It is written as guidance for *how a mathematically literate person thinks* when they encounter an equation problem.

### The right mental model: questions, not procedures

A good mathematician sees an equation and immediately asks a sequence of questions. The `math-knowledge.md` file teaches the TA to ask those same questions — in order — before it looks at the student's work.

**The questions a mathematician asks when seeing an equation:**

1. **What are we trying to find?** Name the unknowns. Count them.
2. **What do we know?** Count the constraints (equations). Do we have enough information?
3. **What is the structure?** Is this linear? Does it factor? Is something repeated? Is anything in a denominator?
4. **What would simplify this?** Is there a substitution that would collapse complexity? Can we look at one piece at a time?
5. **Are there hidden constraints?** What values would break this equation? (Division by zero, square roots of negatives, etc.)
6. **What does a valid answer look like?** Exact? All solutions? Should we verify?

These questions — not a sub-type taxonomy — are what `math-knowledge.md` teaches.

### What the file also captures: Henry's specific thinking habits

Beyond the general questions, the file captures Henry's particular habits that appear repeatedly in his correction log:

**From correction log examples #3, #5, #31:**
Henry notices when a student divides by a variable and asks: *"But can that variable be zero?"* This is not a sub-type rule — it's a habit of asking "what values would break this?" every time something is in a denominator or being divided by.

**From correction log examples #2, #13:**
When the answer is a set of values (multiple solutions), Henry cares about completeness — *all* solutions. His comment "主要就是其中一個要是0" (the key is that one of them equals zero) shows he's thinking about the *reason* the solutions exist, not just listing them.

**From correction log example #31:**
When a student solves `1/a + 5 = 3 + 2/a`, Henry suggests: *"What if you treat `1/a` as a single unknown?"* This is the substitution habit — if something complex repeats, rename it. Not a procedure, a habit of mind.

**From correction log example #22:**
For `178a + 178b = 356`, Henry's note "nice trick! to add them up" — he appreciates and teaches noticing algebraic structure (both terms share 178) before computing.

### What the file does NOT contain

- No "sub-type: single-variable linear → do these steps"
- No lookup table of equation forms
- No rigid step sequences the TA is supposed to follow

The TA uses its own mathematical competence (which GPT-4o already has) guided by the *thinking habits* taught in this file. The file amplifies and directs the model's existing capabilities; it doesn't try to replace them with brittle rules.

### File structure (prose, not tables)

```markdown
# Equation Solving — Mathematical Intuition

## How to approach an equation problem

When you encounter an equation problem, resist the urge to immediately start
computing. First, look at the whole problem and ask:

[questions listed in natural language, as described above]

## Henry's thinking habits for equations

These patterns appear throughout Henry's teaching. When grading equation problems,
bring these habits to bear on the student's work:

**Ask: can this be zero?**
[description + examples from correction log]

**Ask: are all solutions found?**
[description + examples from correction log]

**Ask: is there something simpler hiding here?**
[description + examples from correction log]

**Ask: what does the structure tell you before you compute?**
[description + examples from correction log]

## What a complete, correct solution looks like

[description of what Henry expects — not a template, but a description
of the qualities a full solution should have]
```

---

## 3. What `grading-rules.md` Actually Contains

This file is **entirely extracted from Henry's correction log**. It teaches the TA:

1. How Henry reads student work — what he looks for, what he values
2. How Henry responds — his comment style, his encouragement pattern
3. What earns full marks, partial marks, minimal marks — from observed behavior, not invented rules

### Grading behavior extracted from the correction log

**Full marks (from examples #2, #13, #22, #31, #34, etc.):**
- Student grasps the core idea and demonstrates it clearly
- Brief correct answers get full marks — brevity is not penalized
- Creative or unexpected approaches that are mathematically sound get full marks
- Multiple solutions all listed

**Partial marks (from examples #3, #5):**
- Correct strategy, correct algebra, but one case missed (the "can this be zero?" question unanswered)
- The student's method is sound — they just didn't ask one more question

**Minimal marks:**
- Correct setup but the algebra breaks down in a way that prevents any valid answer
- Shows the student understood what kind of problem it is but couldn't execute

### How Henry comments — distilled from the correction log

Henry's comment pattern for equation problems (from examples #3, #5, #31, #34):

1. **Acknowledge the good idea first**: "除以b是一個很棒的想法!!" / "很棒!"
2. **Pause with "但是" / "but"**: pivot to the question
3. **Ask — don't tell**: "還有一種可能....是不能除以b的" (there's another possibility) — he points toward it but doesn't state it
4. **Offer a new angle**: "如果我把 1/a整個當一個未知數呢?" (what if you treated 1/a as a single unknown?) — suggests the habit of mind, not the answer

The TA's suggested comment for any equation problem should follow this pattern.

### File structure

```markdown
# Equation Solving — Henry's Grading Rules

## What Henry values

[distilled from correction log — qualities that earn marks]

## What earns full marks

[from observed Henry grades, with examples]

## What earns partial marks

[from observed Henry grades, with examples — always grounded in specific correction log entries]

## What earns minimal marks

[from observed Henry grades, with examples]

## How Henry comments on equation problems

[the acknowledge → pause → question → suggest pattern, with real examples]

## Common patterns Henry catches

[the specific habits he has for equations — drawn from his comments]
```

---

## 4. How the TA Uses These Files

The grading route loads the topic knowledge and gives it to the TA as context. The prompt instructs the TA:

> "Before reading the student's work, use the math-knowledge.md for this topic to think through the problem yourself — what questions does a mathematician ask here? What would a complete solution look like? Then read the student's work and use grading-rules.md to assess where they are on that journey."

This is the key sequencing: **solve it first, then read the student**. The topic knowledge enables step 1 of the 8-step grading protocol (the existing `grading-protocol.md`) to be deeper and more specific.

The TA does not match the student's work against a pre-defined template. It matches it against the TA's own understanding of the problem — which is richer because of the topic knowledge file.

### What the TA outputs (unchanged schema)

The existing output schema already captures what we need:

```json
{
  "step1_math_understanding": "What the problem asks — TA's own solution and thinking",
  "step2_student_approach": "What the student actually did",
  "step3_deviation": "Where and why the student's thinking diverged",
  "step4_henry_perspective": "What Henry would see",
  "step5_path_continuation": "Does the student's path work if continued correctly?",
  "failed_at_step": "A natural-language description of where the student fell short",
  "topic_module_used": "equation-solving",
  "score": 2,
  "max_score": 3,
  "confidence": 0.88,
  "comment": "Henry's comment in his style"
}
```

`failed_at_step` is now a **free-text description** (not a fixed enum value from a pre-defined taxonomy). The TA describes in its own words where the student's reasoning broke down — e.g., "Student correctly set up the equation but didn't check whether dividing by b was valid." This is more informative than a rigid label and doesn't require maintaining a taxonomy.

---

## 5. Topic Classifier — Unchanged

The classifier logic from the previous design is correct. Topics are identified by:
1. Tag match (exact slug match) — confidence 1.0
2. Keyword match in title/description — confidence 0.8
3. No match — fall back to global files, cap confidence at 0.75

The keyword list for `equation-solving`:
`解方程`, `方程化简`, `方程`, `solve`, `equation`, `求解`, `化简`, `求x`, `求a`, `找x`

---

## 6. Grading Route Changes — Minimal and Additive

The route update is the same as before:

1. Classify topic from challenge metadata
2. Load `topics/{slug}/math-knowledge.md` and `topics/{slug}/grading-rules.md` if topic found
3. Inject into system prompt alongside existing global files
4. Existing grading + critic logic runs unchanged
5. Output includes `topic_module_used` and `failed_at_step` (now free text)

No change to the critic logic. No change to the confidence calculation. The topic knowledge simply makes the grader's step 1 (understand the problem) deeper.

---

## 7. Feedback Loop — Simplified

### HTTP method note

HTML forms only support `GET` and `POST`. When a browser form says `method="POST"`, it submits a POST request. There is no native HTML support for `PUT` or `PATCH`.

In REST API design:
- **POST** — submit an action or create a resource when the ID is not yet known
- **PUT** — replace a resource entirely at a known ID (idempotent; omitting a field clears it)
- **PATCH** — partially update a resource at a known ID (idempotent; only the sent fields change)
- **GET** — read only, no side effects

For the feedback route, we are **partially updating** an existing `ta_grades` row (setting `status`, adding `henry_score`, `henry_comment`) — not replacing it entirely. The correct method is **PATCH**:

```
PATCH /api/ta/grade/[id]
Body: { henry_score, henry_comment, henry_step_correction, lesson_type }
```

### Collision handling

Two teachers could theoretically PATCH the same `ta_grades` row simultaneously, or Henry could double-click. The design uses **optimistic locking via status guard** — no version counter needed because the status transition is one-directional (`pending` → terminal state).

The PATCH handler executes:

```sql
UPDATE ta_grades
SET status = 'accepted', henry_score = ?, reviewed_at = now(), reviewed_by = ?
WHERE id = ? AND status = 'pending'
```

If `0 rows updated` → the row was already resolved by a concurrent request. The handler returns `409 Conflict` with body `{ error: 'already_resolved', current_status: 'accepted' }`.

The UI on receiving 409 shows: *"This grade was already reviewed. Reload to see the current state."*

This also naturally prevents the correction-log append from happening twice — the append only occurs when the UPDATE succeeds (1 row affected).

**Double-click protection on the frontend:** the "Accept" and "Override" buttons are disabled immediately on first click (set `loading = true`), so duplicate requests from the same user are already prevented client-side. The 409 guard is server-side protection for the multi-teacher case.

When Henry overrides a grade, the correction log entry is extended with:

```markdown
### Correction #N — [date]
**Topic module**: equation-solving
**AI's understanding of the problem**: [from step1_math_understanding]
**AI's read of the student**: [from step2_student_approach]
**AI's failed_at_step**: [what the TA said went wrong]
**Henry's grade**: X/Y
**Henry's note**: [Henry's actual comment]
**What the TA missed**: [Henry fills this in when overriding]
```

The `what_the_TA_missed` field is what drives knowledge improvement. When 5+ corrections accumulate for a topic, the system proposes an addition to `math-knowledge.md` or `grading-rules.md` — not as a new sub-type rule, but as a new question to ask or a new habit to carry. Henry approves or edits.

---

## 8. Accuracy Validation — Same Structure, Revised Framing

The test dataset and eval script remain the same. The key change is what "accuracy" means at the detailed level:

- **Grade accuracy**: does the TA's score match Henry's? (primary metric, 95% target)
- **Comment quality**: does the TA's suggested comment follow Henry's pattern of acknowledge → question → suggest? (qualitative review, not automated)
- **`failed_at_step` quality**: does the TA's free-text description of where the student went wrong match Henry's actual comment? (qualitative review, helps improve the knowledge files)

The 95% gate on grade accuracy remains unchanged as the condition for expanding to new topics.

---

## 9. Implementation Order

1. **Write `math-knowledge.md`** for equation-solving — as mathematical intuition, questions to ask, and Henry's habits. This is the hardest and most important step.
2. **Write `grading-rules.md`** for equation-solving — extracted from the correction log, grounding Henry's comment style and grading behavior in real examples.
3. **Build the test dataset** — 20+ labeled cases from the existing correction log.
4. **Update the grading route** — minimal changes: topic classifier, prompt assembly, `topic_module_used` / `failed_at_step` in output.
5. **Run eval** — measure baseline accuracy.
6. **Iterate on the knowledge files** based on which cases fail — adjust the questions, add habits, until 95% is reached.
7. **Build feedback route** — step-level correction capture for ongoing improvement.


---

## 10. The Anqi Critique Agent — Two-Agent Architecture

### 10.1 How Anqi's brain works

Anqi asks questions differently from most people. When Anqi sees a student's answer — even a correct one — the first instinct is not to verify the answer, but to probe *whether the student actually understands what they did*. The questions Anqi asks are:

- **Does the student understand *why* this works, or did they just follow a procedure?**
  A student who writes `a=1, a=2, a=3` has the right answer. But do they know *why* each factor being zero is the condition? Anqi would ask: "主要就是其中一個要是0 — but can you tell me why that's true?"

- **Did the student make a lucky guess or a sound argument?**
  A numerically correct answer with no reasoning gets challenged: "You got the right number — walk me through how you got there."

- **Is there a simpler way to see this?**
  Even for correct solutions, Anqi looks for the cleaner path: "Your way works — but what if you treated `1/a` as a single unknown?"

- **What happens at the boundary?**
  Anqi always pushes to the edge case: "b can be any number, you said — can b be zero?"

- **Can you generalize?**
  Anqi asks students to extend: "This works for (a-1)(a-2)(a-3). What about (a-1)(a-2)(a-3)(a-4)?"

This is the mindset the Critique Agent embodies. It doesn't check the math again — the TA already did that. It asks: *is the TA's grade and comment the kind of response that actually helps the student grow?*

---

### 10.2 The Two-Agent Architecture

The grading pipeline now has two sequential GPT calls:

```
Student submission
       ↓
  ┌────────────┐
  │  TA Agent  │   Call 1: solves the problem, reads the student,
  │            │   grades based on math-knowledge + grading-rules
  └─────┬──────┘
        │  draft grade + reasoning + suggested comment
        ↓
  ┌─────────────────┐
  │  Anqi Critique  │   Call 2: reads the TA's output and asks
  │  Agent          │   "is this the right call? is this comment
  │                 │   actually helpful? what did the TA miss?"
  └─────┬───────────┘
        │  critique + revised grade (if changed) + improved comment
        ↓
   Final output shown to Henry
```

The two agents have **different system prompts and different jobs**. The TA Agent knows how to solve equations and knows Henry's grading style. The Anqi Critique Agent doesn't re-grade the math — it interrogates whether the TA's *reasoning and response* are genuinely useful.

---

### 10.3 Anqi Critique Agent — What It Does

The Critique Agent receives:
- The problem statement
- The student's submission
- The TA's draft grade, reasoning, and suggested comment

It then runs through Anqi's question set:

**Q1: Did the TA understand what the student was actually trying to do?**
Read the submission charitably. Is there a reasonable interpretation the TA missed? If the student wrote something brief, did the TA assume incompetence instead of considering they might have understood the core idea concisely?

**Q2: Is the grade proportional to the actual gap?**
If the TA said "missing one case" but gave 1/3 instead of 2/3, that's disproportionate. If the student showed the right method but made a small slip, was partial credit given appropriately?

**Q3: Does the comment actually help the student take the next step?**
A good comment leaves the student with a clear *next action*. "不太对喔" (not quite right) is not helpful. "除以b是一個很棒的想法!! 但是....還有一種可能....是不能除以b的" is helpful — it names the good idea and points to the gap. Does the TA's comment do this?

**Q4: Is there a more interesting question to ask?**
Anqi doesn't just correct — Anqi extends. Can the comment include a nudge toward a deeper insight? "You found a=1,2,3 — can you see why there couldn't be a 4th solution?"

**Q5: What would a student who read this comment do next?**
Concretely imagine the student reading the TA's comment. What would they do? If the answer is "feel confused" or "resubmit the same thing", the comment needs revision.

---

### 10.4 Critique Agent Output and Feedback Loop

The Critique Agent outputs:

```json
{
  "upheld": true | false,
  "grade_revision": null | { "new_score": 2, "reason": "..." },
  "comment_assessment": "helpful" | "too_vague" | "too_direct" | "misses_opportunity",
  "revised_comment": "...",
  "anqi_question": "The question Anqi would ask to deepen the student's understanding",
  "what_ta_missed": "..." | null
}
```

If `upheld = false`, the revised score and `revised_comment` replace the TA's output in what Henry sees.

If `upheld = true` but `comment_assessment != 'helpful'`, Henry sees both the TA's original comment and the Critique Agent's `revised_comment`, and can choose which to post.

The `anqi_question` is always surfaced to Henry — it's an optional deeper question Henry can choose to add to his comment if he wants to extend the student's thinking beyond the immediate correction.

---

### 10.5 Why Two Separate Agents, Not One

The TA Agent and Critique Agent have fundamentally different orientations:

- The **TA Agent** is in "assessment mode" — it has math knowledge, it follows the grading protocol, it looks for what the student got right and wrong relative to a correct solution.

- The **Critique Agent** is in "teacher mode" — it doesn't care about the rubric, it cares about whether this response will actually help the student learn. It asks Anqi's questions.

Putting both in one prompt produces a compromise that does neither well. The separation is what makes the critique genuinely adversarial — the Critique Agent starts from a different orientation and is explicitly trying to find flaws in the TA's response, not validate it.

The existing critic (from the earlier grading route design) challenges the *grade*. The Anqi Critique Agent challenges the *comment and pedagogy*. They are complementary.

---

### 10.6 What Henry Sees

The UI shows a three-tier result:

```
🤖 TA Grade: 2/3  (92% confidence)

   Deviation: Student divided both sides by b but didn't check b=0 case
   
   Suggested comment: "除以b是一個很棒的想法!! 但是....還有一種可能"

🔍 Anqi Review: Grade upheld ✓ | Comment: needs_improvement

   Revised comment: "除以b是一個很棒的想法!! 但是....如果b等於零的話呢? 
                    試試看把b=0代進去原式看看會發生什麼事"
   
   Anqi's deeper question (optional): 
   "如果題目改成 (a-1)b = b²，情況一樣嗎？"

[Accept TA grade + revised comment]  [Customize]  [Dismiss]
```

Henry can accept the combined output, customize any part, or dismiss and grade manually.
