import { describe, expect, it } from 'vitest'
import { detectLanguage, maskMath, unmaskMath } from '../mathtext-core'

/**
 * Masking is what guarantees a translator cannot touch an expression, so these
 * check the round trip rather than the prompt. If mask -> unmask is lossless,
 * the model's output can never corrupt the math.
 */
describe('maskMath / unmaskMath', () => {
  it('round-trips $...$ untouched', () => {
    const text = 'Let $x = 2$ and solve for $y$.'
    const { masked, math } = maskMath(text)
    expect(masked).not.toContain('x = 2')
    expect(math).toEqual(['x = 2', 'y'])
    expect(unmaskMath(masked, math)).toBe(text)
  })

  it('survives the translator reordering placeholders', () => {
    const { masked, math } = maskMath('Solve $a+b$ then $c-d$.')
    // A translation can legitimately move clauses around; indices carry meaning
    // so the expressions still land on the right ones.
    const reordered = masked.replace(/⟦M0⟧(.*)⟦M1⟧/, '⟦M1⟧$1⟦M0⟧')
    const restored = unmaskMath(reordered, math)
    expect(restored).toContain('$c-d$')
    expect(restored).toContain('$a+b$')
    expect(restored.indexOf('$c-d$')).toBeLessThan(restored.indexOf('$a+b$'))
  })

  it('keeps bare commands without wrapping them', () => {
    const { masked, math } = maskMath('The \\angle here is right.')
    expect(math).toEqual(['\\angle'])
    expect(unmaskMath(masked, math)).toBe('The \\angle here is right.')
  })

  it('keeps \\frac and \\sqrt groups intact', () => {
    const text = 'Compute \\frac{1}{2} plus \\sqrt{9}.'
    const { masked, math } = maskMath(text)
    expect(math).toEqual(['\\frac{1}{2}', '\\sqrt{9}'])
    expect(masked).not.toContain('frac')
  })

  it('leaves text with no math alone', () => {
    const { masked, math } = maskMath('No math at all here.')
    expect(math).toEqual([])
    expect(unmaskMath(masked, math)).toBe('No math at all here.')
  })
})

describe('detectLanguage', () => {
  it('detects English prose', () => {
    expect(detectLanguage('When C is 22 years old, how old is A?')).toBe('en')
  })

  it('detects Simplified Chinese prose', () => {
    expect(detectLanguage('甲乙丙三人，丙22岁的时候，甲的年纪是乙的2倍。')).toBe('zh')
  })

  it('treats a Chinese sentence quoting an English term as Chinese', () => {
    expect(detectLanguage('这个方法叫做 substitution，很好用。')).toBe('zh')
  })

  it('treats an English sentence with one Chinese name as English', () => {
    expect(detectLanguage('This method is what 甲 used to solve the problem here.')).toBe('en')
  })

  it('returns other for bare math, where there is nothing to translate', () => {
    expect(detectLanguage('$x = 2y + 3$')).toBe('other')
    expect(detectLanguage('42')).toBe('other')
  })
})
