import { describe, it, expect } from 'vitest'
import {
  HenryProblemError,
  parseHenryProblem,
  parseHenryProblemValue,
  readStoredHenryProblem,
} from '@/lib/henryproblem'
import { studioSnapshot } from './helpers/fakeSupabase'

/**
 * The value-based entry point the import route uses, and the revision field
 * the Studio bridge adds to the stored projection.
 */

describe('parseHenryProblemValue', () => {
  it('reads an already-decoded snapshot exactly like the file text', () => {
    const value = studioSnapshot()

    const fromValue = parseHenryProblemValue(value)
    const fromText = parseHenryProblem(JSON.stringify(value))

    expect(fromValue).toEqual(fromText)
    expect(fromValue.title).toBe('Custom Function 1')
    expect(fromValue.maxPoints).toBe(3)
  })

  it('refuses anything that is not an object with the same message as the file reader', () => {
    for (const bad of [null, 'text', 42, [1, 2]]) {
      expect(() => parseHenryProblemValue(bad)).toThrow(HenryProblemError)
      expect(() => parseHenryProblemValue(bad)).toThrow(/not a Henry Math editable problem file/)
    }
  })

  it('leaves the rich editor document and the local paths out of the stored projection', () => {
    const parsed = parseHenryProblemValue(studioSnapshot())

    expect(parsed.stored).toEqual({
      format: 'henry-math-editable-problem',
      version: 1,
      problem: parsed.snapshot.problem,
      source_basename: 'Custom Function 1',
      created_at: '2026-08-29T14:41:02-04:00',
    })
    expect((parsed.stored.problem as any).editor_documents).toBeUndefined()
  })
})

describe('source_revision', () => {
  it('survives the round trip through the jsonb column', () => {
    const parsed = parseHenryProblemValue(studioSnapshot())
    const stored = { ...parsed.stored, source_revision: 'abc123' }

    const back = readStoredHenryProblem(JSON.parse(JSON.stringify(stored)))

    expect(back?.source_revision).toBe('abc123')
    expect(back?.problem.title).toBe('Custom Function 1')
  })

  it('is absent on rows the website imported itself', () => {
    const parsed = parseHenryProblemValue(studioSnapshot())

    expect(readStoredHenryProblem(parsed.stored)?.source_revision).toBeUndefined()
  })
})
