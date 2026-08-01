'use server'

/**
 * Resolving a bubble by thanking whoever answered it.
 *
 * The owner picks one person who replied. That marks the question resolved —
 * it stops floating and moves to Completed in My Bubbles — and gives the
 * thanked person one TA point, unless they are staff.
 *
 * ── WHERE THE RULES LIVE ────────────────────────────────────
 * The point is paid by a trigger on the insert, so the record and the payment
 * are one transaction and no future caller can create a thanks that forgets to
 * pay. Resolve-once is a UNIQUE constraint, and "not yourself" is a CHECK, so
 * neither depends on this file being the only way in. What is left here is the
 * part the database cannot know: whether the person actually replied, and
 * whether they are staff.
 */

import { createClient } from '@/lib/supabase/server'

type ActionResult<T> = { data: T; error?: never } | { data?: never; error: string }

export interface Responder {
  userId: string
  displayName: string
  /** Staff resolve the question but earn nothing — shown so the owner knows. */
  isStaff: boolean
}

async function isTeacherOrAdmin(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('user_roles')
    .select('roles!inner(name)')
    .eq('user_id', userId)
    .is('class_id', null)
  return (data ?? []).some((r: any) =>
    r.roles?.name === 'teacher' || r.roles?.name === 'administrator',
  )
}

/**
 * Everyone who replied and could be thanked, for the dropdown.
 *
 * Excludes the caller: a student may answer their own question, and thanking
 * yourself would mint a point out of nothing. The database refuses it too, but
 * offering a choice that will be rejected is a worse experience than not
 * offering it.
 */
export async function fetchThankableResponders(
  questionId: string,
): Promise<Responder[]> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data: rows } = await supabase
      .from('bubble_room_responses')
      .select('user_id, profiles:user_id ( full_name, nickname )')
      .eq('question_id', questionId)

    const seen = new Map<string, Responder>()
    for (const row of (rows ?? []) as any[]) {
      if (row.user_id === user.id) continue
      if (seen.has(row.user_id)) continue
      seen.set(row.user_id, {
        userId: row.user_id,
        displayName: row.profiles?.nickname ?? row.profiles?.full_name ?? 'Unknown',
        isStaff: await isTeacherOrAdmin(supabase, row.user_id),
      })
    }
    return [...seen.values()]
  } catch (err) {
    console.error('[bubbleThanks] fetchThankableResponders:', err)
    return []
  }
}

/**
 * Thank someone and resolve the question.
 *
 * The thanks row is written first. If marking the question resolved then fails,
 * the student has still been paid and the UNIQUE constraint stops a retry from
 * paying twice — the question simply stays afloat until someone tries again.
 * The reverse order would risk a resolved question whose helper was never paid,
 * which is the worse of the two.
 */
export async function thankResponder(
  questionId: string,
  thankedUserId: string,
): Promise<ActionResult<{ awardedPoint: boolean }>> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'UNAUTHORIZED' }

    if (thankedUserId === user.id) return { error: 'SELF' }

    // Must be the owner. RLS enforces this too; checking here turns a raw
    // policy violation into an error the panel can explain.
    const { data: question } = await supabase
      .from('bubble_room_questions')
      .select('id, user_id, resolved_at')
      .eq('id', questionId)
      .maybeSingle()

    if (!question) return { error: 'NOT_FOUND' }
    if ((question as any).user_id !== user.id) return { error: 'NOT_OWNER' }
    if ((question as any).resolved_at) return { error: 'ALREADY_RESOLVED' }

    // They must actually have replied. Nothing in the schema ties a thanks to a
    // response, so without this the owner could name any user at all.
    const { data: reply } = await supabase
      .from('bubble_room_responses')
      .select('id')
      .eq('question_id', questionId)
      .eq('user_id', thankedUserId)
      .limit(1)
      .maybeSingle()

    if (!reply) return { error: 'DID_NOT_REPLY' }

    const staff = await isTeacherOrAdmin(supabase, thankedUserId)

    const { error: thanksError } = await supabase
      .from('bubble_thanks')
      .insert({
        question_id: questionId,
        thanked_user_id: thankedUserId,
        thanked_by: user.id,
        awarded_point: !staff,
      })

    if (thanksError) {
      // 23505 = unique violation: somebody resolved it between the check above
      // and this insert.
      if ((thanksError as any).code === '23505') return { error: 'ALREADY_RESOLVED' }
      throw thanksError
    }

    const { error: resolveError } = await supabase
      .from('bubble_room_questions')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', questionId)
    if (resolveError) throw resolveError

    return { data: { awardedPoint: !staff } }
  } catch (err) {
    console.error('[bubbleThanks] thankResponder:', err)
    return { error: 'FAILED' }
  }
}
