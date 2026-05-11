import { NextResponse } from 'next/server'

/**
 * POST /api/generate-template
 * 
 * Takes a plain-language description and returns a generative template JSON
 * that fits the system's expected format.
 * 
 * Body: { prompt: string }
 * Returns: { titleTemplate, descriptionTemplate, variables, answerFormula, maxPoints }
 * 
 * Requires OPENAI_API_KEY env var.
 */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured. Add OPENAI_API_KEY to environment variables.' },
      { status: 503 }
    )
  }

  const { prompt } = await request.json()

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
  }

  const systemPrompt = `You are a math challenge template generator. Given a teacher's description, output a JSON object for a generative challenge template.

The template system uses {{variable_name}} placeholders that get replaced with random values.

Variable types:
- random_int: { "type": "random_int", "min": <number>, "max": <number> }
- random_float: { "type": "random_float", "min": <number>, "max": <number>, "decimals": <number> }
- random_choice: { "type": "random_choice", "options": ["option1", "option2", ...] }

Output ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "titleTemplate": "Challenge title with {{variables}}",
  "descriptionTemplate": "Description with {{variables}} explaining what to solve",
  "variables": {
    "varName": { "type": "random_int", "min": 1, "max": 10 }
  },
  "answerFormula": "{{a}} * {{b}}",
  "maxPoints": 10
}

Rules:
- answerFormula must be a valid arithmetic expression using +, -, *, /, %, () and {{variables}}
- All {{variable}} references in templates must exist in the variables object
- Use descriptive variable names (a, b, x, y, num1, num2, etc.)
- maxPoints should be 10 unless the problem is complex
- Support Chinese and English in titles/descriptions if the teacher's prompt is in Chinese`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: `OpenAI API error: ${response.status}` }, { status: 502 })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim()

    if (!content) {
      return NextResponse.json({ error: 'Empty response from OpenAI' }, { status: 502 })
    }

    // Parse the JSON response (strip markdown code fences if present)
    const jsonStr = content.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    const template = JSON.parse(jsonStr)

    // Validate required fields
    if (!template.titleTemplate || !template.descriptionTemplate || !template.variables || !template.answerFormula) {
      return NextResponse.json({ error: 'Invalid template structure from AI' }, { status: 502 })
    }

    return NextResponse.json(template)
  } catch (err: any) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'Failed to parse AI response as JSON' }, { status: 502 })
    }
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
