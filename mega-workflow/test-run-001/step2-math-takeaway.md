# Step 2 — Math Takeaway Agent Output

## Status: READY FOR HENRY'S REVIEW
*(Full self-critique loop completed — v4: surface + logic + downstream alignment + second pass all done)*

---

## Agent Inputs
- Challenge title: Which is the Smallest?
- Challenge body: Out of the following values, which is the smallest? A. 2100  B. 550  C. 375  D. 460  E. 740
- Step 1 approved output:
  - Answer: C. 375
  - Core trap: students skip digit-count check and apply leading-digit comparison across numbers of different lengths
  - Teaching hook: "Before you compare these numbers, what's the FIRST thing you should notice about them?"
  - 3 concrete mistakes each linked to a specific solution step

---

## Self-Critique Log

**v1 surface flaws fixed in v2:**
- ❌ `core_concept` was a memorisable rule ("you must check digit count") not a mathematical truth → rewritten as a place-value truth
- ❌ `student_insight` used the exact challenge as its example — a student could parrot it without understanding → replaced with a generalising example
- ❌ `teaching_angle` used 9 vs 10 which is too easy and doesn't expose the trap → replaced with 99 vs 100 plus "how did you know?" to force articulation
- ❌ `connection_to_prior_knowledge` was vague ("students know single-digit comparison") → named the specific shortcut that backfires

**v2 logic flaws fixed in v3:**
- ❌ `student_insight` v2 still too abstract/adult → rewritten in a genuine kid's voice
- ❌ `core_concept` v2 was accurate but academic → rewritten as Henry's warm speaking voice
- ❌ `story_hook` field was missing from `Step2Output` type → noted for Phase B type update

**v3 flaws found and fixed in v4 (this version):**
- ❌ `core_concept` was two sentences — second sentence repeated the first — trimmed to one sharp quotable line
- ❌ `student_insight` said "four digits means it's at least a thousand" — correct but asserted, not explained — rewritten so the character reasons through it ("1000 is the smallest 4-digit number, so 2100 is already over 1000...")
- ❌ `teaching_angle` read like a full lesson plan paragraph — Agent 4 would reproduce it verbatim producing a bloated section — stripped to the mechanism and the key question only
- ❌ No `challenge_extension` field — Agent 4's "Challenge Yourself" section had nothing concrete to pull from — added with a specific generalising question for this problem
- ❌ `story_hook` option 3 (map distances) too abstract for a child story — replaced with a more playful option (sticker collection / candy counts)

---

## Agent Output (v4 — final after full critique)

```json
{
  "core_concept": "Before you compare any numbers, count their digits first — a number with more digits is always larger, no matter what those digits are.",

  "student_insight": "Wait — 2100 has FOUR digits! 1000 is the smallest 4-digit number, so 2100 is at least a thousand. But 375, 460, 550, 740 only have three digits — they're all less than 1000. So 2100 can't possibly be the smallest. It's actually the biggest!",

  "teaching_angle": "Write 99 and 100 on the board. Ask which is bigger, then ask HOW they knew without calculating. Students must articulate 'because 100 has three digits and 99 only has two' — this forces them to name the rule themselves. Then show them this problem and ask if the same logic applies.",

  "connection_to_prior_knowledge": "Students already use a valid shortcut: when numbers have the same digit count, compare left to right — 7xx beats 4xx beats 3xx. That shortcut is correct. This problem is specifically designed to catch students applying it before checking digit counts, which is the one case where it breaks.",

  "story_hook": "Three real-world setups where a character naturally encounters numbers of different lengths: (1) Price tags at a market — one item costs 2100 coins, others cost 375, 460, 550, 740 — character scans and confidently picks the wrong cheapest item. (2) Leaderboard scores in a game — one player has 2100 points versus other players' 3-digit scores — character assumes the player starting with '2' is doing badly. (3) A sticker collection — one friend has 2100 stickers, others have a few hundred each — character tries to find who has the least and gets it wrong. Any setup where a character uses the leading-digit shortcut, gets burned, then has the digit-count realisation.",

  "challenge_extension": "What if we added 12000 to the list — does your strategy still work? What's the smallest 5-digit number? What about this list: 99, 100, 98, 101, 97 — same strategy, but now all numbers are close together. Does digit count still help you?"
}
```

---

## Why each field is shaped this way

| Field | Serves | How |
|-------|--------|-----|
| `core_concept` | Agent 4 — Key Insight | One sentence, Henry's voice, quotable, warm |
| `student_insight` | Agent 3 — story payoff line | Child's voice, reasons through *why* not just *what* |
| `teaching_angle` | Agent 3 — story turning point | Mechanism only — the 99 vs 100 moment and the forcing question |
| `connection_to_prior_knowledge` | Agent 3 — character's starting state | Names the exact shortcut so character starts competent, not clueless |
| `story_hook` | Agent 3 — story scenario | 3 concrete child-friendly setups with the trap baked in |
| `challenge_extension` | Agent 4 — Challenge Yourself section | Specific generalising questions, not generic "try more numbers" |

---

## Type Note for Phase B
Two fields added beyond original `Step2Output` schema. Update `lib/mega/types.ts`:
```ts
export interface Step2Output {
  core_concept: string
  student_insight: string
  teaching_angle: string
  connection_to_prior_knowledge: string
  story_hook: string           // ← add
  challenge_extension: string  // ← add
}
```

---

## Henry's Review
- [x] Approved as-is
- [ ] Approved with edits
- [ ] Re-run requested

## Henry's Edits (if any)
_none_

## Approved Output
Same as v4 agent output above. ✅ Locked.
