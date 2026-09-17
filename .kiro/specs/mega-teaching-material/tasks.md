# Implementation Tasks — Mega Teaching Material Workflow

## Conventions used in this file

- Every sub-task is atomic: one file, one concern.
- "Exact pattern" means copy the described structure verbatim — don't invent new patterns.
- Auth guard pattern = the `useEffect → init() → getUser → user_roles → roles → isTeacher` block from `app/admin/shop/page.tsx` lines 592–630.
- API route auth pattern = the dual-token block from `app/api/ta/grade/route.ts` lines 571–592.
- All Supabase calls in API routes use `createClient(SUPABASE_URL, SUPABASE_KEY)` from `@supabase/supabase-js` (NOT `@/lib/supabase/client`).
- All admin pages use `import { createClient } from '@/lib/supabase/client'` and `const supabase = createClient()`.
- Claude is called via raw `fetch` to `https://api.anthropic.com/v1/messages` (not an SDK) — same approach the codebase uses for OpenAI.

---

## Task 1 — Install Anthropic dependency

**File:** `package.json`  
**What to do:**
- Run `npm install @anthropic-ai/sdk` — OR — we skip the SDK and use raw `fetch` against `https://api.anthropic.com/v1/messages` (matching the existing OpenAI pattern). Use raw `fetch` to stay consistent with the codebase.
- No SDK needed. The `callClaude()` helper in Task 4 will use `fetch` directly.
- Add `ANTHROPIC_API_KEY=` to `.env.example` (alongside existing `OPENAI_API_KEY=`).

**Acceptance:** `.env.example` has `ANTHROPIC_API_KEY=your-anthropic-key-here` as a new line. No package change required.

---

## Task 2 — Database migration

**File:** `supabase/add-mega-workflows.sql`  
**What to write — exact SQL:**

```sql
-- Mega Teaching Material Workflows
-- Stores one workflow per challenge-generation session.
-- Each step's raw agent output and Henry's approved (possibly edited) version
-- are stored separately so we can audit how much Henry changes the AI output.

CREATE TABLE IF NOT EXISTS mega_workflows (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source challenge — exactly one must be non-null
  challenge_id     UUID REFERENCES daily_challenges(id) ON DELETE SET NULL,
  bank_item_id     UUID REFERENCES challenge_bank(id) ON DELETE SET NULL,

  created_by       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Snapshot of challenge at workflow creation time
  -- (so workflow stays coherent if challenge is later edited)
  challenge_title  TEXT NOT NULL,
  challenge_body   TEXT NOT NULL,
  challenge_image_url TEXT,          -- null if no image; used for vision in step 1

  -- Workflow status
  status           TEXT NOT NULL DEFAULT 'step1_pending'
                   CHECK (status IN (
                     'step1_pending',
                     'step1_done',
                     'step2_pending',
                     'step2_done',
                     'step3_pending',
                     'step3_done',
                     'step4_pending',
                     'completed'
                   )),

  -- Raw agent outputs (what the AI produced before Henry touched it)
  step1_raw        JSONB,
  step2_raw        JSONB,
  step3_raw        JSONB,
  step4_raw        JSONB,

  -- Approved outputs (what Henry approved, possibly after editing)
  -- step1_output: { answer, solution_steps: string[], common_mistakes: string[], difficulty_note }
  step1_output     JSONB,
  -- step2_output: { core_concept, student_insight, teaching_angle, connection_to_prior_knowledge }
  step2_output     JSONB,
  -- step3_output: { selected_pitch: StoryPitch, all_pitches: StoryPitch[] }
  step3_output     JSONB,
  -- step4_output: { story_intro, challenge, solution: string[], key_insight, common_traps: string[], challenge_yourself }
  step4_output     JSONB,

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_mega_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mega_workflows_updated_at
  BEFORE UPDATE ON mega_workflows
  FOR EACH ROW EXECUTE FUNCTION update_mega_workflows_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mega_workflows_created_by   ON mega_workflows(created_by);
CREATE INDEX IF NOT EXISTS idx_mega_workflows_challenge_id ON mega_workflows(challenge_id);
CREATE INDEX IF NOT EXISTS idx_mega_workflows_bank_item_id ON mega_workflows(bank_item_id);
CREATE INDEX IF NOT EXISTS idx_mega_workflows_status       ON mega_workflows(status);

-- RLS
ALTER TABLE mega_workflows ENABLE ROW LEVEL SECURITY;

-- Teachers see their own workflows
CREATE POLICY "Teachers can read own mega_workflows"
  ON mega_workflows FOR SELECT
  USING (created_by = auth.uid());

-- Admins see all workflows
CREATE POLICY "Admins can read all mega_workflows"
  ON mega_workflows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name = 'administrator'
    )
  );

-- Only service role writes (all mutations go through API routes)
CREATE POLICY "Service role manages mega_workflows"
  ON mega_workflows FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';
```

**Acceptance:** File is valid SQL. Running it on the Supabase project creates the table with all columns and policies.

---

## Task 3 — TypeScript types

**File:** `lib/mega/types.ts`  
**What to write:**

```ts
// ── Step output shapes ────────────────────────────────────────────────────

export interface Step1Output {
  answer: string
  solution_steps: string[]
  common_mistakes: string[]
  difficulty_note: string
}

export interface Step2Output {
  core_concept: string
  student_insight: string
  teaching_angle: string
  connection_to_prior_knowledge: string
}

export interface StoryPitch {
  title: string
  character: string
  scenario: string
  why_it_works: string
}

export interface Step3Output {
  selected_pitch: StoryPitch
  all_pitches: StoryPitch[]
}

export interface Step4Output {
  story_intro: string
  challenge: string
  solution: string[]
  key_insight: string
  common_traps: string[]
  challenge_yourself: string
}

// ── Workflow status ───────────────────────────────────────────────────────

export type MegaStatus =
  | 'step1_pending' | 'step1_done'
  | 'step2_pending' | 'step2_done'
  | 'step3_pending' | 'step3_done'
  | 'step4_pending' | 'completed'

// ── Full workflow row (mirrors DB schema) ─────────────────────────────────

export interface MegaWorkflow {
  id: string
  challenge_id: string | null
  bank_item_id: string | null
  created_by: string
  challenge_title: string
  challenge_body: string
  challenge_image_url: string | null
  status: MegaStatus
  step1_raw: Step1Output | null
  step2_raw: Step2Output | null
  step3_raw: Omit<Step3Output, 'selected_pitch'> & { pitches: StoryPitch[] } | null
  step4_raw: Step4Output | null
  step1_output: Step1Output | null
  step2_output: Step2Output | null
  step3_output: Step3Output | null
  step4_output: Step4Output | null
  created_at: string
  updated_at: string
}

// ── Challenge picker item (used in the index page modal) ─────────────────

export interface ChallengePick {
  id: string
  title: string
  description: string
  image_url: string | null
  source: 'daily_challenge' | 'bank_item'
}
```

**Acceptance:** File compiles with no errors. All 4 step output shapes and `MegaWorkflow` are exported.

---

## Task 4 — Agent prompts

**File:** `lib/mega/prompts.ts`  
**What to write — 4 system prompt constants:**

```ts
export const MATH_SOLVER_PROMPT = `You are a precise math expert. Your only job is to solve the given problem and explain it clearly.

Rules:
- Solve the problem completely and correctly
- Write solution steps a student can follow
- Identify exactly 2-4 mistakes students commonly make on this type of problem
- Do NOT be vague — be specific about what students get wrong and why

Output ONLY valid JSON with no markdown fences, no extra text:
{
  "answer": "the correct answer(s) — if multiple solutions, list all",
  "solution_steps": ["step 1 description", "step 2 description", "..."],
  "common_mistakes": ["specific mistake 1", "specific mistake 2"],
  "difficulty_note": "one sentence: what makes this problem easy or tricky for students"
}`

export const MATH_TAKEAWAY_PROMPT = `You are a math education expert. You identify the single most important insight a student should take away from a math problem.

You think about what makes a concept actually "click" — the mental model shift, the aha moment, not the procedure.

You will receive the challenge and its solution. Extract the core mathematical takeaway.

Output ONLY valid JSON with no markdown fences:
{
  "core_concept": "one sentence — the mathematical insight this problem is really about (not the procedure, the insight)",
  "student_insight": "what a student who truly understands this would say in their own words — simple, like a 10-year-old would say it",
  "teaching_angle": "the most effective way to present this insight — what single question or activity causes the aha moment",
  "connection_to_prior_knowledge": "what the student must already know for this to make sense"
}`

export const STORY_BRAINSTORM_PROMPT = `You are a creative writer for a children's math classroom. You create fun, cute, engaging stories that make math feel like an adventure.

Your characters must be imaginative — talking animals, young inventors, magical creatures, junior chefs, space explorers — NEVER just "a student doing homework."

Rules:
- The math must arise NATURALLY from the story situation (not forced)
- The story must make the core mathematical concept feel obvious once it unfolds
- Keep it appropriate for ages 8–14
- Each story must be genuinely different from the others — different genre, different character type, different setting

You will receive the challenge, solution, and the core concept to illustrate.

Output ONLY valid JSON with no markdown fences:
{
  "pitches": [
    {
      "title": "short catchy story name (max 6 words)",
      "character": "who the main character is — specific and imaginative",
      "scenario": "2-3 sentences: the story setup and how the math problem arises naturally in it",
      "why_it_works": "one sentence: why this story makes the core concept click for a young learner"
    },
    { ... },
    { ... }
  ]
}`

export const MEGA_GENERATOR_PROMPT = `You are a master teaching material creator for Henry's Math Classroom. You take a math problem, its solution, the core learning takeaway, and an approved story concept, and assemble them into a complete, polished teaching document called a "Mega."

A Mega is used by Henry in class. It should feel like it was written by a thoughtful human teacher — warm, clear, and engaging.

Rules:
- The story intro must use the approved character and scenario naturally
- The solution must be written in the story's voice where it flows naturally (e.g. "Mochi the bear counted..." not just "Step 1: ...")
- The key insight must be written AS HENRY SPEAKING TO THE CLASS — direct, warm, first-person ("What I want you to notice here is...")
- Common traps must be framed as warnings: "Watch out for..." 
- The follow-up question must extend the thinking beyond the original problem — harder or more general

Output ONLY valid JSON with no markdown fences:
{
  "story_intro": "3-5 sentences: open with the story character and situation, naturally leading to the math problem",
  "challenge": "the original challenge presented cleanly — verbatim or very close",
  "solution": ["step 1 in story voice", "step 2 in story voice", "..."],
  "key_insight": "2-3 sentences written as Henry speaking to his class, capturing the core concept",
  "common_traps": ["Watch out for: trap 1", "Watch out for: trap 2"],
  "challenge_yourself": "one follow-up question that extends or generalizes the thinking"
}`
```

**Acceptance:** File exports 4 named constants. No runtime logic — pure strings.

---

## Task 5 — Claude caller utility

**File:** `lib/mega/agents.ts`  
**What to write:**

```ts
import {
  MATH_SOLVER_PROMPT,
  MATH_TAKEAWAY_PROMPT,
  STORY_BRAINSTORM_PROMPT,
  MEGA_GENERATOR_PROMPT,
} from './prompts'
import type { Step1Output, Step2Output, Step3Output, Step4Output, StoryPitch } from './types'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-5'

// ── Core Claude caller ────────────────────────────────────────────────────

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  apiKey: string,
): Promise<string> {
  // Build message content — text only for most steps
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${errText}`)
  }
  const data = await res.json()
  return data.content[0].text as string
}

// ── JSON parser helper ────────────────────────────────────────────────────

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

// ── Vision-aware Claude caller ────────────────────────────────────────────
// Used for step 1 when the challenge has an image_url.

async function callClaudeWithImage(
  systemPrompt: string,
  textMessage: string,
  imageUrl: string,
  maxTokens: number,
  apiKey: string,
): Promise<string> {
  // Fetch the image and convert to base64 for Anthropic vision
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) {
    // If image fetch fails, fall back to text-only
    return callClaude(systemPrompt, textMessage, maxTokens, apiKey)
  }
  const imgBuffer = await imgRes.arrayBuffer()
  const base64 = Buffer.from(imgBuffer).toString('base64')
  const mimeType = imgRes.headers.get('content-type') || 'image/png'

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64 },
          },
          { type: 'text', text: textMessage },
        ],
      }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.content[0].text as string
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
    ? await callClaudeWithImage(MATH_SOLVER_PROMPT, userMsg, imageUrl, 2000, apiKey)
    : await callClaude(MATH_SOLVER_PROMPT, userMsg, 2000, apiKey)
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
    `Solution:`,
    `Answer: ${step1.answer}`,
    `Steps: ${step1.solution_steps.join(' → ')}`,
  ].join('\n')
  const raw = await callClaude(MATH_TAKEAWAY_PROMPT, userMsg, 2000, apiKey)
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
    `Teaching angle: ${step2.teaching_angle}`,
    `The key student insight: ${step2.student_insight}`,
  ].join('\n')
  const raw = await callClaude(STORY_BRAINSTORM_PROMPT, userMsg, 2000, apiKey)
  const parsed = parseJSON<{ pitches: StoryPitch[] }>(raw)
  if (!Array.isArray(parsed.pitches) || parsed.pitches.length < 3) {
    throw new Error('Step 3 agent did not return 3 pitches')
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
    `Solution steps: ${step1.solution_steps.join(' | ')}`,
    `Common mistakes: ${step1.common_mistakes.join(' | ')}`,
    `Core concept: ${step2.core_concept}`,
    `Key insight: ${step2.student_insight}`,
    `Teaching angle: ${step2.teaching_angle}`,
    ``,
    `Approved story:`,
    `Character: ${selectedPitch.character}`,
    `Story scenario: ${selectedPitch.scenario}`,
    `Why it works: ${selectedPitch.why_it_works}`,
  ].join('\n')
  const raw = await callClaude(MEGA_GENERATOR_PROMPT, userMsg, 4000, apiKey)
  return parseJSON<Step4Output>(raw)
}
```

**Acceptance:** File compiles. Each `runStep*` function takes only what its agent needs. The `callClaude` / `callClaudeWithImage` functions match the raw-fetch pattern used for OpenAI in the rest of the codebase.

---

## Task 6 — API route: create workflow + list workflows

**File:** `app/api/mega/route.ts`  
**What to write:**

```ts
/**
 * GET  /api/mega  — list all mega workflows for current user
 * POST /api/mega  — create a new mega workflow from a challenge
 *
 * POST body: {
 *   challenge_id?: string      // UUID of a daily_challenge row
 *   bank_item_id?: string      // UUID of a challenge_bank row
 *   source: 'daily_challenge' | 'bank_item'
 * }
 *
 * Auth: teacher/admin session token (same pattern as /api/ta/grade)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ── Auth helper (reuse exact pattern from /api/ta/grade) ──────────────────
async function authenticateTeacher(req: NextRequest): Promise<{ userId: string } | NextResponse> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const supabaseUser = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { data: roles } = await supabase
    .from('user_roles').select('roles!inner(name)').eq('user_id', user.id).is('class_id', null)
  const isTeacher = (roles as any[])?.some((r: any) =>
    ['teacher', 'administrator'].includes(r.roles?.name)
  )
  if (!isTeacher) return NextResponse.json({ error: 'Teacher only' }, { status: 403 })

  return { userId: user.id }
}

export async function GET(req: NextRequest) {
  const auth = await authenticateTeacher(req)
  if (auth instanceof NextResponse) return auth

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const { data, error } = await supabase
    .from('mega_workflows')
    .select('id, challenge_title, status, created_at, updated_at, challenge_id, bank_item_id')
    .eq('created_by', auth.userId)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, workflows: data })
}

export async function POST(req: NextRequest) {
  const auth = await authenticateTeacher(req)
  if (auth instanceof NextResponse) return auth

  let body: { challenge_id?: string; bank_item_id?: string; source: 'daily_challenge' | 'bank_item' }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const { source, challenge_id, bank_item_id } = body
  if (source === 'daily_challenge' && !challenge_id)
    return NextResponse.json({ error: 'challenge_id required for daily_challenge source' }, { status: 400 })
  if (source === 'bank_item' && !bank_item_id)
    return NextResponse.json({ error: 'bank_item_id required for bank_item source' }, { status: 400 })

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // Fetch challenge snapshot
  let title = '', description = '', imageUrl: string | null = null
  if (source === 'daily_challenge') {
    const { data, error } = await supabase
      .from('daily_challenges').select('title, description, image_url').eq('id', challenge_id!).single()
    if (error || !data) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    title = data.title; description = data.description; imageUrl = data.image_url
  } else {
    const { data, error } = await supabase
      .from('challenge_bank').select('title, description, image_url').eq('id', bank_item_id!).single()
    if (error || !data) return NextResponse.json({ error: 'Challenge bank item not found' }, { status: 404 })
    title = data.title; description = data.description; imageUrl = data.image_url
  }

  const { data: workflow, error: insertErr } = await supabase
    .from('mega_workflows')
    .insert({
      challenge_id: source === 'daily_challenge' ? challenge_id : null,
      bank_item_id: source === 'bank_item' ? bank_item_id : null,
      created_by: auth.userId,
      challenge_title: title,
      challenge_body: description,
      challenge_image_url: imageUrl,
      status: 'step1_pending',
    })
    .select('id')
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, workflow_id: workflow.id }, { status: 201 })
}

export const maxDuration = 30
```

**Acceptance:** GET returns a list, POST creates a row and returns `workflow_id`. Both return `{ error }` on failure.

---

## Task 7 — API route: fetch workflow state

**File:** `app/api/mega/[id]/route.ts`  
**What to write:**

```ts
/**
 * GET /api/mega/[id] — fetch full workflow state
 * Auth: teacher/admin (teacher sees own, admin sees all — RLS enforced)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function authenticateTeacher(req: NextRequest): Promise<{ userId: string } | NextResponse> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const supabaseUser = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: roles } = await supabase
    .from('user_roles').select('roles!inner(name)').eq('user_id', user.id).is('class_id', null)
  const isTeacher = (roles as any[])?.some((r: any) => ['teacher', 'administrator'].includes(r.roles?.name))
  if (!isTeacher) return NextResponse.json({ error: 'Teacher only' }, { status: 403 })
  return { userId: user.id }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateTeacher(req)
  if (auth instanceof NextResponse) return auth

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const { data, error } = await supabase
    .from('mega_workflows')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })

  // Access control: teacher can only see their own
  if (data.created_by !== auth.userId) {
    // Check if admin
    const { data: roles } = await supabase
      .from('user_roles').select('roles!inner(name)').eq('user_id', auth.userId).is('class_id', null)
    const isAdmin = (roles as any[])?.some((r: any) => r.roles?.name === 'administrator')
    if (!isAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, workflow: data })
}

export const maxDuration = 30
```

**Acceptance:** Returns `{ ok: true, workflow: { ...all columns } }` for valid requests.

---

## Task 8 — API route: run agent + approve step

**File:** `app/api/mega/[id]/step/[step]/route.ts`  
**This is the most complex route. Write it exactly as follows:**

```ts
/**
 * POST /api/mega/[id]/step/[step] — run the AI agent for step [step]
 * PATCH /api/mega/[id]/step/[step] — approve (save) Henry's final output for that step
 *
 * POST does NOT advance the workflow status — it only saves the raw output.
 * PATCH advances status (with optimistic lock to prevent races).
 *
 * step values: 1 | 2 | 3 | 4
 *
 * PATCH body for steps 1, 2, 4: the full approved output JSON
 * PATCH body for step 3: { selected_pitch: StoryPitch, all_pitches: StoryPitch[] }
 *
 * Special: PATCH for step 3 with action='reset' and target_step=N resets from step N.
 * Reset body: { action: 'reset', from_step: 2 | 3 | 4 }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runStep1, runStep2, runStep3, runStep4 } from '@/lib/mega/agents'
import type { Step1Output, Step2Output, Step3Output, Step4Output, StoryPitch } from '@/lib/mega/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!

export const maxDuration = 120

// ── Status progression map ────────────────────────────────────────────────
const STEP_PENDING: Record<number, string> = {
  1: 'step1_pending',
  2: 'step2_pending',
  3: 'step3_pending',
  4: 'step4_pending',
}
const STEP_DONE: Record<number, string> = {
  1: 'step1_done',
  2: 'step2_done',
  3: 'step3_done',
  4: 'completed',
}
// When resetting from step N, set status back to stepN_pending and clear steps N+
const RESET_STATUS: Record<number, string> = {
  2: 'step2_pending',
  3: 'step3_pending',
  4: 'step4_pending',
}

// ── Auth helper ───────────────────────────────────────────────────────────
async function authenticateTeacher(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return null
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const supabaseUser = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return null
  const { data: roles } = await supabase
    .from('user_roles').select('roles!inner(name)').eq('user_id', user.id).is('class_id', null)
  const isTeacher = (roles as any[])?.some((r: any) => ['teacher', 'administrator'].includes(r.roles?.name))
  return isTeacher ? { userId: user.id, supabase } : null
}

// ── POST — run agent ──────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; step: string } }
) {
  const auth = await authenticateTeacher(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stepNum = parseInt(params.step)
  if (![1, 2, 3, 4].includes(stepNum))
    return NextResponse.json({ error: 'Invalid step' }, { status: 400 })

  const { data: wf, error: wfErr } = await auth.supabase
    .from('mega_workflows').select('*').eq('id', params.id).single()
  if (wfErr || !wf) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })

  // Owner check
  if (wf.created_by !== auth.userId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Allow re-run at any point (don't block if already done — Henry can re-run any step)

  try {
    let rawOutput: Step1Output | Step2Output | StoryPitch[] | Step4Output

    switch (stepNum) {
      case 1:
        rawOutput = await runStep1(wf.challenge_title, wf.challenge_body, wf.challenge_image_url, ANTHROPIC_KEY)
        break
      case 2:
        if (!wf.step1_output) return NextResponse.json({ error: 'Step 1 must be approved first' }, { status: 400 })
        rawOutput = await runStep2(wf.challenge_title, wf.challenge_body, wf.step1_output, ANTHROPIC_KEY)
        break
      case 3:
        if (!wf.step2_output) return NextResponse.json({ error: 'Step 2 must be approved first' }, { status: 400 })
        rawOutput = await runStep3(wf.challenge_title, wf.challenge_body, wf.step1_output!, wf.step2_output, ANTHROPIC_KEY)
        break
      case 4:
        if (!wf.step3_output?.selected_pitch) return NextResponse.json({ error: 'Step 3 must be approved first' }, { status: 400 })
        rawOutput = await runStep4(
          wf.challenge_title, wf.challenge_body,
          wf.step1_output!, wf.step2_output!,
          wf.step3_output.selected_pitch,
          ANTHROPIC_KEY
        )
        break
      default:
        return NextResponse.json({ error: 'Invalid step' }, { status: 400 })
    }

    // Save raw output — do NOT change status yet
    const rawField = `step${stepNum}_raw`
    await auth.supabase.from('mega_workflows').update({ [rawField]: rawOutput }).eq('id', params.id)

    return NextResponse.json({ ok: true, raw: rawOutput })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── PATCH — approve step or reset ─────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; step: string } }
) {
  const auth = await authenticateTeacher(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const stepNum = parseInt(params.step)

  // ── Reset action ──
  if (body.action === 'reset') {
    const fromStep = body.from_step as number
    if (![2, 3, 4].includes(fromStep))
      return NextResponse.json({ error: 'Can only reset from step 2, 3, or 4' }, { status: 400 })

    const clearFields: Record<string, null> = {}
    for (let s = fromStep; s <= 4; s++) {
      clearFields[`step${s}_output`] = null
      clearFields[`step${s}_raw`] = null
    }
    const { error } = await auth.supabase
      .from('mega_workflows')
      .update({ ...clearFields, status: RESET_STATUS[fromStep] })
      .eq('id', params.id)
      .eq('created_by', auth.userId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, status: RESET_STATUS[fromStep] })
  }

  // ── Approve action ──
  if (![1, 2, 3, 4].includes(stepNum))
    return NextResponse.json({ error: 'Invalid step' }, { status: 400 })

  // Step 3: validate selected_pitch structure
  if (stepNum === 3) {
    const p = body.selected_pitch
    if (!p || !p.title || !p.character || !p.scenario || !p.why_it_works)
      return NextResponse.json({ error: 'step3 requires selected_pitch with title, character, scenario, why_it_works' }, { status: 400 })
    if (!Array.isArray(body.all_pitches))
      return NextResponse.json({ error: 'step3 requires all_pitches array' }, { status: 400 })
  }

  const outputField = `step${stepNum}_output`
  const newStatus = STEP_DONE[stepNum]
  const pendingStatus = STEP_PENDING[stepNum]

  // Optimistic lock: only update if status is the pending state for this step
  // (prevents double-click races)
  const { data: updated, error } = await auth.supabase
    .from('mega_workflows')
    .update({ [outputField]: body, status: newStatus })
    .eq('id', params.id)
    .eq('status', pendingStatus)   // ← the lock
    .eq('created_by', auth.userId)
    .select('id, status')
    .single()

  // Also accept already-done status (Henry approving a re-run after prior approval)
  if (error || !updated) {
    // Check if it's a race or a real error
    const { data: current } = await auth.supabase
      .from('mega_workflows').select('status').eq('id', params.id).single()
    if (current?.status === STEP_DONE[stepNum] || current?.status === STEP_PENDING[stepNum + 1]) {
      // Already resolved — allow overwrite (Henry editing an already-approved step)
      const { error: overwriteErr } = await auth.supabase
        .from('mega_workflows')
        .update({ [outputField]: body })
        .eq('id', params.id)
        .eq('created_by', auth.userId)
      if (overwriteErr) return NextResponse.json({ error: overwriteErr.message }, { status: 500 })
      return NextResponse.json({ ok: true, status: current.status })
    }
    return NextResponse.json({ error: 'already_resolved' }, { status: 409 })
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
```

**Acceptance:** POST runs the correct agent for each step. PATCH saves output and advances status. Reset clears downstream steps. Optimistic lock prevents races.

---

## Task 9 — Index page: list + challenge picker

**File:** `app/admin/mega-materials/page.tsx`  
**Pattern:** Follow `app/admin/generative-templates/page.tsx` exactly.

**Component structure to implement:**

```
'use client'
export const dynamic = 'force-dynamic'

imports: useEffect, useState, useCallback, useRouter, useLanguage, createClient, Card, Button, HomeButton

Main component: MegaMaterialsPage
  state:
    - workflows: MegaListItem[]         ← list of in-progress/completed workflows
    - loading: boolean
    - showPicker: boolean               ← challenge picker modal open/closed
    - pickerSearch: string              ← search term in picker
    - pickerItems: ChallengePick[]      ← all challenges for picker
    - pickerLoading: boolean
    - creating: boolean                 ← POST /api/mega in progress
    - notification: { message, type } | null

  auth guard: same useEffect pattern as app/admin/shop/page.tsx
    - getUser → user_roles → roles → isTeacher → router.push('/login') if not teacher

  loadWorkflows(): fetch GET /api/mega with Authorization header
    - calls supabase.auth.getSession() to get token
    - fetch('/api/mega', { headers: { Authorization: 'Bearer <token>' } })
    - setWorkflows(data.workflows)

  loadPickerItems():
    - query daily_challenges: select id, title, description, image_url, order by created_at desc, limit 100
    - query challenge_bank: select id, title, description, image_url, order by created_at desc, limit 100
    - merge into ChallengePick[] with source field
    - setPickerItems(merged)

  handleStartMega(pick: ChallengePick):
    - setCreating(true)
    - POST /api/mega with { challenge_id/bank_item_id, source }
    - on success: router.push('/admin/mega-materials/' + workflow_id)
    - on error: setNotification({ message: err, type: 'error' })

  render:
    - Notification component (same as generative-templates page)
    - Header: "Mega Teaching Materials" title + HomeButton
    - "New Mega" button → setShowPicker(true)
    - WorkflowList component (list of workflow cards)
    - ChallengePicker modal (shown when showPicker=true)
```

**WorkflowList sub-component:**
- Each card shows: `challenge_title`, status badge (color-coded), `updated_at` formatted as relative time
- Status badge colors: pending steps = amber, completed = green
- Click → `router.push('/admin/mega-materials/' + id)`
- "Continue →" button on each card

**ChallengePicker sub-component:**
- Modal overlay with close button
- Search input filtering `pickerItems` by title
- Two sections: "Daily Challenges" and "Challenge Bank" (grouped)
- Each row: challenge title + source badge
- Click row → `handleStartMega(pick)`
- Show spinner on clicked row while `creating`

**Acceptance:** Page loads, lists workflows, picker opens, selecting a challenge creates a workflow and redirects.

---

## Task 10 — Workflow page: the 4-step UI

**File:** `app/admin/mega-materials/[id]/page.tsx`  
**Pattern:** `'use client'`, `export const dynamic = 'force-dynamic'`, same auth guard, same hooks.

**State:**
```ts
workflow: MegaWorkflow | null
loading: boolean
stepRunning: number | null        // which step is currently calling the agent (null = none)
stepRawOutput: Record<number, any> // raw output returned from POST (before approve)
editMode: Record<number, boolean>  // is a step in edit mode?
editDraft: Record<number, any>     // Henry's edited version of the raw output
selectedPitch: StoryPitch | null   // which story pitch Henry clicked (step 3)
allPitches: StoryPitch[] | null    // all 3 pitches from step 3 run
resetConfirm: number | null        // which step is showing reset confirmation (null = none)
notification: { message, type } | null
```

**loadWorkflow():** fetch GET `/api/mega/[id]` with auth token → setWorkflow(data.workflow)

**handleRunStep(step):**
1. `setStepRunning(step)`
2. POST `/api/mega/[id]/step/[step]` with auth token
3. On success: save raw output to `stepRawOutput[step]`
4. On step 3 success: save pitches array to `allPitches`
5. `setStepRunning(null)`
6. On error: `setNotification({ message: err, type: 'error' })`, `setStepRunning(null)`

**handleApprove(step):**
1. Determine output to approve: if `editMode[step]`, use `editDraft[step]`; else use `stepRawOutput[step]` or `workflow.step{N}_raw`
2. For step 3: output is `{ selected_pitch: selectedPitch, all_pitches: allPitches }`
3. PATCH `/api/mega/[id]/step/[step]` with the output
4. On success: call `loadWorkflow()` to refresh state
5. On 409: show `setNotification({ message: 'Grade already resolved — refresh', type: 'error' })`

**handleReset(fromStep):**
1. Show `resetConfirm = fromStep`
2. On confirm: PATCH `/api/mega/[id]/step/[fromStep]` with `{ action: 'reset', from_step: fromStep }`
3. Call `loadWorkflow()`
4. `setResetConfirm(null)`

**Page layout JSX structure:**
```
<div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 p-4 sm:p-8">
  <div className="max-w-3xl mx-auto">

    {/* Challenge anchor — always visible */}
    <ChallengeHeader title={workflow.challenge_title} body={workflow.challenge_body} />

    {/* Progress stepper */}
    <StepStepper currentStatus={workflow.status} />

    {/* Step panels — one per step */}
    <StepPanel step={1} ... />
    <StepPanel step={2} ... />
    <StepPanel step={3} ... />
    <StepPanel step={4} ... />

  </div>
</div>
```

**ChallengeHeader sub-component:**
- Sticky or top-pinned card
- Shows `challenge_title` in bold, `challenge_body` in smaller text (clamped to 3 lines, expandable)

**StepStepper sub-component:**
- 4 circles connected by lines: "① Math Solver", "② Takeaway", "③ Story", "④ Mega"
- States per step: `locked` (gray), `active` (indigo ring), `done` (green checkmark)
- Derive from `workflow.status`

**StepPanel sub-component (handles all 4 steps):**

State transitions for a step panel:
```
NOT_RUN → [Run button] → RUNNING [spinner] → HAS_RAW [output + Approve/Edit/Rerun buttons]
                                                    ↓ Approve
                                              APPROVED [collapsed summary + "Reset from here"]
```

Props: `step`, `status`, `rawOutput`, `approvedOutput`, `isRunning`, `editMode`, `editDraft`, `onRun`, `onApprove`, `onEdit`, `onRerun`, `onReset`

For each step, the output display:
- **Step 1:** 4 sections: Answer (bold), Solution Steps (numbered list), Common Mistakes (bullet list), Difficulty Note
- **Step 2:** 4 sections: Core Concept (highlighted), Student Insight, Teaching Angle, Prior Knowledge
- **Step 3:** 3 pitch cards side-by-side (`grid grid-cols-1 sm:grid-cols-3`). Each card: title, character, scenario, why-it-works. Clicking selects it (ring border). "Re-run" shows 3 new pitches. No approve button until a pitch is selected.
- **Step 4:** 6 sections: Story Intro, Challenge (box), Solution (numbered), Key Insight (highlighted), Common Traps, Challenge Yourself

**Edit mode for steps 1, 2, 4:**
- Clicking "Edit" replaces each field with a `<textarea>` pre-filled with the raw output value
- Henry edits inline, then clicks "Approve edited version"
- `editDraft` holds the in-progress edits as a copy of the output object

**Approve button states:**
- Normal: `"✓ Approve →"` (indigo, primary)
- Sending: `"Saving..."` (disabled)
- Re-run: `"↺ Re-run"` (gray, secondary)
- Edit: `"✏️ Edit"` (text link style)

**Collapsed approved step:**
- Shows step name + green ✓ badge + first sentence/value of output
- `<details>` or a toggle button to expand and re-read full output
- "Reset from step N" link (shows `resetConfirm` dialog on click)

**Reset confirmation dialog:**
- Inline below the step card, not a modal
- "⚠️ This will clear Steps N through 4. Continue?" + Yes/Cancel buttons

**Acceptance:** All 4 steps render correctly. Run → raw output appears → Approve → step collapses → next step unlocks. Step 3 shows 3 story cards, selection required before approve. Reset works. Edit mode saves Henry's edits.

---

## Task 11 — Add `ANTHROPIC_API_KEY` to environment docs

**File:** `.env.example`  
**What to add:**

```
# Anthropic Claude (for Mega Teaching Material workflow)
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Add it after `OPENAI_API_KEY` line.

**Acceptance:** `.env.example` has the new line. `.env.local` on the developer's machine has the real key set.

---

## Task 12 — Add navigation link to admin mega-materials

**File:** Find the existing admin nav (check `components/ui/HomeButton.tsx` or the nav in `app/admin/` layout if one exists, otherwise update `app/page.tsx` admin section).

**What to add:** A link/button "📚 Mega Materials" pointing to `/admin/mega-materials` — placed alongside existing admin links like "Shop", "Book Skins", "Generative Templates".

**If no shared admin nav exists:** Add a link in the admin section of `app/page.tsx` where other admin links appear.

**Acceptance:** Henry can reach `/admin/mega-materials` by clicking a link from the main page.

---

## Task 13 — End-to-end manual test

**Challenge to use:**
- Title: "Which is the Smallest?"
- Body: "Out of the following values, which is the smallest?\nA. 2100  B. 550  C. 375  D. 460  E. 740"
- Source: Create as a new challenge in `daily_challenges` or use an existing similar one

**Test script:**
1. Navigate to `/admin/mega-materials`
2. Click "New Mega" → pick the challenge → workflow created → redirected to workflow page
3. Click "Run Math Solver" → spinner shows → output appears with answer "C. 375", 3+ solution steps, 2+ common mistakes
4. Click "Approve →" → step 1 collapses with green ✓
5. Click "Run Takeaway Agent" → output appears with core_concept about number comparison / place value
6. Click "Approve →" → step 2 collapses
7. Click "Run Story Brainstorm" → 3 story pitch cards appear
8. Click one pitch to select it → Approve button enables → click Approve
9. Click "Run Mega Generator" → full mega document appears with all 6 sections
10. Click "Approve →" → workflow shows status "completed" → all steps collapsed with green ✓

**Additional tests:**
- Refresh mid-workflow (after step 2 approve) → state restored, step 1+2 still show approved, step 3 shows Run button
- Click "Re-run" on step 2 after it's approved → new raw output appears without approving, previous approved output unchanged until Henry approves the re-run
- Click "Reset from step 2" on a completed workflow → steps 2, 3, 4 cleared, status back to step2_pending
- Double-click Approve quickly → second click is a no-op (button disabled on first click)

**Acceptance:** All 13 test cases pass without errors. Completed mega reads as a coherent, engaging teaching document.
