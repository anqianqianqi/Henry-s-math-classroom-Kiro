'use client'

/**
 * The symbols a student cannot type, and a reminder of the ones they can.
 *
 * ── WHAT GOES ON A BUTTON ───────────────────────────────────
 * Each button inserts SHORTHAND, never LaTeX. Tapping "Fraction" types `/`
 * into the row, exactly as if the student had reached for the key — so the
 * palette teaches the shorthand rather than competing with it, and a student
 * who learns `1/2` stops needing the button. The tooltip says what to type,
 * for the same reason.
 *
 * The set is drawn from BARE_COMMANDS in lib/mathtext-core.ts, which is the
 * closest thing this codebase has to a record of what this classroom writes:
 * it is the list the worksheet renderer already treats as math without
 * delimiters. Adding to it is a decision about the curriculum, not the UI.
 */

import { useLanguage } from '@/lib/i18n/LanguageProvider'
import type { TranslationKey } from '@/lib/i18n/catalog'

export interface PaletteEntry {
  /** What the button shows — the symbol itself wherever one exists. */
  face: string
  /** The shorthand typed into the row. `|` marks where the cursor lands. */
  insert: string
  labelKey: TranslationKey
}

export const PALETTE: PaletteEntry[] = [
  { face: 'a/b', insert: '/|', labelKey: 'solution.symFraction' },
  { face: 'x²', insert: '^|', labelKey: 'solution.symPower' },
  { face: '√', insert: 'sqrt(|)', labelKey: 'solution.symRoot' },
  { face: 'xₙ', insert: '_|', labelKey: 'solution.symSubscript' },
  { face: '≤', insert: ' <= |', labelKey: 'solution.symLeq' },
  { face: '≥', insert: ' >= |', labelKey: 'solution.symGeq' },
  { face: '≠', insert: ' != |', labelKey: 'solution.symNeq' },
  { face: '×', insert: ' * |', labelKey: 'solution.symTimes' },
  { face: '÷', insert: ' div |', labelKey: 'solution.symDiv' },
  { face: '±', insert: ' +- |', labelKey: 'solution.symPm' },
  { face: 'π', insert: 'pi|', labelKey: 'solution.symPi' },
  { face: '∠', insert: 'angle |', labelKey: 'solution.symAngle' },
  { face: '△', insert: 'triangle |', labelKey: 'solution.symTriangle' },
  // A degree sign is a raised \circ, so it has to go in as an exponent —
  // a bare `circ` renders at the baseline and reads as a composition symbol.
  { face: '°', insert: '^circ|', labelKey: 'solution.symDegree' },
]

export function MathPalette({ onInsert }: { onInsert: (entry: PaletteEntry) => void }) {
  const { t } = useLanguage()

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('solution.symbols')}>
      {PALETTE.map(entry => (
        <button
          key={entry.face}
          type="button"
          /*
            onMouseDown with preventDefault, not onClick: clicking a button
            blurs the row's input, and a blurred input has no selection to
            insert at. Suppressing the blur keeps the caret where the student
            left it, which is the whole point of a palette.
          */
          onMouseDown={event => {
            event.preventDefault()
            onInsert(entry)
          }}
          title={t(entry.labelKey)}
          aria-label={t(entry.labelKey)}
          className="min-w-[2.25rem] px-2 py-1.5 rounded-lg text-[15px] leading-none
                     bg-[rgba(255,252,242,0.75)] text-[#4a2c00]
                     border border-[rgba(100,60,10,0.22)]
                     hover:bg-[rgba(255,252,242,1)] hover:border-[rgba(100,60,10,0.4)]
                     active:translate-y-px transition-colors"
        >
          {entry.face}
        </button>
      ))}
    </div>
  )
}
