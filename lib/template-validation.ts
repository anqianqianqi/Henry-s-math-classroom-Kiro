import { Variable } from './challenge-generator'

/**
 * Validate a generative template configuration.
 * Returns an array of error messages. Empty array means valid.
 */
export function validateGenerativeTemplate(template: {
  is_generative: boolean
  title_template: string | null | undefined
  description_template: string | null | undefined
  variables: Record<string, Variable> | null | undefined
  answer_formula: string | null | undefined
}): string[] {
  const errors: string[] = []

  if (!template.is_generative) {
    return errors
  }

  // Requirement 5.1: Required fields when is_generative is true
  if (!template.title_template) {
    errors.push('title_template is required for generative templates')
  }
  if (!template.description_template) {
    errors.push('description_template is required for generative templates')
  }
  if (!template.variables) {
    errors.push('variables is required for generative templates')
  }
  if (!template.answer_formula) {
    errors.push('answer_formula is required for generative templates')
  }

  // If variables is missing, we can't validate further
  if (!template.variables) {
    return errors
  }

  // Requirement 5.6: At least one variable must be defined
  const variableKeys = Object.keys(template.variables)
  if (variableKeys.length === 0) {
    errors.push('At least one variable must be defined')
  }

  // Requirement 11.4: Validate JSONB structure of each variable
  for (const [name, variable] of Object.entries(template.variables)) {
    errors.push(...validateVariable(name, variable))
  }

  // Requirement 5.2: Validate template references match variable keys
  if (template.title_template) {
    errors.push(
      ...validateTemplateReferences(template.title_template, variableKeys, 'title_template')
    )
  }
  if (template.description_template) {
    errors.push(
      ...validateTemplateReferences(template.description_template, variableKeys, 'description_template')
    )
  }
  if (template.answer_formula) {
    errors.push(
      ...validateTemplateReferences(template.answer_formula, variableKeys, 'answer_formula')
    )
  }

  return errors
}

/**
 * Validate a single variable definition.
 * Returns an array of error messages for this variable.
 */
export function validateVariable(name: string, variable: Variable): string[] {
  const errors: string[] = []

  if (!variable || typeof variable !== 'object') {
    errors.push(`Variable "${name}" must be an object`)
    return errors
  }

  if (!variable.type) {
    errors.push(`Variable "${name}" must have a type`)
    return errors
  }

  const validTypes = ['random_int', 'random_choice', 'random_float']
  if (!validTypes.includes(variable.type)) {
    errors.push(`Variable "${name}" has invalid type "${variable.type}". Must be one of: ${validTypes.join(', ')}`)
    return errors
  }

  switch (variable.type) {
    case 'random_int': {
      if (variable.min == null || variable.max == null) {
        errors.push(`Variable "${name}" (random_int) must have min and max defined`)
      } else if (variable.min > variable.max) {
        // Requirement 5.3: min <= max
        errors.push(`Variable "${name}" (random_int) must have min <= max (got min=${variable.min}, max=${variable.max})`)
      }
      break
    }
    case 'random_float': {
      if (variable.min == null || variable.max == null) {
        errors.push(`Variable "${name}" (random_float) must have min and max defined`)
      } else if (variable.min > variable.max) {
        errors.push(`Variable "${name}" (random_float) must have min <= max (got min=${variable.min}, max=${variable.max})`)
      }
      if (variable.decimals == null) {
        errors.push(`Variable "${name}" (random_float) must have decimals defined`)
      } else if (variable.decimals < 0 || variable.decimals > 10) {
        // Requirement 5.4: decimals in range 0-10
        errors.push(`Variable "${name}" (random_float) must have decimals in range 0-10 (got ${variable.decimals})`)
      }
      break
    }
    case 'random_choice': {
      if (!variable.options || !Array.isArray(variable.options)) {
        errors.push(`Variable "${name}" (random_choice) must have an options array`)
      } else if (variable.options.length < 2) {
        // Requirement 5.5: at least 2 options
        errors.push(`Variable "${name}" (random_choice) must have at least 2 options (got ${variable.options.length})`)
      }
      break
    }
  }

  return errors
}

/**
 * Validate that all {{variable}} references in a template string
 * have matching keys in the variables definition.
 * Returns an array of error messages.
 */
export function validateTemplateReferences(
  template: string,
  variableKeys: string[],
  fieldName: string
): string[] {
  const errors: string[] = []
  const pattern = /\{\{(\w+)\}\}/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(template)) !== null) {
    const referencedVar = match[1]
    if (!variableKeys.includes(referencedVar)) {
      errors.push(`${fieldName} references undefined variable "{{${referencedVar}}}"`)
    }
  }

  return errors
}
