import { describe, it, expect } from 'vitest'
import { parsePrintLanguage, wordingFor } from '@/lib/problemSet/wording'
import type { HenryProblemFields } from '@/lib/henryproblem'

const both: HenryProblemFields = {
  mode: 'no_graph',
  title: 'Folding a net',
  score: '5',
  tags: ['geometry'],
  english: 'Fold the net into a cube. How many faces meet at the marked vertex?',
  chinese: '把展开图折成正方体。标记的顶点处有几个面相交？',
}

describe('parsePrintLanguage', () => {
  it('reads the two single-language values', () => {
    expect(parsePrintLanguage('en')).toBe('en')
    expect(parsePrintLanguage('zh')).toBe('zh')
  })

  it('falls back to both for anything else', () => {
    for (const value of ['both', '', 'EN', 'fr', null, undefined]) {
      expect(parsePrintLanguage(value)).toBe('both')
    }
  })
})

describe('wordingFor', () => {
  it('leaves the problem alone for both', () => {
    expect(wordingFor(both, 'both')).toBe(both)
  })

  it('drops the Chinese for en, and the English for zh', () => {
    expect(wordingFor(both, 'en')).toMatchObject({ english: both.english, chinese: '' })
    expect(wordingFor(both, 'zh')).toMatchObject({ english: '', chinese: both.chinese })
  })

  it('keeps everything else on the sheet', () => {
    const only = wordingFor(both, 'en')
    expect(only.title).toBe(both.title)
    expect(only.score).toBe(both.score)
    expect(only.tags).toEqual(both.tags)
    expect(only.mode).toBe(both.mode)
  })

  it('does not mutate the problem it was given', () => {
    wordingFor(both, 'en')
    expect(both.chinese).not.toBe('')
  })

  // The blank-page case: honouring the request literally would print a title,
  // a graph and no question at all.
  it('keeps the only wording there is when the other language is missing', () => {
    const englishOnly = { ...both, chinese: '' }
    expect(wordingFor(englishOnly, 'zh').english).toBe(both.english)

    const chineseOnly = { ...both, english: '' }
    expect(wordingFor(chineseOnly, 'en').chinese).toBe(both.chinese)
  })

  it('treats whitespace-only wording as missing', () => {
    const padded = { ...both, chinese: '   \n  ' }
    expect(wordingFor(padded, 'zh').english).toBe(both.english)
  })
})
