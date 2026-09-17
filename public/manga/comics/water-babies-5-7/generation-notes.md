# Water babies — English two-page console experiment

Built-in image generator; flat raster previews, not layered production masters. No publication, upload or commit performed. Chinese counterpart not generated yet.

User-approved teaching direction: group alternating operations into a round, find net change, predict rounds, distinguish rounds from individual pours. Start A3/B3, capacity5/7. States: (3,3),(2,4),(4,2),(3,3),(5,1). Answer4 pours. Check stopping after each individual transfer. Two babies moving together represent ONE pour.

Important correction from user: the forced order `A→B: 1`, then `B→A: 2` is a GIVEN RULE of this problem, not a Math Takeaway. State it visibly and repeat in order, but do not elevate “record the next action” into the general lesson. The midpoint return to(3,3) is used only to show that half a round is not the full-round net change.

Locked Math Takeaway: group the prescribed repeating operations into one complete round; calculate the net change only after the complete round; determine how many rounds reach the target; convert rounds into total pours; still check the stop condition after each pour. Here A changes by `−1+2=+1` per round, needs2 more, so2 rounds×2 pours=4 pours.

Approved story metaphor: water babies are passengers, Funbo the driver. Six babies move between buses; no creation of new babies. A5 seats, B7. Round-trip friend joke; returning to3/3 but next action differs; two rounds versus four tickets. Natural English, large bold typography, Japanese children's manga, usual two-page output.

## QA and selected outputs

page-01-en-v1.png uses the first corrected page, which removed duplicate flying babies. A later seat correction changed B's passenger count incorrectly and was rejected. Selected baby's numerical counts are correct. Empty seat outlines still do not consistently match5/7: notably page1 panel3 and panel4 B, and page2 panel8 A. These previews are NOT final math-visual QA approved. Need deterministic seat/occupant layers for reliable counting; do not publish as verified classroom materials yet.

page-02-en-v1.png uses corrected panel10 A with FIVE babies (initial had six). All stated math and final answer checked.

page-02-en-v2.png supersedes v1 for the story experiment. It explicitly labels the forced actions as GIVEN RULES in panel8, says the repeated `(3,3)` is only half a round in panel9, and separates GIVEN RULES from MATH TAKEAWAY in panel14. Panel10 shows exactly A5/B1. This is still a generated flat-raster preview.

### Page 2 v2 update prompt

Edit target is this complete English manga page2. Preserve art style, Funbo, Leo, all baby counts, buses, panels10–13, math, large bold typography and layout. Rewrite ONLY panels8,9 and the takeaway wording in panel14 to clearly distinguish GIVEN RULES from MATH TAKEAWAY.

Panel8 must explicitly remind the fixed rules BEFORE the action. Add a prominent small route card reading exactly:
"THE ONLY MOVES:
1. A → B: 1 baby
2. B → A: 2 babies
Repeat in this order."
Funbo says "The next allowed move is A → B: 1!" Then show Move3 result A:3 B:3 exactly as existing, with one arrow A to B. It is okay to make panel8 slightly taller or reduce character size; all text must remain very large and readable.

Panel9 retains comic surprise but dialogue becomes:
Funbo: "Three and three AGAIN?! Was that round useless?"
Leo: "Not yet—we’ve only done HALF the round!"
Do NOT teach recording the next action as a takeaway. It is simply because the given rule has two moves per complete round.

Panel14 notebook title stays "Think in rounds!" and the teaching text must be exactly:
"1. Group the repeating operations into one full round.
2. Find the NET CHANGE after a full round.
3. Count rounds, then count total pours."
Example:
"A: −1 + 2 = +1 per round
A needs 2 more → 2 rounds
2 rounds × 2 pours = 4 pours"
Small reminder bubble: "Check for FULL after every pour!"
Remove wording "1 group move = 1 pour" because it is confusing. Footer answer "Answer: 4 pours."
The two required operations and their order are GIVEN RULES, not the takeaway. Keep all lettering very large; expand final panel height if needed. Output full corrected page2 only.

## Original prompts

Use case illustration-story. Create a polished English children's Japanese manga PAGE, portrait 2 columns, 7 panels (three rows of two plus wide last panel). Style reference image is for character identity and art style ONLY, NOT its water-tube story. Warm cream paper, pastel flat colors, clean expressive black lines, yellow circle panel numbers, VERY LARGE BOLD BLACK readable natural speech, simple uncluttered backgrounds, varied closeups. Funbo is cream capsule robot, blue limbs, single yellow-ball antenna, black face yellow eyes, lowercase yellow f on closed blue chest, wearing a small paper driver's cap. Leo calm clever boy black tousled hair yellow hoodie. New story: six cute pale-blue water-drop babies move between two transparent toy buses, labeled A (5 seats) and B (7 seats). Show simple single row of individual seat spaces in each bus, A physically shorter. Babies never multiply. Six total across buses and any in transit. Bus bodies remain stationary; only babies change buses. One baby equals1 unit water. One GROUP transfer counts as one pour, not one pour per baby. Alternate one baby A→B then TWO babies B→A, stop immediately when either bus full. Numerical states (A,B): start(3,3), after move1(2,4), after move2(4,2), after move3(3,3), after move4(5,1). Render exact counts whenever visible; do not add decorative babies outside a state scene. Movement scenes may show endpoints AFTER transfer with directional arrow, avoids double-counting moving copies. Cute comedy, thought pauses, no eating, no bottle pouring. PAGE ONE panels1–7. Do not reveal final answer on page1.
1 Establish two toy buses A5seats B7seats, exactly3 babies in each with remaining seats empty. Leo: "A has 5 seats. B has 7. Three water babies in each!" Funbo: "All aboard!" Small caption "Each baby is 1 unit of water."
2 Leo shows route card: "First, 1 goes A → B. Then, 2 go B → A." Funbo: "Keep taking turns!" Leo: "Stop when either bus is full. How many moves?" No babies needed closeup characters.
3 Move1 finished: A exactly2 babies, B exactly4. Short clear arrow A→B labeled "1". One baby newly seated in B waves "Just visiting!" Funbo "One passenger, off you go!" Large labels "Move 1" "A: 2" "B: 4".
4 Move2 finished: A exactly4 babies B exactly2. Two newly arrived babies in A hand-in-hand. Arrow B→A labeled "2". Funbo surprised: "You brought a friend?!" Baby: "We’re going together!" Labels "Move 2" "A: 4" "B: 2".
5 Funbo curious closeup comparing note A3 with A4. Funbo "A started with 3... now it has 4?" Leo: "How many left? How many came back?" No answer in this panel, invite reader thought.
6 Funbo finger-counting, cap slips sideways in delight: "One left. Two came back. That’s one extra!" Leo: "Those TWO moves make ONE round." Simple equation "−1 + 2 = +1". No buses needed.
7 wide end panel, Funbo stands proud with skewed cap: "A has 4. One more round will fill it!" Leo smiles: "Let’s test that!" A with exactly4 babies one empty seat if shown. Page footer1.

Use case illustration-story. Create a polished English children's Japanese manga PAGE, portrait 2 columns, 7 panels (three rows of two plus wide last panel). Style reference image is for character identity and art style ONLY, NOT its water-tube story. Warm cream paper, pastel flat colors, clean expressive black lines, yellow circle panel numbers, VERY LARGE BOLD BLACK readable natural speech, simple uncluttered backgrounds, varied closeups. Funbo is cream capsule robot, blue limbs, single yellow-ball antenna, black face yellow eyes, lowercase yellow f on closed blue chest, wearing a small paper driver's cap. Leo calm clever boy black tousled hair yellow hoodie. New story: six cute pale-blue water-drop babies move between two transparent toy buses, labeled A (5 seats) and B (7 seats). Show simple single row of individual seat spaces in each bus, A physically shorter. Babies never multiply. Six total across buses and any in transit. Bus bodies remain stationary; only babies change buses. One baby equals1 unit water. One GROUP transfer counts as one pour, not one pour per baby. Alternate one baby A→B then TWO babies B→A, stop immediately when either bus full. Numerical states (A,B): start(3,3), after move1(2,4), after move2(4,2), after move3(3,3), after move4(5,1). Render exact counts whenever visible; do not add decorative babies outside a state scene. Movement scenes may show endpoints AFTER transfer with directional arrow, avoids double-counting moving copies. Cute comedy, thought pauses, no eating, no bottle pouring. PAGE TWO panels8–14. Continue after A4 B2.
8 Move3 finished, buses A3 B3 exactly. Arrow A→B labeled1. Funbo "Next passenger!" Label "Move 3" "A: 3" "B: 3".
9 Funbo clutches his cap in mock panic comparing start note(3,3) to now(3,3). "Three and three AGAIN?! Did we go nowhere?" Leo "Have we done the return trip yet?" No more babies than state if shown.
10 Move4 FINISHED, A exactly5 babies all5 seats occupied, B exactly1 baby plus6 empty seats. Arrow B→A labeled2. Funbo "Oh! Two still need to come back!" Labels "Move 4" "A: 5 — FULL!" "B: 1".
11 Closeup Funbo raises a stop paddle happily "STOP! A is full!" Leo "Your prediction worked!" No motion after full, no extra babies.
12 Funbo proudly holds two fingers "Only two moves!" Leo displays exactly FOUR simple tickets in two pairs, numbered1,2,3,4: "Then who used these four tickets?" Show no equations yet.
13 Funbo counts tickets, embarrassed cute face, cap down over one eye. "One, two, three, four... Two ROUNDS, four MOVES!" Leo "The return trip counts too!" Large short equation "2 rounds × 2 moves = 4".
14 wide concluding panel with clear large short notebook and tiny characters to side. Notebook title "Think in rounds!" Three lines "Group the repeating moves." "Find the change per round." "Count rounds, then moves." Example line "A gains 1 per round. It needs 2 more." Funbo speech "Check for FULL after every move!" Footer clearly "1 group move = 1 pour. Answer: 4 pours." This group meaning vital: TWO babies moving together count as ONE pour. Page footer2. Keep typography huge and readable, allow more height for this panel.

## Correction prompts summary

Page1: remove extra babies outside buses in panels3/4; retain states2/4 and4/2. Seat correction attempted but not accepted due to altered count.
Page2: panel10 A exactly5 babies, B1; adjust empty seats to capacities5/7. Seat rendering still imperfect.
