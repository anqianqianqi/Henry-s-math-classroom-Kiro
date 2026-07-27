'use client'

/**
 * Renders a .henryproblem as the Henry Math worksheet page.
 *
 * This is a live HTML re-creation of the layout produced by the Prettify
 * Homework PDF/JPEG pipeline — same palette and section rhythm, but text stays
 * selectable, math scales on phones, and edits show up without regenerating an
 * image. It is a visual match, not a pixel-for-pixel copy of the PDF.
 */

import 'katex/dist/katex.min.css'
import { MathText } from '@/lib/mathtext'
import type { HenryProblemFields } from '@/lib/henryproblem'

// Henry Class Note palette — see AGENTS.md in the Prettify Homework workspace.
const PAPER = '#F6F0E6'
const CARD = '#FFFDF8'
const GREEN = '#495F42'
const INK = '#2F332B'
const MUTED = '#6F706A'
const BORDER = '#DDD4C7'

/** Mirrors format_score(): a bare number gets " pts" appended. */
function formatScore(score: string): string {
  const text = (score || '').trim()
  if (!text) return ''
  return /^\d+(\.\d+)?$/.test(text) ? `${text} pts` : text
}

function WordingPanel({
  text,
  lang,
  className,
}: {
  text: string
  lang: 'en' | 'zh'
  className?: string
}) {
  return (
    <div
      className={`rounded-lg px-4 py-3 ${className || ''}`}
      style={{ background: CARD, border: `1px solid ${BORDER}` }}
      lang={lang === 'zh' ? 'zh-Hans' : 'en'}
    >
      <MathText
        text={text}
        className="block text-[15px] leading-relaxed"
      />
    </div>
  )
}

export interface HenryProblemSheetProps {
  problem: HenryProblemFields
  /** Cropped graph image, already uploaded to the challenge-images bucket. */
  graphUrl?: string | null
  /** Called when the graph is clicked, for the existing lightbox. */
  onGraphClick?: (url: string) => void
  className?: string
}

export function HenryProblemSheet({
  problem,
  graphUrl,
  onGraphClick,
  className,
}: HenryProblemSheetProps) {
  const score = formatScore(problem.score)
  const hasGraph = problem.mode === 'graph' && !!graphUrl
  const hasEnglish = !!problem.english.trim()
  const hasChinese = !!problem.chinese.trim()

  return (
    <div
      className={`rounded-xl overflow-hidden ${className || ''}`}
      style={{ background: PAPER, border: `1px solid ${BORDER}` }}
    >
      <div className="px-4 py-3 sm:px-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-2">
          <span
            className="font-semibold text-sm sm:text-base tracking-wide"
            style={{ color: GREEN }}
          >
            Henry&apos;s Math<span className="hidden sm:inline">（Henry&apos;s 数学）</span>
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/henry-math-logo.png"
            alt=""
            aria-hidden="true"
            className="w-8 h-8 rounded-full shrink-0"
          />
        </div>

        {/* Title / Score row */}
        <div
          className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-2"
          style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}
        >
          <div className="flex items-baseline gap-2 min-w-0 flex-1">
            <span className="text-xs shrink-0" style={{ color: MUTED }}>Title :</span>
            <span className="font-medium text-sm truncate" style={{ color: INK }}>
              {problem.title || '—'}
            </span>
          </div>
          {score && (
            <div className="flex items-baseline gap-2">
              <span className="text-xs" style={{ color: MUTED }}>Score :</span>
              <span className="font-medium text-sm" style={{ color: INK }}>{score}</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="py-3 space-y-3">
          {hasGraph && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={graphUrl!}
              alt="Problem diagram"
              onClick={() => onGraphClick?.(graphUrl!)}
              className={`w-full max-h-80 object-contain rounded-lg ${
                onGraphClick ? 'cursor-zoom-in hover:opacity-90 transition-opacity' : ''
              }`}
              style={{ background: CARD, border: `1px solid ${BORDER}` }}
            />
          )}

          {hasGraph && hasEnglish && hasChinese ? (
            /* Graph mode: English lower-left, Chinese lower-right. */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <WordingPanel text={problem.english} lang="en" />
              <WordingPanel text={problem.chinese} lang="zh" />
            </div>
          ) : (
            <>
              {hasEnglish && <WordingPanel text={problem.english} lang="en" />}
              {hasChinese && <WordingPanel text={problem.chinese} lang="zh" />}
            </>
          )}
        </div>

        {/* Tags footer */}
        {problem.tags.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-2 pt-2"
            style={{ borderTop: `1px solid ${BORDER}` }}
          >
            <span className="text-xs" style={{ color: MUTED }}>Tags :</span>
            {problem.tags.map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: i % 2 === 0 ? 'rgba(73,95,66,0.10)' : 'rgba(230,149,66,0.14)',
                  color: i % 2 === 0 ? GREEN : '#9C6420',
                  border: `1px solid ${i % 2 === 0 ? 'rgba(73,95,66,0.20)' : 'rgba(230,149,66,0.30)'}`,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default HenryProblemSheet
