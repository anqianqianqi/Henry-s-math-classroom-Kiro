'use client'

/**
 * One equation in a solution.
 *
 * ── THE SEAM ────────────────────────────────────────────────
 * Outside this component an equation is LaTeX, because that is what gets
 * stored and what `maskMath` protects from the translator. Inside it, the
 * student types shorthand and never sees a backslash. Everything about how the
 * equation is entered lives behind this one boundary, so swapping the input
 * for a WYSIWYG field later — MathLive, or something built on KaTeX — changes
 * this file and nothing else.
 *
 * ── WHY THE TYPED TEXT IS LOCAL STATE ───────────────────────
 * `latex` seeds the row; it does not drive it. Deriving the shorthand from the
 * LaTeX on every render would fight the student mid-keystroke: they type `1/`,
 * which converts to something, which converts back to something else, and the
 * caret jumps. The shorthand is the truth while the row is being edited, and
 * the LaTeX is what falls out of it.
 */

import { useMemo, useRef, useState } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { shorthandToLatex, latexToShorthand } from '@/lib/solution/shorthand'
import { MathPalette, type PaletteEntry } from './MathPalette'

export function MathRow({
  latex,
  onChange,
  autoFocus,
}: {
  latex: string
  onChange: (latex: string) => void
  autoFocus?: boolean
}) {
  const { t } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)
  const [typed, setTyped] = useState(() => latexToShorthand(latex))
  const [focused, setFocused] = useState(false)

  const rendered = useMemo(() => {
    const expression = shorthandToLatex(typed)
    if (!expression) return null
    return katex.renderToString(expression, {
      throwOnError: false,
      // A step in a solution is a display equation — it stands on its own line
      // and deserves full-size operators, not the cramped inline forms.
      displayMode: true,
      trust: false,
      strict: false,
      output: 'html',
    })
  }, [typed])

  function update(next: string) {
    setTyped(next)
    onChange(shorthandToLatex(next))
  }

  /** Insert a palette entry at the caret, landing the cursor on its `|` mark. */
  function insert(entry: PaletteEntry) {
    const input = inputRef.current
    const at = input?.selectionStart ?? typed.length
    const end = input?.selectionEnd ?? at

    /*
      A word-shaped snippet dropped straight after letters would weld itself on:
      tapping √ after `x` gave `xsqrt()`, which lexes as one variable named
      "xsqrt" and stores `x s q r t ()`. A space is what the student would have
      typed, so the palette types it for them.
    */
    const before = typed.slice(0, at)
    const gap = /[A-Za-z]$/.test(before) && /^[A-Za-z]/.test(entry.insert) ? ' ' : ''

    const snippet = gap + entry.insert.replace('|', '')
    const caret = at + gap.length + entry.insert.indexOf('|')

    const next = before + snippet + typed.slice(end)
    update(next)

    // After React re-renders with the new value; setting it synchronously
    // would be overwritten by the controlled value landing after.
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(caret, caret)
    })
  }

  return (
    <div className="rounded-xl border border-[rgba(100,60,10,0.18)] bg-[rgba(255,252,242,0.5)] p-3">
      {rendered ? (
        <div
          className="min-h-[3rem] flex items-center justify-center text-[#2d1a00] overflow-x-auto"
          // KaTeX emits its own markup; `trust` is off above, so \href and
          // friends are rejected rather than rendered.
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      ) : (
        <div className="min-h-[3rem] flex items-center justify-center">
          <span className="text-sm text-[rgba(100,60,10,0.45)]">{t('solution.equationPlaceholder')}</span>
        </div>
      )}

      <input
        ref={inputRef}
        value={typed}
        autoFocus={autoFocus}
        onChange={event => update(event.target.value)}
        onFocus={() => setFocused(true)}
        // A palette press fires onMouseDown and cancels the blur, so the strip
        // stays open while it is being used.
        onBlur={() => setFocused(false)}
        placeholder={t('solution.equationPlaceholder')}
        inputMode="text"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="mt-2 w-full bg-transparent text-center font-mono text-sm
                   text-[rgba(100,60,10,0.75)] placeholder-[rgba(100,60,10,0.35)]
                   border-t border-dashed border-[rgba(100,60,10,0.2)] pt-2
                   focus:outline-none"
      />

      {focused && (
        <div className="mt-2">
          <MathPalette onInsert={insert} />
        </div>
      )}
    </div>
  )
}
