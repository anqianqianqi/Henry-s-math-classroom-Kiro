'use client'

/**
 * Who may print which problems.
 *
 * A teacher prints any class. A student prints the classes they are enrolled
 * in, and only problems that have already been set.
 *
 * ── WHY THIS IS NOT LEFT TO THE DROPDOWN ────────────────────
 * The printable page takes its class and its dates from the query string, so
 * a window that offers a student the right choices decides nothing on its
 * own — the URL it produces can be edited, and the tables behind it are
 * readable by any signed-in user (see 003_complete_rls_policies.sql, where
 * daily_challenges and challenge_assignments are both readable by
 * `authenticated`). The rules therefore live here and are applied by the page
 * that prints, not only by the window that asks.
 *
 * ── WHY TODAY IS THE DEFAULT, NOT A WALL ────────────────────
 * Problems are written ahead of the day they are set, and a student's
 * challenge list has always stopped at today (app/challenges/page.tsx). A
 * problem set opens on the same horizon so that printing "everything" means
 * what has actually been set — but a student who wants to read ahead may
 * switch it off, and the window says plainly what that includes. The date is
 * the school's today, not the reader's: a student in another timezone would
 * otherwise cross into tomorrow's problem hours before the class it belongs
 * to, without ever asking to.
 *
 * The class list is the part that is a wall. A student prints their own
 * classes; that is checked by the printing page, not just offered by the
 * window.
 */

import { createClient } from '@/lib/supabase/client'
import { schoolDateString } from '@/lib/utils/timezone'

export interface ProblemSetScope {
  /** Null when signed out. */
  userId: string | null
  isTeacher: boolean
  /** The classes this viewer may print, by name. */
  classes: { id: string; name: string }[]
  /**
   * The date a student's range stops at unless they ask for more — today.
   * Undefined for a teacher, who wrote the problems and has no horizon.
   */
  notAfter?: string
}

/** Teacher or administrator — the roles that see every class. */
export async function isTeacherViewer(userId: string): Promise<boolean> {
  const supabase = createClient()
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId)

  if (!userRoles?.length) return false

  const { data: roles } = await supabase
    .from('roles')
    .select('name')
    .in('id', userRoles.map((r: any) => r.role_id))

  return (roles ?? []).some((r: any) => r.name === 'teacher' || r.name === 'administrator')
}

/** The classes this viewer may print a set for. */
export async function printableClasses(
  isTeacher: boolean,
  userId: string,
): Promise<{ id: string; name: string }[]> {
  const supabase = createClient()

  if (isTeacher) {
    const { data } = await supabase.from('classes').select('id, name').order('name', { ascending: true })
    return (data ?? []) as { id: string; name: string }[]
  }

  const { data: memberships } = await supabase
    .from('class_members')
    .select('class_id')
    .eq('user_id', userId)

  const ids = [...new Set((memberships ?? []).map((m: any) => m.class_id).filter(Boolean))]
  if (!ids.length) return []

  const { data } = await supabase
    .from('classes')
    .select('id, name')
    .in('id', ids)
    .order('name', { ascending: true })

  return (data ?? []) as { id: string; name: string }[]
}

/** Everything the printable page needs to decide what it may show. */
export async function problemSetScope(): Promise<ProblemSetScope> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { userId: null, isTeacher: false, classes: [] }

  const isTeacher = await isTeacherViewer(user.id)
  const classes = await printableClasses(isTeacher, user.id)

  return {
    userId: user.id,
    isTeacher,
    classes,
    notAfter: isTeacher ? undefined : schoolDateString(),
  }
}

/** Whether this viewer may print the class they asked for. */
export function mayPrintClass(scope: ProblemSetScope, classId: string): boolean {
  if (!scope.userId) return false
  return scope.classes.some(c => c.id === classId)
}
