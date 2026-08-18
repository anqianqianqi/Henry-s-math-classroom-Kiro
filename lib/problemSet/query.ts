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
  /**
   * The bank problem this was published from, when it was.
   *
   * A submission to a bank-sourced problem is keyed by the BANK item, not by
   * the daily instance, so that republishing the problem does not lose the
   * student's work — see add-bank-item-submissions.sql, and note that
   * challenge_id is set to NULL when the instance is deleted. Anything asking
   * "has this been answered?" therefore has to look under this id as well as
   * the challenge id, and a new submission has to carry it or a second row
   * lands beside the one that was already there.
   */
  source_bank_id: string | null
}

/**
 * Every date this class has a problem on, newest last. For the dropdowns.
 *
 * `notAfter` is a student's horizon — see lib/problemSet/viewer.ts. Applied
 * here rather than by the caller so a date the viewer may not reach is never
 * offered in the first place.
 */
export async function problemDatesForClass(classId: string, notAfter?: string): Promise<string[]> {
  const supabase = createClient()
  const ids = await assignedChallengeIds(supabase, classId)
  if (!ids.length) return []

  let query = supabase
    .from('daily_challenges')
    .select('challenge_date')
    .in('id', ids)
  if (notAfter) query = query.lte('challenge_date', notAfter)

  const { data } = await query.order('challenge_date', { ascending: true })

  // Distinct, because a day can carry more than one problem.
  return [...new Set((data ?? []).map((r: any) => r.challenge_date).filter(Boolean))]
}

/**
 * The later end of a range, never past the viewer's horizon.
 *
 * Its own function because it is the whole of the rule and the range arrives
 * from a query string: `to` is whatever the URL said.
 */
export function clampRangeEnd(to: string, notAfter?: string): string {
  return notAfter && notAfter < to ? notAfter : to
}

/**
 * The problems themselves, in date order. Both ends inclusive.
 *
 * `notAfter` clamps the end of the range rather than trusting it: the range
 * arrives from the query string of the printable page, where a student could
 * type any date they liked.
 */
export async function problemsForClass(
  classId: string,
  from: string,
  to: string,
  notAfter?: string,
): Promise<ProblemSetItem[]> {
  const supabase = createClient()
  const ids = await assignedChallengeIds(supabase, classId)
  if (!ids.length) return []

  const end = clampRangeEnd(to, notAfter)

  const { data } = await supabase
    .from('daily_challenges')
    .select('id, title, challenge_date, description, henryproblem, image_url, max_points, source_bank_id')
    .in('id', ids)
    .gte('challenge_date', from)
    .lte('challenge_date', end)
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
