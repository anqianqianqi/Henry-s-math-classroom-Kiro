import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { toBrowserPublicUrl } from '../supabase/publicUrl'

const DIRECT = 'https://thgaokonzsabpvhfbfdy.supabase.co'
const BROWSER = 'https://thgaokonzsabpvhfbfdy.henrymathclassroom.com'

const original = {
  direct: process.env.NEXT_PUBLIC_SUPABASE_URL,
  browser: process.env.NEXT_PUBLIC_SUPABASE_BROWSER_URL,
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = DIRECT
  process.env.NEXT_PUBLIC_SUPABASE_BROWSER_URL = BROWSER
})

afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = original.direct
  process.env.NEXT_PUBLIC_SUPABASE_BROWSER_URL = original.browser
})

describe('toBrowserPublicUrl', () => {
  it('swaps the Supabase host for the one a browser can reach', () => {
    expect(toBrowserPublicUrl(`${DIRECT}/storage/v1/object/public/challenge-images/a.png`))
      .toBe(`${BROWSER}/storage/v1/object/public/challenge-images/a.png`)
  })

  it('keeps the path, query and fragment exactly as they were', () => {
    expect(toBrowserPublicUrl(`${DIRECT}/storage/v1/object/public/b/c%20d.png?token=x#y`))
      .toBe(`${BROWSER}/storage/v1/object/public/b/c%20d.png?token=x#y`)
  })

  it('leaves URLs from other hosts alone', () => {
    const other = 'https://example.com/pic.png'
    expect(toBrowserPublicUrl(other)).toBe(other)
  })

  it('passes null and undefined straight through', () => {
    expect(toBrowserPublicUrl(null)).toBeNull()
    expect(toBrowserPublicUrl(undefined)).toBeUndefined()
    expect(toBrowserPublicUrl('')).toBe('')
  })

  it('is a no-op when no browser URL is configured', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_BROWSER_URL
    const url = `${DIRECT}/storage/v1/object/public/x.png`
    expect(toBrowserPublicUrl(url)).toBe(url)
  })

  it('is a no-op when both URLs are the same host', () => {
    process.env.NEXT_PUBLIC_SUPABASE_BROWSER_URL = DIRECT
    const url = `${DIRECT}/storage/v1/object/public/x.png`
    expect(toBrowserPublicUrl(url)).toBe(url)
  })

  it('survives a malformed browser URL rather than throwing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_BROWSER_URL = 'not a url'
    const url = `${DIRECT}/storage/v1/object/public/x.png`
    expect(toBrowserPublicUrl(url)).toBe(url)
  })

  it('is idempotent — a URL already pointing at the browser host is unchanged', () => {
    const already = `${BROWSER}/storage/v1/object/public/x.png`
    expect(toBrowserPublicUrl(already)).toBe(already)
  })
})
