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

/** Bare commands the worksheet renderer treats as math without delimiters. */
const BARE_COMMANDS = [
  'bigcirc', 'circ', 'perp', 'parallel', 'angle', 'triangle', 'cong', 'sim',
  'leq', 'geq', 'neq', 'approx', 'times', 'div', 'pm', 'cdot', 'infty',
  'alpha', 'beta', 'gamma', 'theta', 'lambda', 'mu', 'pi', 'sigma', 'omega',
].join('|')

/** One brace group, tolerating a single level of nesting. */
const BRACE_GROUP = '\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\}'

const TOKEN_PATTERN = new RegExp(
  [
    '\\$([^$]+?)\\$',                              // $...$
    '\\\\\\(([\\s\\S]+?)\\\\\\)',                  // \(...\)
    `(\\\\frac${BRACE_GROUP}${BRACE_GROUP})`,      // bare \frac{a}{b}
    `(\\\\sqrt${BRACE_GROUP})`,                    // bare \sqrt{x}
    `(\\\\(?:${BARE_COMMANDS})\\b)`,               // bare \angle, \leq, ...
  ].join('|'),
  'g'
)

function renderExpression(expression: string): string {
  return katex.renderToString(expression, {
    throwOnError: false,
    displayMode: false,
    trust: false,
    strict: false,
    output: 'html',
  })
}

interface Segment {
  kind: 'text' | 'math'
  value: string
}

export function tokenizeMathText(text: string): Segment[] {
  const segments: Segment[] = []
  let lastIndex = 0

  TOKEN_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TOKEN_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', value: text.slice(lastIndex, match.index) })
    }
    // Exactly one capture group matches per token.
    const expression = match.slice(1).find(group => group != null) ?? match[0]
    segments.push({ kind: 'math', value: expression })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) })
  }
  return segments
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
