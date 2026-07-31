import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Engine selection and the no-call fast paths. The network is stubbed, so these
 * assert what gets SENT and when nothing is sent at all — the parts that decide
 * what this feature costs.
 */

const ORIGINAL_ENV = { ...process.env }

async function load() {
  vi.resetModules()
  // `server-only` is a build-time guard with no runtime behaviour to exercise.
  vi.doMock('server-only', () => ({}))
  return await import('../i18n/translateUserText')
}

beforeEach(() => {
  for (const k of ['DEEPL_API_KEY', 'GOOGLE_TRANSLATE_API_KEY', 'OPENAI_API_KEY']) {
    delete process.env[k]
  }
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('engine selection', () => {
  it('prefers DeepL, and sends Simplified Chinese with ignore tags', async () => {
    process.env.DEEPL_API_KEY = 'test:fx'
    process.env.OPENAI_API_KEY = 'sk-test'

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ translations: [{ text: '求 <x>⟦M0⟧</x> 的值' }] }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { translateUserText } = await load()
    const out = await translateUserText('Find $x+1$')

    const [url, init] = fetchMock.mock.calls[0] as any
    // Free keys must not go to the paid host, or every call 403s.
    expect(url).toContain('api-free.deepl.com')
    const body = (init.body as URLSearchParams).toString()
    expect(decodeURIComponent(body)).toContain('target_lang=ZH-HANS')
    expect(decodeURIComponent(body)).toContain('ignore_tags=x')
    expect(decodeURIComponent(body)).toContain('<x>⟦M0⟧</x>')

    // Tags stripped, math restored, original kept for the source language.
    expect(out.zh).toBe('求 $x+1$ 的值')
    expect(out.en).toBe('Find $x+1$')
    expect(out.lang).toBe('en')
  })

  it('falls back to OpenAI when no MT key is set', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '你好' } }] }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { translateUserText } = await load()
    await translateUserText('Hello there')

    expect((fetchMock.mock.calls[0] as any)[0]).toContain('api.openai.com')
  })

  it('stores the original both ways when no key is configured', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { translateUserText } = await load()
    const out = await translateUserText('Hello there')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(out.en).toBe('Hello there')
    expect(out.zh).toBe('Hello there')
  })
})

describe('calls that should never be made', () => {
  it('skips wordless math — it reads the same in every language', async () => {
    process.env.DEEPL_API_KEY = 'test'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { translateUserText } = await load()
    const out = await translateUserText('$x = 2y$')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(out.en).toBe('$x = 2y$')
    expect(out.zh).toBe('$x = 2y$')
  })

  it('translates only the missing direction, not both', async () => {
    process.env.DEEPL_API_KEY = 'test'
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ translations: [{ text: 'How do I start?' }] }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { translateUserText } = await load()
    const out = await translateUserText('这道题怎么开始？')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(out.zh).toBe('这道题怎么开始？')
    expect(out.en).toBe('How do I start?')
  })
})

describe('failure handling', () => {
  it('keeps the original — and the post — when the engine errors', async () => {
    process.env.DEEPL_API_KEY = 'test'
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 456, statusText: 'Quota' })))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { translateUserText } = await load()
    const out = await translateUserText('Hello there')

    expect(out.en).toBe('Hello there')
    expect(out.zh).toBe('Hello there')
  })
})
