/**
 * A solution as a list of rows, and the plain string it is stored as.
 *
 * ── WHY ROWS, AND WHY THE FORMAT DOES NOT CHANGE ────────────
 * A worked solution is a chain of steps, one per line. Editing it as a list of
 * rows rather than one blob is what lets a row be a real equation while the row
 * above it stays ordinary prose — and it avoids contenteditable, which is the
 * usual way to mix the two and a bad idea here: half these students type
 * Chinese through an IME, and IME composition inside a contenteditable with
 * custom inline nodes is a bug farm. A native <textarea> handles composition
 * correctly for free.
 *
 * What is stored is still a plain string: rows joined by newlines, with math
 * rows wrapped in `$...$`. That is the format lib/mathtext-core.ts already
 * defines, which buys three things for nothing —
 *
 *   - translation already protects it (translateUserText masks `$...$` before
 *     the engine sees the prose, so a solution's words translate and its
 *     equations cannot be mangled),
 *   - no migration: an existing submission is already valid, and parses as a
 *     single text row,
 *   - every existing reader — grading, All Student Submissions, search — keeps
 *     working, because the string's shape never changed.
 *
 * The editor is only a nicer way to produce that string.
 */

import { tokenizeMathText } from '@/lib/mathtext-core'

export type Row =
  | { kind: 'text'; value: string }
  | { kind: 'math'; latex: string }

/**
 * Split a stored solution into rows.
 *
 * A line counts as a math row only when the whole line is one math token.
 * Anything else is prose — including a line that merely contains some math,
 * which stays a text row so the student's words are not torn apart. That rule
 * is also what keeps `I have $12 and $5 left` out of the math path: it
 * tokenises as text-math-text, not as a single expression.
 */
export function parseRows(content: string): Row[] {
  const lines = (content ?? '').split('\n')

  return lines.map<Row>(line => {
    const trimmed = line.trim()
    if (!trimmed) return { kind: 'text', value: '' }

    const segments = tokenizeMathText(trimmed)
    if (segments.length === 1 && segments[0].kind === 'math') {
      return { kind: 'math', latex: segments[0].value }
    }
    return { kind: 'text', value: line }
  })
}

/**
 * Rows back into the stored string.
 *
 * Empty rows are dropped rather than written as blank lines: a student who
 * adds a row and changes their mind should not leave a gap in what their
 * teacher reads.
 */
export function serialiseRows(rows: Row[]): string {
  return rows
    .map(row => (row.kind === 'math' ? wrapMath(row.latex) : row.value.trim()))
    .filter(line => line.length > 0)
    .join('\n')
}

/**
 * Wrap an expression so tokenizeMathText will read it back as one math row.
 *
 * A bare command like `\angle` is already a whole token on its own and is left
 * alone; anything else needs the dollars. Same rule as unmaskMath in
 * mathtext-core, deliberately — two places that disagree about delimiters is
 * how a solution comes back from the database looking like source code.
 */
function wrapMath(latex: string): string {
  const expression = latex.trim()
  if (!expression) return ''
  return /^\\[a-zA-Z]+$/.test(expression) ? expression : `$${expression}$`
}

/** A blank row of the given kind, for the "add a step" buttons. */
export function emptyRow(kind: Row['kind']): Row {
  return kind === 'math' ? { kind: 'math', latex: '' } : { kind: 'text', value: '' }
}
