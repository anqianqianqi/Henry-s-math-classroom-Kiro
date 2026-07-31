'use client'

/**
 * Renders a .henryproblem as the Henry Math worksheet page.
 *
 * This is a live HTML re-creation of the layout produced by the Prettify
 * Homework PDF/JPEG pipeline — same palette and section rhythm, but text stays
 * selectable, math scales on phones, and edits show up without regenerating an
 * image. It is a visual match, not a pixel-for-pixel copy of the PDF.
 *
 * Sizing is em-relative throughout so the whole sheet scales from one root
 * font-size — that is what the enlarge overlay drives.
 */

import 'katex/dist/katex.min.css'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MathText } from '@/lib/mathtext'
import type { HenryProblemFields } from '@/lib/henryproblem'
import { HenrySheetHeader } from '@/components/HenrySheetHeader'
import {
  defaultHenryTheme,
  themeColor,
  type HenryPalette,
  type HenrySheetTheme,
} from '@/lib/henry-theme'

/** Mirrors format_score(): a bare number gets " pts" appended. */
function formatScore(score: string): string {
  const text = (score || '').trim()
  if (!text) return ''
  return /^\d+(\.\d+)?$/.test(text) ? `${text} pts` : text
}

function WordingPanel({
  text,
  lang,
  palette,
}: {
  text: string
  lang: 'en' | 'zh'
  palette: HenryPalette
}) {
  return (
    <div
      className="rounded-lg"
      style={{
        background: palette.card,
        border: `1px solid ${palette.border}`,
        padding: '0.75em 1em',
      }}
      lang={lang === 'zh' ? 'zh-Hans' : 'en'}
    >
      <MathText text={text} className="block leading-relaxed" />
    </div>
  )
}

/** The worksheet itself. Everything sizes off the root font-size. */
function Sheet({
  problem,
  graphUrl,
  onGraphClick,
  fontSize,
  maxGraphHeight,
  theme,
  subheader,
}: {
  problem: HenryProblemFields
  graphUrl?: string | null
  onGraphClick?: (url: string) => void
  fontSize: string
  maxGraphHeight: string
  theme: HenrySheetTheme
  subheader?: React.ReactNode
}) {
  const palette = theme.palette
  const score = formatScore(problem.score)
  const hasGraph = problem.mode === 'graph' && !!graphUrl
  const hasEnglish = !!problem.english.trim()
  const hasChinese = !!problem.chinese.trim()

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: palette.paper, border: `1px solid ${palette.border}`, fontSize }}
    >
      <div style={{ padding: '0.85em 1em' }}>
        <HenrySheetHeader theme={theme} />

        {subheader && <div style={{ paddingTop: '0.5em' }}>{subheader}</div>}

        {/* Title / Score row. The divider sits above it by default (the header
            rule); themes that clear header.rule and set titleRule move it here,
            so the row is enclosed by the banner rather than by the problem. */}
        <div
          className="flex flex-wrap items-baseline"
          style={{
            gap: '0.25em 1.5em',
            padding: '0.5em 0',
            borderBottom: theme.titleRule
              ? `${theme.titleRule.thickness} solid ${palette[theme.titleRule.color]}`
              : `1px solid ${palette.border}`,
          }}
        >
          <div className="flex items-baseline min-w-0 flex-1" style={{ gap: '0.5em' }}>
            <span className="shrink-0" style={{ color: palette.muted, fontSize: '0.8em' }}>Title :</span>
            <span className="font-medium truncate" style={{ color: palette.ink, fontSize: '0.92em' }}>
              {problem.title || '—'}
            </span>
          </div>
          {score && (
            <div className="flex items-baseline" style={{ gap: '0.5em' }}>
              <span style={{ color: palette.muted, fontSize: '0.8em' }}>Score :</span>
              <span className="font-medium" style={{ color: palette.ink, fontSize: '0.92em' }}>{score}</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '0.75em 0', display: 'grid', gap: '0.75em' }}>
          {hasGraph && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={graphUrl!}
              alt="Problem diagram"
              onClick={onGraphClick ? () => onGraphClick(graphUrl!) : undefined}
              className="w-full object-contain rounded-lg cursor-zoom-in hover:opacity-90 transition-opacity"
              style={{ maxHeight: maxGraphHeight, background: palette.card, border: `1px solid ${palette.border}` }}
              title="Click to enlarge the diagram"
            />
          )}

          {hasGraph && hasEnglish && hasChinese ? (
            /* Graph mode: English lower-left, Chinese lower-right. */
            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '0.75em' }}>
              <WordingPanel text={problem.english} lang="en" palette={palette} />
              <WordingPanel text={problem.chinese} lang="zh" palette={palette} />
            </div>
          ) : (
            <>
              {hasEnglish && <WordingPanel text={problem.english} lang="en" palette={palette} />}
              {hasChinese && <WordingPanel text={problem.chinese} lang="zh" palette={palette} />}
            </>
          )}
        </div>

        {/* Tags footer — alternating green/orange chips */}
        {problem.tags.length > 0 && (
          <div
            className="flex flex-wrap items-center"
            style={{ gap: '0.5em', paddingTop: '0.5em', borderTop: `1px solid ${palette.border}` }}
          >
            <span style={{ color: palette.muted, fontSize: '0.8em' }}>Tags :</span>
            {problem.tags.map((tag, i) => {
              const accent: keyof HenryPalette = i % 2 === 0 ? 'green' : 'orange'
              return (
                <span
                  key={`${tag}-${i}`}
                  className="font-medium rounded-full"
                  style={{
                    fontSize: '0.72em',
                    padding: '0.15em 0.7em',
                    background: themeColor(palette, accent, i % 2 === 0 ? 0.1 : 0.14),
                    color: i % 2 === 0 ? palette.green : '#9C6420',
                    border: `1px solid ${themeColor(palette, accent, i % 2 === 0 ? 0.2 : 0.3)}`,
                  }}
                >
                  {tag}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export interface HenryProblemSheetProps {
  problem: HenryProblemFields
  /** Cropped graph image, already uploaded to the challenge-images bucket. */
  graphUrl?: string | null
  /** Called when the diagram is clicked, for a host-provided image lightbox. */
  onGraphClick?: (url: string) => void
  /** Show a tap-to-enlarge affordance that opens the sheet full-screen. */
  zoomable?: boolean
  /**
   * Rendered between the banner and the Title/Score row. The challenge room
   * puts the date here so the header block reads banner, date, title, rule.
   */
  subheader?: React.ReactNode
  /**
   * Palette and header decorations. Defaults to defaultHenryTheme — pass
   * plainHenryTheme, or your own, to restyle without touching this component.
   */
  theme?: HenrySheetTheme
  className?: string
}

/** Enlarge steps available in the overlay. */
const ZOOM_STEPS = [1.15, 1.45, 1.8, 2.2]

export function HenryProblemSheet({
  problem,
  graphUrl,
  onGraphClick,
  zoomable,
  theme = defaultHenryTheme,
  className,
  subheader,
}: HenryProblemSheetProps) {
  const [zoomed, setZoomed] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Escape closes; lock background scroll while open.
  useEffect(() => {
    if (!zoomed) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setZoomed(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [zoomed])

  /**
   * Clicks on the diagram are left alone so the host's image lightbox (or the
   * book shell's) still gives a pixel-level zoom of the figure. Everything
   * else on the sheet opens the enlarged text view.
   */
  function handleSheetClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).tagName === 'IMG') return
    setZoomed(true)
  }

  const sheet = (
    <Sheet
      problem={problem}
      graphUrl={graphUrl}
      onGraphClick={onGraphClick}
      fontSize="1rem"
      maxGraphHeight="20rem"
      theme={theme}
      subheader={subheader}
    />
  )

  if (!zoomable) {
    return <div className={className}>{sheet}</div>
  }

  const scale = ZOOM_STEPS[stepIndex]

  return (
    <div className={className}>
      <div onClick={handleSheetClick} className="cursor-zoom-in">
        {sheet}
      </div>
      <p
        className="text-xs text-center mt-1"
        style={{ color: 'rgba(100,60,10,0.5)', fontStyle: 'italic' }}
      >
        Tap the problem to enlarge
      </p>

      {mounted && zoomed && createPortal(
        <div
          className="fixed inset-0 z-[100] overflow-auto overscroll-contain"
          style={{ background: 'rgba(30,20,5,0.82)' }}
          onClick={() => setZoomed(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged problem"
        >
          {/* Controls */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3"
            style={{ background: 'linear-gradient(rgba(30,20,5,0.9), transparent)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStepIndex(i => Math.max(0, i - 1))}
                disabled={stepIndex === 0}
                className="w-9 h-9 rounded-full bg-white/90 text-lg font-semibold text-gray-800
                           hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Smaller"
              >
                −
              </button>
              <span className="text-white/80 text-sm tabular-nums w-12 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setStepIndex(i => Math.min(ZOOM_STEPS.length - 1, i + 1))}
                disabled={stepIndex === ZOOM_STEPS.length - 1}
                className="w-9 h-9 rounded-full bg-white/90 text-lg font-semibold text-gray-800
                           hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Larger"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => setZoomed(false)}
              className="w-9 h-9 rounded-full bg-white/90 text-lg text-gray-800 hover:bg-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="px-3 pb-10 flex justify-center">
            <div
              className="w-full"
              style={{ maxWidth: '64rem' }}
              onClick={e => e.stopPropagation()}
            >
              <Sheet
                problem={problem}
                graphUrl={graphUrl}
                fontSize={`${scale}rem`}
                maxGraphHeight="none"
                theme={theme}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default HenryProblemSheet
