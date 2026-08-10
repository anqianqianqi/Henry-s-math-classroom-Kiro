/**
 * Writing a class's timetable.
 *
 * Every function here leaves two invariants standing, and they are the reason
 * this is a module rather than inline calls in a modal:
 *
 *   Nothing reaches backwards. Generating, regenerating and deleting a series
 *   all operate from today forward. Sessions that already happened are history
 *   — students have submissions and materials against them — and a teacher
 *   moving Monday's class to 5pm in October is not making a claim about
 *   September.
 *
 *   session_number stays in date order. It is recomputed across the class after
 *   any change rather than continued from the maximum, because a session added
 *   between two others has to renumber what follows it. See renumberByDate.
 *
 * ── ON DELETING SESSIONS ────────────────────────────────────
 * Safe only because supabase/decouple-homework-from-occurrences.sql has run.
 * Before it, removing a session cascaded into homework_assignments,
 * homework_submissions and homework_grades. Now the work keeps its class_id and
 * merely loses the session link.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  planSessions, renumberByDate, toSqlTime,
  type ScheduleSeries,
} from './series'
import { slotsFromOccurrences, groupByClass, type DerivedSlot } from './derive'

/**
 * When each of these classes meets, read back from what is booked.
 *
 * One query for the whole list. A page showing thirty classes calling this
 * per class would make thirty round trips to render thirty subtitles.
 *
 * Only upcoming sessions count: a class that finished last term should read as
 * having nothing scheduled, not go on advertising the Mondays it used to run.
 */
export async function meetingSlotsFor(
  supabase: SupabaseClient, classIds: string[], today: string,
): Promise<Record<string, DerivedSlot[]>> {
  if (classIds.length === 0) return {}

  const { data, error } = await supabase
    .from('class_occurrences')
    .select('class_id, occurrence_date, start_time, end_time, status')
    .in('class_id', classIds)
    .gte('occurrence_date', today)
    .order('occurrence_date', { ascending: true })
  if (error) throw error

  const grouped = groupByClass(data || [])
  const out: Record<string, DerivedSlot[]> = {}
  for (const id of classIds) out[id] = slotsFromOccurrences(grouped[id] || [])
  return out
}

export interface SeriesInput {
  class_id: string
  weekday: number
  start_time: string
  end_time: string
  effective_from: string
  effective_until: string | null
}

export interface SeriesRow extends ScheduleSeries {
  className: string
}

/**
 * How far forward an open-ended series generates.
 *
 * A series with no effective_until has no natural horizon, and something has to
 * choose one — an unbounded loop is not an option. A year is long enough that
 * no teacher hits the edge during a term, and short enough that a class created
 * by mistake does not write hundreds of rows.
 */
export const OPEN_ENDED_HORIZON_DAYS = 365

export function horizonFrom(today: string): string {
  const d = new Date(`${today}T12:00:00`)
  d.setDate(d.getDate() + OPEN_ENDED_HORIZON_DAYS)
  return d.toISOString().slice(0, 10)
}

export async function listSeries(supabase: SupabaseClient): Promise<SeriesRow[]> {
  const { data, error } = await supabase
    .from('class_schedule_series')
    .select('id, class_id, weekday, start_time, end_time, effective_from, effective_until, classes:class_id(name)')
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true })
  if (error) throw error
  return (data || []).map((r: any) => ({
    id: r.id,
    class_id: r.class_id,
    weekday: r.weekday,
    start_time: r.start_time,
    end_time: r.end_time,
    effective_from: r.effective_from,
    effective_until: r.effective_until,
    className: r.classes?.name ?? '',
  }))
}

/**
 * Recompute session_number for one class.
 *
 * Reads every session the class has and writes back only the rows whose number
 * actually moved, so appending to the end costs one update rather than forty.
 */
export async function renumberClass(supabase: SupabaseClient, classId: string): Promise<void> {
  const { data, error } = await supabase
    .from('class_occurrences')
    .select('id, occurrence_date, start_time, session_number')
    .eq('class_id', classId)
  if (error) throw error

  const changed = renumberByDate(data || [])
  // Sequential rather than Promise.all: these are updates to the same table on
  // the same rows a moment after they were written, and a burst of parallel
  // writes here buys nothing worth the contention.
  for (const c of changed) {
    const { error: e } = await supabase
      .from('class_occurrences')
      .update({ session_number: c.session_number })
      .eq('id', c.id)
    if (e) throw e
  }
}

/** Dates the class already has, so generation cannot double-book one. */
async function takenDates(supabase: SupabaseClient, classId: string, from: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('class_occurrences')
    .select('occurrence_date')
    .eq('class_id', classId)
    .gte('occurrence_date', from)
  if (error) throw error
  return new Set((data || []).map((r: any) => r.occurrence_date))
}

async function generateFor(
  supabase: SupabaseClient, series: ScheduleSeries, today: string,
): Promise<number> {
  const until = series.effective_until ?? horizonFrom(today)
  const taken = await takenDates(supabase, series.class_id, today)
  const rows = planSessions(series, today, until, taken)
  if (rows.length === 0) return 0

  const { error } = await supabase.from('class_occurrences').insert(
    // session_number is NOT NULL, so the rows go in with a placeholder and
    // renumberClass immediately puts them in date order. Numbering them here
    // would mean guessing at the class's existing sequence.
    rows.map(r => ({ ...r, session_number: 0 })),
  )
  if (error) throw error
  await renumberClass(supabase, series.class_id)
  return rows.length
}

export async function createSeries(
  supabase: SupabaseClient, input: SeriesInput, userId: string, today: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('class_schedule_series')
    .insert({
      class_id: input.class_id,
      weekday: input.weekday,
      start_time: toSqlTime(input.start_time),
      end_time: toSqlTime(input.end_time),
      // Never earlier than today: a new schedule describes what happens from
      // now on, and backfilling one would invent sessions nobody held.
      effective_from: input.effective_from > today ? input.effective_from : today,
      effective_until: input.effective_until,
      created_by: userId,
    })
    .select()
    .single()
  if (error) throw error
  return generateFor(supabase, data as ScheduleSeries, today)
}

/**
 * Change a series, and rebuild what it produces from today forward.
 *
 * Future sessions belonging to this series are removed and regenerated. A
 * session that was edited on its own has already had its series_id cleared —
 * that is what detaching is for — so it is not caught by this and survives.
 */
export async function updateSeries(
  supabase: SupabaseClient, id: string, input: SeriesInput, today: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('class_schedule_series')
    .update({
      weekday: input.weekday,
      start_time: toSqlTime(input.start_time),
      end_time: toSqlTime(input.end_time),
      effective_until: input.effective_until,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  await deleteFutureOfSeries(supabase, id, today)
  return generateFor(supabase, data as ScheduleSeries, today)
}

/** Removes this series' sessions from `from` onward. Past ones are untouched. */
export async function deleteFutureOfSeries(
  supabase: SupabaseClient, seriesId: string, from: string,
): Promise<void> {
  const { error } = await supabase
    .from('class_occurrences')
    .delete()
    .eq('series_id', seriesId)
    .gte('occurrence_date', from)
  if (error) throw error
}

/**
 * Drop a series and everything it has yet to produce.
 *
 * Sessions that already happened keep their rows; the foreign key is
 * ON DELETE SET NULL, so they simply stop belonging to a series. Deleting them
 * would take a term of attendance history with them.
 */
export async function deleteSeries(
  supabase: SupabaseClient, seriesId: string, classId: string, today: string,
): Promise<void> {
  await deleteFutureOfSeries(supabase, seriesId, today)
  const { error } = await supabase.from('class_schedule_series').delete().eq('id', seriesId)
  if (error) throw error
  await renumberClass(supabase, classId)
}

/** One session on one day, belonging to no series. */
export async function addOneOff(
  supabase: SupabaseClient,
  classId: string, date: string, startTime: string, endTime: string,
): Promise<void> {
  const { error } = await supabase.from('class_occurrences').insert({
    class_id: classId,
    occurrence_date: date,
    start_time: toSqlTime(startTime),
    end_time: toSqlTime(endTime),
    session_number: 0,
    status: 'upcoming',
    series_id: null,
  })
  if (error) throw error
  await renumberClass(supabase, classId)
}

/**
 * Change one session's time.
 *
 * Editing a session that belongs to a repeating schedule DETACHES it — its
 * series_id is cleared. That is the whole mechanism by which an individual
 * change survives: the next time the schedule is edited it rebuilds its own
 * future sessions, and anything still carrying its series_id is replaced. A
 * session moved by hand has to stop being the schedule's business, or the
 * change is silently undone the next time someone touches the series.
 *
 * Renumbered afterwards because moving a session earlier or later can reorder
 * it against another on the same day.
 */
export async function updateOccurrenceTime(
  supabase: SupabaseClient,
  id: string, classId: string, startTime: string, endTime: string,
): Promise<void> {
  const { error } = await supabase
    .from('class_occurrences')
    .update({
      start_time: toSqlTime(startTime),
      end_time: toSqlTime(endTime),
      series_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
  await renumberClass(supabase, classId)
}

/** Remove one session. Its homework and materials keep their class. */
export async function deleteOccurrence(
  supabase: SupabaseClient, id: string, classId: string,
): Promise<void> {
  const { error } = await supabase.from('class_occurrences').delete().eq('id', id)
  if (error) throw error
  await renumberClass(supabase, classId)
}

/**
 * "This and all future" — the rest of a series from this date on.
 *
 * The series row itself stays: it still describes what happened up to here, and
 * clipping effective_until is what stops it generating again.
 */
export async function deleteSeriesFrom(
  supabase: SupabaseClient, seriesId: string, classId: string, fromDate: string,
): Promise<void> {
  await deleteFutureOfSeries(supabase, seriesId, fromDate)
  const dayBefore = new Date(`${fromDate}T12:00:00`)
  dayBefore.setDate(dayBefore.getDate() - 1)
  const { error } = await supabase
    .from('class_schedule_series')
    .update({ effective_until: dayBefore.toISOString().slice(0, 10) })
    .eq('id', seriesId)
  if (error) throw error
  await renumberClass(supabase, classId)
}
