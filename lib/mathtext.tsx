'use client'

/**
 * Renders the local LaTeX shorthand used in .henryproblem wording.
 *
 * The Prettify workspace wraps recognized formulas in `$...$` (or `\(...\)`),
 * but also renders a few bare commands — notably `\frac{a}{b}` — as math even
 * outside delimiters. This mirrors that behavior with KaTeX.
 */

import katex from 'katex'
import { Fragment, useMemo } from 'react'

// The pattern and tokenizer live in mathtext-core so server-side translation
// can mask math using exactly what this renders — see lib/mathtext-core.ts.
import { tokenizeMathText, type Segment } from './mathtext-core'

export { tokenizeMathText }
export type { Segment }

function renderExpression(expression: string): string {
  return katex.renderToString(expression, {
    throwOnError: false,
    displayMode: false,
    trust: false,
    strict: false,
    output: 'html',
  })
}

/** Plain text with line breaks preserved. */
function TextSegment({ value }: { value: string }) {
  const lines = value.split('\n')
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </>
  )
}

export function MathText({ text, className }: { text: string; className?: string }) {
  const segments = useMemo(() => tokenizeMathText(text || ''), [text])

  return (
    <span className={className}>
      {segments.map((segment, i) =>
        segment.kind === 'text' ? (
          <TextSegment key={i} value={segment.value} />
        ) : (
          <span
            key={i}
            // KaTeX emits its own markup; trust is disabled above so \href
            // and friends are rejected rather than rendered.
            dangerouslySetInnerHTML={{ __html: renderExpression(segment.value) }}
          />
        )
      )}
    </span>
  )
}
