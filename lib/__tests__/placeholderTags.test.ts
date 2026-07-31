import { describe, expect, it } from 'vitest'
import { stripIgnoreTags, wrapForIgnore } from '../i18n/placeholderTags'
import { maskMath, unmaskMath } from '../mathtext-core'

/**
 * The ignore-tag wrapper sits between masking and the translation engine. If the
 * wrap -> strip round trip is lossless then the engine can only ever see, and
 * only ever return, opaque placeholders — so the math is safe no matter what it
 * does to the surrounding prose.
 */
describe('wrapForIgnore / stripIgnoreTags', () => {
  it('round-trips back to the masked text', () => {
    const masked = 'Solve ⟦M0⟧ and then find ⟦M1⟧ please.'
    expect(stripIgnoreTags(wrapForIgnore(masked))).toBe(masked)
  })

  it('wraps every placeholder, keeping its index', () => {
    expect(wrapForIgnore('⟦M0⟧ then ⟦M12⟧')).toBe('<x>⟦M0⟧</x> then <x>⟦M12⟧</x>')
  })

  it('leaves prose without placeholders alone', () => {
    const text = 'How do I start this one?'
    expect(wrapForIgnore(text)).toBe(text)
  })

  it('strips the self-closing form some engines return', () => {
    expect(stripIgnoreTags('<x/>⟦M0⟧<x />')).toBe('⟦M0⟧')
  })

  it('recovers when the engine drops half of a pair', () => {
    // A dropped closing tag must not strand markup in what students read.
    expect(stripIgnoreTags('求 <x>⟦M0⟧ 的值')).toBe('求 ⟦M0⟧ 的值')
  })

  it('survives the full mask -> wrap -> translate -> strip -> unmask path', () => {
    const original = 'If $x = 2y$ then what is $y$?'
    const { masked, math } = maskMath(original)

    // Stand in for the engine: translate the words, move the clauses, and leave
    // the ignore-tagged spans exactly as received.
    const returned = wrapForIgnore(masked)
      .replace('If ', '如果 ')
      .replace(' then what is ', ' 那么 ')
      .replace('?', ' 是多少？')

    expect(unmaskMath(stripIgnoreTags(returned), math)).toBe(
      '如果 $x = 2y$ 那么 $y$ 是多少？',
    )
  })
})
