# Henry Math Classroom Manga — Multi-Agent Architecture Plan

Status: approved planning direction, implementation not started  
Date: 2026-09-03

## 2026-09-04 approved target interaction (supersedes future manual gates below)

The administrator's primary conversation is with the **Math Takeaway Agent**, a user-facing entry point combining mathematical reasoning and pedagogy discussion. Other specialists should become stable background executors rather than require routine turn-by-turn interviews. This is the desired end state, NOT a claim that autonomous orchestration is implemented or validated.

Target: challenge → discuss and approve teaching thesis → background story, storyboard, bilingual copy, panel art, composition and independent QA → administrator reviews the complete comic. Keep final publication an explicit admin action. The existing runtime approval gates remain unchanged until deliberately implemented and tested.

The main agent hands off a locked teaching contract: problem constraints and assumptions, verified solution, transferable thinking strategy, cognitive steps, prerequisites, misconceptions, example mapping, and necessary visible intermediate states. Background agents cannot silently alter that contract. They self-critique and revise within bounds; unresolved ambiguity, a proposed teaching-goal change, or repeated revision failure returns to the Math Takeaway conversation. Human overrides remain available at every stage.

The contract must explicitly separate `givenRules` from `mathTakeaway`. A condition that constrains the solution belongs in the story setup and correctness checks; it is not automatically a transferable lesson. The critic rejects takeaways that merely restate the prompt's allowed operations.

Downstream responsibilities: Story (engagement and context), Storyboard (causal and state continuity), Language (natural matching English/Chinese), Image & Layout (approved characters, large typography, editable overlays, assembled pages), independent stage-specific Critic (math, pedagogy, visual and bilingual checks). Logical roles need not mean separate deployments or models.

Continue console experiments on varied problems before calling these agents stable. Persist preferences, approved examples, rejected shortcuts and regression criteria, not just prompts. See [latest checkpoint](MANGA_PROGRESS_2026-09-04.md).

## Product outcome

An administrator selects a Henry Math Classroom challenge and works through a deliberate, reviewable process that identifies the mathematical essence, turns it into an engaging story, generates editable panel-level artwork, produces matching Chinese and English editions, and publishes the approved comic through Supabase.

The product is not merely a collection of LLM prompts. Its deliverables are:

1. Versioned agent instruction prompts.
2. Strict JSON input/output contracts for every call.
3. A state-machine orchestrator with approval gates and dependency invalidation.
4. Independent creator, critic and revision calls.
5. Persistent teaching decisions, preferences, character bibles and critique history.
6. Per-stage model routing and reasoning configuration.
7. Evaluation fixtures, scoring rubrics and regression tests.
8. Panel-first image generation with no baked-in prose.
9. Deterministic speech-bubble, math, translation and page composition.
10. Admin review UI and Supabase publication integration.

## Architecture decision

Split the workflow into specialist logical agents, but keep them in the existing Henry Math Classroom application. An agent is initially a separately configured LLM call with a focused prompt and strict contract, not a separately deployed service.

```text
Manga Orchestrator (deterministic application code)
├── Math Reasoning Agent
├── Pedagogy Agent
├── Story Agent
├── Storyboard Agent
├── Panel Art Agent
└── Quality Critic Agent with stage-specific modes
```

Creation, critique and revision must be independent calls even when they use the same underlying model.

## Workflow and approval gates

```text
Trusted challenge input
  → Math Reasoning draft
  → Math correctness critique
  → Math revision
  → Pedagogy essence candidates
  → Pedagogy critique
  → Pedagogy revision and teacher discussion
  → Gate 1: teacher approves the teaching thesis
  → Five story ideas
  → Idea critique
  → Idea revision
  → Gate 2: admin selects an idea
  → Character selection and story adjustment
  → Structured storyboard
  → Storyboard critique
  → Storyboard revision
  → Gate 3: admin approves every panel specification
  → Generate each panel as separate, text-free art
  → Per-panel visual critique and selective regeneration
  → Gate 4: admin approves panel art
  → Deterministic Chinese and English text overlays
  → Deterministic page composition
  → Final math, visual and bilingual QA
  → Publish to Supabase
```

## Agent responsibilities

### 1. Math Reasoning Agent

Goal: produce correct, independently verified mathematics without deciding the story.

Required output:

- answer;
- assumptions and ambiguities;
- legal solution steps;
- alternative solution methods;
- verification;
- mathematical representations;
- prerequisite concepts;
- likely student misconceptions.

It must distinguish a valid procedure from an explanation of why the procedure works.

### 2. Pedagogy Agent

Goal: decide what the challenge can teach a child.

It proposes multiple candidate teaching essences rather than one generic takeaway. Each candidate includes:

- underlying mathematical structure;
- real-world-action-to-math translation;
- cognitive leap;
- reusable thinking strategy;
- connection to the current example;
- age and prerequisite fit;
- visual teachability;
- misconception risks;
- whether it is the primary thesis, a secondary strategy or teacher-only background.

For the 7 mL / 10 mL challenge, the approved direction to test is:

```text
Fill A once        = +7
Empty a full B once = -10
5 = 7 × 5 - 10 × 3
```

Primary teaching thesis: translate repeated physical actions into multiples and find the difference between two multiples. State tracking and working backward may remain secondary strategies, not the central lesson.

### 3. Story Agent

Goal: create five genuinely different, engaging story ideas that express the approved teaching thesis.

Prefer vivid story mechanisms over characters narrating an experiment. When mathematically faithful, personify or dramatize the problem objects so their actions embody the approved teaching thesis and generate the humor (for example fixed water units as passengers). Always state the mapping and preserve object counts, legal directions and stopping conditions; the critic rejects metaphors that are only decoration or corrupt the model.

The Story Agent may not redefine the mathematics. Each idea must identify its hook, character roles, math integration, visual opportunity, estimated panel count and misconception risks.

### 4. Storyboard Agent

Goal: convert the selected story into a complete panel-level specification.

Each panel records:

```ts
{
  panelIndex: number
  teachingPurpose: string
  beforeState?: unknown
  action?: string
  afterState?: unknown
  visualAction: string
  dialogueZh: string[]
  dialogueEn: string[]
  mathOverlay: string[]
  characters: CharacterDirection[]
  props: PropDirection[]
  invariants: string[]
}
```

Any mechanically checkable transition must be validated in application code before image generation.

### 5. Panel Art Agent

Goal: create one text-free panel illustration at a time.

It receives only the approved visual description, character reference assets, prop invariants and composition needs. It does not solve mathematics, translate copy, render formulas or compose pages.

### 6. Quality Critic Agent

The Critic uses independent calls with a mode-specific rubric:

- `math_correctness`
- `pedagogy_essence`
- `idea_quality`
- `storyboard_logic`
- `panel_visual`
- `bilingual_consistency`
- `final_comic`

The Critic returns evidence, scores, blocking findings, required revisions and one verdict: `ready`, `revise` or `reject`.

Critical math errors always reject. A missing teaching thesis or illegal storyboard transition always requires revision. Automatic creator/reviewer loops stop after two revisions and return unresolved issues to the admin.

## Self-critique contracts

### Pedagogy critique questions

1. Is this a solution step or the mathematical essence?
2. What underlying structure explains why the solution works?
3. How are physical actions translated into mathematical representations?
4. What is the real cognitive leap?
5. Can the student reuse this thinking on another problem?
6. Is a secondary tactic being mistaken for the main lesson?
7. Does the current example genuinely demonstrate the proposed principle?
8. Is the idea appropriate for the stated grade and prerequisites?
9. What misconception could this explanation create?
10. Can a comic show the concept clearly?

### Idea critique dimensions

- teaching-essence fidelity;
- mathematical clarity;
- story completeness;
- character fit;
- child appeal;
- originality relative to the other four ideas;
- visual potential;
- unnecessary content;
- misconception risk.

### Storyboard critique dimensions

- complete setup, reasoning and resolution;
- no missing transitions;
- legal before/action/after states;
- one primary beat per panel;
- explicit source, target and motion direction;
- stable character and prop invariants;
- dialogue and image communicate the same claim;
- sufficient context for a first-time learner;
- bilingual text can fit without changing the art;
- no forced use of a character mechanism when it is mathematically irrelevant.

## Prompt strategy

Each agent has three separately versioned prompt types where applicable:

```text
creator prompt
critic prompt
revision prompt
```

Prompt tuning means improving the full call configuration:

- instructions and success criteria;
- supplied context and retrieved memories;
- strict output schema;
- examples and counterexamples;
- critique rubric and thresholds;
- model and reasoning effort;
- temperature or equivalent controls when supported;
- retry and stopping policy.

Do not duplicate the JSON schema as prose inside the prompt. Keep stable instructions before dynamic challenge context so caching remains possible. Use representative evals rather than judging a prompt from one successful output.

This phase does not require fine-tuning model weights. Fine-tuning should be considered only after a sufficiently large set of approved examples and repeated prompt-level failure patterns exists.

## Initial model-routing recommendation

Model choices are configuration defaults, not permanent hard-coded decisions. Every role must support an environment-variable override and be evaluated on quality, latency and cost.

| Stage | Initial model profile | Reasoning | Rationale |
|---|---|---:|---|
| Math reasoning | `gpt-5.6-sol` | high | Quality-critical mathematical analysis and alternative representations |
| Math correctness critic | `gpt-5.6-sol` | high | Independent verification should not be the cheapest stage |
| Pedagogy candidate generation | `gpt-5.6-sol` | high | Identifying the teaching essence requires the deepest judgment |
| Pedagogy critic/revision | `gpt-5.6-sol` | high | Central product value and teacher-facing discussion |
| Story ideas | `gpt-5.6-terra` | medium | Balanced creativity, instruction following and cost |
| Idea critic/revision | `gpt-5.6-terra` | medium | Structured critique over already approved mathematics |
| Storyboard | `gpt-5.6-terra` | high | Needs detailed continuity and constrained planning |
| Storyboard critic | `gpt-5.6-sol` | high | Final semantic gate before paid image generation |
| Translation/copy fitting | `gpt-5.6-luna` | low | High-volume, bounded transformation with deterministic QA |
| Panel illustration | `gpt-image-2` | n/a | Dedicated image generation/editing model |
| Page composition | no LLM | n/a | Deterministic HTML/SVG/Canvas renderer |
| Orchestration/state transitions | no LLM | n/a | Deterministic application logic |

For a less expensive MVP, start all text creation and critique stages on `gpt-5.6-terra`, then promote only Math, Pedagogy and pre-image Storyboard Critique to `gpt-5.6-sol` when evals show a meaningful gain. Translation can move to `gpt-5.6-luna` after exact-content regression tests exist.

Suggested configuration keys:

```text
OPENAI_MANGA_MATH_MODEL
OPENAI_MANGA_MATH_CRITIC_MODEL
OPENAI_MANGA_PEDAGOGY_MODEL
OPENAI_MANGA_PEDAGOGY_CRITIC_MODEL
OPENAI_MANGA_STORY_MODEL
OPENAI_MANGA_STORY_CRITIC_MODEL
OPENAI_MANGA_STORYBOARD_MODEL
OPENAI_MANGA_STORYBOARD_CRITIC_MODEL
OPENAI_MANGA_TRANSLATION_MODEL
OPENAI_MANGA_IMAGE_MODEL
```

The current implementation uses one `OPENAI_TEXT_MODEL` value and defaults to `gpt-4o-mini`; implementation must replace that single routing decision with per-stage profiles.

OpenAI's current guidance recommends the Responses API for reasoning and multi-turn workflows, intentional reasoning-effort selection, strict Structured Outputs, and benchmarking model/effort combinations on representative tasks. It identifies `gpt-5.6-sol` as the flagship profile, `gpt-5.6-terra` as the balanced profile and `gpt-5.6-luna` as the efficient high-volume profile. See the [official model guidance](https://developers.openai.com/api/docs/guides/latest-model) and [current model catalog](https://developers.openai.com/api/docs/models/all).

## Persistence model

Persist only explicit approvals as durable behavior. Suggested or inferred preferences remain candidates until approved.

### Durable categories

1. Non-overridable house rules.
2. Approved teaching principles.
3. Approved visual preferences.
4. Approved storytelling preferences.
5. Versioned character bibles.
6. Problem-family teaching strategies.
7. Challenge-specific facts and constraints.
8. Teacher decisions with rationale.
9. Creator, critique and revision artifacts.

Every persisted item includes:

```ts
{
  scope: 'global' | 'grade' | 'math_domain' | 'problem_family' | 'project' | 'challenge'
  status: 'candidate' | 'approved' | 'rejected' | 'deprecated' | 'superseded'
  source: 'explicit_user' | 'agent_suggestion' | 'system'
  version: number
  rationale: string
  supersedesId?: string
  createdAt: string
  updatedAt: string
}
```

The system must save both approved choices and meaningful rejections. For example, the earlier decision to use state tracking as this challenge's primary essence should be retained as rejected with the rationale that it solves the procedure but misses the multiples structure.

### Precedence

```text
House rules
  → approved character bible
  → approved global/teacher preferences
  → problem-family principles
  → project preferences
  → challenge facts
  → panel instructions
```

Mathematical facts always outrank style preferences.

## Panel-first rendering

- Generate one panel at a time.
- Save text-free art separately from content.
- Give every panel its own version and approval status.
- Regenerate only invalidated panels.
- Render dialogue, equations, state labels, arrows, panel numbers and page numbers deterministically.
- Reuse identical art for Chinese and English output.
- Compose pages after all panel art is approved.

Dependency invalidation examples:

- Rename Funbo: rerender text overlays only.
- Change one line of dialogue: rerender that language's overlay only.
- Change one panel action: invalidate that panel art and downstream visual QA only.
- Change the teaching thesis: invalidate story ideas, storyboard and all downstream artifacts.
- Change a character's visual anchor: invalidate only panels containing that character.

## Evaluation plan

Create a small gold dataset before optimizing models:

- function input/output challenge;
- number-base challenge;
- 7 mL / 10 mL operation challenge;
- geometry visualization challenge;
- ambiguous or under-specified challenge;
- one challenge where the obvious procedure is not the teaching essence.

For each example, store teacher-approved math, teaching thesis, rejected alternatives, story rubric, storyboard constraints and expected QA findings.

Compare configurations using:

- mathematical correctness;
- teaching-essence agreement with the teacher;
- critique recall;
- revision success rate;
- number of human corrections;
- latency to first reviewable artifact;
- image calls per approved panel;
- total cost per published comic.

Do not choose the final model by reputation alone. Promote or downgrade each stage based on these evals.

## Implementation sequence

1. Define the new schemas and persistent teaching-decision tables.
2. Add the Orchestrator state machine and invalidation rules.
3. Implement Math Creator → Critic → Revision.
4. Implement Pedagogy Candidate → Critic → Revision → teacher discussion.
5. Implement Idea and Storyboard critique loops.
6. Add per-stage model profiles and observability.
7. Replace whole-page generation with versioned text-free panels.
8. Build deterministic bilingual overlay and page composition.
9. Add QA and regression fixtures.
10. Rebuild the 7 mL / 10 mL comic as the first acceptance test.

## Acceptance criteria

- The primary teaching thesis is explicitly approved before story creation.
- Math, Pedagogy, Ideas and Storyboards retain critique artifacts and revisions.
- A one-panel change never regenerates another approved panel.
- A copy or character-name change never calls the image model.
- Chinese and English editions reuse identical panel art.
- Every mechanically checkable storyboard transition passes deterministic validation.
- Preferences and teaching principles are versioned and scoped.
- The 7 mL / 10 mL comic clearly teaches `5 = 7 × 5 - 10 × 3` and ends with the third full-B emptying operation, leaving `(A,B) = (5,0)`.
