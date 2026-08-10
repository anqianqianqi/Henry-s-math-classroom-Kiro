'use client'

/**
 * A submitted solution, as anyone reads it: the student, their teacher, the
 * class once solutions are revealed.
 *
 * ── WHY NOT JUST MathText ───────────────────────────────────
 * MathText renders every expression with `displayMode: false`, which is right
 * for an equation sitting inside a sentence and wrong for one that is a step
 * on its own line — fractions collapse to the cramped inline form and a chain
 * of steps reads like a paragraph. Parsing back into rows lets a standalone
 * equation render as a display equation and a sentence keep its inline maths,
 * from the same stored string.
 *
 * The string is the only input. Nothing here needs the editor to have been
 * used, so a submission typed years ago renders the same as one written today.
 */

import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { MathText } from '@/lib/mathtext'
import { parseRows } from '@/lib/solution/rows'

export function SolutionView({ content, className }: { content: string; className?: string }) {
  const rows = useMemo(() => parseRows(content), [content])

  return (
    <div className={className}>
      {rows.map((row, i) =>
        row.kind === 'math' ? (
          <div
            key={i}
            className="my-1 overflow-x-auto"
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(row.latex, {
                throwOnError: false,
                displayMode: true,
                trust: false,
                strict: false,
                output: 'html',
              }),
            }}
          />
        ) : row.value.trim() ? (
          // Prose keeps inline maths — "since $a>c$" belongs in the sentence.
          <MathText key={i} text={row.value} className="block leading-relaxed" />
        ) : null,
      )}
    </div>
  )
}
