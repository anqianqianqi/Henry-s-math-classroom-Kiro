import 'server-only'
import { z } from 'zod'

export async function structuredResponse<T>(input: { instructions: string; prompt: string; name: string; schema: Record<string, unknown>; validate: z.ZodType<T> }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing')
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini', instructions: input.instructions, input: input.prompt, store: false,
      text: { format: { type: 'json_schema', name: input.name, strict: true, schema: input.schema } },
    }),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body?.error?.message || `OpenAI returned ${response.status}`)
  const outputText = body.output_text || body.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === 'output_text')?.text
  if (!outputText) throw new Error('OpenAI returned no structured output')
  return input.validate.parse(JSON.parse(outputText))
}
