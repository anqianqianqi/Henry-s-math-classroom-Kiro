import { SupabaseClient } from '@supabase/supabase-js'

// --- Types and Interfaces ---

export interface Variable {
  type: 'random_int' | 'random_choice' | 'random_float'
  min?: number
  max?: number
  options?: string[]
  decimals?: number
}

export interface GenerativeTemplate {
  id: string
  title_template: string
  description_template: string
  variables: Record<string, Variable>
  answer_formula: string
  max_points: number
  tag_ids: string[]
}

export interface GeneratedChallenge {
  title: string
  description: string
  expected_answer: string
  values: Record<string, number | string>
}

// --- Core Functions ---

/**
 * Generate random values for all template variables.
 * Each value satisfies the constraints defined by its variable type.
 */
export function generateValues(
  variables: Record<string, Variable>
): Record<string, number | string> {
  const values: Record<string, number | string> = {}

  for (const [name, def] of Object.entries(variables)) {
    switch (def.type) {
      case 'random_int': {
        const min = def.min!
        const max = def.max!
        const range = max - min + 1
        values[name] = Math.floor(Math.random() * range) + min
        break
      }
      case 'random_float': {
        const min = def.min!
        const max = def.max!
        const decimals = def.decimals ?? 1
        const raw = Math.random() * (max - min) + min
        values[name] = parseFloat(raw.toFixed(decimals))
        break
      }
      case 'random_choice': {
        const options = def.options!
        const index = Math.floor(Math.random() * options.length)
        values[name] = options[index]
        break
      }
    }
  }

  return values
}

/**
 * Replace all {{variable_name}} patterns in a template string with values.
 * Missing keys are replaced with the key name as a literal string.
 * The original template string is not mutated.
 */
export function fillTemplate(
  template: string,
  values: Record<string, number | string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return key in values ? String(values[key]) : key
  })
}

/**
 * Safely evaluate a mathematical formula with variable substitution.
 * Returns the string result of the evaluation, or empty string on failure.
 * Never throws exceptions.
 */
export function evaluateFormula(
  formula: string,
  values: Record<string, number | string>
): string {
  try {
    // Substitute all {{variable}} placeholders with numeric values
    const filled = fillTemplate(formula, values)

    // Validate expression against arithmetic allowlist
    const safePattern = /^[\d\s+\-*/%().]+$/
    if (!safePattern.test(filled)) {
      return ''
    }

    // Evaluate using Function constructor (sandboxed arithmetic only)
    const result = Function('"use strict"; return (' + filled + ')')()
    return String(result)
  } catch {
    return ''
  }
}

/**
 * Generate a preview challenge without any database interaction.
 * Returns a GeneratedChallenge object with filled title, description,
 * expected answer, and the generated values.
 */
export function previewChallenge(template: GenerativeTemplate): GeneratedChallenge {
  const values = generateValues(template.variables)
  const title = fillTemplate(template.title_template, values)
  const description = fillTemplate(template.description_template, values)
  const expected_answer = evaluateFormula(template.answer_formula, values)

  return {
    title,
    description,
    expected_answer,
    values,
  }
}

/**
 * Generate a challenge from a template and persist it to the database.
 * Performs deduplication check against (template_id, title).
 * Returns the challenge ID on success, existing ID if duplicate, or null on error.
 * Never throws exceptions.
 */
export async function generateChallenge(
  template: GenerativeTemplate,
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  try {
    // Step 1: Generate random values
    const values = generateValues(template.variables)

    // Step 2: Fill title and description templates
    const title = fillTemplate(template.title_template, values)
    const description = fillTemplate(template.description_template, values)

    // Step 3: Compute expected answer
    const expected_answer = evaluateFormula(template.answer_formula, values)

    // Step 4: Deduplication check against (template_id, title)
    const { data: existing } = await supabase
      .from('daily_challenges')
      .select('id')
      .eq('template_id', template.id)
      .eq('title', title)
      .maybeSingle()

    if (existing) {
      return existing.id
    }

    // Step 5: Insert new daily challenge record
    const { data: challenge, error } = await supabase
      .from('daily_challenges')
      .insert({
        title,
        description,
        template_id: template.id,
        expected_answer,
        max_points: template.max_points,
        tag_ids: template.tag_ids,
        challenge_date: new Date().toISOString().split('T')[0],
        created_by: userId,
      })
      .select('id')
      .single()

    if (error) {
      return null
    }

    return challenge.id
  } catch {
    return null
  }
}
