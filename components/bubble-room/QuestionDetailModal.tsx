'use client'

/**
 * QuestionDetailModal — expanded question with responses and reply form.
 *
 * On mount:
 *  - Calls recordView() silently for engagement tracking
 *  - Opens a Supabase Realtime channel for live response updates
 *  - Fetches existing responses via getResponses() Server Action
 *
 * Responsibilities:
 *  - Display full question text, author, timestamp (Req 3.1)
 *  - Display each response with role indicator (Req 3.2)
 *  - Response form: validate + postResponse (Req 3.3, 3.4, 3.5, 3.6)
 *  - Delete actions respecting authorship/role rules (Req 6.1-6.4, 7.1-7.5)
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  recordView,
  postResponse,
  deleteQuestion,
  deleteResponse,
} from '@/lib/actions/bubbleRoom'
import type { BubbleQuestion, BubbleResponse } from '@/lib/types/bubbleRoom'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import type { Language } from '@/lib/i18n/catalog'
import { useOnDemandTranslation } from '@/lib/i18n/useOnDemandTranslation'
import { BadgePill } from './BadgePill'
import { ThankResponderBar } from './ThankResponderBar'
import { canAnswerBubble } from '@/lib/utils/bubbleAnswerPermission'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export interface QuestionDetailModalProps {
  question: BubbleQuestion
  currentUserId: string
  currentUserRole: 'teacher' | 'student'
  /** Holds the bubble_room_ta badge — decides whether the reply box appears. */
  currentUserIsTA: boolean
  currentUserDisplayName: string
  onClose: () => void
  onResponseSubmitted: () => void
  onDeleteQuestion: (questionId: string) => void
  onDeleteResponse: (responseId: string) => void
  /** Optional: shown when the modal was opened from the assigned list */
  onBack?: () => void
}

export function QuestionDetailModal({
  question,
  currentUserId,
  currentUserRole,
  currentUserIsTA,
  currentUserDisplayName,
  onClose,
  onResponseSubmitted,
  onDeleteQuestion,
  onDeleteResponse,
  onBack,
}: QuestionDetailModalProps) {
  const [responses, setResponses] = useState<BubbleResponse[]>([])
  const [responseText, setResponseText] = useState('')
  const [responseImageFile, setResponseImageFile] = useState<File | null>(null)
  const [responseImagePreview, setResponseImagePreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [responseError, setResponseError] = useState<string | null>(null)
  const [deleteQuestionError, setDeleteQuestionError] = useState<string | null>(null)
  const [deleteResponseError, setDeleteResponseError] = useState<string | null>(null)
  const [isDeletingQuestion, setIsDeletingQuestion] = useState(false)
  const [deletingResponseId, setDeletingResponseId] = useState<string | null>(null)
  const [loadingResponses, setLoadingResponses] = useState(true)
  const [confirmDeleteQuestion, setConfirmDeleteQuestion] = useState(false)
  const [confirmDeleteResponseId, setConfirmDeleteResponseId] = useState<string | null>(null)
  // Local so the bar can flip to "Resolved" without refetching the question.
  const [resolvedAt, setResolvedAt] = useState<string | null>(
    (question as any).resolved_at ?? null,
  )
  // Challenge context: fetch the full challenge content when challenge_id is set
  const [challengeContext, setChallengeContext] = useState<{
    title: string
    description: string
    image_url: string | null
  } | null>(null)
  const responseInputRef = useRef<HTMLTextAreaElement>(null)
  const responseFileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const { t, language } = useLanguage()
  const local = useOnDemandTranslation('question', question.id, question, language)

  // ── On mount: record view + fetch responses + open Realtime channel ──────
  useEffect(() => {
    // Fire-and-forget engagement tracking (Req: engagement scoring)
    recordView(question.id).catch(() => {})

    // Fetch challenge context if this bubble is linked to a challenge
    if (question.challenge_id) {
      ;(async () => {
        const supabaseClient = createClient()
        // Try daily_challenges first, then challenge_bank as fallback
        let title = ''
        let description = ''
        let imageUrl: string | null = null

        const { data: dc } = await supabaseClient
          .from('daily_challenges')
          .select('title, description, image_url')
          .eq('id', question.challenge_id!)
          .maybeSingle()

        if (dc) {
          title = dc.title ?? ''
          description = dc.description ?? ''
          imageUrl = (dc as any).image_url ?? null
        } else {
          const { data: cb } = await supabaseClient
            .from('challenge_bank')
            .select('title, description, image_url')
            .eq('id', question.challenge_id!)
            .maybeSingle()
          if (cb) {
            title = cb.title ?? ''
            description = cb.description ?? ''
            imageUrl = (cb as any).image_url ?? null
          }
        }

        if (title || description) {
          setChallengeContext({ title, description, image_url: imageUrl })
        }
      })()
    }

    // Fetch existing responses directly via client — no Server Action round-trip
    ;(async () => {
      const supabaseClient = createClient()
      const { data, error } = await supabaseClient
        .from('bubble_room_responses')
        .select(`
          id,
          question_id,
          user_id,
          text,
          text_en,
          text_zh,
          text_lang,
          image_url,
          created_at,
          profiles:user_id ( full_name, nickname )
        `)
        .eq('question_id', question.id)
        .order('created_at', { ascending: true })

      if (!error && data) {
        // Batch-resolve teacher roles
        const responderIds = [...new Set(data.map((r: any) => r.user_id))]
        let teacherIds = new Set<string>()
        if (responderIds.length > 0) {
          const { data: roleRows } = await supabaseClient
            .from('user_roles')
            .select('user_id, roles ( name )')
            .in('user_id', responderIds)
            .is('class_id', null)
          teacherIds = new Set(
            (roleRows ?? [])
              .filter((r: any) => r.roles?.name === 'teacher' || r.roles?.name === 'administrator')
              .map((r: any) => r.user_id),
          )
        }

        setResponses(
          data.map((row: any): BubbleResponse => ({
            id: row.id,
            question_id: row.question_id,
            user_id: row.user_id,
            text: row.text,
            text_en: row.text_en ?? null,
            text_zh: row.text_zh ?? null,
            text_lang: row.text_lang ?? null,
            image_url: row.image_url ?? null,
            created_at: row.created_at,
            responder_display_name: row.profiles?.nickname ?? row.profiles?.full_name ?? 'Unknown',
            responder_role: teacherIds.has(row.user_id) ? 'teacher' : 'student',
            responder_badges: [],
          })),
        )

        // Batch-fetch active badges for all responders
        if (responderIds.length > 0) {
          const supabaseClient2 = createClient()
          const { data: badgeRows } = await supabaseClient2
            .from('user_badges')
            .select('user_id, badge:badge_definitions(slug, name, emoji, color)')
            .in('user_id', responderIds)
            .is('revoked_at', null)

          if (badgeRows?.length) {
            const badgesByUser = new Map<string, Array<{ slug: string; name: string; emoji: string; color: string }>>()
            for (const br of badgeRows) {
              const b = br.badge as any
              if (!b) continue
              const list = badgesByUser.get(br.user_id) ?? []
              list.push({ slug: b.slug, name: b.name, emoji: b.emoji, color: b.color })
              badgesByUser.set(br.user_id, list)
            }
            setResponses((prev) =>
              prev.map((r) => ({ ...r, responder_badges: badgesByUser.get(r.user_id) ?? [] })),
            )
          }
        }
      }
      setLoadingResponses(false)
    })()

    // Supabase Realtime: listen for response INSERT / DELETE
    const channel = supabase
      .channel(`bubble-room-responses:${question.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bubble_room_responses',
          filter: `question_id=eq.${question.id}`,
        },
        async (payload) => {
          // Re-fetch to get joined profile data, but skip if already present (optimistic)
          const supabaseClient = createClient()
          const { data, error } = await supabaseClient
            .from('bubble_room_responses')
            .select(`
              id,
              question_id,
              user_id,
              text,
              created_at,
              profiles:user_id ( full_name, nickname )
            `)
            .eq('question_id', question.id)
            .order('created_at', { ascending: true })

          if (!error && data) {
            const responderIds = [...new Set(data.map((r: any) => r.user_id))]
            let teacherIds = new Set<string>()
            if (responderIds.length > 0) {
              const { data: roleRows } = await supabaseClient
                .from('user_roles')
                .select('user_id, roles ( name )')
                .in('user_id', responderIds)
                .is('class_id', null)
              teacherIds = new Set(
                (roleRows ?? [])
                  .filter((r: any) => r.roles?.name === 'teacher' || r.roles?.name === 'administrator')
                  .map((r: any) => r.user_id),
              )
            }
            setResponses(
              data.map((row: any): BubbleResponse => ({
                id: row.id,
                question_id: row.question_id,
                user_id: row.user_id,
                text: row.text,
            text_en: row.text_en ?? null,
            text_zh: row.text_zh ?? null,
            text_lang: row.text_lang ?? null,
                image_url: row.image_url ?? null,
                created_at: row.created_at,
                responder_display_name: row.profiles?.nickname ?? row.profiles?.full_name ?? 'Unknown',
                responder_role: teacherIds.has(row.user_id) ? 'teacher' : 'student',
                responder_badges: [],
              })),
            )
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'bubble_room_responses',
          filter: `question_id=eq.${question.id}`,
        },
        (payload) => {
          setResponses((prev) => prev.filter((r) => r.id !== (payload.old as any).id))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [question.id])

  // ── Helpers ──────────────────────────────────────────────────────────────

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  /** Can the current user delete a piece of content? */
  function canDelete(contentUserId: string): boolean {
    return currentUserId === contentUserId || currentUserRole === 'teacher'
  }

  /* Answering is a TA's job — a student without the badge reads the thread but
     replies only under their own question. The brr_insert policy enforces this;
     hiding the box just spares them writing an answer that would be refused. */
  const canAnswer = canAnswerBubble({
    isOwner: currentUserId === question.user_id,
    role: currentUserRole,
    isTA: currentUserIsTA,
  })

  // ── Response image handler ────────────────────────────────────────────────

  function handleResponseImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setResponseError(t('bubble.errImageType'))
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setResponseError(t('bubble.errImageSize'))
      return
    }
    setResponseError(null)
    setResponseImageFile(file)
    setResponseImagePreview(URL.createObjectURL(file))
  }

  function handleRemoveResponseImage() {
    setResponseImageFile(null)
    setResponseImagePreview(null)
    if (responseFileInputRef.current) responseFileInputRef.current.value = ''
  }

  // ── Response submit ───────────────────────────────────────────────────────

  async function handleResponseSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResponseError(null)

    const trimmed = responseText.trim()
    if (!trimmed) {
      setResponseError(t('bubble.errResponseEmpty'))
      responseInputRef.current?.focus()
      return
    }

    setIsSubmitting(true)
    try {
      // Upload image if one was attached
      let uploadedImageUrl: string | null = null
      if (responseImageFile) {
        const supabaseClient = createClient()
        const ext = responseImageFile.name.split('.').pop() ?? 'jpg'
        const path = `responses/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabaseClient.storage
          .from('bubble-room-images')
          .upload(path, responseImageFile, { cacheControl: '3600', upsert: false })
        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`)
        const { data: { publicUrl } } = supabaseClient.storage
          .from('bubble-room-images')
          .getPublicUrl(path)
        uploadedImageUrl = publicUrl
      }

      const result = await postResponse(question.id, trimmed, uploadedImageUrl)
      if (result.error) {
        setResponseError(result.error)
        return
      }
      // Optimistically append the new response immediately
      if (result.data) {
        setResponses((prev) => {
          if (prev.find((r) => r.id === result.data!.id)) return prev
          return [...prev, result.data!]
        })
      }
      setResponseText('')
      setResponseImageFile(null)
      setResponseImagePreview(null)
      if (responseFileInputRef.current) responseFileInputRef.current.value = ''
      onResponseSubmitted()
    } catch (err) {
      setResponseError(err instanceof Error ? err.message : t('bubble.errPostResponse'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Delete question ───────────────────────────────────────────────────────

  async function handleDeleteQuestion() {
    if (!confirmDeleteQuestion) {
      setConfirmDeleteQuestion(true)
      return
    }
    setIsDeletingQuestion(true)
    setDeleteQuestionError(null)
    try {
      const result = await deleteQuestion(question.id)
      if (result.error) {
        setDeleteQuestionError(result.error)
        setConfirmDeleteQuestion(false)
        return
      }
      onDeleteQuestion(question.id)
      onClose()
    } catch {
      setDeleteQuestionError(t('bubble.errDelete'))
      setConfirmDeleteQuestion(false)
    } finally {
      setIsDeletingQuestion(false)
    }
  }

  // ── Delete response ───────────────────────────────────────────────────────

  async function handleDeleteResponse(responseId: string) {
    if (confirmDeleteResponseId !== responseId) {
      setConfirmDeleteResponseId(responseId)
      return
    }
    setDeletingResponseId(responseId)
    setDeleteResponseError(null)
    try {
      const result = await deleteResponse(responseId)
      if (result.error) {
        setDeleteResponseError(result.error)
        setConfirmDeleteResponseId(null)
        return
      }
      setResponses((prev) => prev.filter((r) => r.id !== responseId))
      onDeleteResponse(responseId)
      setConfirmDeleteResponseId(null)
    } catch {
      setDeleteResponseError(t('bubble.errDelete'))
      setConfirmDeleteResponseId(null)
    } finally {
      setDeletingResponseId(null)
    }
  }

  // ── Edge bubbles (bottom half only) ──────────────────────────────────────
  // Seeded PRNG so bubbles are stable across re-renders but varied per question
  const edgeBubbles = useMemo(() => {
    const seed = question.id
    let h = 0
    for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0
    const rand = () => { h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h ^= h >>> 16; return (Math.abs(h) / 2147483648) }

    const isChallenge = !!question.challenge_id
    const colorsC = ['rgba(191,219,254,0.88)', 'rgba(243,232,255,0.82)', 'rgba(252,231,243,0.84)', 'rgba(216,180,254,0.75)']
    const colorsR = ['rgba(254,240,138,0.88)', 'rgba(254,249,195,0.82)', 'rgba(254,252,232,0.78)', 'rgba(253,224,71,0.70)']
    const glowC = 'rgba(139,92,246,0.35)'
    const glowR = 'rgba(202,138,4,0.38)'

    const bubbles: Array<{
      id: number; size: number; edge: string; pos: number
      delay: number; speed: number; wait: number; dx: number; dy: number
      color: string; glow: string; travel: number
    }> = []

    // Bottom edge — densely packed, 20 bubbles
    for (let i = 0; i < 20; i++) {
      const size = 5 + Math.floor(rand() * 26)
      const pos = 2 + rand() * 96
      const dx = (rand() - 0.5) * 0.8
      const dy = -(0.8 + rand() * 0.4)
      // wait: 0–50% of total duration is "invisible hold" baked into keyframe
      const wait = rand() * 0.50
      bubbles.push({
        id: i, size, edge: 'bottom', pos,
        delay: 0, speed: 3.5 + rand() * 5, wait,
        dx, dy,
        color: (isChallenge ? colorsC : colorsR)[Math.floor(rand() * 4)],
        glow: isChallenge ? glowC : glowR,
        travel: 50 + size * 2.8 + rand() * 40,
      })
    }
    // Lower-half of left edge — 10 bubbles
    for (let i = 0; i < 10; i++) {
      const size = 5 + Math.floor(rand() * 22)
      const pos = 50 + rand() * 50
      const dx = -(0.8 + rand() * 0.4)
      const dy = -(rand() * 0.6)
      const wait = rand() * 0.50
      bubbles.push({
        id: 20 + i, size, edge: 'left', pos,
        delay: 0, speed: 3.5 + rand() * 5, wait,
        dx, dy,
        color: (isChallenge ? colorsC : colorsR)[Math.floor(rand() * 4)],
        glow: isChallenge ? glowC : glowR,
        travel: 45 + size * 2.5 + rand() * 35,
      })
    }
    // Lower-half of right edge — 10 bubbles
    for (let i = 0; i < 10; i++) {
      const size = 5 + Math.floor(rand() * 22)
      const pos = 50 + rand() * 50
      const dx = 0.8 + rand() * 0.4
      const dy = -(rand() * 0.6)
      const wait = rand() * 0.50
      bubbles.push({
        id: 30 + i, size, edge: 'right', pos,
        delay: 0, speed: 3.5 + rand() * 5, wait,
        dx, dy,
        color: (isChallenge ? colorsC : colorsR)[Math.floor(rand() * 4)],
        glow: isChallenge ? glowC : glowR,
        travel: 45 + size * 2.5 + rand() * 35,
      })
    }
    return bubbles
  }, [question.id, question.challenge_id])

  const panelRef = useRef<HTMLDivElement>(null)
  const [panelSize, setPanelSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const measure = () => setPanelSize({ w: el.offsetWidth, h: el.offsetHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-detail-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-2"
    >
      {/* Backdrop — color matches bubble type */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{
          background: question.challenge_id
            ? 'rgba(49, 46, 129, 0.22)'    // indigo tint for challenge (purple)
            : 'rgba(113, 85, 0, 0.18)',     // warm yellow-brown tint for regular
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel + bubble overlay wrapper — overflow visible so bubbles escape */}
      <div className="relative z-10 w-full sm:max-w-6xl flex flex-col" style={{ maxHeight: '95vh' }}>

        {/* Bubble overlay — anchored to actual panel edges via measured size */}
        {panelSize.w > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ zIndex: 12, overflow: 'visible' }}
          >
            {edgeBubbles.map((b) => {
              let stylePos: React.CSSProperties = {}
              if (b.edge === 'bottom') {
                stylePos = {
                  left: (b.pos / 100) * panelSize.w,
                  bottom: 0,
                  transform: 'translate(-50%, 50%)',
                }
              } else if (b.edge === 'left') {
                stylePos = {
                  left: 0,
                  top: (b.pos / 100) * panelSize.h,
                  transform: 'translate(-50%, -50%)',
                }
              } else {
                stylePos = {
                  right: 0,
                  top: (b.pos / 100) * panelSize.h,
                  transform: 'translate(50%, -50%)',
                }
              }
              return (
                <div
                  key={b.id}
                  className="modal-edge-bubble absolute rounded-full pointer-events-none"
                  style={{
                    width: b.size,
                    height: b.size,
                    ...stylePos,
                    background: `radial-gradient(circle at 33% 28%, rgba(255,255,255,0.88) 0%, ${b.color} 55%, rgba(255,255,255,0.04) 100%)`,
                    border: '1px solid rgba(255,255,255,0.65)',
                    boxShadow: `0 0 ${Math.round(b.size * 0.65)}px ${b.glow}`,
                    animationDelay: `${(b.wait * b.speed).toFixed(2)}s`,
                    animationDuration: `${b.speed}s`,
                    '--eb-tx': `${b.dx * b.travel}px`,
                    '--eb-ty': `${b.dy * b.travel}px`,
                  } as React.CSSProperties}
                />
              )
            })}
          </div>
        )}

      {/* Panel — bubble-glass aesthetic */}
      <div
        ref={panelRef}
        className="
          bubble-modal-panel
          relative w-full
          rounded-t-3xl sm:rounded-3xl
          flex flex-col
          max-h-[90vh]
          overflow-hidden
        "
        style={{
          // Match exact bubble gradient stops:
          // Regular:   blue-200 → purple-100 → pink-100  (#bfdbfe → #f3e8ff → #fce7f3)
          // Challenge: blue-200 → purple-100 → pink-100 (purple palette)
          // Regular:   yellow-100 → yellow-50 → white (lighter than bubble, dreamy)
          background: question.challenge_id
            ? 'linear-gradient(145deg, rgba(191,219,254,0.93) 0%, rgba(243,232,255,0.89) 45%, rgba(252,231,243,0.93) 100%)'
            : 'linear-gradient(145deg, rgba(254,249,195,0.92) 0%, rgba(254,252,232,0.88) 45%, rgba(255,255,255,0.90) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: question.challenge_id
            ? '1.5px solid rgba(167,139,250,0.40)'
            : '1.5px solid rgba(254,240,138,0.60)',
          boxShadow: question.challenge_id
            ? '0 8px 48px rgba(100,60,200,0.20), 0 0 0 1px rgba(191,219,254,0.3), inset 0 1px 0 rgba(255,255,255,0.65), inset -2px -2px 8px rgba(100,60,200,0.10)'
            : '0 8px 48px rgba(180,140,0,0.18), 0 0 0 1px rgba(254,240,138,0.4), inset 0 1px 0 rgba(255,255,255,0.70), inset -2px -2px 8px rgba(161,98,7,0.08)',
        }}
      >
        {/* Bubble highlight — large soft ellipse upper-right (mirrors QuestionBubble) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full"
          style={{
            width: '55%', height: '22%',
            top: '4%', right: '3%',
            background: 'radial-gradient(ellipse at 40% 40%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)',
            transform: 'rotate(-30deg)',
            filter: 'blur(6px)',
            zIndex: 0,
          }}
        />
        {/* Bubble rim glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-t-3xl sm:rounded-3xl"
          style={{
            boxShadow: question.challenge_id
              ? 'inset 0 0 0 1.5px rgba(191,219,254,0.5)'
              : 'inset 0 0 0 1.5px rgba(254,249,195,0.55)',
            zIndex: 0,
          }}
        />
        {/* ── Top bar: back + close ─────────────────────────────── */}
        <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2">
          <div>
            {onBack && (
              <button type="button" onClick={onBack}
                className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 font-medium transition-colors">
                ← Back to Assigned
              </button>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label={t('action.close')}
            className="text-indigo-300 hover:text-indigo-600 transition-colors shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Two-column body ──────────────────────────────────── */}
        <div className="relative z-10 flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">

          {/* LEFT: Question + delete */}
          <div className="sm:w-1/2 flex flex-col overflow-y-auto px-5 py-4 border-b border-white/40 sm:border-b-0 sm:border-r sm:border-white/40 space-y-3">
            <div>
              <p className="text-xs text-indigo-400/80 mb-0.5">
                {question.author_display_name} · {formatDate(question.created_at)}
              </p>
              {challengeContext && (
                <div className="mb-3 rounded-2xl p-3 space-y-2"
                  style={{ background: 'rgba(237,233,254,0.70)', border: '1.5px solid rgba(167,139,250,0.40)', backdropFilter: 'blur(8px)' }}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm" aria-hidden="true">🎯</span>
                    <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide flex-1">Challenge</span>
                    <a href={`/challenges/${question.challenge_id}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-purple-600 hover:text-purple-800 hover:underline shrink-0 font-medium"
                      title={t('bubble.openChallenge')} onClick={(e) => e.stopPropagation()}>
                      View full challenge →
                    </a>
                  </div>
                  <p className="text-sm font-semibold text-purple-900 leading-snug">{challengeContext.title}</p>
                  {challengeContext.description && (
                    <p className="text-xs text-purple-700 leading-snug whitespace-pre-wrap">{challengeContext.description}</p>
                  )}
                  {challengeContext.image_url && (
                    <a href={challengeContext.image_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={challengeContext.image_url} alt="Challenge image"
                        className="rounded-lg border border-purple-200 w-full hover:opacity-90 transition-opacity" />
                    </a>
                  )}
                </div>
              )}
              {question.title && (
                <h2 id="question-detail-title" className="text-base font-semibold text-gray-800 leading-snug mb-1">
                  {local.title}
                </h2>
              )}
              <p id={question.title ? undefined : 'question-detail-title'}
                className={`leading-snug ${question.title ? 'text-sm text-gray-600' : 'text-base font-semibold text-gray-800'}`}>
                {local.text}
              </p>
              {question.image_url && (
                <a href={question.image_url} target="_blank" rel="noopener noreferrer" className="block mt-2"
                  aria-label={t('bubble.viewQuestionImage')}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={question.image_url} alt="Question attachment"
                    className="max-h-48 rounded-xl border border-gray-200 object-contain bg-gray-50 hover:opacity-90 transition-opacity" />
                </a>
              )}
            </div>
            {/* Bottom-left of the question: resolve it by thanking whoever
                answered. Hidden for non-owners and until somebody replies. */}
            <ThankResponderBar
              questionId={question.id}
              isOwner={currentUserId === question.user_id}
              resolvedAt={resolvedAt}
              responseCount={responses.length}
              onResolved={() => {
                setResolvedAt(new Date().toISOString())
                onResponseSubmitted()
              }}
            />

            {canDelete(question.user_id) && (
              <div>
                {deleteQuestionError && <p role="alert" className="text-sm text-gray-500 mb-1">{deleteQuestionError}</p>}
                {confirmDeleteQuestion ? (
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className="text-sm text-gray-600 font-medium">{t('bubble.confirmDeleteQuestion')}</span>
                    <button type="button" onClick={handleDeleteQuestion} disabled={isDeletingQuestion}
                      className="text-sm font-semibold text-gray-600 hover:text-gray-800 disabled:opacity-50">
                      {isDeletingQuestion ? t('bubble.deleting') : t('bubble.yesDelete')}
                    </button>
                    <button type="button" onClick={() => setConfirmDeleteQuestion(false)} className="text-sm text-gray-500 hover:text-gray-700">
                      {t('action.cancel')}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={handleDeleteQuestion}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={t('bubble.deleteThisQuestion')}>
                    🗑 {t('bubble.deleteQuestion')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Responses + reply form */}
          <div className="sm:w-1/2 flex flex-col min-h-0 max-h-[45vh] sm:max-h-none">

        {/* ── Responses list (Req 3.1, 3.2) ───────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {loadingResponses ? (
            <div className="text-center py-6">
              <div className="inline-block w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" aria-label={t('bubble.loadingResponses')} />
            </div>
          ) : responses.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              {t('bubble.noResponses')}
            </p>
          ) : (
            responses.map((response) => (
              <div
                key={response.id}
                className="group rounded-2xl p-3 space-y-1"
                style={{
                  background: 'rgba(255,255,255,0.45)',
                  border: question.challenge_id
                    ? '1px solid rgba(253,224,71,0.35)'
                    : '1px solid rgba(191,219,254,0.5)',
                  backdropFilter: 'blur(6px)',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Role indicator (Req 3.2) */}
                    {response.responder_role === 'teacher' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-100 rounded-full px-2 py-0.5">
                        ⭐ {response.responder_display_name}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-gray-600">
                        {response.responder_display_name}
                      </span>
                    )}
                    {/* Badges */}
                    {(response.responder_badges ?? []).map((b) => (
                      <BadgePill key={b.slug} emoji={b.emoji} name={b.name} color={b.color} />
                    ))}
                    <span className="text-xs text-gray-400">{formatDate(response.created_at)}</span>
                  </div>

                  {/* Delete response action (Req 6.3, 7.3) */}
                  {canDelete(response.user_id) && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {confirmDeleteResponseId === response.id ? (
                        <div className="flex gap-1 items-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteResponse(response.id)}
                            disabled={deletingResponseId === response.id}
                            className="text-xs font-semibold text-gray-600 hover:text-gray-800 disabled:opacity-50"
                          >
                            {deletingResponseId === response.id ? t('bubble.deleting') : t('action.confirm')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteResponseId(null)}
                            className="text-xs text-gray-500"
                          >
                            {t('action.cancel')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteResponse(response.id)}
                          aria-label={`Delete response by ${response.responder_display_name}`}
                          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <ResponseText response={response} language={language} />
                {/* Response image */}
                {response.image_url && (
                  <a
                    href={response.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-1.5"
                    aria-label={t('bubble.viewResponseImage')}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={response.image_url}
                      alt="Response attachment"
                      className="max-h-48 rounded-xl border border-gray-200 object-contain bg-gray-50 hover:opacity-90 transition-opacity"
                    />
                  </a>
                )}
              </div>
            ))
          )}

          {deleteResponseError && (
            <p role="alert" className="text-sm text-gray-500">
              {deleteResponseError}
            </p>
          )}
        </div>

        {/* ── Response form (Req 3.3, 3.4, 3.5, 3.6) ─────────────────── */}
        {canAnswer ? (
        <form
          onSubmit={handleResponseSubmit}
          className="relative z-10 p-4 space-y-2"
          style={{
            borderTop: '1px solid rgba(200,180,255,0.3)',
            background: 'rgba(255,255,255,0.25)',
            backdropFilter: 'blur(8px)',
          }}
          aria-label={t('bubble.postAResponse')}
        >
          <textarea
            ref={responseInputRef}
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder={t('bubble.writeResponse')}
            className={`
              w-full px-3 py-2 rounded-xl border text-sm text-gray-800 resize-none
              focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent
              transition-colors placeholder:text-indigo-300
              ${responseError ? 'border-red-400 bg-red-50' : 'border-white/60 bg-white/60'}
            `}
          />

          {/* Response image preview */}
          {responseImagePreview && (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={responseImagePreview}
                alt="Selected image preview"
                className="max-h-32 rounded-xl border border-gray-200 object-contain bg-gray-50"
              />
              <button
                type="button"
                onClick={handleRemoveResponseImage}
                aria-label={t('bubble.removeImage')}
                className="
                  absolute -top-2 -right-2
                  w-5 h-5 rounded-full bg-gray-700 text-white
                  flex items-center justify-center text-xs
                  hover:bg-red-600 transition-colors
                "
              >
                ✕
              </button>
            </div>
          )}

          {responseError && (
            <p role="alert" className="text-sm text-red-600">
              {responseError}
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            {/* Image attach button */}
            <label
              className="
                flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                text-xs text-gray-500 border border-gray-200 bg-white
                cursor-pointer hover:border-primary-400 hover:text-primary-500
                transition-colors
              "
              aria-label={t('bubble.attachResponseImage')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {responseImageFile ? responseImageFile.name.slice(0, 16) + (responseImageFile.name.length > 16 ? '…' : '') : 'Image'}
              <input
                ref={responseFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleResponseImageChange}
                className="sr-only"
              />
            </label>

            <Button
              type="submit"
              size="sm"
              variant="primary"
              isLoading={isSubmitting}
              disabled={isSubmitting || responseText.trim().length === 0}
            >
              {t('bubble.reply')}
            </Button>
          </div>
        </form>
        ) : (
          /* A notice rather than a disabled textarea: there is nothing they can
             do to make the box work on this question, so offering one would
             only invite them to write an answer that cannot be posted. */
          <div
            className="relative z-10 p-4 text-center"
            style={{
              borderTop: '1px solid rgba(200,180,255,0.3)',
              background: 'rgba(255,255,255,0.25)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <p className="text-sm font-medium text-gray-600">
              {t('bubble.answersAreForTAs')}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {t('bubble.answersAreForTAsHint')}
            </p>
          </div>
        )}
          </div>{/* end RIGHT column */}
        </div>{/* end two-column body */}
      </div>
      </div>
    </div>
  )
}

// ── Reply text ─────────────────────────────────────────────────────────────

/**
 * One reply's prose, in the reader's language.
 *
 * Separate from the list above only because the on-demand translation is a
 * hook, and hooks cannot run inside a .map(). Each reply asks for its own
 * translation the first time somebody reads the thread in a language it has
 * not been rendered in yet; the result is stored server-side, so the rest of
 * the class gets it immediately.
 */
function ResponseText({
  response,
  language,
}: {
  response: BubbleResponse
  language: Language
}) {
  const { text } = useOnDemandTranslation('response', response.id, response, language)
  return <p className="text-sm text-gray-800 leading-relaxed">{text}</p>
}
