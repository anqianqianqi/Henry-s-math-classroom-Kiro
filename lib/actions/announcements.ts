'use server'

/**
 * Server Actions for the "New Feature" announcement.
 *
 * ── SHAPE ───────────────────────────────────────────────────
 * There is at most one live announcement, and the table is append-only:
 * changing the text deactivates the current row and inserts a new one. The
 * table is therefore its own modification timeline, and the new row's new id
 * is what makes the button shine again for everyone — nobody has a view row
 * for an id that did not exist a moment ago.
 *
 * ── TRUST ───────────────────────────────────────────────────
 * Every mutation re-checks the role here. The client knows whether to draw the
 * edit form, but that is a convenience for the reader, not a permission: a
 * student can call a server action directly. RLS enforces it a third time.
 */

import { createClient } from '@/lib/supabase/server'
import { detectLanguage } from '@/lib/mathtext-core'
import { isWithinShineWindow } from '@/lib/announcements/shineWindow'

type ActionResult<T> = { data: T; error?: never } | { data?: never; error: string }

export interface Announcement {
  id: string
  body: string
  body_en: string | null
  body_zh: string | null
  created_at: string
  /** True while this reader is still inside their own shine window. */
  shining: boolean
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
 * The live announcement, or null.
 *
 * Returns null on ANY failure rather than an error. The button is decoration
 * on someone else's page: if this table is missing, or RLS refuses, or the
 * network drops, the header should look exactly as it does today rather than
 * showing a broken control.
 */
export async function getActiveAnnouncement(): Promise<Announcement | null> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: row } = await supabase
      .from('announcements')
      .select('id, body, body_en, body_zh, created_at')
      .eq('is_active', true)
      .maybeSingle()

    if (!row) return null

    const { data: view } = await supabase
      .from('announcement_views')
      .select('first_seen_at')
      .eq('announcement_id', (row as any).id)
      .eq('user_id', user.id)
      .maybeSingle()

    return {
      ...(row as any),
      shining: isWithinShineWindow((view as any)?.first_seen_at ?? null),
    }
  } catch (err) {
    console.error('[announcements] getActiveAnnouncement:', err)
    return null
  }
}

/**
 * Start this reader's three-day clock, once.
 *
 * Called when the button RENDERS, not when it is clicked: a student who never
 * opens it should still stop being shone at. `ignoreDuplicates` makes the
 * repeat calls on every page load free rather than an error to swallow.
 */
export async function recordAnnouncementView(announcementId: string): Promise<void> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('announcement_views')
      .upsert(
        { announcement_id: announcementId, user_id: user.id },
        { onConflict: 'announcement_id,user_id', ignoreDuplicates: true },
      )
  } catch (err) {
    // Losing this only means the student is shone at for longer. Never worth
    // surfacing, and never worth blocking a render for.
    console.error('[announcements] recordAnnouncementView:', err)
  }
}

/**
 * Replace the announcement text.
 *
 * Deactivate-then-insert, in that order: the partial unique index permits only
 * one active row, so inserting first would fail.
 *
 * Unchanged text is reported as such rather than saved. A trigger also skips
 * the insert, which covers writes that do not come through here — but this
 * check is what lets the panel say "no changes" instead of claiming a save
 * that silently did nothing.
 */
export async function saveAnnouncement(body: string): Promise<
  ActionResult<{ id: string | null; unchanged: boolean }>
> {
  try {
    const trimmed = body.trim()
    if (!trimmed) return { error: 'EMPTY' }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'UNAUTHORIZED' }
    if (!(await isTeacherOrAdmin(supabase, user.id))) return { error: 'UNAUTHORIZED' }

    const { data: current } = await supabase
      .from('announcements')
      .select('id, body')
      .eq('is_active', true)
      .maybeSingle()

    if (current && (current as any).body.trim() === trimmed) {
      return { data: { id: (current as any).id, unchanged: true } }
    }

    if (current) {
      const { error: retireError } = await supabase
        .from('announcements')
        .update({
          is_active: false,
          deactivated_at: new Date().toISOString(),
          deactivated_by: user.id,
        })
        .eq('id', (current as any).id)
      if (retireError) throw retireError
    }

    const { data: inserted, error: insertError } = await supabase
      .from('announcements')
      .insert({
        body: trimmed,
        body_lang: detectLanguage(trimmed),
        created_by: user.id,
      })
      .select('id')
      .single()
    if (insertError) throw insertError

    return { data: { id: (inserted as any).id, unchanged: false } }
  } catch (err) {
    console.error('[announcements] saveAnnouncement:', err)
    return { error: 'SAVE_FAILED' }
  }
}

/**
 * Retire the announcement. The row stays as history — only `is_active` flips,
 * so the text and who wrote it survive, and re-posting it later is a new row
 * with a fresh three days for everyone.
 */
export async function deleteAnnouncement(): Promise<ActionResult<true>> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'UNAUTHORIZED' }
    if (!(await isTeacherOrAdmin(supabase, user.id))) return { error: 'UNAUTHORIZED' }

    const { error } = await supabase
      .from('announcements')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deactivated_by: user.id,
      })
      .eq('is_active', true)
    if (error) throw error

    return { data: true }
  } catch (err) {
    console.error('[announcements] deleteAnnouncement:', err)
    return { error: 'DELETE_FAILED' }
  }
}

/** Whether the current reader may edit. Drives the panel's UI only. */
export async function canEditAnnouncements(): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    return await isTeacherOrAdmin(supabase, user.id)
  } catch {
    return false
  }
}
