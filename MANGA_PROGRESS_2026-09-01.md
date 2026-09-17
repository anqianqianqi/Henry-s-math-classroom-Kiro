# Manga Agent Progress — 2026-09-01

## Current goal

Build the manga-generation workflow directly inside Henry Math Classroom. An admin selects or feeds in a classroom challenge, reviews the mathematics and story, chooses approved characters, and generates a comic that Henry Math Classroom can read from Supabase.

Only admins may generate comics. Published comics can be consumed by the classroom product.

## Approved workflow

1. Solve and independently verify the challenge.
2. Produce a child-facing math takeaway that teaches a reusable way of thinking, then connect it to the current example.
3. Offer five structurally different story directions:
   - funny
   - warm
   - interactive
   - TikTok-style
   - Instagram short-video style
4. Let the admin choose and revise a story direction.
5. Choose characters from the approved character library and adjust the story to fit their personalities.
6. Review a complete storyboard before image generation.
7. Ask for format and visual style when they are not already specified.
8. Generate separate Chinese and English editions from the same locked storyboard. Only the copy changes; poses, pacing, visual mathematics and answers remain consistent.
9. Run a math and visual-continuity review before publishing.

The default length is adaptive: use 6–18 panels and add pages when more context or intermediate reasoning is needed. Clarity and fun matter more than forcing a six-panel layout.

## Approved characters

### 函宝 / Funbo

- Final English name: **Funbo**.
- A cute deterministic function robot.
- Cream-white rounded capsule body.
- Exactly one sky-blue antenna with a yellow glowing tip.
- Glossy black face screen with yellow eyes.
- Sky-blue three-finger mittens and rounded boots.
- Transparent sky-blue chest chamber.
- Idle chest displays one centered lowercase mathematical `f`.
- For function stories, Funbo treats input like a snack, digests it adorably, and releases the correct output from the chest chamber.
- The lower belly is smooth: **no drawer**.
- Funbo always executes the loaded function correctly but may not understand why the rule works.
- The input/output behavior is used only when it is mathematically appropriate. It must not be forced into unrelated stories.

### Leo

- East Asian boy, visually 10–12 years old.
- Intelligent, quiet, focused, gentle and dependable.
- Soft round face, deep-brown eyes and fluffy black short hair.
- One small upward-curving hair tuft.
- No glasses.
- Plain cream-yellow hoodie with no badge, logo or graphic.
- Deep navy trousers and white sneakers with sky-blue laces.
- Carries a slim sky-blue tablet and white stylus.
- Usually reaches the correct conclusion, notices patterns and explains why.
- Funbo supplies deterministic results; Leo organizes, verifies and explains the reasoning.

## Approved visual and format preference

- Warm, cute, clean children’s manga.
- Hand-drawn ink with soft watercolor and gouache texture.
- Cream paper, sunny yellow, sky blue and gentle pastel panel backgrounds.
- Thin, slightly organic black panel borders and wide warm-white gutters.
- Small yellow numbered circle in the upper-left of each panel.
- Left-to-right, top-to-bottom reading order.
- Minimal backgrounds and props; keep attention on the story and math.
- Use enough dialogue to make the context understandable.
- One story beat, one main action and one math idea per panel.
- Separate Chinese and English editions after storyboard approval.

### Math-prop continuity rule

When props represent different capacities, lengths or sizes, their outer silhouettes must remain visibly and consistently different in every panel. Internal fill level must never change a prop’s physical dimensions. Source, target and movement direction must be explicit.

For the 7 mL / 10 mL tube story:

- A is the shorter 7 mL tube.
- B is the taller 10 mL tube.
- A remains roughly two-thirds to 70% of B’s height.
- In every `A → B` action, the short A is the tilted source and the tall B is the target.

## Prototype workflow test: 7 mL and 10 mL tubes

Challenge: using only “fill A,” “pour A into B,” and “empty B,” measure exactly 5 mL.

The generated prototype found a legal route, but teacher review determined that its primary takeaway did not capture the intended mathematical essence. It is retained as an experiment, not as the approved final teaching design.

Revised primary teaching thesis:

- Translate physical operations into multiples.
- Filling A once adds 7 mL; emptying a full B once removes 10 mL.
- Search for two multiples whose difference is the target:

```text
5 = 7 × 5 - 10 × 3
```

- Five fills of A add 35 mL in total.
- Three emptyings of a full B remove 30 mL in total.
- The fully isolated final state is `(A,B) = (5,0)`, not merely `(5,10)`.

Secondary strategies:

- Work backward from the goal when it helps organize the procedure.
- To leave 5 mL in a full 7 mL tube, 2 mL must pour out.
- Therefore the 10 mL tube must already contain 8 mL, leaving room for exactly 2 mL.
- Record states as `(A,B)`.
- If a state repeats while the same actions repeat, the process is in a loop.

Correct solution path:

```text
(0,0) → (7,0) → (0,7) → (7,7) → (4,10) → (4,0) → (0,4)
→ (7,4) → (1,10) → (1,0) → (0,1) → (7,1) → (0,8)
→ (7,8) → (5,10)
```

The deliberate bad loop used in the story is:

```text
(0,7) → (7,7) → (7,0) → (0,7)
```

Prototype comic assets:

- `public/manga/comics/jug-7-10-find-5-v1-zh-page-1.png`
- `public/manga/comics/jug-7-10-find-5-v1-zh-page-2.png`
- `public/manga/comics/jug-7-10-find-5-v1-en-page-1.png`
- `public/manga/comics/jug-7-10-find-5-v1-en-page-2.png`

English character cards:

- `public/manga/character-cards/hanbao-introduction-card-v1-en.png` — displays the approved English name Funbo.
- `public/manga/character-cards/leo-introduction-card-v1-en.png`

## Supabase status

The earlier manga SQL was run by the user. The following new migrations still need to be applied to that existing Supabase database:

1. `supabase/migrations/20260901_rename_hanbao_english_name_to_funbo.sql`
2. `supabase/migrations/20260901_add_math_prop_continuity_preference.sql`

The first migration changes the stable 函宝 character record and all relevant character-bible references from `F-Bao` to `Funbo`. The second persists the math-prop scale and direction rule.

## Verification

- `lib/manga/__tests__/domain.test.ts`: 2 tests passed.
- Final tube comic was visually checked for the complete state sequence, explicit `A 倒入 B` labels, the required `(0,1)` state, source/target direction and different A/B tube heights.

## Architecture planning update — 2026-09-03

The approved next direction is a specialist multi-agent workflow with independent self-critique for mathematics, pedagogy, story ideas and storyboards. Whole-page image generation will be replaced by versioned, text-free, single-panel generation plus deterministic bilingual overlays and page composition.

See `MANGA_MULTI_AGENT_ARCHITECTURE.md` for the agent boundaries, prompt deliverables, model-routing recommendation, persistence design, evaluation plan and implementation phases.

## Git status and next step

The latest Funbo rename, tube comic assets, English cards, prop-continuity preference and two new Supabase migrations are currently **not committed**.

Older untracked draft assets also remain in the working tree and should not be included automatically:

- `public/manga/characters/hanbao-v1-character-sheet.png`
- `public/manga/characters/hanbao-v2-chest-output-character-sheet.png`
- `public/manga/comics/base-5-444-workflow-test-v1.png`

Recommended next session:

1. Review this progress file and the four final tube-comic pages.
2. Apply the two pending Supabase migrations.
3. Commit only the approved workflow changes and final assets, excluding obsolete drafts unless they are intentionally retained.
4. Continue with the next challenge through the full interactive workflow.
