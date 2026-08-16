'use client'

/**
 * A class's problems over a range of dates.
 *
 * Two callers need exactly this: the window that asks for a range, so it can
 * offer real dates and say how many problems are in the chosen span, and the
 * printable page that lays them out. One function, so the count a teacher is
 * shown and the pages they get cannot disagree.
 *
 * ── HOW A PROBLEM REACHES A CLASS ───────────────────────────
 * challenge_assignments is the join: one row per (challenge, class). A problem
 * assigned to nobody, or to individual students only, is not part of a class's
 * set and is not printed here.
 */

import { createClient } from '@/lib/supabase/client'

export interface ProblemSetItem {
  id: string
  title: string
  challenge_date: string
  description: string | null
  henryproblem: unknown
  /** The problem's own picture — a net to fold, a graph to read. */
  image_url: string | null
  max_points: number | null
}

/** Every date this class has a problem on, newest last. For the dropdowns. */
export async function problemDatesForClass(classId: string): Promise<string[]> {
  const supabase = createClient()
  const ids = await assignedChallengeIds(supabase, classId)
  if (!ids.length) return []

  const { data } = await supabase
    .from('daily_challenges')
    .select('challenge_date')
    .in('id', ids)
    .order('challenge_date', { ascending: true })

  // Distinct, because a day can carry more than one problem.
  return [...new Set((data ?? []).map((r: any) => r.challenge_date).filter(Boolean))]
}

/** The problems themselves, in date order. Both ends inclusive. */
export async function problemsForClass(
  classId: string,
  from: string,
  to: string,
): Promise<ProblemSetItem[]> {
  const supabase = createClient()
  const ids = await assignedChallengeIds(supabase, classId)
  if (!ids.length) return []

  const { data } = await supabase
    .from('daily_challenges')
    .select('id, title, challenge_date, description, henryproblem, image_url, max_points')
    .in('id', ids)
    .gte('challenge_date', from)
    .lte('challenge_date', to)
    .order('challenge_date', { ascending: true })

  return (data ?? []) as ProblemSetItem[]
}

async function assignedChallengeIds(supabase: ReturnType<typeof createClient>, classId: string) {
  const { data } = await supabase
    .from('challenge_assignments')
    .select('challenge_id')
    .eq('class_id', classId)

  // Deduped: the table is unique on (challenge, class), but a defensive Set
  // costs nothing and keeps the .in() below from repeating an id.
  return [...new Set((data ?? []).map((r: any) => r.challenge_id).filter(Boolean))]
}
