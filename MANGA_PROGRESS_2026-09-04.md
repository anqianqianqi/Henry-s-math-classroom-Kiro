# Manga checkpoint — 2026-09-04

## Approved direction

User accepted the revised two-page English water-tube manga as a good example. Next: test a new question in this conversation, starting with mathematical essence and pedagogy, not immediate image generation. The user has not supplied the new question yet.

Desired end state: mainly discuss with Math Takeaway Agent. After teaching approval, stable background story, storyboard, language, image/layout and critique agents execute without routine interruptions; return important decisions and unresolved failures to the main conversation. Final admin review/publication remains explicit. Architecture update is planning, not deployed functionality.

## Saved accepted outputs

- [English page 1, revised 8a–8c](public/manga/comics/water-7-10-panels/water-page-01-en-manga-v5.png)
- [English page 2](public/manga/comics/water-7-10-panels/water-page-02-en-v1.png)
- [Page 1 prompt and QA](public/manga/comics/water-7-10-panels/water-page-01-en-manga-v5.prompt.md)
- [Page 2 prompt](public/manga/comics/water-7-10-panels/water-page-02-en-v1.prompt.md)

Preserve previous versions, panel sources and render scripts. These final previews are generated flat raster pages, NOT fully editable layered masters. Earlier page-one SVGs have editable dialogue and labels. Panel-first art plus deterministic overlays remains the production target; the user's complete-page console previews are an exception. No Chinese version of this final pair is completed. No Supabase upload or Git commit/push is implied by this checkpoint.

## Teaching contract for the water example

A holds 7 mL; B holds 10 mL. No graduations. Allowed: fill A, pour A into B until A empty or B full, empty B completely. Agreed target: all positive integer amounts below 10 in B. The chosen strategy refills only empty A and empties only full B; these are strategy choices, not extra problem restrictions.

Teach converting physical actions into arithmetic: cumulative water remaining after A is empty is 7n − 10m, where n counts full refills from empty and m counts full-B dumps, starting from both empty. Example: 5 × 7 − 3 × 10 = 5. Reachable B sequence: 7,4,1,8,5,2,9,6,3,0. Thus every positive integer 1–9 is reached. Do not reuse the formula without its conditions.

Narrative: try → notice a tentative pattern → test and disprove 'always 3 less' at 1+7=8 → count input/output → predict and verify → find all. Do not make Leo deliver a fully known lecture from the beginning.

## Durable preferences and acceptance checks

- Cute Japanese children's manga: clean expressive outlines, cream and soft pastel colors, minimal background clutter, varied shots and expressions.
- Usually two assembled pages; completeness and readability take priority over a fixed panel count.
- Large bold near-black dialogue and labels readable at whole-page display size. The user requested enlargement twice; do not revert to tiny copy to fit a panel.
- Natural action-driven dialogue, not worksheet text, ad copy, or long teacher monologues.
- Funbo/函宝: curious cream-and-blue robot, one yellow-ball antenna, blue chest with lowercase f; no forced eating in non-function stories. Leo: calm smart boy in yellow hoodie. Use approved character references.
- Story must establish the objective, constraints, result location and success criterion without requiring the original worksheet.
- Never hide an unlearned reasoning step behind 'repeat' or 'one more try'. Show initial state, operation, reason, and resulting state; expand the layout when needed.
- Concrete regression: panel 8 must explain B4 needs6; A7 pours6 leaving A1/B10; empty B then transfer A's last1 to get A0/B1. Approved strip uses 8a–8c.
- Check labels against water levels, source-to-target stream direction, full/empty states, and stable physical tube sizes. A must be shorter than B. Bottom-strip height differences remain imperfect in the accepted raster; retain as a known visual limitation, not a gold-standard geometry fixture.
- Generate Chinese and English from one approved storyboard; inspect each language's line breaks and meaning.
- Math, idea, storyboard and visual stages need self-critique, correction and persistent failure examples. Stability must be evaluated across varied questions, not inferred from one good comic.
- Separate **given conditions** from the **transferable Math Takeaway**. Operational rules must be introduced clearly enough to understand the story, but must not be presented as the lesson merely because the solution must obey them. Water-babies regression: forced alternation `A→B:1`, `B→A:2` is given; the takeaway is grouping a complete repeated round and finding its net change. Do not promote “record the next action” as the takeaway for this example.
- Make stories more vivid than a dressed-up experiment. Prefer a natural personification or active visual metaphor when it makes the mathematical structure tangible: in the 5/7 example, six fixed units of water became six water-baby passengers, and the return trip created both the joke and the `−1+2` discovery. The metaphor must be explicitly mapped back to the problem and preserve counts, directions and stopping rules. Reject decorative duplicate countable objects; generated seat/passenger counts require deterministic visual QA.

## Next experiment

Ask for the new problem (text or image). First verify the mathematics, discuss alternative teaching takeaways and agree on what thinking the child should learn. Apply the stored defaults automatically. Do not begin artwork until the teaching direction and story are ready.
