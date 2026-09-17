# Step 3 — Story Brainstorm Agent Output

## Status: READY FOR HENRY'S REVIEW
*(Full self-critique loop completed — v2: surface + logic + downstream alignment all passed)*

---

## Agent Inputs
- Challenge: Which is the Smallest? A.2100  B.550  C.375  D.460  E.740
- Core concept: Count digits first — a number with more digits is always larger, no matter what those digits are
- Student insight (story payoff line): "Wait — 2100 has FOUR digits! 1000 is the smallest 4-digit number, so 2100 is at least a thousand. But the others only have three digits — they're all less than 1000. So 2100 is actually the BIGGEST!"
- Teaching angle: The 99 vs 100 forcing question — digit count is the first filter
- Story hook options: price tags, leaderboard scores, sticker/collection counting

---

## Self-Critique Log

**v1 flaws fixed in v2:**
- ❌ Pitch 1: character was corrected by someone else — not a self-discovery moment → rewritten so character catches the mistake themselves
- ❌ Pitch 2: math was incidental to the story — game outcome was the real tension → replaced with a setup where digit-count is the entire dramatic pivot
- ❌ Pitch 3: scenario too vague — "trade goes wrong" with no specifics → tightened to show exactly what wrong decision was made and the realisation moment
- ❌ All `why_it_works` fields didn't tie back to `core_concept` explicitly → each now explains how the story makes digit-count feel obvious
- ❌ All scenarios too sketchy for Agent 4 to write from → each now has who + what they're doing + where the math appears + the specific wrong moment

---

## Agent Output (v2 — final)

```json
{
  "pitches": [
    {
      "title": "Mochi's Bargain Blunder",
      "character": "Mochi, a young bear chef who runs a tiny dessert stall and is always hunting for the cheapest ingredients",
      "scenario": "Mochi needs to buy sugar and finds five suppliers with these prices: 2100, 550, 375, 460, and 740 gold coins per bag. She scans the tags quickly, spots the '2' at the start of 2100, and confidently grabs that bag — 'smallest first digit, best deal!' she thinks. At the checkout she counts out her coins and realises she's massively overpaid. She stares at the price tag. Then she counts the digits. One... two... three... FOUR. Her stomach drops. 2100 is four digits — it's over a thousand coins. The 375 bag with its quiet little '3' was sitting right there the whole time.",
      "why_it_works": "Mochi starts with a skill that usually works — leading-digit scanning — and applies it one step too early, before checking digit count. Her self-correction ('I counted the digits') models exactly the core concept without anyone explaining it to her. The story makes 'count digits first' feel like an obvious thing Mochi should have done, because the consequences of skipping it are immediate and funny."
    },
    {
      "title": "Zara's Worst Broadcast",
      "character": "Zara, a 12-year-old junior esports commentator who hosts a weekly livestream ranking players on her favourite game",
      "scenario": "Zara is live on stream, reading out this week's scores: 2100, 550, 375, 460, and 740 points. She glances at the first digits and announces confidently: 'And the LOWEST scorer this week — most improved needed — is the player with 2100 points, because 2 is the smallest!' Her chat immediately explodes. Hundreds of viewers type '???' and 'ZARA NO'. She freezes, looks again. Slowly counts: 2-1-0-0. Four digits. Her face goes red. 'Oh. OH. That's two thousand one hundred. That's actually... the highest score.' Dead silence. Then she bursts out laughing.",
      "why_it_works": "The livestream format means Zara's mistake is public and instant, which creates comedic tension students will enjoy. Her chat reacting in real time mirrors the student experience of 'everyone can see I got it wrong.' The realisation ('four digits — that's two thousand') is spoken aloud so the core concept is dramatised, not just implied. The self-correction is Zara's own — nobody teaches her, she figures it out herself under pressure."
    },
    {
      "title": "The Witch's Ingredient Mixup",
      "character": "Pip, an apprentice witch whose job is to find the ingredient her master needs in the smallest quantity — because too much of certain ingredients makes potions explode",
      "scenario": "Pip checks the ingredient store. Five jars are labelled with how many drops they contain: 2100, 550, 375, 460, and 740. She needs the jar with the least. She spots '2' first and grabs the 2100 jar — 'smallest number starts with 2, this must be the least!' She tips it into the cauldron. The potion immediately turns bright purple and starts bubbling violently. Her master rushes in. 'You used over TWO THOUSAND drops!' Pip looks at the jar. Counts the digits. Four. She counts the other jars. All three digits — all under a thousand. The 375 jar was right there, quietly being the actual smallest.",
      "why_it_works": "The stakes (potion explosion) make the consequence of the digit-count error feel real and memorable. The scenario requires Pip to state her reasoning out loud ('smallest number starts with 2') which names the exact wrong shortcut. Her correction involves physically counting digits on the jar label, which is a concrete action students can picture doing themselves. The core concept — digit count before digit value — is demonstrated through consequence, not instruction."
    }
  ]
}
```

---

## Henry's Decision

**You need to pick one pitch.** This becomes the story Agent 4 builds the entire Mega around.

| | Pitch | Character | Vibe |
|---|---|---|---|
| A | Mochi's Bargain Blunder | Bear chef overpays at market | Cosy, relatable, slightly embarrassing |
| B | Zara's Worst Broadcast | Kid esports commentator goes viral for wrong reason | Funny, modern, social media energy |
| C | The Witch's Ingredient Mixup | Apprentice witch nearly explodes a potion | Magical, dramatic, high stakes |

You can also:
- **Edit any pitch** — change the character, setting, or scenario and select it
- **Re-run** — get 3 completely different pitches

---

## Henry's Review
- [x] Selected Pitch A — Mochi's Bargain Blunder
- [ ] Selected Pitch B — Zara's Worst Broadcast
- [ ] Selected Pitch C — The Witch's Ingredient Mixup
- [ ] Selected with edits
- [ ] Re-run requested

## Henry's Selection / Edits
Pitch A selected as-is.

## Approved Output
```json
{
  "selected_pitch": {
    "title": "Mochi's Bargain Blunder",
    "character": "Mochi, a young bear chef who runs a tiny dessert stall and is always hunting for the cheapest ingredients",
    "scenario": "Mochi needs to buy sugar and finds five suppliers with these prices: 2100, 550, 375, 460, and 740 gold coins per bag. She scans the tags quickly, spots the '2' at the start of 2100, and confidently grabs that bag — 'smallest first digit, best deal!' she thinks. At the checkout she counts out her coins and realises she's massively overpaid. She stares at the price tag. Then she counts the digits. One... two... three... FOUR. Her stomach drops. 2100 is four digits — it's over a thousand coins. The 375 bag with its quiet little '3' was sitting right there the whole time.",
    "why_it_works": "Mochi starts with a skill that usually works — leading-digit scanning — and applies it one step too early, before checking digit count. Her self-correction models exactly the core concept without anyone explaining it to her."
  },
  "all_pitches": ["A", "B", "C"]
}
```
✅ Locked.
