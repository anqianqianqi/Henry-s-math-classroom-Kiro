import { describe, it, expect } from 'vitest'
import { readAnswers } from '@/lib/solutions/answers'

const problems = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]
const box = { x: 0.1, y: 0.2, w: 0.6, h: 0.3 }
const wrap = (answers: unknown) => JSON.stringify({ answers })

describe('readAnswers', () => {
  it('reads a well-formed reply', () => {
    const out = readAnswers(wrap([{ id: 'p1', found: true, page: 0, box, confidence: 0.9 }]), problems, 3)
    expect(out).toEqual([{ id: 'p1', page: 0, box, confidence: 0.9 }])
  })

  it('accepts a bare array as well as an answers object', () => {
    const out = readAnswers(JSON.stringify([{ id: 'p2', page: 1, box }]), problems, 3)
    expect(out?.[0].id).toBe('p2')
  })

  it('survives a code fence', () => {
    const out = readAnswers('```json\n' + wrap([{ id: 'p1', page: 0, box }]) + '\n```', problems, 3)
    expect(out).toHaveLength(1)
  })

  it('returns null for something that is not JSON at all', () => {
    expect(readAnswers('I could not read these pages, sorry.', problems, 3)).toBeNull()
    expect(readAnswers('', problems, 3)).toBeNull()
  })

  it('returns an empty list when nothing was found', () => {
    const out = readAnswers(wrap([{ id: 'p1', found: false }]), problems, 3)
    expect(out).toEqual([])
  })

  // The cases that would post work under the wrong problem, or crop nothing.
  it('drops an id that was never sent', () => {
    const out = readAnswers(wrap([{ id: 'made-up', page: 0, box }]), problems, 3)
    expect(out).toEqual([])
  })

  it('drops a page past the end of the upload', () => {
    expect(readAnswers(wrap([{ id: 'p1', page: 3, box }]), problems, 3)).toEqual([])
    expect(readAnswers(wrap([{ id: 'p1', page: -1, box }]), problems, 3)).toEqual([])
    expect(readAnswers(wrap([{ id: 'p1', page: 1.5, box }]), problems, 3)).toEqual([])
  })

  it('keeps only the first answer for a repeated problem', () => {
    const out = readAnswers(wrap([
      { id: 'p1', page: 0, box, confidence: 0.9 },
      { id: 'p1', page: 2, box, confidence: 0.4 },
    ]), problems, 3)
    expect(out).toHaveLength(1)
    expect(out?.[0].page).toBe(0)
  })

  it('drops a box that is missing, degenerate, or not numeric', () => {
    expect(readAnswers(wrap([{ id: 'p1', page: 0 }]), problems, 3)).toEqual([])
    expect(readAnswers(wrap([{ id: 'p1', page: 0, box: { x: 0, y: 0, w: 0, h: 0.5 } }]), problems, 3)).toEqual([])
    expect(readAnswers(wrap([{ id: 'p1', page: 0, box: { x: 'a', y: 0, w: 0.5, h: 0.5 } }]), problems, 3)).toEqual([])
  })

  it('defaults a missing confidence and clamps a silly one', () => {
    const none = readAnswers(wrap([{ id: 'p1', page: 0, box }]), problems, 3)
    expect(none?.[0].confidence).toBe(0.5)
    const over = readAnswers(wrap([{ id: 'p1', page: 0, box, confidence: 7 }]), problems, 3)
    expect(over?.[0].confidence).toBe(1)
  })

  it('keeps the good answers when one entry is rubbish', () => {
    const out = readAnswers(wrap([
      { id: 'p1', page: 0, box },
      null,
      { id: 'nope', page: 0, box },
      { id: 'p3', page: 2, box },
    ]), problems, 3)
    expect(out?.map(a => a.id)).toEqual(['p1', 'p3'])
  })

  it('returns null when the shape is right but answers is not a list', () => {
    expect(readAnswers(JSON.stringify({ answers: 'none' }), problems, 3)).toBeNull()
  })
})
