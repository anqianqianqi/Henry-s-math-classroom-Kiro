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

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { createClient } from '@/lib/supabase/client'
import { HenryProblemSheet } from '@/components/HenryProblemSheet'
import { readStoredHenryProblem } from '@/lib/henryproblem'
import { MathText } from '@/lib/mathtext'
import { problemsForClass, type ProblemSetItem } from '@/lib/problemSet/query'

export default function ProblemSetPage() {
  const { t } = useLanguage()
  const params = useSearchParams()
  const supabase = createClient()

  const classId = params.get('class') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''

  const [items, setItems] = useState<ProblemSetItem[] | null>(null)
  const [className, setClassName] = useState('')

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
        .ps-sheet {
          background: #fff;
          width: 190mm;                /* A4 width less a 10mm margin each side */
          min-height: 262mm;           /* and its height, so the break is honest */
          margin: 0 auto 24px;
          padding: 14mm;
          box-shadow: 0 6px 24px rgba(0,0,0,0.18);
          box-sizing: border-box;
        }
        .ps-bar { position: sticky; top: 0; z-index: 10; }

        @page { size: A4; margin: 10mm; }

        @media print {
          /* Nothing but the sheets. */
          .ps-bar { display: none !important; }
          .problem-set { background: #fff; padding: 0; }
          .ps-sheet {
            width: auto;
            min-height: 0;
            margin: 0;
            padding: 0;
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
            <span className="hidden text-[11px] text-gray-400 sm:inline">{t('pset.backgroundHint')}</span>
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
          <ProblemPage key={item.id} item={item} index={i + 1} total={items.length} />
        ))
      )}
    </div>
  )
}

function ProblemPage({ item, index, total }: { item: ProblemSetItem; index: number; total: number }) {
  const { t } = useLanguage()
  const sheet = readStoredHenryProblem(item.henryproblem)
  const date = new Date(`${item.challenge_date}T12:00:00`).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <section className="ps-sheet">
      {sheet ? (
        // The worksheet as the challenge room draws it, with its own picture.
        <HenryProblemSheet problem={sheet.problem} graphUrl={item.image_url} zoomable={false} />
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

      <p className="mt-6 text-right text-[10px] text-gray-400">
        {t('pset.pageOf', { index, total })}
      </p>
    </section>
  )
}
