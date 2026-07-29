/**
 * .henryproblem — Henry Math editable problem snapshots
 *
 * Reader for the snapshot format produced by the Prettify Homework workspace
 * (tools/problem_snapshot.py). The file is plain JSON with a 1-to-1 mapping of
 * title / score / tags / wording, so uploading one needs no image parsing and
 * no LLM call.
 *
 * This module is pure — no DOM, no network — so it is safe on the server.
 * Browser-only helpers live in henryproblem-graph.ts.
 */

export const HENRY_PROBLEM_FORMAT = 'henry-math-editable-problem'
export const HENRY_PROBLEM_VERSION = 1
export const HENRY_PROBLEM_EXTENSION = '.henryproblem'

/** Normalized crop rectangle, 0..1 relative to the embedded graph image. */
export interface HenryGraphCrop {
  left: number
  top: number
  right: number
  bottom: number
}

export const FULL_CROP: HenryGraphCrop = { left: 0, top: 0, right: 1, bottom: 1 }

export interface HenryProblemFields {
  mode: 'no_graph' | 'graph'
  title: string
  score: string
  tags: string[]
  english: string
  chinese: string
  notes?: string
  graph_crop?: HenryGraphCrop
}

export interface HenryEmbeddedGraph {
  format: 'png'
  encoding: 'base64'
  data: string
}

export interface HenryProblemSnapshot {
  format: string
  version: number
  created_at?: string
  updated_at?: string
  output_basename?: string
  output_format?: string
  source_file?: string
  preview_file?: string
  problem: HenryProblemFields
  graph: HenryEmbeddedGraph | null
}

/**
 * What we persist in the `henryproblem` jsonb column: everything except the
 * embedded graph, which is uploaded to the challenge-images bucket instead so
 * a multi-megabyte base64 blob never lands in a row we read on every page view.
 */
export interface StoredHenryProblem {
  format: string
  version: number
  problem: HenryProblemFields
  source_basename?: string
  created_at?: string
}

export interface ParsedHenryProblem {
  /** The full snapshot exactly as read, including the embedded graph. */
  snapshot: HenryProblemSnapshot
  /** Graph-free projection destined for the jsonb column. */
  stored: StoredHenryProblem
  title: string
  /** English + Chinese wording flattened, for search and the TA grader. */
  description: string
  /** Parsed from `score` — null when the snapshot left it blank. */
  maxPoints: number | null
  tagNames: string[]
  /** `data:image/png;base64,...` for the embedded graph, or null. */
  graphDataUrl: string | null
  crop: HenryGraphCrop
}

export class HenryProblemError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HenryProblemError'
  }
}

export function isHenryProblemFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(HENRY_PROBLEM_EXTENSION)
}

/**
 * Mirrors normalize_graph_crop() in homework_prettifier.py: clamp to 0..1 and
 * fall back to the full image when the rectangle collapses.
 */
export function normalizeCrop(value: unknown): HenryGraphCrop {
  if (!value || typeof value !== 'object') return { ...FULL_CROP }
  const raw = value as Record<string, unknown>
  const num = (v: unknown, fallback: number) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v))
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), 1) : fallback
  }
  const left = num(raw.left, 0)
  const top = num(raw.top, 0)
  const right = num(raw.right, 1)
  const bottom = num(raw.bottom, 1)
  if (right - left < 0.005 || bottom - top < 0.005) return { ...FULL_CROP }
  return { left, top, right, bottom }
}

/**
 * "3" → 3, "3 pts" → 3, "" → null. The snapshot stores score as free text
 * because the worksheet prints it verbatim.
 */
export function parseScore(score: unknown): number | null {
  const text = String(score ?? '').trim()
  if (!text) return null
  const match = text.match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const value = Number(match[0])
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value)
}

function normalizeMode(value: unknown): 'no_graph' | 'graph' {
  const text = String(value ?? '').trim().toLowerCase().replace(/[-\s]/g, '_')
  if (text === 'graph' || text === 'with_graph' || text === 'diagram') return 'graph'
  return 'no_graph'
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(t => String(t).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value.split(',').map(t => t.trim()).filter(Boolean)
  }
  return []
}

/** English above, Chinese below — matches how the worksheet reads. */
export function flattenWording(english: string, chinese: string): string {
  return [english.trim(), chinese.trim()].filter(Boolean).join('\n\n')
}

/**
 * Parse the text contents of a .henryproblem file.
 * Throws HenryProblemError with a teacher-readable message on any problem.
 */
export function parseHenryProblem(text: string): ParsedHenryProblem {
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    throw new HenryProblemError('This file is not valid JSON — it may be damaged.')
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new HenryProblemError('This is not a Henry Math editable problem file.')
  }
  const raw = payload as Record<string, unknown>

  if (raw.format !== HENRY_PROBLEM_FORMAT) {
    throw new HenryProblemError('This is not a Henry Math editable problem file.')
  }
  if (raw.version !== HENRY_PROBLEM_VERSION) {
    throw new HenryProblemError(
      `Unsupported .henryproblem version: ${String(raw.version)}. This app reads version ${HENRY_PROBLEM_VERSION}.`
    )
  }
  if (!raw.problem || typeof raw.problem !== 'object' || Array.isArray(raw.problem)) {
    throw new HenryProblemError('This file does not contain editable problem data.')
  }

  const rawProblem = raw.problem as Record<string, unknown>
  const english = String(rawProblem.english ?? '').trim()
  const chinese = String(rawProblem.chinese ?? '').trim()

  if (!english && !chinese) {
    throw new HenryProblemError('This problem has no English or Chinese wording to import.')
  }

  const problem: HenryProblemFields = {
    mode: normalizeMode(rawProblem.mode),
    title: String(rawProblem.title ?? '').trim(),
    score: String(rawProblem.score ?? '').trim(),
    tags: normalizeTags(rawProblem.tags),
    english,
    chinese,
    notes: String(rawProblem.notes ?? '').trim() || undefined,
  }

  const crop = normalizeCrop(rawProblem.graph_crop)
  if (problem.mode === 'graph') problem.graph_crop = crop

  // The graph is optional even in graph mode — a snapshot can be saved before
  // the teacher attaches a diagram.
  let graphDataUrl: string | null = null
  const graph = raw.graph
  if (graph && typeof graph === 'object' && !Array.isArray(graph)) {
    const g = graph as Record<string, unknown>
    if (g.encoding !== 'base64' || g.format !== 'png') {
      throw new HenryProblemError('This file contains an unsupported graph image.')
    }
    const data = String(g.data ?? '')
    if (data) graphDataUrl = `data:image/png;base64,${data}`
  }

  const snapshot: HenryProblemSnapshot = {
    format: String(raw.format),
    version: Number(raw.version),
    created_at: raw.created_at ? String(raw.created_at) : undefined,
    updated_at: raw.updated_at ? String(raw.updated_at) : undefined,
    output_basename: raw.output_basename ? String(raw.output_basename) : undefined,
    output_format: raw.output_format ? String(raw.output_format) : undefined,
    problem,
    graph: graphDataUrl ? (graph as HenryEmbeddedGraph) : null,
  }

  const stored: StoredHenryProblem = {
    format: snapshot.format,
    version: snapshot.version,
    problem,
    source_basename: snapshot.output_basename,
    created_at: snapshot.created_at,
  }

  return {
    snapshot,
    stored,
    title: problem.title,
    description: flattenWording(english, chinese),
    maxPoints: parseScore(problem.score),
    tagNames: problem.tags,
    graphDataUrl,
    crop,
  }
}

/**
 * Read a value back out of the `henryproblem` jsonb column. Returns null for
 * anything unrecognized so callers can fall back to the plain description.
 */
export function readStoredHenryProblem(value: unknown): StoredHenryProblem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (raw.format !== HENRY_PROBLEM_FORMAT) return null
  if (!raw.problem || typeof raw.problem !== 'object') return null

  const rawProblem = raw.problem as Record<string, unknown>
  const english = String(rawProblem.english ?? '').trim()
  const chinese = String(rawProblem.chinese ?? '').trim()
  if (!english && !chinese) return null

  return {
    format: String(raw.format),
    version: Number(raw.version) || HENRY_PROBLEM_VERSION,
    source_basename: raw.source_basename ? String(raw.source_basename) : undefined,
    created_at: raw.created_at ? String(raw.created_at) : undefined,
    problem: {
      mode: normalizeMode(rawProblem.mode),
      title: String(rawProblem.title ?? '').trim(),
      score: String(rawProblem.score ?? '').trim(),
      tags: normalizeTags(rawProblem.tags),
      english,
      chinese,
      notes: String(rawProblem.notes ?? '').trim() || undefined,
      graph_crop: rawProblem.graph_crop ? normalizeCrop(rawProblem.graph_crop) : undefined,
    },
  }
}
