import { describe, test, expect } from 'vitest'
import { naturalCompare, resolveTagNames, tagSlug, type KnownTag } from '../challenge-tags'

const KNOWN: KnownTag[] = [
  { id: 'id-algebra', names: ['Algebra', '代数'] },
  { id: 'id-circle', names: ['Circle', '圆'] },
  { id: 'id-roots', names: ['Roots'] },
]

describe('resolveTagNames', () => {
  test('matches existing tags by name', () => {
    const { matchedIds, newNames } = resolveTagNames(['Algebra', 'Roots'], KNOWN)
    expect(matchedIds).toEqual(['id-algebra', 'id-roots'])
    expect(newNames).toEqual([])
  })

  test('matches case-insensitively', () => {
    expect(resolveTagNames(['ALGEBRA', 'circle'], KNOWN).matchedIds)
      .toEqual(['id-algebra', 'id-circle'])
  })

  test('matches on any language a tag is named in', () => {
    // A snapshot tagged in Chinese should hit the same tag as the English name
    expect(resolveTagNames(['代数'], KNOWN).matchedIds).toEqual(['id-algebra'])
  })

  test('reports names that do not exist yet', () => {
    const { matchedIds, newNames } = resolveTagNames(['Algebra', 'Number Theory'], KNOWN)
    expect(matchedIds).toEqual(['id-algebra'])
    expect(newNames).toEqual(['Number Theory'])
  })

  test('collapses duplicates, including across languages', () => {
    const { matchedIds, newNames } = resolveTagNames(
      ['Algebra', '代数', 'algebra', 'Vieta', 'vieta '],
      KNOWN
    )
    expect(matchedIds).toEqual(['id-algebra'])
    expect(newNames).toEqual(['Vieta'])
  })

  test('ignores blank entries', () => {
    const { matchedIds, newNames } = resolveTagNames(['', '   ', 'Circle'], KNOWN)
    expect(matchedIds).toEqual(['id-circle'])
    expect(newNames).toEqual([])
  })

  test('handles an empty tag registry', () => {
    const { matchedIds, newNames } = resolveTagNames(['Algebra'], [])
    expect(matchedIds).toEqual([])
    expect(newNames).toEqual(['Algebra'])
  })
})

describe('naturalCompare', () => {
  test('sorts numbered problems the way a person reads them', () => {
    const files = ['Angle 10', 'Angle 9', 'Angle 11', 'Angle 1']
    expect(files.sort(naturalCompare)).toEqual(['Angle 1', 'Angle 9', 'Angle 10', 'Angle 11'])
  })

  test('keeps real batch filenames in order', () => {
    const files = [
      '方程化簡 10.henryproblem',
      '方程化簡 2.henryproblem',
      '方程化簡 1.henryproblem',
    ]
    expect(files.sort(naturalCompare)).toEqual([
      '方程化簡 1.henryproblem',
      '方程化簡 2.henryproblem',
      '方程化簡 10.henryproblem',
    ])
  })
})

describe('tagSlug', () => {
  test.each([
    ['Number Theory', 'number-theory'],
    ['  Spring 2026  ', 'spring-2026'],
    ['C++ Basics', 'c-basics'],
  ])('tagSlug(%j) === %j', (input, expected) => {
    expect(tagSlug(input)).toBe(expected)
  })
})
