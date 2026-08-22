import { describe, it, expect } from 'vitest'
import { clampRangeEnd } from '@/lib/problemSet/query'
import { mayPrintClass, type ProblemSetScope } from '@/lib/problemSet/viewer'

const student: ProblemSetScope = {
  userId: 'student-1',
  isTeacher: false,
  classes: [{ id: 'class-a', name: 'Algebra' }, { id: 'class-b', name: 'Geometry' }],
  notAfter: '2026-08-16',
}

const teacher: ProblemSetScope = {
  userId: 'teacher-1',
  isTeacher: true,
  classes: [{ id: 'class-a', name: 'Algebra' }, { id: 'class-z', name: 'Someone else’s' }],
}

const signedOut: ProblemSetScope = { userId: null, isTeacher: false, classes: [] }

describe('mayPrintClass', () => {
  it('lets a student print a class they are in', () => {
    expect(mayPrintClass(student, 'class-a')).toBe(true)
    expect(mayPrintClass(student, 'class-b')).toBe(true)
  })

  // The point of checking on the printing page: the class id comes from a URL.
  it('refuses a class the student is not in', () => {
    expect(mayPrintClass(student, 'class-z')).toBe(false)
    expect(mayPrintClass(student, 'anything-else')).toBe(false)
    expect(mayPrintClass(student, '')).toBe(false)
  })

  it('lets a teacher print any class they were given', () => {
    expect(mayPrintClass(teacher, 'class-z')).toBe(true)
  })

  it('refuses everything when signed out', () => {
    expect(mayPrintClass(signedOut, 'class-a')).toBe(false)
  })
})

describe('clampRangeEnd', () => {
  it('leaves a range that ends before the horizon alone', () => {
    expect(clampRangeEnd('2026-08-10', '2026-08-16')).toBe('2026-08-10')
  })

  it('pulls a range back to the horizon', () => {
    expect(clampRangeEnd('2026-12-31', '2026-08-16')).toBe('2026-08-16')
  })

  it('keeps a range that ends exactly on the horizon', () => {
    expect(clampRangeEnd('2026-08-16', '2026-08-16')).toBe('2026-08-16')
  })

  // A teacher, or a student who asked to read ahead.
  it('does not clamp when there is no horizon', () => {
    expect(clampRangeEnd('2099-01-01', undefined)).toBe('2099-01-01')
  })

  // ISO dates compare correctly as strings; this is the assumption the whole
  // rule rests on, including across a year boundary.
  it('compares dates across a year boundary', () => {
    expect(clampRangeEnd('2027-01-02', '2026-12-31')).toBe('2026-12-31')
    expect(clampRangeEnd('2026-12-30', '2026-12-31')).toBe('2026-12-30')
  })
})
