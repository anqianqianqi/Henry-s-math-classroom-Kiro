'use client'

/**
 * A class's problems, one to a page, ready to print.
 *
 * ── WHY THIS IS ITS OWN ROUTE ───────────────────────────────
 * The challenge page shows a problem inside the book: a 3D canvas, a room, a
 * pet, and a zoomed reader that is position:fixed. Fixed elements print only
 * their first screen, and hiding all of that with print rules would be a long
 * fight against a page built for reading rather than printing. A separate
 * document has none of it — nothing to hide, and what you see is what comes
 * out of the printer.
 *
 * ── WHY THERE IS NO PDF LIBRARY ─────────────────────────────
 * HenryProblemSheet is already a re-creation of the worksheet the Prettify
 * pipeline produces as a PDF, sized in em from a single root font-size. Print
 * it and the browser writes the PDF — with selectable text and KaTeX drawn as
 * type rather than pictures. A library would mean rebuilding that layout a
 * second time and getting a worse copy of it.
 */

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { createClient } from '@/lib/supabase/client'
import { HenryProblemSheet } from '@/components/HenryProblemSheet'
import { readStoredHenryProblem } from '@/lib/henryproblem'
import { MathText } from '@/lib/mathtext'
import { problemsForClass, type ProblemSetItem } from '@/lib/problemSet/query'
import { parsePrintLanguage, wordingFor, type PrintLanguage } from '@/lib/problemSet/wording'
import {
  PAGE_MARGIN_MM, PAPER_IDS, PAPER_SIZES, pageContentPx, readStoredPaper, storePaper,
  type PaperId,
} from '@/lib/problemSet/paper'

/** Below this the worksheet stops being readable; better a second page. */
const MIN_ZOOM = 0.55

/** Halvings of the range between MIN_ZOOM and 1 — lands within ~0.004. */
const FIT_STEPS = 7

/** Held back from the page so a rounding error has somewhere to go. */
const SAFETY_PX = 4

export default function ProblemSetPage() {
  const { t } = useLanguage()
  const params = useSearchParams()
  const supabase = createClient()

  const classId = params.get('class') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const lang = parsePrintLanguage(params.get('lang'))

  const [items, setItems] = useState<ProblemSetItem[] | null>(null)
  const [className, setClassName] = useState('')
  const [fit, setFit] = useState(true)
  /** What fitting did to each problem, so the bar can report it honestly. */
  const [fitted, setFitted] = useState<Record<string, { zoom: number; fits: boolean }>>({})
  /*
    Starts at A4 and settles on the remembered paper after mount. Reading
    localStorage or the locale during render would give the server one answer
    and the browser another, and React would discard the markup it streamed.
  */
  const [paper, setPaper] = useState<PaperId>('a4')
  useEffect(() => { setPaper(readStoredPaper()) }, [])

  const page = PAPER_SIZES[paper]
  const contentPx = pageContentPx(paper)

  function choosePaper(next: PaperId) {
    setPaper(next)
    storePaper(next)
    // Every sheet is measured against the new height, so drop the old verdicts
    // rather than letting the count describe the paper that was just replaced.
    setFitted({})
  }

  useEffect(() => {
    if (!classId || !from || !to) { setItems([]); return }
    let cancelled = false

    async function load() {
      const [problems, { data: cls }] = await Promise.all([
        problemsForClass(classId, from, to),
        supabase.from('classes').select('name').eq('id', classId).maybeSingle(),
      ])
      if (cancelled) return
      setItems(problems)
      setClassName((cls as any)?.name ?? '')
    }

    load().catch(() => { if (!cancelled) setItems([]) })
    return () => { cancelled = true }
  }, [classId, from, to, supabase])

  const heading = useMemo(() => {
    const nice = (d: string) =>
      d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''
    return t('pset.forClass', { name: className, from: nice(from), to: nice(to) })
  }, [className, from, to, t])

  return (
    <div className="problem-set">
      <style>{`
        /* Screen: a stack of sheets on a grey desk, so the page breaks are
           visible before anything is printed. */
        .problem-set { background: #e9e7e2; min-height: 100vh; padding: 24px 0 48px; }
        /*
          A whole page of the chosen paper, with the print margin drawn as
          padding. The content box is then the same on screen as on paper, so a
          line that wraps here wraps there and the height measured for "fit to
          page" is the height that gets printed. An earlier version was 190mm
          wide with 14mm of padding, which measured a 162mm column and shrank
          problems that would have fitted.
        */
        .ps-sheet {
          background: #fff;
          width: ${page.widthMm}mm;
          min-height: ${page.heightMm}mm;
          margin: 0 auto 24px;
          padding: ${PAGE_MARGIN_MM}mm;
          box-shadow: 0 6px 24px rgba(0,0,0,0.18);
          box-sizing: border-box;
        }
        .ps-bar { position: sticky; top: 0; z-index: 10; }

        /* Naming the paper stops the browser fitting the document to whatever
           is in the tray, which would rescale it past the measurement. The
           margin is zero because the sheet draws its own, above. */
        @page { size: ${page.css}; margin: 0; }

        @media print {
          /* Nothing but the sheets. The overflow warning is a screen aid, and
             would add to the very height it is warning about. */
          .ps-bar, .ps-overflow { display: none !important; }
          .problem-set { background: #fff; padding: 0; }
          /*
            The sheet keeps the size it has on screen: a whole page of the
            chosen paper, with the margin drawn as its own padding, and @page
            reduced to nothing.

            It used to be width:auto with the margin left to @page, which hands
            the width to the page box — and the page box is whatever the print
            dialog says. Pick any margin setting other than the 10mm asked for
            and the column narrows, the wording re-wraps taller, and a problem
            measured as fitting spills onto a second sheet. The screen still
            showed it fitting, because on screen the width is fixed in mm.

            Sized this way the box cannot move: it is the paper. Nothing in the
            dialog changes the column the text wraps into, and a dialog that
            does scale the page scales all of it at once, which keeps the fit.
          */
          .ps-sheet {
            width: ${page.widthMm}mm;
            min-height: 0;
            margin: 0;
            padding: ${PAGE_MARGIN_MM}mm;
            box-shadow: none;
            /* One problem per page. break-after on every sheet but the last,
               or the printer emits a trailing blank page. */
            break-after: page;
            page-break-after: always;
            /* Keep a problem whole. Deliberately NOT applied to descendants:
               break-inside on every node inside a KaTeX tree makes Chrome drop
               and displace content, which is how the first version printed a
               header and then an empty page. */
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .ps-sheet:last-child { break-after: auto; page-break-after: auto; }

          /*
            The worksheet IS its colours: the wording sits in a tinted panel,
            the tags are filled chips, the header is a band. Browsers drop
            background colours when printing, which strips the sheet back to a
            title and some floating text — technically all there, and unreadable
            as a worksheet. This asks for them back for the sheet only, so the
            printout matches what the teacher previewed.
          */
          .ps-sheet {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="ps-bar bg-white/90 px-6 py-3 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex max-w-[190mm] flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-900">{t('pset.printTitle')}</h1>
            {className && <p className="truncate text-xs text-gray-500">{heading}</p>}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
              {t('pset.paper')}
              <select
                value={paper}
                onChange={e => choosePaper(e.target.value as PaperId)}
                className="rounded border border-gray-300 px-1.5 py-1 text-[11px] text-gray-700"
                title={t('pset.paperHint')}
              >
                {PAPER_IDS.map(id => (
                  <option key={id} value={id}>{t(PAPER_SIZES[id].label)}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <input type="checkbox" checked={fit} onChange={e => setFit(e.target.checked)} />
              {t('pset.fitToPage')}
            </label>
            {(() => {
              const verdicts = Object.values(fitted)
              const shrunk = verdicts.filter(v => v.fits && v.zoom < 1).length
              const over = verdicts.filter(v => !v.fits).length
              return (
                <>
                  {fit && shrunk > 0 && (
                    <span className="text-[11px] text-gray-400">{t('pset.shrunk', { count: shrunk })}</span>
                  )}
                  {/* Said plainly, because the sheet on screen simply grows
                      taller and gives no sign that the paper will not take it. */}
                  {over > 0 && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                      {t('pset.overflowing', { count: over })}
                    </span>
                  )}
                </>
              )
            })()}
            <span className="hidden text-[11px] text-gray-400 lg:inline">{t('pset.backgroundHint')}</span>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!items?.length}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white
                         transition-colors hover:bg-primary-700 disabled:opacity-40"
            >
              🖨️ {t('pset.print')}
            </button>
          </div>
        </div>
      </div>

      {items === null ? (
        <p className="mt-10 text-center text-sm text-gray-500">{t('pset.loadingDates')}</p>
      ) : items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-gray-500">{t('pset.nothingHere')}</p>
      ) : (
        items.map((item, i) => (
          <ProblemPage
            key={item.id}
            item={item}
            index={i + 1}
            total={items.length}
            lang={lang}
            fit={fit}
            contentPx={contentPx}
            onFitted={(zoom, fits) => setFitted(prev => (
              prev[item.id]?.zoom === zoom && prev[item.id]?.fits === fits
                ? prev
                : { ...prev, [item.id]: { zoom, fits } }
            ))}
          />
        ))
      )}
    </div>
  )
}

function ProblemPage({
  item, index, total, lang, fit, contentPx, onFitted,
}: {
  item: ProblemSetItem
  index: number
  total: number
  lang: PrintLanguage
  fit: boolean
  /** Printable height of the chosen paper, in CSS pixels. */
  contentPx: number
  onFitted: (zoom: number, fits: boolean) => void
}) {
  const { t } = useLanguage()
  const sheet = readStoredHenryProblem(item.henryproblem)
  const bodyRef = useRef<HTMLDivElement>(null)
  const footRef = useRef<HTMLParagraphElement>(null)
  const [zoom, setZoom] = useState(1)
  const [fits, setFits] = useState(true)

  /*
    Shrink a problem that would otherwise spill onto a second page.

    `zoom` rather than `transform: scale`, because zoom takes part in layout —
    the sheet genuinely becomes shorter, so the page break moves with it. A
    transform only repaints, leaving the browser breaking the page where the
    unscaled content used to end.

    Measured at zoom 1 and applied once. Re-measuring after the zoom lands
    would read the shrunken height and creep towards nothing.
  */
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    if (!fit) { el.style.zoom = ''; setZoom(1); setFits(true); onFitted(1, true); return }
    let cancelled = false

    function measure() {
      if (cancelled || !el) return

      // The page number sits below the problem and is not scaled with it, so
      // the space the problem may occupy is the page less that line. A couple
      // of pixels are held back: landing on exactly 100% of the page leaves a
      // rounding error nowhere to go but the next sheet.
      const foot = footRef.current
      const gap = foot ? parseFloat(getComputedStyle(foot).marginTop) || 0 : 0
      const available = contentPx - (foot?.offsetHeight ?? 0) - gap - SAFETY_PX

      /** Rendered height at a given factor — what the paper actually gets. */
      function heightAt(z: number) {
        el!.style.zoom = z === 1 ? '' : String(z)
        return el!.getBoundingClientRect().height
      }

      /*
        Search for the largest factor that fits rather than dividing once.

        Height is not proportional to the factor. zoom scales the coordinate
        space, so a shrunken sheet lays out in a *wider* column in its own
        units, the wording re-wraps into fewer lines, and it comes out shorter
        than the arithmetic predicts. One division therefore overshoots badly:
        three demo problems asked for 0.48 and 0.34 and were pinned to the 0.55
        floor, when measuring showed 0.80 fitted all of them.

        Measuring each candidate makes no assumption about the shape of that
        curve, only that it does not grow as the factor shrinks.
      */
      if (heightAt(1) <= available) {
        el.style.zoom = ''
        setZoom(1); setFits(true)
        onFitted(1, true)
        return
      }

      let lo = MIN_ZOOM
      let hi = 1
      let best = MIN_ZOOM
      for (let i = 0; i < FIT_STEPS; i++) {
        const mid = (lo + hi) / 2
        if (heightAt(mid) <= available) { best = mid; lo = mid } else { hi = mid }
      }

      // Applied here as well as through state: when the factor happens to be
      // the one already held, React has nothing to re-render and would leave
      // the element at whatever the search last tried.
      const settled = heightAt(best) <= available
      el.style.zoom = String(best)
      setZoom(best); setFits(settled)
      onFitted(best, settled)
    }

    // The graph is the tallest thing on most sheets and the last to arrive;
    // measuring before it loads reads a sheet that is not the one printed.
    const images = Array.from(el.querySelectorAll('img'))
    const pending = images.filter(img => !img.complete)
    if (!pending.length) measure()
    else {
      let left = pending.length
      const done = () => { if (--left === 0) measure() }
      pending.forEach(img => { img.addEventListener('load', done); img.addEventListener('error', done) })
      // A slow image should not leave the sheet unmeasured forever.
      const timer = window.setTimeout(measure, 3000)
      return () => {
        cancelled = true
        window.clearTimeout(timer)
        pending.forEach(img => { img.removeEventListener('load', done); img.removeEventListener('error', done) })
      }
    }
    return () => { cancelled = true }
    // contentPx: a change of paper changes both the height to fit inside and
    // the width the wording wraps at, so the sheet has to be measured again.
    // lang: dropping a wording panel changes the height this measures, even
    // though it comes from the URL and cannot change in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, lang, contentPx, item.id])
  const date = new Date(`${item.challenge_date}T12:00:00`).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <section className="ps-sheet">
      <div ref={bodyRef} style={fit && zoom < 1 ? ({ zoom } as React.CSSProperties) : undefined}>
      {sheet ? (
        // The worksheet as the challenge room draws it, with its own picture,
        // carrying whichever wording was asked for.
        <HenryProblemSheet problem={wordingFor(sheet.problem, lang)} graphUrl={item.image_url} zoomable={false} />
      ) : (
        // No snapshot: the title, the wording and the picture still print.
        <>
          <h2 className="mb-1 text-2xl font-bold text-gray-900">{item.title}</h2>
          <p className="mb-4 text-sm text-gray-500">{date}</p>
          {item.description && <MathText text={item.description} className="block leading-relaxed" />}
          {item.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt={item.title} className="mt-4 w-full rounded border border-gray-200" />
          )}
          {!item.description && !item.image_url && (
            <p className="text-sm italic text-gray-400">{t('pset.noSheet')}</p>
          )}
        </>
      )}

      </div>

      {/*
        A sheet that will not fit looks exactly like one that will: min-height
        makes every sheet at least a page tall, and one that overruns simply
        grows, with no line drawn where the paper ends. This says so. It is
        screen-only — the printout has the page break to speak for itself.
      */}
      {!fits && (
        <p className="ps-overflow mt-4 rounded bg-amber-50 px-2 py-1 text-center text-[11px] text-amber-800">
          {t('pset.thisOverflows')}
        </p>
      )}

      <p ref={footRef} className="mt-6 text-right text-[10px] text-gray-400">
        {t('pset.pageOf', { index, total })}
      </p>
    </section>
  )
}
