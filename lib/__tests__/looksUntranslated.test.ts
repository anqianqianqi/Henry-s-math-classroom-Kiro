import { describe, expect, it } from 'vitest'
import { looksUntranslated } from '../i18n/localize'

/**
 * The self-healing check. An older build stored the original in both slots
 * whenever no engine answered, which marked a row finished forever. This is
 * what recognises those rows so they retranslate instead of staying stuck.
 *
 * It has to be exact in both directions: too loose and healthy rows
 * retranslate on every view; too strict and a frozen row is never retried.
 */
describe('looksUntranslated', () => {
  const claire =
    'You can navigate to this page by clicking the "Bubble Room Q&A" button ' +
    'under the "Total Score". If you have a specific problem inquiry, click ' +
    'to the challenge, then scroll down.'

  it('catches the real frozen row', () => {
    expect(looksUntranslated(claire, claire, claire)).toBe(true)
  })

  it('leaves a properly translated English post alone', () => {
    // text_en === text is CORRECT here: the source language is kept verbatim
    // rather than round-tripped. Only both matching is suspicious.
    expect(looksUntranslated('Hello there', 'Hello there', '你好')).toBe(false)
  })

  it('leaves a properly translated Chinese post alone', () => {
    expect(looksUntranslated('你好', 'Hello there', '你好')).toBe(false)
  })

  it('leaves pure math alone — it really is the same in both languages', () => {
    // Retranslating these on every view would be a permanent cost for no gain.
    expect(looksUntranslated('$x = 2y$', '$x = 2y$', '$x = 2y$')).toBe(false)
    expect(looksUntranslated('$a+b$ $c-d$', '$a+b$ $c-d$', '$a+b$ $c-d$')).toBe(false)
  })

  it('catches prose that merely contains math', () => {
    const t = 'Solve $x+1$ for me please'
    expect(looksUntranslated(t, t, t)).toBe(true)
  })

  it('treats an untranslated row as not-yet-frozen rather than frozen', () => {
    // NULL columns are handled by the plain emptiness check, not this one.
    expect(looksUntranslated('Hello', null, null)).toBe(false)
  })

  it('ignores empty originals', () => {
    expect(looksUntranslated('', '', '')).toBe(false)
    expect(looksUntranslated(null, null, null)).toBe(false)
  })

  it('catches a frozen Chinese-only post', () => {
    const t = '这道题怎么开始？'
    expect(looksUntranslated(t, t, t)).toBe(true)
  })
})
