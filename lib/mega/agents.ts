/**
 * Mega workflow agent runners.
 * Each function calls OpenAI with the correct system prompt and returns
 * a typed output. Uses raw fetch — same pattern as the rest of the codebase.
 */

import {
  MATH_SOLVER_PROMPT,
  MATH_TAKEAWAY_PROMPT,
  STORY_BRAINSTORM_PROMPT,
  MEGA_GENERATOR_PROMPT,
} from './prompts'
import type {
  Step1Output,
  Step2Output,
  Step3RawOutput,
  Step4Output,
  StoryPitch,
} from './types'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o'

// ── Core OpenAI caller ────────────────────────────────────────────────────

async function callOpenAI(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  apiKey: string,
): Promise<string> {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage   },
      ],
      max_tokens: maxTokens,
      temperature: 0.2,
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${errText}`)
  }
  const data = await res.json()
  return data.choices[0].message.content as string
}

// ── Vision-aware caller for step 1 when challenge has an image ────────────

async function callOpenAIWithImage(
  systemPrompt: string,
  textMessage: string,
  imageUrl: string,
  maxTokens: number,
  apiKey: string,
): Promise<string> {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text',      text: textMessage },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          ],
        },
      ],
      max_tokens: maxTokens,
      temperature: 0.2,
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI vision error ${res.status}: ${errText}`)
  }
  const data = await res.json()
  return data.choices[0].message.content as string
}

// ── JSON parser ───────────────────────────────────────────────────────────

function parseJSON<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    throw new Error(`Agent returned non-JSON: ${raw.slice(0, 300)}`)
  }
}

// ── Step runners ──────────────────────────────────────────────────────────

export async function runStep1(
  title: string,
  body: string,
  imageUrl: string | null,
  apiKey: string,
): Promise<Step1Output> {
  const userMsg = `Challenge title: ${title}\n\nChallenge description:\n${body}`
  const raw = imageUrl
    ? await callOpenAIWithImage(MATH_SOLVER_PROMPT, userMsg, imageUrl, 2000, apiKey)
    : await callOpenAI(MATH_SOLVER_PROMPT, userMsg, 2000, apiKey)
  return parseJSON<Step1Output>(raw)
}

export async function runStep2(
  title: string,
  body: string,
  step1: Step1Output,
  apiKey: string,
): Promise<Step2Output> {
  const userMsg = [
    `Challenge title: ${title}`,
    `Challenge description:\n${body}`,
    ``,
    `Core trap: ${step1.core_trap}`,
    `Teaching hook: ${step1.teaching_hook}`,
    `Answer: ${step1.answer}`,
    `Solution steps: ${step1.solution_steps.map(s => s.step).join(' → ')}`,
    `Common mistakes: ${step1.common_mistakes.map(m => m.mistake).join(', ')}`,
  ].join('\n')
  const raw = await callOpenAI(MATH_TAKEAWAY_PROMPT, userMsg, 2000, apiKey)
  return parseJSON<Step2Output>(raw)
}

export async function runStep3(
  title: string,
  body: string,
  step1: Step1Output,
  step2: Step2Output,
  apiKey: string,
): Promise<StoryPitch[]> {
  const userMsg = [
    `Challenge title: ${title}`,
    `Challenge description:\n${body}`,
    ``,
    `Core concept to illustrate: ${step2.core_concept}`,
    `Student insight (the payoff line): ${step2.student_insight}`,
    `Teaching angle: ${step2.teaching_angle}`,
    `Connection to prior knowledge (character's starting skill): ${step2.connection_to_prior_knowledge}`,
    `Story hook options: ${step2.story_hook}`,
    `Core trap: ${step1.core_trap}`,
  ].join('\n')
  const raw = await callOpenAI(STORY_BRAINSTORM_PROMPT, userMsg, 2000, apiKey)
  const parsed = parseJSON<Step3RawOutput>(raw)
  if (!Array.isArray(parsed.pitches) || parsed.pitches.length < 3) {
    throw new Error(`Step 3 agent returned ${parsed.pitches?.length ?? 0} pitches, expected 3`)
  }
  return parsed.pitches
}

export async function runStep4(
  title: string,
  body: string,
  step1: Step1Output,
  step2: Step2Output,
  selectedPitch: StoryPitch,
  apiKey: string,
): Promise<Step4Output> {
  const userMsg = [
    `Challenge title: ${title}`,
    `Challenge description:\n${body}`,
    ``,
    `Answer: ${step1.answer}`,
    `Solution steps:`,
    step1.solution_steps.map(s =>
      `  - ${s.step}: ${s.action} | Discovery: ${s.discovery_moment}`
    ).join('\n'),
    ``,
    `Common mistakes:`,
    step1.common_mistakes.map(m => `  - ${m.mistake}: ${m.what_student_writes}`).join('\n'),
    ``,
    `Core concept (Henry's key insight): ${step2.core_concept}`,
    `Student insight (character's realisation line): ${step2.student_insight}`,
    `Teaching angle: ${step2.teaching_angle}`,
    `Challenge extension: ${step2.challenge_extension}`,
    ``,
    `Selected story:`,
    `  Title: ${selectedPitch.title}`,
    `  Character: ${selectedPitch.character}`,
    `  Scenario: ${selectedPitch.scenario}`,
    `  Why it works: ${selectedPitch.why_it_works}`,
  ].join('\n')
  const raw = await callOpenAI(MEGA_GENERATOR_PROMPT, userMsg, 4000, apiKey)
  return parseJSON<Step4Output>(raw)
}
