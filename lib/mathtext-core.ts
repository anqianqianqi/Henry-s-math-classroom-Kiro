/**
 * Math tokenising, with no React or KaTeX dependency.
 *
 * Split out from mathtext.tsx so server code — translation in particular — can
 * find math in a string without pulling a renderer into the bundle. Both this
 * and the component share one pattern, so what the translator protects is
 * exactly what the renderer will render.
 */

/** Bare commands the worksheet renderer treats as math without delimiters. */
const BARE_COMMANDS = [
  'bigcirc', 'circ', 'perp', 'parallel', 'angle', 'triangle', 'cong', 'sim',
  'leq', 'geq', 'neq', 'approx', 'times', 'div', 'pm', 'cdot', 'infty',
  'alpha', 'beta', 'gamma', 'theta', 'lambda', 'mu', 'pi', 'sigma', 'omega',
].join('|')

/** One brace group, tolerating a single level of nesting. */
const BRACE_GROUP = '\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\}'

export const TOKEN_PATTERN = new RegExp(
  [
    '\\$([^$]+?)\\$',                              // $...$
    '\\\\\\(([\\s\\S]+?)\\\\\\)',                  // \(...\)
    `(\\\\frac${BRACE_GROUP}${BRACE_GROUP})`,      // bare \frac{a}{b}
    `(\\\\sqrt${BRACE_GROUP})`,                    // bare \sqrt{x}
    `(\\\\(?:${BARE_COMMANDS})\\b)`,               // bare \angle, \leq, ...
  ].join('|'),
  'g'
)

export interface Segment {
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

/**
 * Replace every math run with an opaque placeholder.
 *
 * Masking rather than instructing: a prompt asking the model to leave math
 * alone works most of the time, and "most of the time" turns 2x into 2×, drops
 * a backslash, or translates a variable name. The model never sees the math
 * here, so it cannot touch it.
 *
 * Placeholders use characters that do not occur in normal prose or LaTeX, and
 * carry an index so reordering during translation is survivable.
 */
export function maskMath(text: string): { masked: string; math: string[] } {
  const segments = tokenizeMathText(text)
  const math: string[] = []
  let masked = ''

  for (const segment of segments) {
    if (segment.kind === 'text') {
      masked += segment.value
    } else {
      masked += `⟦M${math.length}⟧`
      math.push(segment.value)
    }
  }
  return { masked, math }
}

/** Put the original expressions back, restoring the delimiters they need. */
export function unmaskMath(masked: string, math: string[]): string {
  return masked.replace(/⟦M(\d+)⟧/g, (whole, index) => {
    const expression = math[Number(index)]
    if (expression === undefined) return whole
    // tokenizeMathText strips $...$ and \(...\) delimiters into the capture, so
    // re-wrap; bare commands like \angle are returned with their backslash and
    // need no wrapper.
    return /^\\[a-zA-Z]+/.test(expression) && !/[\s{]/.test(expression)
      ? expression
      : `$${expression}$`
  })
}

/**
 * Which language the author wrote in.
 *
 * A ratio rather than "contains any CJK": a Chinese sentence quoting an English
 * term is still Chinese, and an English sentence with one Chinese name is still
 * English. Text that is mostly digits and math — common for a bare answer —
 * lands on 'other', which is correct: there is nothing to translate either way.
 */
export function detectLanguage(text: string): 'en' | 'zh' | 'other' {
  // Strip the placeholders too, not just the math: ⟦M0⟧ contains a Latin "M",
  // which made a bare expression like $x = 2y$ look like English prose.
  const stripped = maskMath(text).masked.replace(/⟦M\d+⟧/g, '')
  const cjk = (stripped.match(/[一-鿿㐀-䶿]/g) ?? []).length
  const latin = (stripped.match(/[A-Za-z]/g) ?? []).length

  if (cjk === 0 && latin === 0) return 'other'
  if (cjk > 0 && cjk >= latin / 4) return 'zh'
  if (latin > 0 && latin >= cjk * 4) return 'en'
  return 'other'
}
