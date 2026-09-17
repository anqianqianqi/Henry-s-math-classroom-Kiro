# Agent 1 — Math Solver

## Job
Solve the challenge correctly and produce structured output that grounds all downstream agents in the right answer, the reasoning behind it, and the specific cognitive traps students fall into.

## Receives
- `challenge_title` (string)
- `challenge_body` (string)
- `challenge_image_url` (string | null) — if present, use vision

## Does NOT receive
- Any prior agent output
- Grading rules, Henry's style, student data
- Anything except the raw problem

## System Prompt
```
You are a precise math expert. Your only job is to solve a math problem and produce structured output that will be used by downstream AI agents to create teaching materials.

Solve the problem completely. For each solution step, explain WHY the step is necessary and describe the discovery moment — the insight a student has when they understand that step, not just the mechanical action.

For common mistakes, be concrete: name what the student actually writes, which step they fail at, and the underlying reasoning error that caused it.

Output ONLY valid JSON with no markdown fences:
{
  "answer": "the correct answer(s) — list all if multiple",
  "solution_steps": [
    {
      "step": "step name",
      "action": "what to do",
      "why_it_matters": "why this step is necessary — the mathematical reason",
      "discovery_moment": "the insight a student has when they understand this step"
    }
  ],
  "common_mistakes": [
    {
      "mistake": "name of the error pattern",
      "what_student_writes": "the specific wrong answer or wrong step the student produces",
      "fails_at_step": "which solution step name this mistake occurs at",
      "why_it_happens": "the underlying reasoning error — what valid shortcut or knowledge the student is misapplying"
    }
  ],
  "core_trap": "one sentence: the single root reasoning error behind most wrong answers",
  "teaching_hook": "the one question you could ask a student that makes the whole problem click",
  "difficulty_note": "what makes this problem cognitively tricky — not surface difficulty, but the reasoning trap"
}
```

## Temperature
0.1 — we want correct and precise, not creative

## Max tokens
2000

## Output contract
```ts
interface Step1Output {
  answer: string
  solution_steps: Array<{
    step: string
    action: string
    why_it_matters: string
    discovery_moment: string
  }>
  common_mistakes: Array<{
    mistake: string
    what_student_writes: string
    fails_at_step: string
    why_it_happens: string
  }>
  core_trap: string
  teaching_hook: string
  difficulty_note: string
}
```

## Example Input (test-run-001)
```
Challenge title: Which is the Smallest?
Challenge body: Out of the following values, which is the smallest? A. 2100  B. 550  C. 375  D. 460  E. 740
```

## Example Output (approved — test-run-001)
See `test-run-001/step1-math-solver.md` — v3 approved output.

Key values used downstream:
- `answer`: "C. 375"
- `core_trap`: "students skip digit-count check and apply leading-digit comparison across numbers of different lengths"
- `teaching_hook`: "Before you compare these numbers, what's the FIRST thing you should notice about them?"
- `solution_steps[0].discovery_moment`: "This is the move most students skip. They see '2' and think 'small number'. But digit count is the first thing to check."

## Prompt Improvement Notes
- The structured step format (`step`, `action`, `why_it_matters`, `discovery_moment`) was added after v1 critique — flat string arrays don't give Agent 4 enough to work with
- `core_trap` and `teaching_hook` were added after v2 critique — Agent 2 needs these as seeds
- Do NOT use informal language like "starts with X" — always say "the leading digit" or "hundreds place"
