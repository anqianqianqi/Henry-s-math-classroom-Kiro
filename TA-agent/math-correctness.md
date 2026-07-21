# Mathematical Correctness Standards

This file defines what is mathematically unacceptable — errors that must result in
significant point deductions regardless of how much else the student did correctly.
It also defines what always counts as a valid approach.

The AI grader must consult this file when evaluating any submission.
These rules are non-negotiable and override any instinct to be generous.

---

## ❌ FATAL ERRORS — Zero tolerance, must be penalized heavily

These are logical or algebraic violations. Work that follows from a fatal error
cannot receive credit, even if it is internally consistent.

### Algebra
- **Distributing exponents over addition**: `(a + b)² = a² + b²` — WRONG. Must be `a² + 2ab + b²`
- **Distributing exponents over subtraction**: `(a - b)² = a² - b²` — WRONG
- **Incorrect square root of sum**: `√(a² + b²) = a + b` — WRONG
- **Canceling terms across addition/subtraction in fractions**: `(a + b)/b = a` — WRONG
- **Dividing by zero**: Any step that involves dividing by an expression that could be zero,
  without stating and checking that condition, is invalid
- **Multiplying/dividing an inequality by a variable**: without knowing its sign — this
  reverses the inequality if the variable is negative. Must state sign assumption.
- **Losing a solution by dividing both sides by a variable**: e.g. `x² = 3x → x = 3`
  (lost `x = 0`). Must factor instead: `x(x - 3) = 0`

### Logic and Proof
- **Circular reasoning**: Assuming the conclusion to prove the conclusion — fatal,
  regardless of how sophisticated it looks
- **Proving by example**: Showing something works for n = 1, 2, 3 is NOT a proof
  that it works for all n, unless the problem specifically asks for an example
- **Claiming the converse**: Proving P → Q then claiming Q → P without proof is invalid
- **Skipping cases**: In a proof by cases, all cases must be handled. Leaving out
  a case (e.g. the negative case, the zero case) makes the proof incomplete

### Arithmetic
- **Sign errors in multiplication**: (-3) × (-4) = -12 is WRONG (= +12)
- **Incorrect order of operations**: computing addition before multiplication without
  parentheses is a fatal error, not a minor slip

---

## ⚠️ SERIOUS ERRORS — Must lose significant points, but work after may still get partial credit

These errors are wrong but the student may have understood the concept and just
applied it incorrectly. Give credit for correct steps before the error.

- **Computational arithmetic errors**: e.g. writing 7 × 8 = 54 instead of 56.
  Lose points for the error, but correct setup and method still earn partial credit.
- **Dropped negative sign in intermediate steps**: often a careless error, but must
  be penalized as it affects the answer.
- **Incorrect but self-consistent substitution**: student substitutes a wrong value
  but then works correctly from that value. Credit the method, penalize the error.
- **Off-by-one errors in sequences or counting**: lose points but not everything.
- **Using the wrong formula** (e.g. area of circle vs circumference): lose most points,
  but any correct manipulation of the wrong formula may earn a small amount.

---

## ✅ ALWAYS VALID APPROACHES — Never penalize these

Even if a method was not taught in class or is not the "expected" approach,
it is valid if it is mathematically correct.

- **Algebraic vs geometric proofs**: both valid unless the problem specifies one
- **Long division vs polynomial factoring**: both valid
- **Substitution vs elimination in systems of equations**: both valid
- **Proof by contradiction vs direct proof**: both valid
- **Using a longer but correct method**: do not penalize wordiness or extra steps
  if all steps are mathematically sound
- **Different but equivalent forms of an answer**: `√2/2` and `1/√2` are the same thing.
  Do not penalize for not rationalizing the denominator unless specifically required.
- **Using advanced techniques the student knows**: if a student uses a technique
  beyond the current curriculum but applies it correctly, full credit

---

## 🔍 COMMON STUDENT MISTAKES TO WATCH FOR

These appear frequently and the AI should specifically check for them:

### In algebra
- Forgetting the ± when taking a square root in an equation: `x² = 4 → x = 2` (missing `x = -2`)
- Incorrect FOIL/expansion: only multiplying first and last terms
- Forgetting to apply an operation to all terms on both sides of an equation
- Fraction arithmetic errors: adding fractions without common denominator

### In geometry
- Confusing area and perimeter formulas
- Using degrees when radians are required or vice versa
- Forgetting that similar triangles require proportional sides, not equal sides
- Missing a case in angle calculations (e.g. obtuse vs acute triangle)

### In word problems
- Setting up the equation for the wrong quantity
- Ignoring units or giving an answer in the wrong units
- Not checking whether the answer makes sense in context (e.g. negative time)

### In sequences and series
- Off-by-one: is the first term n=0 or n=1? Must match the problem statement
- Using the wrong formula for arithmetic vs geometric sequences

---

## 📏 PRECISION REQUIREMENTS

- Answers requiring exact values: `√2`, `π`, fractions — **do not accept decimal approximations**
  unless the problem says "to 2 decimal places" or similar
- Rounding: if a problem asks for exact form, `0.707` is NOT an acceptable substitute for `√2/2`
- Significant figures: if a problem specifies precision, the answer must respect it

---

## SUMMARY: The AI's Checklist Before Finalizing a Grade

Before assigning a final grade, verify:
1. Did the student commit any fatal errors listed above? If yes, follow-on work loses credit.
2. Did the student use a valid approach, even if unexpected? If yes, do not penalize.
3. Is the final answer in the correct form (exact vs decimal, units included)?
4. Did the student handle all cases (zero case, negative case, boundary cases)?
5. For proofs: is there any circular reasoning or proof-by-example?
