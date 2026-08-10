import { describe, it, expect } from 'vitest'
import { parseRows, serialiseRows, type Row } from '../rows'
import { maskMath } from '@/lib/mathtext-core'

describe('a stored solution splits into rows', () => {
  it('reads a whole-line equation as a math row', () => {
    expect(parseRows('$a+b=c+d$')).toEqual([{ kind: 'math', latex: 'a+b=c+d' }])
  })

  it('reads prose as a text row', () => {
    expect(parseRows('Subtract c from both sides')).toEqual([
      { kind: 'text', value: 'Subtract c from both sides' },
    ])
  })

  it('keeps a line that only contains some math as prose', () => {
    // Tearing "since $a>c$, subtract" into three rows would scatter one
    // sentence down the page. A row is a step, not a token.
    const rows = parseRows('since $a>c$, subtract c')
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe('text')
  })

  it('leaves money alone', () => {
    // The `$...$` currency trap: this must never become an equation.
    const rows = parseRows('I have $12 and $5 left')
    expect(rows[0].kind).toBe('text')
  })

  it('parses an existing plain-text submission as one text row', () => {
    // No migration: everything already in the database is valid input.
    const old = 'b is less than d because a is bigger than c'
    expect(parseRows(old)).toEqual([{ kind: 'text', value: old }])
  })
})

describe('rows serialise back to the stored format', () => {
  const rows: Row[] = [
    { kind: 'text', value: 'Subtract c from both sides:' },
    { kind: 'math', latex: 'a+b-c=d' },
    { kind: 'math', latex: 'b<d' },
  ]

  it('joins with newlines and wraps the maths', () => {
    expect(serialiseRows(rows)).toBe('Subtract c from both sides:\n$a+b-c=d$\n$b<d$')
  })

  it('round-trips', () => {
    expect(parseRows(serialiseRows(rows))).toEqual(rows)
  })

  it('drops a row the student added and left blank', () => {
    expect(serialiseRows([...rows, { kind: 'text', value: '   ' }])).toBe(serialiseRows(rows))
  })

  it('leaves a bare command undoubled', () => {
    // \angle is a whole token already; wrapping it in dollars too would store
    // `$\angle$`, which reads back the same but is not what mathtext writes.
    expect(serialiseRows([{ kind: 'math', latex: '\\angle' }])).toBe('\\angle')
  })
})

describe('what the translator will see', () => {
  it('hides every equation and keeps every word', () => {
    // This is requirement 4, and it costs nothing: the format is already the
    // one translateUserText masks before calling the engine.
    const stored = serialiseRows([
      { kind: 'text', value: 'Subtract c from both sides:' },
      { kind: 'math', latex: 'a+b-c=d' },
    ])
    const { masked, math } = maskMath(stored)

    expect(masked).toBe('Subtract c from both sides:\n⟦M0⟧')
    expect(math).toEqual(['a+b-c=d'])
  })
})
