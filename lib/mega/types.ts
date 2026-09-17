// ── Step 1 output ─────────────────────────────────────────────────────────

export interface SolutionStep {
  step: string
  action: string
  why_it_matters: string
  discovery_moment: string
}

export interface CommonMistake {
  mistake: string
  what_student_writes: string
  fails_at_step: string
  why_it_happens: string
}

export interface Step1Output {
  answer: string
  solution_steps: SolutionStep[]
  common_mistakes: CommonMistake[]
  core_trap: string
  teaching_hook: string
  difficulty_note: string
}

// ── Step 2 output ─────────────────────────────────────────────────────────

export interface Step2Output {
  core_concept: string
  student_insight: string
  teaching_angle: string
  connection_to_prior_knowledge: string
  story_hook: string          // 3 real-world setups for Agent 3
  challenge_extension: string // specific follow-up question for Agent 4
}

// ── Step 3 output ─────────────────────────────────────────────────────────

export interface StoryPitch {
  title: string
  character: string
  scenario: string
  why_it_works: string
}

export interface Step3RawOutput {
  pitches: StoryPitch[]
}

export interface Step3Output {
  selected_pitch: StoryPitch
  all_pitches: StoryPitch[]
}

// ── Step 4 output ─────────────────────────────────────────────────────────

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
  step3_raw: Step3RawOutput | null
  step4_raw: Step4Output | null
  step1_output: Step1Output | null
  step2_output: Step2Output | null
  step3_output: Step3Output | null
  step4_output: Step4Output | null
  created_at: string
  updated_at: string
}

// ── Challenge picker (index page modal) ──────────────────────────────────

export interface ChallengePick {
  id: string
  title: string
  description: string
  image_url: string | null
  source: 'daily_challenge' | 'bank_item'
}

// ── Status helpers ────────────────────────────────────────────────────────

export const STEP_PENDING: Record<number, MegaStatus> = {
  1: 'step1_pending',
  2: 'step2_pending',
  3: 'step3_pending',
  4: 'step4_pending',
}

export const STEP_DONE: Record<number, MegaStatus> = {
  1: 'step1_done',
  2: 'step2_done',
  3: 'step3_done',
  4: 'completed',
}

export const RESET_STATUS: Record<number, MegaStatus> = {
  2: 'step2_pending',
  3: 'step3_pending',
  4: 'step4_pending',
}

export function stepFromStatus(status: MegaStatus): number {
  if (status === 'step1_pending' || status === 'step1_done') return 1
  if (status === 'step2_pending' || status === 'step2_done') return 2
  if (status === 'step3_pending' || status === 'step3_done') return 3
  return 4
}

export function isStepDone(status: string, step: number): boolean {
  const order: MegaStatus[] = [
    'step1_pending', 'step1_done',
    'step2_pending', 'step2_done',
    'step3_pending', 'step3_done',
    'step4_pending', 'completed',
  ]
  const currentIdx = order.indexOf(status)
  const doneStatus = STEP_DONE[step]
  const doneIdx = order.indexOf(doneStatus)
  return currentIdx > doneIdx
}
