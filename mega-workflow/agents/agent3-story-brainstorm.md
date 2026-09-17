# Agent 3 — Story Brainstorm

## Job
Generate exactly 3 story pitches that make the core mathematical concept feel obvious once the story unfolds. Henry picks one. The selected pitch becomes the story Agent 4 builds the entire Mega around.

## Receives
- `challenge_title` (string)
- `challenge_body` (string)
- `step1_output` (approved — specifically `core_trap`)
- `step2_output` (approved — specifically `core_concept`, `student_insight`, `teaching_angle`, `connection_to_prior_knowledge`, `story_hook`)

## Does NOT receive
- The answer directly (agent derives it from step 1)
- Henry's grading style
- Student submission data

## System Prompt
```
You are a creative writer for a children's math classroom. You create fun, imaginative stories that make math feel like an adventure.

Rules for characters:
- Must be imaginative and specific — a talking bear chef, a junior game commentator, an apprentice witch, a robot postal worker — NEVER "a student doing homework" or "a person at school"
- The character must have a job or goal that naturally requires comparing numbers

Rules for scenarios:
- The math trap must arise NATURALLY from the story — the character has a real reason to compare these numbers
- The character must make the wrong decision themselves (using the flawed shortcut), then have the aha moment themselves — nobody corrects them from outside
- The student_insight from step 2 should be expressible as the character's own line
- The story must make the core_concept feel obvious once it unfolds — not explained, demonstrated

Rules for why_it_works:
- Must explain HOW the story makes the core_concept feel obvious
- Must reference what the character's starting skill is (from connection_to_prior_knowledge) and how it backfires

Generate exactly 3 pitches. Make them genuinely different — different genre, character type, and setting.

Output ONLY valid JSON with no markdown fences:
{
  "pitches": [
    {
      "title": "short catchy name (max 5 words)",
      "character": "specific, imaginative, named if possible",
      "scenario": "3-4 sentences: who, what they're trying to do, how the trap appears, the specific wrong decision, the realisation moment",
      "why_it_works": "1-2 sentences: how this story makes the core_concept feel obvious — reference the character's prior skill and how it backfires"
    },
    { ... },
    { ... }
  ]
}
```

## Temperature
0.9 — we want genuine creative variety

## Max tokens
2000

## Output contract
```ts
interface StoryPitch {
  title: string
  character: string
  scenario: string
  why_it_works: string
}

interface Step3Output {
  selected_pitch: StoryPitch   // set by Henry's selection
  all_pitches: StoryPitch[]    // all 3 for reference
}
```

## Example Input (test-run-001)
- core_trap: leading-digit shortcut applied without digit-count check
- core_concept: count digits first — more digits = always larger
- student_insight: "Wait — 2100 has FOUR digits! 1000 is the smallest 4-digit number..."
- story_hook: price tags / leaderboard / sticker collection

## Example Output (approved — test-run-001)
See `test-run-001/step3-story-brainstorm.md` — v2 approved output.

Henry selected **Pitch A — Mochi's Bargain Blunder**:
- Character: Mochi, a young bear chef hunting for the cheapest ingredients
- Scenario: 5 supplier price tags, spots '2' in 2100, grabs it, counts out too many coins at checkout, counts digits, FOUR, stomach drops
- Why it works: character uses leading-digit scan (valid shortcut), applies it before digit-count check, catches mistake herself

## Prompt Improvement Notes
- v1 critique: all 3 pitches had the character corrected by someone else — the character must figure it out themselves
- The `student_insight` from step 2 should be the character's actual line — not paraphrased into narration
- `scenario` must be 3-4 sentences with the specific wrong decision and the realisation beat — "goes to market and buys wrong thing" is not enough
- `why_it_works` must name the prior skill that backfires (from step 2 `connection_to_prior_knowledge`)
