/**
 * The grading desk's queue: what is waiting, grouped by problem, in reading
 * order.
 *
 * Pure shaping and filtering, so it is testable without a browser or a
 * database. The page fetches; this decides what the rail shows, in what order
 * the desk walks through it, and how the assistant's rows are read.
 *
 * Two problem keys, on purpose. A submission handed in against a bank problem
 * carries bank_item_id, and one whose dated challenge was deleted keeps only
 * that. Grouping by challenge_id alone would sweep both into "no problem".
 */

export interface TaSuggestion {
  /** Row id in ta_grades; null when the suggestion failed to save. */
  id: string | null
  suggestedScore: number
  maxScore: number
  confidence: number
  comment: string
  gap: string | null
  view: string | null
  solution: string | null
  criticChanged: boolean
  criticFrom: number | null
  criticTo: number | null
  criticReason: string | null
  status: 'pending' | 'accepted' | 'overridden'
  henryScore: number | null
}

export interface QueueRow {
  id: string
  userId: string
  challengeId: string | null
  bankItemId: string | null
  /** The typed answer; empty when the student only attached a photo. */
  content: string
  imageUrl: string | null
  points: number | null
  isLocked: boolean
  submittedAt: string
  studentName: string
  studentEmail: string
  problemTitle: string
  challengeDate: string | null
  maxPoints: number
  ta: TaSuggestion | null
}

export interface QueueGroup {
  key: string
  title: string
  date: string | null
  rows: QueueRow[]
}

export interface QueueFilters {
  /** User ids in the chosen class, or null for every class. */
  members: Set<string> | null
  from: string
  to: string
  search: string
}

export const DEFAULT_MAX_POINTS = 100

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * A number, or null for nothing. Checked before coercing, because Number(null)
 * is 0, and an ungraded hand-in read as "zero points" would look graded.
 */
function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

/** The maximum a hand-in is marked out of: the dated challenge's, else the bank item's, else the site default. */
function maxPointsFrom(...candidates: unknown[]): number {
  for (const candidate of candidates) {
    const n = num(candidate)
    if (n !== null && n > 0) return Math.round(n)
  }
  return DEFAULT_MAX_POINTS
}

/** Shape one row of the submissions query, with its joined student and problem. */
export function rowFromRecord(record: any): QueueRow {
  const profile = record?.profiles || {}
  const challenge = record?.daily_challenges || null
  const bank = record?.challenge_bank || null
  const name = String(profile.full_name || '').trim()
    || [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
  return {
    id: String(record.id),
    userId: String(record.user_id ?? ''),
    challengeId: record.challenge_id ? String(record.challenge_id) : null,
    bankItemId: record.bank_item_id ? String(record.bank_item_id) : null,
    content: String(record.content ?? ''),
    imageUrl: record.image_url ? String(record.image_url) : null,
    points: num(record.points),
    isLocked: !!record.is_locked,
    submittedAt: String(record.submitted_at ?? ''),
    studentName: name,
    studentEmail: String(profile.email ?? ''),
    problemTitle: String(challenge?.title ?? bank?.title ?? '').trim(),
    challengeDate: challenge?.challenge_date ? String(challenge.challenge_date) : null,
    maxPoints: maxPointsFrom(challenge?.max_points, bank?.max_points),
    ta: null,
  }
}

/** A saved ta_grades row, as the desk reads it. */
export function taFromRow(row: any): TaSuggestion {
  const r = row?.reasoning || {}
  const changed = !!r.grade_changed_by_critic
  const score = num(row?.suggested_score) ?? 0
  return {
    id: row?.id ? String(row.id) : null,
    suggestedScore: score,
    maxScore: maxPointsFrom(row?.max_score),
    confidence: clamp01(Number(row?.confidence)),
    comment: String(row?.suggested_comment ?? ''),
    gap: text(r.step3_deviation),
    view: text(r.step4_henry_perspective),
    solution: text(r.step6_better_solution),
    criticChanged: changed,
    criticFrom: changed ? num(r.draft_score) : null,
    criticTo: changed ? score : null,
    criticReason: changed ? text(r.critic_reasoning) : null,
    status: row?.status === 'accepted' || row?.status === 'overridden' ? row.status : 'pending',
    henryScore: num(row?.henry_score),
  }
}

/** The assistant's answer from POST /api/ta/grade, as the desk reads it. */
export function taFromResponse(grade: any): TaSuggestion {
  const r = grade?.reasoning || {}
  const critic = grade?.critic || null
  const changed = !!critic?.grade_changed
  return {
    id: grade?.id ? String(grade.id) : null,
    suggestedScore: num(grade?.suggested_score) ?? 0,
    maxScore: maxPointsFrom(grade?.max_score),
    confidence: clamp01(Number(grade?.confidence)),
    comment: String(grade?.comment ?? ''),
    gap: text(r.step3_deviation),
    view: text(r.step4_henry_perspective),
    solution: text(grade?.suggested_solution),
    criticChanged: changed,
    criticFrom: changed ? num(critic.draft_score) : null,
    criticTo: changed ? num(critic.final_score) : null,
    criticReason: changed ? text(critic.reasoning) : null,
    status: 'pending',
    henryScore: null,
  }
}

/** Pair each row with its assistant suggestion, keyed by submission id. */
export function attachTa(rows: QueueRow[], taRows: any[]): QueueRow[] {
  const byId = new Map<string, TaSuggestion>()
  for (const raw of taRows || []) {
    if (raw?.submission_id) byId.set(String(raw.submission_id), taFromRow(raw))
  }
  return rows.map(row => ({ ...row, ta: byId.get(row.id) ?? null }))
}

export function problemKey(row: Pick<QueueRow, 'challengeId' | 'bankItemId'>): string {
  if (row.challengeId) return `challenge:${row.challengeId}`
  if (row.bankItemId) return `bank:${row.bankItemId}`
  return 'none'
}

function latestIn(group: QueueGroup): string {
  return group.rows.reduce((latest, row) => (row.submittedAt > latest ? row.submittedAt : latest), '')
}

/**
 * Group by problem, newest problem first, students in name order inside.
 *
 * Name order rather than hand-in order, for the same reason the spread uses
 * it: grading one must not reshuffle the rest under the teacher's hands.
 */
export function groupByProblem(rows: QueueRow[]): QueueGroup[] {
  const groups = new Map<string, QueueGroup>()
  for (const row of rows) {
    const key = problemKey(row)
    const group = groups.get(key) ?? { key, title: row.problemTitle, date: row.challengeDate, rows: [] }
    group.rows.push(row)
    groups.set(key, group)
  }
  const list = [...groups.values()]
  for (const group of list) {
    group.rows.sort((a, b) =>
      a.studentName.localeCompare(b.studentName) || a.submittedAt.localeCompare(b.submittedAt) || a.id.localeCompare(b.id))
  }
  list.sort((a, b) =>
    (b.date ?? '').localeCompare(a.date ?? '') || latestIn(b).localeCompare(latestIn(a)) || a.title.localeCompare(b.title))
  return list
}

export function flatten(groups: QueueGroup[]): QueueRow[] {
  return groups.flatMap(group => group.rows)
}

export function applyFilters(rows: QueueRow[], filters: QueueFilters): QueueRow[] {
  const needle = filters.search.trim().toLowerCase()
  return rows.filter(row => {
    if (filters.members && !filters.members.has(row.userId)) return false
    const day = row.submittedAt.slice(0, 10)
    if (filters.from && day < filters.from) return false
    if (filters.to && day > filters.to) return false
    if (needle) {
      const haystack = `${row.studentName} ${row.studentEmail} ${row.problemTitle}`.toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })
}

export function confidenceBand(confidence: number): 'high' | 'mid' | 'low' {
  if (confidence >= 0.85) return 'high'
  if (confidence >= 0.6) return 'mid'
  return 'low'
}

/** Move through the queue without falling off either end. */
export function stepIndex(current: number, delta: number, total: number): number {
  if (total <= 0) return -1
  const base = current < 0 ? (delta < 0 ? total : -1) : current
  return Math.min(total - 1, Math.max(0, base + delta))
}

/**
 * What to tell the assistant about a saved grade. Accepting means the score
 * it suggested stands; anything else is an override it should learn from.
 */
export function feedbackActionFor(ta: TaSuggestion | null | undefined, score: number): 'accepted' | 'overridden' | null {
  if (!ta || !ta.id || ta.status !== 'pending') return null
  return score === ta.suggestedScore ? 'accepted' : 'overridden'
}

export function timeAgoParts(iso: string, now: number = Date.now()): { unit: 'now' | 'm' | 'h' | 'd'; count: number } {
  const seconds = Math.floor((now - new Date(iso).getTime()) / 1000)
  if (!Number.isFinite(seconds) || seconds < 60) return { unit: 'now', count: 0 }
  if (seconds < 3600) return { unit: 'm', count: Math.floor(seconds / 60) }
  if (seconds < 86400) return { unit: 'h', count: Math.floor(seconds / 3600) }
  return { unit: 'd', count: Math.floor(seconds / 86400) }
}
