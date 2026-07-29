import { describe, test, expect } from 'vitest'
import {
  HenryProblemError,
  isHenryProblemFile,
  normalizeCrop,
  parseHenryProblem,
  parseScore,
  readStoredHenryProblem,
  FULL_CROP,
} from '../henryproblem'

/** Shaped exactly like a real snapshot from tools/problem_snapshot.py. */
function snapshot(overrides: Record<string, any> = {}) {
  const { problem: problemOverrides, ...envelopeOverrides } = overrides
  return JSON.stringify({
    format: 'henry-math-editable-problem',
    version: 1,
    created_at: '2026-07-27T07:55:58-04:00',
    updated_at: '2026-07-27T07:55:58-04:00',
    output_basename: 'Vieta 1',
    output_format: 'jpeg',
    source_file: 'C:\\Daily Problems\\Pasted Problem.png',
    preview_file: 'C:\\Daily Problems\\Vieta 1.jpg',
    problem: {
      mode: 'no_graph',
      title: 'Vieta 1',
      score: '3',
      tags: ['Algebra', 'Equation', 'Roots'],
      english: 'Given real numbers $m$, $n$, find $\\frac{n}{m}$.',
      chinese: '已知实数 $m$，$n$，求 $\\frac{n}{m}$。',
      notes: '',
      ...(problemOverrides || {}),
    },
    graph: null,
    ...envelopeOverrides,
  })
}

describe('parseHenryProblem', () => {
  test('maps snapshot fields 1-to-1 with no parsing needed', () => {
    const parsed = parseHenryProblem(snapshot())

    expect(parsed.title).toBe('Vieta 1')
    expect(parsed.maxPoints).toBe(3)
    expect(parsed.tagNames).toEqual(['Algebra', 'Equation', 'Roots'])
    expect(parsed.description).toContain('Given real numbers')
    expect(parsed.description).toContain('已知实数')
    expect(parsed.graphDataUrl).toBeNull()
  })

  test('strips the embedded graph from the stored projection', () => {
    const withGraph = snapshot({
      problem: { mode: 'graph' },
      graph: { format: 'png', encoding: 'base64', data: 'iVBORw0KGgo=' },
    })
    const parsed = parseHenryProblem(withGraph)

    expect(parsed.graphDataUrl).toBe('data:image/png;base64,iVBORw0KGgo=')
    expect(parsed.snapshot.graph).not.toBeNull()
    // The jsonb column must never carry the base64 blob.
    expect(JSON.stringify(parsed.stored)).not.toContain('iVBORw0KGgo=')
    expect((parsed.stored as any).graph).toBeUndefined()
  })

  test('rejects a file that is not a Henry snapshot', () => {
    const notHenry = JSON.stringify({ format: 'something-else', version: 1, problem: {} })
    expect(() => parseHenryProblem(notHenry)).toThrow(HenryProblemError)
  })

  test('rejects an unsupported version rather than guessing', () => {
    expect(() => parseHenryProblem(snapshot({ version: 2 }))).toThrow(/version/i)
  })

  test('rejects malformed JSON with a readable message', () => {
    expect(() => parseHenryProblem('{ not json')).toThrow(/not valid JSON/i)
  })

  test('rejects a snapshot with no wording in either language', () => {
    expect(() =>
      parseHenryProblem(snapshot({ problem: { english: '', chinese: '' } }))
    ).toThrow(/no English or Chinese wording/i)
  })

  test('accepts a snapshot with only one language', () => {
    const parsed = parseHenryProblem(snapshot({ problem: { chinese: '' } }))
    expect(parsed.description).toBe('Given real numbers $m$, $n$, find $\\frac{n}{m}$.')
  })

  test('graph mode without an attached graph still parses', () => {
    const parsed = parseHenryProblem(snapshot({ problem: { mode: 'graph' }, graph: null }))
    expect(parsed.snapshot.problem.mode).toBe('graph')
    expect(parsed.graphDataUrl).toBeNull()
  })

  test('rejects a graph in an unsupported encoding', () => {
    const bad = snapshot({ graph: { format: 'jpeg', encoding: 'base64', data: 'x' } })
    expect(() => parseHenryProblem(bad)).toThrow(/unsupported graph/i)
  })
})

describe('parseScore', () => {
  test.each([
    ['3', 3],
    ['3 pts', 3],
    ['10 points', 10],
    ['2.6', 3],
    ['', null],
    ['   ', null],
    ['n/a', null],
    ['0', null],
  ])('parseScore(%j) === %j', (input, expected) => {
    expect(parseScore(input)).toBe(expected)
  })
})

describe('normalizeCrop', () => {
  test('passes through a valid rectangle', () => {
    expect(normalizeCrop({ left: 0.1, top: 0.2, right: 0.9, bottom: 0.8 })).toEqual({
      left: 0.1, top: 0.2, right: 0.9, bottom: 0.8,
    })
  })

  test('clamps values outside 0..1', () => {
    expect(normalizeCrop({ left: -1, top: -1, right: 5, bottom: 5 })).toEqual(FULL_CROP)
  })

  test('falls back to the full image when the rectangle collapses', () => {
    // Matches the <0.005 guard in homework_prettifier.py
    expect(normalizeCrop({ left: 0.5, top: 0.5, right: 0.502, bottom: 0.9 })).toEqual(FULL_CROP)
  })

  test('falls back to the full image for missing or junk input', () => {
    expect(normalizeCrop(undefined)).toEqual(FULL_CROP)
    expect(normalizeCrop('nope')).toEqual(FULL_CROP)
  })
})

describe('readStoredHenryProblem', () => {
  test('round-trips what parseHenryProblem stored', () => {
    const stored = parseHenryProblem(snapshot()).stored
    const read = readStoredHenryProblem(JSON.parse(JSON.stringify(stored)))

    expect(read).not.toBeNull()
    expect(read!.problem.title).toBe('Vieta 1')
    expect(read!.problem.tags).toEqual(['Algebra', 'Equation', 'Roots'])
    expect(read!.problem.chinese).toContain('已知实数')
  })

  test('returns null for plain challenges so callers fall back', () => {
    expect(readStoredHenryProblem(null)).toBeNull()
    expect(readStoredHenryProblem(undefined)).toBeNull()
    expect(readStoredHenryProblem({ format: 'other' })).toBeNull()
    expect(readStoredHenryProblem('a string')).toBeNull()
  })
})

describe('isHenryProblemFile', () => {
  test('matches regardless of case', () => {
    expect(isHenryProblemFile('Vieta 1.henryproblem')).toBe(true)
    expect(isHenryProblemFile('Vieta 1.HENRYPROBLEM')).toBe(true)
    expect(isHenryProblemFile('Vieta 1.json')).toBe(false)
    expect(isHenryProblemFile('henryproblem')).toBe(false)
  })
})
