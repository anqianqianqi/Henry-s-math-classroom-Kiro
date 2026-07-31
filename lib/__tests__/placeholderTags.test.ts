import { describe, expect, it } from 'vitest'
import { escapeXml, stripIgnoreTags, unescapeXml, wrapForIgnore } from '../i18n/placeholderTags'
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

/**
 * XML escaping for tag_handling=xml.
 *
 * DeepL parses the text as XML when ignore-tags are in use, so unescaped prose
 * is a 400 for the whole request — which is exactly how a real reply containing
 * "Bubble Room Q&A" failed to translate.
 */
describe('escapeXml / unescapeXml', () => {
  it('escapes the ampersand that broke a real reply', () => {
    const real = 'clicking the "Bubble Room Q&A" button'
    expect(escapeXml(real)).not.toMatch(/&(?!amp;|quot;|apos;|lt;|gt;)/)
    expect(unescapeXml(escapeXml(real))).toBe(real)
  })

  it('round-trips every metacharacter', () => {
    const text = `a & b < c > d " e ' f`
    expect(unescapeXml(escapeXml(text))).toBe(text)
  })

  it('does not double-decode an escape the author typed literally', () => {
    // "&lt;" written by hand must come back as "&lt;", not as "<".
    const text = 'write &lt; for less-than'
    expect(unescapeXml(escapeXml(text))).toBe(text)
  })

  it('escapes before tagging, so the ignore tags survive as tags', () => {
    const { masked } = maskMath('Is $x<y$ in Q&A?')
    const wire = wrapForIgnore(escapeXml(masked))

    // The placeholder's own tags must be real markup...
    expect(wire).toContain('<x>')
    expect(wire).toContain('</x>')
    // ...while the author's ampersand is inert.
    expect(wire).toContain('&amp;')
  })

  it('survives the whole DeepL path with an ampersand and math', () => {
    const original = 'In Q&A, solve $x+1$ please'
    const { masked, math } = maskMath(original)

    // What actually goes on the wire.
    const sent = wrapForIgnore(escapeXml(masked))
    // A well-behaved engine returns the tagged span untouched.
    const returned = sent.replace('In Q&amp;A, solve ', '在问答中，求解 ').replace(' please', '')

    expect(unmaskMath(unescapeXml(stripIgnoreTags(returned)), math))
      .toBe('在问答中，求解 $x+1$')
  })
})
