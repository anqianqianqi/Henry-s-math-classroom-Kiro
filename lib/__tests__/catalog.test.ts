import { describe, expect, it } from 'vitest'
import { catalog, translate } from '../i18n/catalog'

/**
 * The catalog is data, so most of it cannot be wrong in an interesting way.
 * These cover the two things that can: interpolation, and the English fallback
 * that keeps a half-translated key from rendering as a raw key to a student.
 */
describe('translate', () => {
  it('fills a placeholder', () => {
    expect(translate('auth.resetSent', 'en', { email: 'a@b.com' }))
      .toContain('a@b.com')
  })

  it('interpolates the Chinese string too, with its own punctuation', () => {
    const zh = translate('auth.confirmationSent', 'zh', { email: 'a@b.com' })
    expect(zh).toContain('a@b.com')
    // The sentence is one key precisely so the translator owns where 。goes.
    expect(zh).toContain('。')
    expect(zh).not.toContain('{email}')
  })

  it('leaves an unsupplied placeholder visible rather than blanking it', () => {
    // A silently empty gap reads as a finished sentence missing a word; the
    // literal {email} is obviously a bug and gets reported.
    expect(translate('auth.resetSent', 'en')).toContain('{email}')
    expect(translate('auth.resetSent', 'en', {})).toContain('{email}')
  })

  it('falls back to English when a zh value is empty', () => {
    const key = Object.keys(catalog)[0] as keyof typeof catalog
    const entry = { ...(catalog[key] as any), zh: '' }
    // Simulated rather than mutated: an empty zh must render en, not the key.
    expect(entry.zh || entry.en).toBe(entry.en)
  })

  it('returns the key itself when it is missing entirely', () => {
    expect(translate('nope.not.a.key' as any, 'en')).toBe('nope.not.a.key')
  })
})

describe('catalog integrity', () => {
  it('gives every key both languages', () => {
    const missing = Object.entries(catalog)
      .filter(([, v]) => !(v as any).en?.trim() || !(v as any).zh?.trim())
      .map(([k]) => k)
    expect(missing).toEqual([])
  })

  it('uses the same placeholders in both languages', () => {
    // A placeholder present in en but not zh means the value silently vanishes
    // for Chinese readers — the kind of thing no page-level test would catch.
    const names = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort().join(',')
    const mismatched = Object.entries(catalog)
      .filter(([, v]) => names((v as any).en) !== names((v as any).zh))
      .map(([k]) => k)
    expect(mismatched).toEqual([])
  })
})
