'use client'

/**
 * The comment thread on a set of submissions: read, post, edit, delete.
 *
 * ── WHY A HOOK ──────────────────────────────────────────────
 * The challenge page carries this logic inline, and the grading spread needs
 * the same behaviour — the same table, the same image upload, the same rule
 * about clearing stored translations on an edit. Copied into a second page it
 * would drift the first time either was touched, and the drift would be
 * invisible: a comment posted from grading that reads differently to one
 * posted from the challenge room.
 *
 * The challenge page is deliberately left alone here. Moving it onto this hook
 * is worth doing, but it is a change to a page students use, and this is not
 * the moment to make it.
 */

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface SubmissionComment {
  id: string
  submission_id: string
  user_id: string
  content: string
  content_en?: string | null
  content_zh?: string | null
  image_url?: string | null
  created_at: string
  profiles: {
    full_name: string
    nickname: string | null
  }
}

/** How many more of a long thread each "show more" reveals. */
export const COMMENTS_INCREMENT = 5

export function useSubmissionComments(submissionIds: string[], userId: string | null) {
  const supabase = createClient()
  const [comments, setComments] = useState<Record<string, SubmissionComment[]>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})
  const [visible, setVisible] = useState<Record<string, number>>({})

  /*
    Joined rather than sorted client-side, and keyed by submission so a row can
    render its own thread without filtering the whole set on every keystroke.

    The id list is joined into a string for the dependency: passing the array
    itself re-runs the effect on every render, because a fresh array is a fresh
    reference even when the ids have not changed.
  */
  const key = submissionIds.join(',')

  useEffect(() => {
    if (!submissionIds.length) { setComments({}); return }
    let cancelled = false

    async function load() {
      const { data } = await supabase
        .from('submission_comments')
        .select('*, profiles!inner(full_name, nickname)')
        .in('submission_id', submissionIds)
        .order('created_at', { ascending: true })

      if (cancelled) return
      const grouped: Record<string, SubmissionComment[]> = {}
      for (const c of (data ?? []) as SubmissionComment[]) {
        ;(grouped[c.submission_id] ??= []).push(c)
      }
      setComments(grouped)
    }

    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, supabase])

  const setDraft = useCallback((submissionId: string, value: string) => {
    setDrafts(prev => ({ ...prev, [submissionId]: value }))
  }, [])

  const showMore = useCallback((submissionId: string) => {
    setVisible(prev => ({
      ...prev,
      [submissionId]: (prev[submissionId] ?? COMMENTS_INCREMENT) + COMMENTS_INCREMENT,
    }))
  }, [])

  const submit = useCallback(async (submissionId: string, imageFile?: File | null) => {
    const text = (drafts[submissionId] ?? '').trim()
    if ((!text && !imageFile) || !userId) return

    setSubmitting(prev => ({ ...prev, [submissionId]: true }))
    try {
      let imageUrl: string | null = null
      if (imageFile) {
        const ext = imageFile.name.split('.').pop()
        const path = `${userId}/comment-${submissionId}-${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('challenge-images')
          .upload(path, imageFile, { contentType: imageFile.type })
        if (!uploadError) {
          imageUrl = supabase.storage.from('challenge-images').getPublicUrl(path).data.publicUrl
        }
      }

      const row: Record<string, unknown> = { submission_id: submissionId, user_id: userId, content: text }
      if (imageUrl) row.image_url = imageUrl

      const { data, error } = await supabase
        .from('submission_comments')
        .insert(row)
        .select('*, profiles!inner(full_name, nickname)')
        .single()

      if (!error && data) {
        setComments(prev => ({
          ...prev,
          [submissionId]: [...(prev[submissionId] ?? []), data as SubmissionComment],
        }))
        setDrafts(prev => ({ ...prev, [submissionId]: '' }))
      }
      return error ?? null
    } finally {
      setSubmitting(prev => ({ ...prev, [submissionId]: false }))
    }
  }, [drafts, supabase, userId])

  const edit = useCallback(async (commentId: string, content: string) => {
    const { error } = await supabase
      .from('submission_comments')
      .update({
        content,
        /*
          Blank the stored translations along with the text they were made
          from. Left in place, a reader in the other language keeps seeing the
          version from before the edit with nothing to show it changed; blanked,
          the next read regenerates against the new wording.
        */
        content_en: null,
        content_zh: null,
        content_lang: null,
      })
      .eq('id', commentId)
      .eq('user_id', userId!)   // own comments only, enforced again by RLS

    if (error) return
    setComments(prev => {
      const next: Record<string, SubmissionComment[]> = {}
      for (const [id, list] of Object.entries(prev)) {
        next[id] = list.map(c => (c.id === commentId ? { ...c, content, content_en: null, content_zh: null } : c))
      }
      return next
    })
  }, [supabase, userId])

  const remove = useCallback(async (commentId: string) => {
    const { error } = await supabase
      .from('submission_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', userId!)

    if (error) return
    setComments(prev => {
      const next: Record<string, SubmissionComment[]> = {}
      for (const [id, list] of Object.entries(prev)) next[id] = list.filter(c => c.id !== commentId)
      return next
    })
  }, [supabase, userId])

  return { comments, drafts, submitting, visible, setDraft, showMore, submit, edit, remove }
}
