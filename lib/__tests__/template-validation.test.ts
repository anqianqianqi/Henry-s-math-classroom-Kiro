import { describe, test, expect } from 'vitest'
import {
  validateGenerativeTemplate,
  validateVariable,
  validateTemplateReferences,
} from '../template-validation'

describe('validateGenerativeTemplate', () => {
  test('returns empty array for non-generative template', () => {
    const errors = validateGenerativeTemplate({
      is_generative: false,
      title_template: null,
      description_template: null,
      variables: null,
      answer_formula: null,
    })
    expect(errors).toEqual([])
  })

  test('returns errors when required fields are null for generative template', () => {
    const errors = validateGenerativeTemplate({
      is_generative: true,
      title_template: null,
      description_template: null,
      variables: null,
      answer_formula: null,
    })
    expect(errors).toContain('title_template is required for generative templates')
    expect(errors).toContain('description_template is required for generative templates')
    expect(errors).toContain('variables is required for generative templates')
    expect(errors).toContain('answer_formula is required for generative templates')
  })

  test('returns error when variables is empty object', () => {
    const errors = validateGenerativeTemplate({
      is_generative: true,
      title_template: 'Test {{a}}',
      description_template: 'Desc {{a}}',
      variables: {},
      answer_formula: '{{a}}',
    })
    expect(errors).toContain('At least one variable must be defined')
  })

  test('returns empty array for valid generative template', () => {
    const errors = validateGenerativeTemplate({
      is_generative: true,
      title_template: '{{a}} + {{b}}',
      description_template: 'Calculate {{a}} + {{b}}',
      variables: {
        a: { type: 'random_int', min: 1, max: 10 },
        b: { type: 'random_int', min: 1, max: 10 },
      },
      answer_formula: '{{a}} + {{b}}',
    })
    expect(errors).toEqual([])
  })

  test('detects undefined variable references in title_template', () => {
    const errors = validateGenerativeTemplate({
      is_generative: true,
      title_template: '{{a}} + {{c}}',
      description_template: 'Desc {{a}}',
      variables: {
        a: { type: 'random_int', min: 1, max: 10 },
      },
      answer_formula: '{{a}}',
    })
    expect(errors).toContain('title_template references undefined variable "{{c}}"')
  })

  test('detects undefined variable references in description_template', () => {
    const errors = validateGenerativeTemplate({
      is_generative: true,
      title_template: '{{a}}',
      description_template: 'Desc {{a}} and {{x}}',
      variables: {
        a: { type: 'random_int', min: 1, max: 10 },
      },
      answer_formula: '{{a}}',
    })
    expect(errors).toContain('description_template references undefined variable "{{x}}"')
  })

  test('detects undefined variable references in answer_formula', () => {
    const errors = validateGenerativeTemplate({
      is_generative: true,
      title_template: '{{a}}',
      description_template: 'Desc {{a}}',
      variables: {
        a: { type: 'random_int', min: 1, max: 10 },
      },
      answer_formula: '{{a}} + {{z}}',
    })
    expect(errors).toContain('answer_formula references undefined variable "{{z}}"')
  })

  test('validates variable constraints', () => {
    const errors = validateGenerativeTemplate({
      is_generative: true,
      title_template: '{{a}}',
      description_template: 'Desc {{a}}',
      variables: {
        a: { type: 'random_int', min: 10, max: 5 },
      },
      answer_formula: '{{a}}',
    })
    expect(errors.some(e => e.includes('min <= max'))).toBe(true)
  })
})

describe('validateVariable', () => {
  describe('random_int', () => {
    test('valid random_int passes', () => {
      const errors = validateVariable('x', { type: 'random_int', min: 1, max: 10 })
      expect(errors).toEqual([])
    })

    test('min equal to max is valid', () => {
      const errors = validateVariable('x', { type: 'random_int', min: 5, max: 5 })
      expect(errors).toEqual([])
    })

    test('min greater than max fails', () => {
      const errors = validateVariable('x', { type: 'random_int', min: 10, max: 5 })
      expect(errors).toContain('Variable "x" (random_int) must have min <= max (got min=10, max=5)')
    })

    test('missing min and max fails', () => {
      const errors = validateVariable('x', { type: 'random_int' })
      expect(errors).toContain('Variable "x" (random_int) must have min and max defined')
    })
  })

  describe('random_float', () => {
    test('valid random_float passes', () => {
      const errors = validateVariable('x', { type: 'random_float', min: 0.1, max: 9.9, decimals: 2 })
      expect(errors).toEqual([])
    })

    test('decimals at 0 is valid', () => {
      const errors = validateVariable('x', { type: 'random_float', min: 1, max: 10, decimals: 0 })
      expect(errors).toEqual([])
    })

    test('decimals at 10 is valid', () => {
      const errors = validateVariable('x', { type: 'random_float', min: 1, max: 10, decimals: 10 })
      expect(errors).toEqual([])
    })

    test('decimals below 0 fails', () => {
      const errors = validateVariable('x', { type: 'random_float', min: 1, max: 10, decimals: -1 })
      expect(errors.some(e => e.includes('decimals in range 0-10'))).toBe(true)
    })

    test('decimals above 10 fails', () => {
      const errors = validateVariable('x', { type: 'random_float', min: 1, max: 10, decimals: 11 })
      expect(errors.some(e => e.includes('decimals in range 0-10'))).toBe(true)
    })

    test('missing decimals fails', () => {
      const errors = validateVariable('x', { type: 'random_float', min: 1, max: 10 })
      expect(errors.some(e => e.includes('decimals defined'))).toBe(true)
    })

    test('min greater than max fails', () => {
      const errors = validateVariable('x', { type: 'random_float', min: 10, max: 5, decimals: 2 })
      expect(errors.some(e => e.includes('min <= max'))).toBe(true)
    })
  })

  describe('random_choice', () => {
    test('valid random_choice passes', () => {
      const errors = validateVariable('x', { type: 'random_choice', options: ['a', 'b', 'c'] })
      expect(errors).toEqual([])
    })

    test('exactly 2 options is valid', () => {
      const errors = validateVariable('x', { type: 'random_choice', options: ['a', 'b'] })
      expect(errors).toEqual([])
    })

    test('fewer than 2 options fails', () => {
      const errors = validateVariable('x', { type: 'random_choice', options: ['a'] })
      expect(errors.some(e => e.includes('at least 2 options'))).toBe(true)
    })

    test('empty options array fails', () => {
      const errors = validateVariable('x', { type: 'random_choice', options: [] })
      expect(errors.some(e => e.includes('at least 2 options'))).toBe(true)
    })

    test('missing options fails', () => {
      const errors = validateVariable('x', { type: 'random_choice' })
      expect(errors.some(e => e.includes('options array'))).toBe(true)
    })
  })

  test('invalid type fails', () => {
    const errors = validateVariable('x', { type: 'invalid' as any })
    expect(errors.some(e => e.includes('invalid type'))).toBe(true)
  })
})

describe('validateTemplateReferences', () => {
  test('returns empty array when all references are valid', () => {
    const errors = validateTemplateReferences('{{a}} + {{b}}', ['a', 'b'], 'title_template')
    expect(errors).toEqual([])
  })

  test('detects undefined variable reference', () => {
    const errors = validateTemplateReferences('{{a}} + {{c}}', ['a', 'b'], 'title_template')
    expect(errors).toContain('title_template references undefined variable "{{c}}"')
  })

  test('returns empty array for template with no references', () => {
    const errors = validateTemplateReferences('Hello world', ['a', 'b'], 'title_template')
    expect(errors).toEqual([])
  })

  test('detects multiple undefined references', () => {
    const errors = validateTemplateReferences('{{x}} + {{y}} + {{z}}', ['a'], 'description_template')
    expect(errors).toHaveLength(3)
  })

  test('does not flag the same undefined variable multiple times per occurrence', () => {
    const errors = validateTemplateReferences('{{x}} and {{x}}', ['a'], 'title_template')
    expect(errors).toHaveLength(2) // Each occurrence is flagged
  })
})
