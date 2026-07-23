# Equation Solving — Mathematical Intuition

> This file teaches the TA how to *think* about equation problems, not how to follow
> a procedure. Read it before looking at any student submission.

---

## Before you compute anything: ask these questions first

When you see an equation problem, your first move is not to solve it — it is to
*understand what kind of situation you are in*. A good mathematician looks at the
whole problem and asks:

**1. What am I trying to find?**
Name the unknowns explicitly. Count them.

**2. What do I know?**
Count the constraints. How many equations? Do I have enough information to find
a unique answer, or will the answer be a set of values, or a relationship?

**3. What is the structure of this equation?**
Look at the *form*, not the numbers. Is something multiplied together? Is something
in a denominator? Does the same expression appear more than once? Is there a
repeated pattern?

**4. What would make this simpler?**
Before expanding, distributing, or computing — ask whether there is a way to
*see* the answer more directly. A substitution that collapses complexity?
A factor that immediately gives you something useful?

**5. Are there hidden constraints?**
What values of the unknown would *break* this equation? If something is in a
denominator, it cannot be zero. If you are taking a square root, the argument
cannot be negative. These constraints are part of the answer — not an afterthought.

**6. What does a complete answer look like?**
Will there be one solution, multiple solutions, no solutions? Should the answer
be exact? Are there conditions that must accompany the numerical answer?

---

## Henry's specific thinking habits for equations

These patterns appear repeatedly in Henry's teaching. When you grade an equation
problem, these are the lenses Henry applies.

---

### Habit 1: Always ask "can this be zero?"

When a student divides both sides of an equation by a variable or expression,
the question that immediately follows is: *can that expression equal zero?*

If yes, dividing by it is not valid for that case — and that case may represent
an additional solution the student missed entirely.

**From Henry's correction log (Examples #3 and #5):**
A student solved `(a-1)b = b` by dividing both sides by b, getting `a-1 = 1`, so `a = 2`.
Henry gave 2/3 and said: *"除以b是一個很棒的想法!! 但是....還有一種可能....是不能除以b的"*
(Dividing by b is a great idea!! But... there is another possibility... which is that b cannot be divided by)

The student had the right instinct but did not ask "what if b = 0?"
When b = 0, the original equation becomes `0 = 0` — true for any value of a.
So b = 0 is not an additional constraint, it changes the answer entirely.

**The habit:** Before accepting a solution obtained by dividing by a variable,
always ask: "What happens when that variable or expression equals zero?"

---

### Habit 2: When something repeats, rename it

When the same complex sub-expression appears multiple times in an equation,
the cleanest path is to treat it as a single unit and give it a temporary name.

**From Henry's correction log (Example #31):**
For the equation `1/a + 5 = 3 + 2/a`, Henry suggested:
*"很棒! 那如果我把 1/a 整個當一個未知數呢"*
(Great! What if we treated 1/a as a single unknown?)

If you let u = 1/a, the equation becomes u + 5 = 3 + 2u, which solves immediately
to u = 2, so a = 1/2. Much cleaner than multiplying through by a first.

**The habit:** Before expanding or clearing denominators, look for repeated
sub-expressions. Name them. Solve for the name, then back-substitute.

---

### Habit 3: Products equal to zero give multiple solutions

When an equation has the form (expression₁)(expression₂) = 0, the solutions
come from asking: *which factor can be zero?* Each factor can independently be zero,
and each gives a separate solution.

**From Henry's correction log (Examples #2 and #13):**
For `(a-1)(a-2)(a-3) = 0`, students who correctly listed a=1, a=2, a=3 got full
marks. Henry's confirmation: *"沒錯主要就是其中一個要是0"* (That's right, the key is
that one of them must equal zero.)

**The habit:** When a product equals zero, list solutions from every factor.
Missing even one factor means missing a solution. Do not divide out a factor —
factor instead, to ensure all solutions are visible.

---

### Habit 4: Notice structure before computing

Some equations look complicated but have simple structure once you step back.

**From Henry's correction log (Example #22):**
For `79a + 99b = 178` and `99a + 79b = 178`, Henry noted: *"Verygood trick! to add
them up."* Adding the two equations gives 178a + 178b = 356, so a + b = 2.
This is much simpler than solving the system by elimination directly.

**The habit:** Before starting to compute, look at what operations on the whole
equations (adding them, subtracting them, multiplying one by a constant) might
reveal something simpler. Algebraic structure is often visible at the equation level,
not just the term level.

---

### Habit 5: Completeness — all solutions, all cases

Henry consistently asks students whether they have found *all* solutions, not
just *a* solution. This applies to:
- Products equal to zero (every factor)
- Equations that could have no solution, one solution, or infinitely many
- Systems of equations where you need to verify the solution satisfies all equations

A student who finds `a = 2` and stops, when the complete answer is `a = 1, 2, 3`,
has shown correct reasoning for one case but missed the question entirely.

**The habit:** After finding solutions, ask: "Have I found all of them?
Could there be cases I haven't considered?"

---

## What a complete, correct solution looks like

A full-marks equation solution typically has:

1. **Clear identification of what is being solved for**
2. **A valid path to the answer** — any mathematically sound approach is acceptable;
   the "standard" method is not required
3. **All solutions found** — if the equation has multiple solutions, all are listed
4. **Domain/constraint check** — if the equation involves division by a variable or
   expression, the conditions are stated (even briefly)
5. **Answer in exact form** unless the problem asks for a decimal approximation

A solution does not need to be verbose. A student who writes the key insight
concisely and correctly has earned full marks.

---

## What this means for grading

When you read a student's submission, you are asking:
*Did the student see the structure? Did they ask the right questions?
Did they find all the solutions? Did they check the hidden constraints?*

If yes — full marks, regardless of method.
If they saw the structure but missed one habit (forgot to check b=0, missed one factor) —
partial marks.
If they couldn't engage with the structure at all — minimal marks.
