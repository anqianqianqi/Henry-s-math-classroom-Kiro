# Generative Challenge Templates - Design Document

## Overview
Teachers can create "generative templates" that produce randomized challenges. Each template defines a pattern with variables that get filled with random values when generating a challenge.

## Example
- Template: "九九乘法: {{a}} × {{b}}"
- Variables: a (1-9), b (1-9)
- Generated challenge: "九九乘法: 3 × 7" with description "計算 3 × 7 = ?" and expected answer "21"

## Database Design

### Option A: Add columns to existing `challenge_templates` table

```sql
ALTER TABLE challenge_templates ADD COLUMN IF NOT EXISTS is_generative BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE challenge_templates ADD COLUMN IF NOT EXISTS title_template TEXT; -- "九九乘法: {{a}} × {{b}}"
ALTER TABLE challenge_templates ADD COLUMN IF NOT EXISTS description_template TEXT; -- "計算 {{a}} × {{b}} = ?"
ALTER TABLE challenge_templates ADD COLUMN IF NOT EXISTS variables JSONB; -- {"a": {"type": "random_int", "min": 1, "max": 9}, "b": {...}}
ALTER TABLE challenge_templates ADD COLUMN IF NOT EXISTS answer_formula TEXT; -- "{{a}} * {{b}}"
ALTER TABLE challenge_templates ADD COLUMN IF NOT EXISTS max_points INT NOT NULL DEFAULT 10;
ALTER TABLE challenge_templates ADD COLUMN IF NOT EXISTS tag_ids UUID[];

-- Add template_id to daily_challenges for dedup
ALTER TABLE daily_challenges ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES challenge_templates(id);
ALTER TABLE daily_challenges ADD COLUMN IF NOT EXISTS expected_answer TEXT;

-- Index for dedup lookup
CREATE INDEX IF NOT EXISTS idx_challenges_template_title ON daily_challenges(template_id, title) WHERE template_id IS NOT NULL;

-- Grant access
GRANT ALL ON challenge_templates TO authenticated;
GRANT ALL ON challenge_templates TO anon;
SELECT pg_notify('pgrst', 'reload schema');
```

### Variable Types Supported
- `random_int`: { type: "random_int", min: 1, max: 9 }
- `random_choice`: { type: "random_choice", options: ["apple", "banana", "cherry"] }
- `random_float`: { type: "random_float", min: 0.1, max: 9.9, decimals: 1 }

## Generation Logic (`lib/challenge-generator.ts`)

```typescript
interface Variable {
  type: 'random_int' | 'random_choice' | 'random_float'
  min?: number
  max?: number
  options?: string[]
  decimals?: number
}

interface GenerativeTemplate {
  id: string
  title_template: string
  description_template: string
  variables: Record<string, Variable>
  answer_formula: string
  max_points: number
  tag_ids: string[]
}

function generateValues(variables: Record<string, Variable>): Record<string, any> {
  const values: Record<string, any> = {}
  for (const [name, def] of Object.entries(variables)) {
    if (def.type === 'random_int') {
      values[name] = Math.floor(Math.random() * (def.max! - def.min! + 1)) + def.min!
    } else if (def.type === 'random_choice') {
      values[name] = def.options![Math.floor(Math.random() * def.options!.length)]
    } else if (def.type === 'random_float') {
      const raw = Math.random() * (def.max! - def.min!) + def.min!
      values[name] = parseFloat(raw.toFixed(def.decimals || 1))
    }
  }
  return values
}

function fillTemplate(template: string, values: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key] ?? key))
}

function evaluateFormula(formula: string, values: Record<string, any>): string {
  const filled = fillTemplate(formula, values)
  try {
    // Safe eval for simple math expressions
    const result = Function('"use strict"; return (' + filled + ')')()
    return String(result)
  } catch {
    return ''
  }
}

async function generateChallenge(template: GenerativeTemplate, supabase: any, userId: string) {
  const values = generateValues(template.variables)
  const title = fillTemplate(template.title_template, values)
  const description = fillTemplate(template.description_template, values)
  const answer = evaluateFormula(template.answer_formula, values)

  // Dedup check
  const { data: existing } = await supabase
    .from('daily_challenges')
    .select('id')
    .eq('template_id', template.id)
    .eq('title', title)
    .maybeSingle()

  if (existing) return existing.id

  // Create new challenge
  const { data: challenge } = await supabase
    .from('daily_challenges')
    .insert({
      title,
      description,
      template_id: template.id,
      expected_answer: answer,
      max_points: template.max_points,
      tag_ids: template.tag_ids,
      challenge_date: new Date().toISOString().split('T')[0],
      created_by: userId
    })
    .select('id')
    .single()

  return challenge?.id
}
```

## Admin UI (`/admin/generative-templates`)

### Create Form
- Title Template: text input with {{variable}} syntax highlighted
- Description Template: textarea with {{variable}} syntax
- Variables section: add/remove variables with name, type, min, max
- Answer Formula: text input (e.g. "{{a}} * {{b}}")
- Max Points: number input
- Tags: tag picker (same as challenge create)
- "Preview" button: shows 3 sample generated challenges
- "Generate Now" button: creates one challenge immediately

### List View
- Shows all generative templates
- Each shows: title pattern, variable count, how many challenges generated from it
- Edit/Delete buttons
- "Generate" button on each

## Scheduler Integration
- When scheduler picks a template with `is_generative = true`, it calls `generateChallenge()` instead of directly assigning
- The generated challenge gets assigned to the class like normal

## Phase 2: ChatGPT Integration (future)
- Add a text box: "Describe what you want in plain language"
- Call OpenAI API with a system prompt that outputs the template JSON
- Teacher reviews the generated template, edits if needed, saves
- Needs: OpenAI API key in env vars, API route at `/api/generate-template`

## Files to Create/Modify
1. `supabase/add-generative-templates.sql` - DB migration
2. `lib/challenge-generator.ts` - Generation logic
3. `app/admin/generative-templates/page.tsx` - Admin UI
4. `lib/scheduler.ts` - Add generative template support
5. `app/challenges/new/page.tsx` - Add "Generate from Template" option

## Notes
- The `challenge_templates` table already exists (used for "Save as Template" feature)
- We're extending it with generative fields rather than creating a new table
- The dedup index on (template_id, title) ensures no duplicate challenges
- Expected answer enables future auto-grading
