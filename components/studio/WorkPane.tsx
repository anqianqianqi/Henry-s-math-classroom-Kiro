'use client'

/**
 * The middle of the desk: the problem, then the student's work under it.
 *
 * The problem is the printed worksheet, drawn by the same component the
 * challenge room uses, so what the teacher reads is what the student saw. The
 * work is read at full width and enlarges on a click: a photographed page of
 * algebra at thumbnail size is the least of what was handed in.
 */

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { MathText } from '@/lib/mathtext'
import { HenryProblemSheet } from '@/components/HenryProblemSheet'
import { readStoredHenryProblem } from '@/lib/henryproblem'
import { defaultHenryTheme } from '@/lib/henry-theme'
import type { QueueRow } from '@/lib/studio/queue'

export interface ProblemInfo {
  key: string
  title: string
  description: string | null
  henryproblem: unknown
  imageUrl: string | null
  maxPoints: number
  challengeId: string | null
  /** True when neither the challenge nor a bank item could be found. */
  gone: boolean
}

export interface WorkComment {
  id: string
  userId: string
  content: string
  createdAt: string
  authorName: string
}

export interface WorkPaneProps {
  row: QueueRow | null
  position: { index: number; total: number }
  problem: ProblemInfo | null
  problemLoading: boolean
  comments: WorkComment[]
  timeAgo: (iso: string) => string
  formatDate: (iso: string) => string
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const { t } = useLanguage()
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="studio-lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <button type="button" className="studio-btn studio-lightbox-close" onClick={onClose}>
        {t('studio.closeEnlarged')}
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="studio-lightbox-img" onClick={e => e.stopPropagation()} />
    </div>
  )
}

export function WorkPane({ row, position, problem, problemLoading, comments, timeAgo, formatDate }: WorkPaneProps) {
  const { t } = useLanguage()
  const [enlarged, setEnlarged] = useState(false)

  // A fresh student closes any enlargement left over from the last one.
  useEffect(() => setEnlarged(false), [row?.id])

  if (!row) {
    return (
      <main className="studio-work">
        <div className="studio-empty">
          <div className="studio-empty-mark">∑</div>
          <p>{t('studio.pickOne')}</p>
        </div>
      </main>
    )
  }

  const stored = problem && !problem.gone ? readStoredHenryProblem(problem.henryproblem) : null
  const title = problem?.title || row.problemTitle

  return (
    <main className="studio-work">
      <header className="studio-work-head">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight truncate">
            {row.studentName || t('studio.unknownStudent')}
            {row.studentEmail && <span className="studio-muted text-sm font-normal"> · {row.studentEmail}</span>}
          </h2>
          <p className="studio-muted text-sm truncate">
            {title || (row.challengeId || row.bankItemId ? t('studio.untitledProblem') : t('studio.deletedProblem'))}
            {row.challengeDate && <span> · {t('studio.setFor', { date: formatDate(row.challengeDate) })}</span>}
            {!row.challengeId && row.bankItemId && <span> · {t('studio.fromBank')}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm">
          <span className="studio-chip">{t('studio.position', { index: position.index + 1, total: position.total })}</span>
          <span className="studio-muted">{t('studio.handedIn', { when: timeAgo(row.submittedAt) })}</span>
          {row.isLocked && <span className="studio-chip" title={t('studio.locked')}>🔒</span>}
          {row.points !== null && (
            <span className="studio-chip studio-chip-high">{t('studio.gradedChip', { score: row.points, max: row.maxPoints })}</span>
          )}
          {row.challengeId && (
            <a className="studio-link" href={`/challenges/${row.challengeId}`} target="_blank" rel="noreferrer">
              {t('studio.openOnSite')} ↗
            </a>
          )}
        </div>
      </header>

      <section className="studio-card studio-section" aria-label={t('studio.problem')}>
        {problemLoading ? (
          <p className="studio-muted text-sm italic">{t('studio.loadingProblem')}</p>
        ) : !problem || problem.gone ? (
          <p className="studio-muted text-sm italic">{t('studio.problemGone')}</p>
        ) : stored ? (
          <HenryProblemSheet problem={stored.problem} graphUrl={problem.imageUrl} theme={defaultHenryTheme} zoomable />
        ) : problem.description || problem.imageUrl ? (
          <div className="studio-plain-problem">
            <h3 className="mb-2 text-xl font-semibold">{problem.title}</h3>
            {problem.description && <MathText text={problem.description} className="block leading-relaxed" />}
            {problem.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={problem.imageUrl} alt={problem.title} className="mt-3 max-w-full rounded-lg" />
            )}
          </div>
        ) : (
          <p className="studio-muted text-sm italic">{t('studio.noProblemText')}</p>
        )}
      </section>

      <section className="studio-card studio-section" aria-label={t('studio.studentWork')}>
        <h3 className="studio-eyebrow">{t('studio.studentWork')}</h3>
        {row.content && (
          <div className="mt-2">
            <p className="studio-muted text-xs">{t('studio.typedAnswer')}</p>
            <MathText text={row.content} className="block whitespace-pre-wrap leading-relaxed" />
          </div>
        )}
        {row.imageUrl && (
          <figure className="mt-3">
            <figcaption className="studio-muted text-xs mb-1">{t('studio.photo')} · {t('studio.enlarge')}</figcaption>
            <button type="button" className="studio-photo" onClick={() => setEnlarged(true)} title={t('studio.enlarge')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={row.imageUrl} alt={t('studio.photo')} loading="lazy" />
            </button>
          </figure>
        )}
        {!row.content && !row.imageUrl && (
          <p className="studio-muted text-sm italic mt-2">{t('studio.noWork')}</p>
        )}
      </section>

      <section className="studio-card studio-section" aria-label={t('studio.comments', { count: comments.length })}>
        <h3 className="studio-eyebrow">{t('studio.comments', { count: comments.length })}</h3>
        {comments.length === 0 ? (
          <p className="studio-muted text-sm italic mt-2">{t('studio.noComments')}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {comments.map(c => (
              <li key={c.id} className="studio-comment">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{c.authorName}</span>
                  <span className="studio-muted text-xs">{timeAgo(c.createdAt)}</span>
                </div>
                <MathText text={c.content} className="block text-sm whitespace-pre-wrap" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {enlarged && row.imageUrl && (
        <Lightbox src={row.imageUrl} alt={t('studio.photo')} onClose={() => setEnlarged(false)} />
      )}
    </main>
  )
}
