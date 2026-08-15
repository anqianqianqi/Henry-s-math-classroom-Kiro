'use client'

/**
 * The grading spread: one problem on the left, every answer to it on the right.
 *
 * ── WHY IT IS A SPREAD AND NOT A LINK ───────────────────────
 * Grading used to mean leaving the list for /challenges/{id} and coming back,
 * once per submission. The problem is the one thing a teacher needs on screen
 * and the one thing the grading list never loaded, so the trip was unavoidable.
 * Opening it in place, with the whole class's answers beside it, turns a round
 * trip per student into one for the whole problem.
 *
 * ── WHY IT LOOKS LIKE THE BOOK ──────────────────────────────
 * The shape is lifted from the zoomed reader in Book3DReveal: a fixed blurred
 * backdrop, then a spread that scrolls as one sheet rather than two panes with
 * their own scrollbars. Worth knowing that only the 3D book needs Three.js —
 * the zoomed reader is plain DOM, which is why this can borrow it outright.
 */

import { useEffect, useMemo, useRef } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { MathText } from '@/lib/mathtext'
import { HenryProblemSheet } from '@/components/HenryProblemSheet'
import { readStoredHenryProblem } from '@/lib/henryproblem'
import { pageNativeHenryTheme } from '@/lib/henry-theme'
import { Button } from '@/components/ui/Button'

export interface SpreadSubmission {
  id: string
  student_name: string
  student_email: string
  answer: string | null
  /**
   * A photo of the working, when the student attached one.
   *
   * Often the whole answer: a student who works on paper types "36" and
   * photographs six lines of algebra. Grading the text alone was grading the
   * least of what they submitted.
   */
  image_url: string | null
  points: number | null
  max_points: number | null
  submitted_at: string
}

export interface SpreadChallenge {
  id: string
  title: string
  challenge_date: string
  description: string | null
  henryproblem: unknown
}

export interface SubmissionSpreadProps {
  challenge: SpreadChallenge | null
  /** Every submission for this challenge, in the order they should be read. */
  submissions: SpreadSubmission[]
  /** The one that was clicked — scrolled to and outlined. */
  focusId: string | null
  /** Draft point values, keyed by submission id. Owned by the page. */
  drafts: Record<string, { points: string; saving: boolean }>
  onDraftChange: (submissionId: string, points: string) => void
  onSave: (submissionId: string, maxPoints: number | null) => void
  onClose: () => void
  /** True while the challenge's problem is still being fetched. */
  loading: boolean
  formatDate: (iso: string) => string
  /**
   * The book's page texture — book_texture_packages.inner_url.
   *
   * Without it the spread is a flat gradient and stops looking like the book
   * the teacher just came from. Null while it loads, or when no package is
   * configured, in which case the gradient below stands in.
   */
  pageTextureUrl?: string | null
}

/**
 * Paper, matching the book's page.
 *
 * Stretched rather than covered, for the reason Book3DReveal gives: the page
 * grows with its content, and `cover` would zoom the texture until the
 * decorative border is cropped off the sides. Stretching keeps the frame
 * framing the whole sheet at any height.
 */
function pageStyle(textureUrl?: string | null): React.CSSProperties {
  return textureUrl
    ? {
        backgroundImage: `url(${textureUrl})`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
      }
    : { background: 'linear-gradient(160deg, #f6efdd 0%, #efe3c8 55%, #e6d6b4 100%)' }
}

/**
 * Top padding on the right page, so the answers start level with the Title row
 * opposite rather than level with the worksheet's banner above it.
 *
 * The same constant as Book3DReveal, and for the same reason — left page from
 * the top is page padding, banner, then the date line.
 */
const ANSWERS_TOP_OFFSET = '7.3rem'

export function SubmissionSpread({
  challenge,
  submissions,
  focusId,
  drafts,
  onDraftChange,
  onSave,
  onClose,
  loading,
  formatDate,
  pageTextureUrl,
}: SubmissionSpreadProps) {
  const { t } = useLanguage()
  const focusRef = useRef<HTMLDivElement>(null)

  // Escape closes, and the list behind must not scroll under the spread.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Bring the clicked student into view — they may be tenth in the class.
  useEffect(() => {
    if (focusRef.current) focusRef.current.scrollIntoView({ block: 'center' })
  }, [focusId, loading])

  const sheet = useMemo(
    () => (challenge ? readStoredHenryProblem(challenge.henryproblem) : null),
    [challenge],
  )

  return (
    <>
      {/* The list behind, blurred. Fixed, so it holds still while the spread scrolls. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/45 backdrop-blur-md"
      />

      {/*
        The overlay scrolls, not the pages. Giving each page its own overflow
        clips a long problem inside a fixed frame, which stops it reading as a
        whole sheet of paper — the same reason the book scrolls its spread.
      */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('grade.theProblem')}
        className="fixed inset-0 z-50 overflow-y-auto overscroll-contain"
        style={{ animation: 'content-fade-in 0.35s ease-out both' }}
      >
        <div className="flex min-h-full items-start justify-center p-3 lg:p-6">
          <div
            className="relative flex w-full flex-col overflow-hidden rounded-lg lg:flex-row"
            style={{ maxWidth: 'min(1700px, 96vw)', minHeight: '90vh', boxShadow: '0 24px 70px rgba(0,0,0,0.6)' }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={t('grade.closeSpread')}
              className="absolute right-3 top-3 z-20 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium
                         text-white/90 backdrop-blur-sm transition-colors hover:bg-black/65 hover:text-white"
            >
              {t('grade.closeSpread')}
            </button>

            {/* LEFT — the problem */}
            <div className="relative flex-1" style={pageStyle(pageTextureUrl)}>
              <div
                className="relative z-10 px-6 py-7 lg:px-12"
                style={{ fontFamily: '"Georgia", "Times New Roman", serif', color: '#2d1a00', lineHeight: 1.8 }}
              >
                {loading ? (
                  <p className="text-sm italic" style={{ color: 'rgba(100,60,10,0.6)' }}>
                    {t('grade.loadingProblem')}
                  </p>
                ) : sheet ? (
                  // The spread is already the enlarged view, so the sheet must
                  // not paint paper of its own or offer a second zoom inside it.
                  <HenryProblemSheet problem={sheet.problem} theme={pageNativeHenryTheme} zoomable={false} />
                ) : challenge?.description ? (
                  <>
                    <h2 className="mb-3 text-2xl font-bold">{challenge.title}</h2>
                    <MathText text={challenge.description} className="block leading-relaxed" />
                  </>
                ) : (
                  <p className="text-sm italic" style={{ color: 'rgba(100,60,10,0.6)' }}>
                    {t('grade.noProblemText')}
                  </p>
                )}
              </div>
            </div>

            <div
              aria-hidden="true"
              className="pointer-events-none hidden w-3 shrink-0 lg:block"
              style={{
                background:
                  'linear-gradient(to right, rgba(0,0,0,0.22), rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.05) 60%, rgba(0,0,0,0.22))',
              }}
            />

            {/* RIGHT — every answer to it */}
            <div className="relative flex-1" style={pageStyle(pageTextureUrl)}>
              <div
                className="relative z-10 px-6 lg:px-10"
                style={{ paddingTop: ANSWERS_TOP_OFFSET, paddingBottom: '1.75rem' }}
              >
                <h3
                  className="mb-4 text-lg font-bold"
                  style={{ fontFamily: 'Georgia, serif', color: '#2d1a00' }}
                >
                  {t('grade.classAnswers', { count: submissions.length })}
                </h3>

                <div className="space-y-3">
                  {submissions.map(s => {
                    const draft = drafts[s.id]
                    const isFocus = s.id === focusId
                    return (
                      <div
                        key={s.id}
                        ref={isFocus ? focusRef : undefined}
                        className="rounded-xl border p-3 transition-colors"
                        style={{
                          borderColor: isFocus ? 'rgba(100,60,10,0.55)' : 'rgba(100,60,10,0.2)',
                          background: isFocus ? 'rgba(255,252,242,0.85)' : 'rgba(255,252,242,0.5)',
                        }}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-semibold" style={{ color: '#2d1a00' }}>{s.student_name}</span>
                            {s.student_email && (
                              <span className="ml-2 text-xs" style={{ color: 'rgba(100,60,10,0.5)' }}>
                                {s.student_email}
                              </span>
                            )}
                          </div>
                          {s.points !== null && (
                            <span className="text-sm font-bold" style={{ color: '#4a7c2f' }}>
                              {t('grade.scoreOf', { points: s.points, max: s.max_points ?? '—' })}
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs" style={{ color: 'rgba(100,60,10,0.5)' }}>
                          {t('grade.submittedOn', { date: formatDate(s.submitted_at) })}
                        </p>

                        <div className="mt-2 rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.6)' }}>
                          {s.answer ? (
                            <MathText text={s.answer} className="block whitespace-pre-wrap text-sm leading-relaxed" />
                          ) : !s.image_url ? (
                            <p className="text-sm italic" style={{ color: 'rgba(100,60,10,0.45)' }}>
                              {t('grade.noAnswer')}
                            </p>
                          ) : null}

                          {/*
                            Full width and unclipped. A photograph of working is
                            the submission for most students who use it, so it
                            is shown at a size it can actually be read at rather
                            than as a thumbnail to click through.

                            Plain <img>: these are Supabase storage URLs on a
                            host next/image is not configured for, and the page
                            around it uses <img> for exactly that reason.
                          */}
                          {s.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.image_url}
                              alt={t('grade.answer')}
                              loading="lazy"
                              className={`w-full rounded-lg border ${s.answer ? 'mt-2' : ''}`}
                              style={{ borderColor: 'rgba(100,60,10,0.2)' }}
                            />
                          )}
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={s.max_points ?? undefined}
                            step={1}
                            value={draft?.points ?? (s.points !== null ? String(s.points) : '')}
                            onChange={event => onDraftChange(s.id, event.target.value)}
                            placeholder={t('grade.pts')}
                            aria-label={t('grade.points')}
                            className="w-20 rounded-lg border-2 px-2 py-1 text-sm"
                            style={{ borderColor: 'rgba(100,60,10,0.3)', background: 'rgba(255,255,255,0.8)' }}
                          />
                          {s.max_points !== null && (
                            <span className="text-sm" style={{ color: 'rgba(100,60,10,0.5)' }}>
                              / {s.max_points}
                            </span>
                          )}
                          <Button
                            size="sm"
                            disabled={draft?.saving || !(draft?.points ?? '').trim()}
                            onClick={() => onSave(s.id, s.max_points)}
                          >
                            {draft?.saving
                              ? t('status.saving')
                              : s.points !== null
                                ? t('grade.update')
                                : t('action.save')}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
