import { describe, expect, it } from 'vitest'
import { mergeTranslations } from '../i18n/useOnDemandTranslation'

/**
 * Which value reaches the screen when the row and a later fetch disagree.
 *
 * This is where a healed translation was being thrown away: the row carried a
 * frozen copy of the English, the fetch brought back real Chinese, and the row
 * won because its value was non-empty. The text only changed on reload.
 */
describe('mergeTranslations', () => {
  const english = 'You can navigate to this page by clicking the button.'
  const chinese = '您可以点击该按钮跳转至此页面。'

  it('lets a fetched translation replace a frozen one without a reload', () => {
    // The row as an older build left it: original in both slots.
    const row = { text: english, text_en: english, text_zh: english }
    const merged = mergeTranslations(row, { text_zh: chinese, text_en: english })

    expect(merged.text_zh).toBe(chinese)
  })

  it('falls back to the row when the fetch brought nothing', () => {
    const row = { text: english, text_en: english, text_zh: chinese }
    const merged = mergeTranslations(row, { text_en: null, text_zh: null })

    // A failed fetch must never blank text that is already on screen.
    expect(merged.text_zh).toBe(chinese)
    expect(merged.text_en).toBe(english)
  })

  it('fills a genuinely empty column', () => {
    const row = { text: english, text_en: null, text_zh: null }
    const merged = mergeTranslations(row, { text_zh: chinese, text_en: english })

    expect(merged.text_zh).toBe(chinese)
  })

  it('treats whitespace as empty rather than as a translation', () => {
    const row = { text: english, text_en: english, text_zh: '   ' }
    const merged = mergeTranslations(row, { text_zh: chinese, text_en: null })

    expect(merged.text_zh).toBe(chinese)
  })

  it('keeps the rest of the row intact', () => {
    const row = { text: english, text_en: english, text_zh: english, title: 'A title' }
    const merged = mergeTranslations(row, { text_zh: chinese })

    expect(merged.text).toBe(english)
    expect(merged.title).toBe('A title')
  })

  it('survives a missing item', () => {
    expect(mergeTranslations(null, null).text).toBe('')
  })

  it('applies the same precedence to titles', () => {
    const row = { text: english, title: 'Q&A', title_en: 'Q&A', title_zh: 'Q&A' }
    const merged = mergeTranslations(row, { title_zh: '问答' })

    expect(merged.title_zh).toBe('问答')
  })
})
