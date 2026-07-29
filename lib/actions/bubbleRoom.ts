'use server'

/**
 * Server Actions for Bubble Room Q&A feature.
 *
 * All mutations run server-side with Supabase auth context.
 * RLS policies enforce authorization at DB level.
 *
 * Requirements: 1.1, 1.3, 1.4, 1.6, 3.3, 3.4, 6.2, 6.4, 7.2, 7.4, 8.3, 8.4, 8.5
 */

import { createClient } from '@/lib/supabase/server'
import type { BubbleQuestion, BubbleResponse } from '@/lib/types/bubbleRoom'

// ── Types ────────────────────────────────────────────────────────────────────

type ActionResult<T> = { data: T; error?: never } | { data?: never; error: string }

// ── postQuestion ─────────────────────────────────────────────────────────────

/**
 * Post a new question to the Bubble Room.
 *
 * Validates text, optionally checks challenge/class alignment, inserts row.
 * Returns the new BubbleQuestion with joined display name.
 *
 * Requirements: 1.1, 1.3, 1.4, 8.3, 8.5
 */
export async function postQuestion(
  classId: string | null,
  text: string,
  challengeId?: string | null,
  title?: string | null,
): Promise<ActionResult<BubbleQuestion>> {
  try {
    const trimmed = text.trim()
    if (!trimmed) {
      return { error: 'Question text cannot be empty.' }
    }
    if (trimmed.length > 2000) {
      return { error: 'Question text must be 2000 characters or fewer.' }
    }

    const trimmedTitle = title?.trim() || null
    if (!trimmedTitle) {
      return { error: 'Title is required.' }
    }
    if (trimmedTitle.length > 120) {
      return { error: 'Title must be 120 characters or fewer.' }
    }

    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { error: 'You must be logged in to post a question.' }
    }

    // Note: class_id is now optional for the global bubble room.
    // If challenge_id FK fails (bank challenge not in daily_challenges), retry without it.

    const insertPayload = {
      class_id: classId ?? null,
      user_id: user.id,
      challenge_id: challengeId ?? null,
      title: trimmedTitle,
      text: trimmed,
    }

    let { data, error } = await supabase
      .from('bubble_room_questions')
      .insert(insertPayload)
      .select(`
        id,
        class_id,
        user_id,
        challenge_id,
        title,
        text,
        created_at,
        updated_at,
        profiles:user_id ( full_name, nickname )
      `)
      .single()

    // If FK violation (bank challenge ID), retry without challenge_id
    if (error && challengeId && (error.code === '23503' || error.message?.includes('foreign key'))) {
      const retry = await supabase
        .from('bubble_room_questions')
        .insert({ ...insertPayload, challenge_id: null })
        .select(`
          id, class_id, user_id, challenge_id, title, text, created_at, updated_at,
          profiles:user_id ( full_name, nickname )
        `)
        .single()
      data = retry.data
      error = retry.error
    }

    if (error) throw error

    const row = data as any
    const displayName =
      (row.profiles?.nickname ?? row.profiles?.full_name ?? 'Unknown') as string

    const question: BubbleQuestion = {
      id: row.id,
      class_id: row.class_id,
      user_id: row.user_id,
      challenge_id: row.challenge_id,
      title: row.title ?? null,
      text: row.text,
      created_at: row.created_at,
      updated_at: row.updated_at,
      author_display_name: displayName,
      response_count: 0,
      unique_view_count: 0,
    }

    return { data: question }
  } catch (err) {
    console.error('[BubbleRoom] postQuestion:', err)
    const msg = err instanceof Error ? err.message : JSON.stringify(err)
    return { error: `Failed to post your question: ${msg}` }
  }
}

// ── postResponse ─────────────────────────────────────────────────────────────

/**
 * Post a response to a Bubble Room question.
 *
 * Requirements: 3.3, 3.4, 8.4
 */
export async function postResponse(
  questionId: string,
  text: string,
): Promise<ActionResult<BubbleResponse>> {
  try {
    const trimmed = text.trim()
    if (!trimmed) {
      return { error: 'Response text cannot be empty.' }
    }
    if (trimmed.length > 2000) {
      return { error: 'Response text must be 2000 characters or fewer.' }
    }

    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { error: 'You must be logged in to post a response.' }
    }

    const { data, error } = await supabase
      .from('bubble_room_responses')
      .insert({
        question_id: questionId,
        user_id: user.id,
        text: trimmed,
      })
      .select(`
        id,
        question_id,
        user_id,
        text,
        created_at,
        profiles:user_id ( full_name, nickname )
      `)
      .single()

    if (error) throw error

    const row = data as any

    // Resolve role: check if user has a teacher/admin role
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('roles ( name )')
      .eq('user_id', user.id)
      .is('class_id', null)

    const isTeacher = (roleRows ?? []).some(
      (r: any) => r.roles?.name === 'teacher' || r.roles?.name === 'administrator',
    )

    const displayName =
      (row.profiles?.nickname ?? row.profiles?.full_name ?? 'Unknown') as string

    const response: BubbleResponse = {
      id: row.id,
      question_id: row.question_id,
      user_id: row.user_id,
      text: row.text,
      created_at: row.created_at,
      responder_display_name: displayName,
      responder_role: isTeacher ? 'teacher' : 'student',
    }

    return { data: response }
  } catch (err) {
    console.error('[BubbleRoom] postResponse:', err)
    return { error: 'Failed to post your response. Please try again.' }
  }
}

// ── recordView ────────────────────────────────────────────────────────────────

/**
 * Upsert a view record for the current user on the given question.
 * Called silently (fire-and-forget) when QuestionDetailModal opens.
 *
 * Requirements: engagement tracking for computeWeight
 */
export async function recordView(questionId: string): Promise<void> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('bubble_room_question_views')
      .upsert(
        { question_id: questionId, user_id: user.id, viewed_at: new Date().toISOString() },
        { onConflict: 'question_id,user_id' },
      )
  } catch (err) {
    console.error('[BubbleRoom] recordView:', err)
    // Silently swallow — engagement tracking should never break UX
  }
}

// ── deleteQuestion ────────────────────────────────────────────────────────────

/**
 * Delete a question (and all child responses) via cascade.
 * RLS enforces authorization at DB level.
 *
 * Requirements: 6.2, 7.2
 */
export async function deleteQuestion(
  questionId: string,
): Promise<ActionResult<{ success: true }>> {
  try {
    const supabase = createClient()

    const { error } = await supabase
      .from('bubble_room_questions')
      .delete()
      .eq('id', questionId)

    if (error) throw error

    return { data: { success: true } }
  } catch (err) {
    console.error('[BubbleRoom] deleteQuestion:', err)
    return { error: 'Failed to delete the question. Please try again.' }
  }
}

// ── deleteResponse ────────────────────────────────────────────────────────────

/**
 * Delete a response.
 * RLS enforces authorization at DB level.
 *
 * Requirements: 6.4, 7.4
 */
export async function deleteResponse(
  responseId: string,
): Promise<ActionResult<{ success: true }>> {
  try {
    const supabase = createClient()

    const { error } = await supabase
      .from('bubble_room_responses')
      .delete()
      .eq('id', responseId)

    if (error) throw error

    return { data: { success: true } }
  } catch (err) {
    console.error('[BubbleRoom] deleteResponse:', err)
    return { error: 'Failed to delete the response. Please try again.' }
  }
}

// ── getResponses ──────────────────────────────────────────────────────────────

/**
 * Fetch all responses for a question, ordered chronologically.
 *
 * Requirements: 3.1, 3.2
 */
export async function getResponses(
  questionId: string,
): Promise<ActionResult<BubbleResponse[]>> {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('bubble_room_responses')
      .select(`
        id,
        question_id,
        user_id,
        text,
        created_at,
        profiles:user_id ( full_name, nickname )
      `)
      .eq('question_id', questionId)
      .order('created_at', { ascending: true })

    if (error) throw error

    // Batch-resolve roles for all responders to avoid N+1
    const responderIds = [...new Set((data ?? []).map((r: any) => r.user_id))]

    let teacherIds = new Set<string>()
    if (responderIds.length > 0) {
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('user_id, roles ( name )')
        .in('user_id', responderIds)
        .is('class_id', null)

      teacherIds = new Set(
        (roleRows ?? [])
          .filter((r: any) =>
            r.roles?.name === 'teacher' || r.roles?.name === 'administrator',
          )
          .map((r: any) => r.user_id),
      )
    }

    const responses: BubbleResponse[] = (data ?? []).map((row: any) => ({
      id: row.id,
      question_id: row.question_id,
      user_id: row.user_id,
      text: row.text,
      created_at: row.created_at,
      responder_display_name:
        row.profiles?.nickname ?? row.profiles?.full_name ?? 'Unknown',
      responder_role: teacherIds.has(row.user_id) ? 'teacher' : 'student',
    }))

    return { data: responses }
  } catch (err) {
    console.error('[BubbleRoom] getResponses:', err)
    return { error: 'Failed to load responses. Please try again.' }
  }
}

// ── fetchInitialQuestions ─────────────────────────────────────────────────────

/**
 * Server-side query for initial SSR hydration of bubble room questions.
 * Joins author display names, response counts, and unique view counts.
 *
 * Called from the Next.js Server Component page.tsx.
 *
 * Requirements: 1.1, 8.1
 */
export async function fetchInitialQuestions(): Promise<BubbleQuestion[]> {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('bubble_room_questions')
      .select(`
        id,
        class_id,
        user_id,
        challenge_id,
        title,
        text,
        created_at,
        updated_at,
        profiles:user_id ( full_name, nickname )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    const questionIds = (data ?? []).map((q: any) => q.id)

    // Fetch response counts
    const responseCounts = new Map<string, number>()
    const viewCounts = new Map<string, number>()

    if (questionIds.length > 0) {
      // Get response counts via a grouped query
      const { data: responsesData } = await supabase
        .from('bubble_room_responses')
        .select('question_id')
        .in('question_id', questionIds)

      ;(responsesData ?? []).forEach((r: any) => {
        responseCounts.set(r.question_id, (responseCounts.get(r.question_id) ?? 0) + 1)
      })

      // Get unique view counts
      const { data: viewsData } = await supabase
        .from('bubble_room_question_views')
        .select('question_id')
        .in('question_id', questionIds)

      ;(viewsData ?? []).forEach((v: any) => {
        viewCounts.set(v.question_id, (viewCounts.get(v.question_id) ?? 0) + 1)
      })
    }

    return (data ?? []).map((row: any): BubbleQuestion => ({
      id: row.id,
      class_id: row.class_id,
      user_id: row.user_id,
      challenge_id: row.challenge_id,
      title: row.title ?? null,
      text: row.text,
      created_at: row.created_at,
      updated_at: row.updated_at,
      author_display_name:
        (row.profiles as any)?.nickname ??
        (row.profiles as any)?.full_name ??
        'Unknown',
      response_count: responseCounts.get(row.id) ?? 0,
      unique_view_count: viewCounts.get(row.id) ?? 0,
    }))
  } catch (err) {
    console.error('[BubbleRoom] fetchInitialQuestions:', err)
    return []
  }
}
