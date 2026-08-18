'use client'

import { useEffect } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { readStoredHenryProblem } from '@/lib/henryproblem'
import { HenryProblemSheet } from '@/components/HenryProblemSheet'
import { MathText } from '@/lib/mathtext'
import type { ProblemSetItem } from '@/lib/problemSet/query'

/** A problem's date, short, matching the review list. */
function niceDate(d: string): string {
  return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

/**
 * The problem itself, enlarged, with whatever this upload found for it.
 *
 * The review is a list of crops, and a crop is only checkable against the
 * question it answers — which the list could not show, because a worksheet at
 * that size is unreadable next to a thumbnail. So it opens over the page at
 * full width instead, with the matched working underneath it: the pairing is
 * the thing being checked, and both halves have to be in view at once for the
 * check to mean anything.
 *
 * The worksheet is drawn by HenryProblemSheet, the same component the challenge
 * room and the printed set use, so a student is reading the page they printed
 * rather than a third rendering of it that could drift from both.
 */
export function ProblemPeek({ problem, preview, onClose }: {
  problem: ProblemSetItem
  /** The working found for it, or null when this upload found none. */
  preview: string | null
  onClose: () => void
}) {
  const { t } = useLanguage()
  const sheet = readStoredHenryProblem(problem.henryproblem)

  // Escape closes, and the page behind does not scroll while it is open —
  // matching the enlarge overlay on the challenge page.
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={problem.title}
    >
      <div
        className="mx-auto my-4 w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">{problem.title}</p>
            <p className="text-xs text-gray-500">{niceDate(problem.challenge_date)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('sol.closePreview')}
            className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
          >
            ✕
          </button>
        </div>

        {sheet ? (
          <HenryProblemSheet
            problem={sheet.problem}
            graphUrl={problem.image_url}
            zoomable={false}
          />
        ) : (
          <div className="rounded-lg border border-gray-200 p-3">
            {problem.description && (
              <MathText text={problem.description} className="block leading-relaxed" />
            )}
            {problem.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={problem.image_url} alt={problem.title}
                className="mt-3 w-full rounded border border-gray-200" />
            )}
            {!problem.description && !problem.image_url && (
              <p className="text-sm italic text-gray-400">{t('pset.noSheet')}</p>
            )}
          </div>
        )}

        {/* The point of opening this: does the working below answer the
            question above? */}
        <p className="mt-4 mb-1 text-xs font-semibold text-gray-700">{t('sol.current')}</p>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={t('sol.current')}
            className="w-full rounded border border-gray-200 bg-white object-contain" />
        ) : (
          <p className="rounded border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-500">
            {t('sol.notFound')}
          </p>
        )}
      </div>
    </div>
  )
}
