import { describe, it, expect } from 'vitest'
import { shorthandToLatex, latexToShorthand } from '../shorthand'

describe('what a student types becomes LaTeX', () => {
  it.each([
    ['1/2', '\\frac{1}{2}'],
    ['(x+1)/(x-2)', '\\frac{x + 1}{x - 2}'],
    ['x^2', 'x^{2}'],
    ['x^(n+1)', 'x^{n + 1}'],
    ['x_1', 'x_{1}'],
    ['sqrt9', '\\sqrt{9}'],
    ['sqrt(x+1)', '\\sqrt{x + 1}'],
    ['a <= b', 'a \\leq b'],
    ['a != b', 'a \\neq b'],
    ['3 * 4', '3 \\times 4'],
    ['pi r^2', '\\pi r^{2}'],
    ['angle ABC', '\\angle ABC'],
  ])('%s', (typed, latex) => {
    expect(shorthandToLatex(typed)).toBe(latex)
  })

  it('binds an exponent tighter than a slash', () => {
    // x squared, over three — not x to the two-thirds.
    expect(shorthandToLatex('x^2/3')).toBe('\\frac{x^{2}}{3}')
  })

  it('keeps brackets that are part of the value', () => {
    // The brackets group a product here, so they have to survive; inside a
    // fraction the same brackets are the student saying "all of this over".
    expect(shorthandToLatex('2(x+1)')).toBe('2 (x + 1)')
  })

  it('leaves an unknown word alone rather than guessing', () => {
    expect(shorthandToLatex('abc')).toBe('abc')
  })

  it.each([
    ['1/pi', '\\frac{1}{\\pi}'],
    ['x^circ', 'x^{\\circ}'],
    ['sqrt(pi)', '\\sqrt{\\pi}'],
    ['sqrt pi', '\\sqrt{\\pi}'],
  ])('names a symbol even when a fraction or script swallows it: %s', (typed, latex) => {
    // These went out as \frac{1}{pi} and x^{circ} until names were resolved at
    // lex time: the folding passes copy a token's text into a brace group and
    // never look at it again, so a later mapping pass never sees it. Only a
    // bracketed group came out right, because brackets recurse.
    expect(shorthandToLatex(typed)).toBe(latex)
  })

  it('renders something from half-typed input instead of nothing', () => {
    // The student is mid-keystroke; the preview must not go blank.
    expect(shorthandToLatex('(x+1')).toContain('x')
  })
})

describe('the way back, so a saved solution can be reopened', () => {
  // The premise of the editor is that a student never sees LaTeX. They can edit
  // a submission after saving, and all we stored was LaTeX — so every construct
  // the forward pass can produce has to come back as the shorthand that made it.
  const corpus = [
    '1/2',
    '(x+1)/(x-2)',
    'x^2',
    'x^(n+1)',
    'x_1',
    'sqrt9',
    'sqrt(x+1)',
    'a <= b',
    'a >= b',
    'a != b',
    'pi r^2',
    'angle ABC',
    'x^2/3',
    '3 * 4',
    '1/2 + 1/3',
  ]

  it.each(corpus)('%s survives a round trip', typed => {
    const latex = shorthandToLatex(typed)
    const back = latexToShorthand(latex)
    // Compared with spaces removed: the forward pass spaces tokens for KaTeX
    // and a person's spacing is their own. What must not change is the maths.
    expect(back.replace(/\s/g, '')).toBe(typed.replace(/\s/g, ''))
  })

  it('brackets a fraction body that would otherwise re-read wrongly', () => {
    // x+1 over 2 must come back as (x+1)/2, never x+1/2.
    expect(latexToShorthand('\\frac{x+1}{2}').replace(/\s/g, '')).toBe('(x+1)/2')
  })

  /**
   * The invariant that matters most, stated the other way round.
   *
   * A submission is stored as LaTeX. Reopening it converts to shorthand, and
   * saving converts back — so the LaTeX has to survive that journey unchanged,
   * or a student who opens their work and saves it without touching anything
   * has silently altered it. The corpus above only checked the shorthand came
   * back; this checks the maths did.
   *
   * It is what caught \sqrt{\pi} returning `sqrtpi`, which re-reads as a single
   * variable named "sqrtpi" and loses the root entirely.
   */
  it.each([
    '\\frac{x + 1}{x - 2}',
    '\\sqrt{\\pi} \\leq 90^{\\circ}',
    '\\frac{x^{2}}{3} \\neq \\pm 1',
    '\\sqrt{9}',
    '\\sqrt{x + 1}',
    '\\frac{1}{2} + \\frac{1}{3}',
    '\\angle ABC = 90^{\\circ}',
  ])('%s is unchanged by a reopen and a save', latex => {
    expect(shorthandToLatex(latexToShorthand(latex))).toBe(latex)
  })

  it('passes an unknown command through whole', () => {
    // A teacher's problem may use commands this editor never emits. Showing
    // \vec is recoverable; silently dropping it is not.
    expect(latexToShorthand('\\vec{v}')).toBe('\\vec{v}')
  })
})
