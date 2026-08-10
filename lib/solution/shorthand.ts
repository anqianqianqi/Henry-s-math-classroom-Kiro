/**
 * What a student types, and the LaTeX it means.
 *
 * ── WHY A SHORTHAND AT ALL ──────────────────────────────────
 * The requirement is that a student never has to think about LaTeX. A palette
 * alone does not achieve that: tapping a fraction button still leaves them
 * staring at `\frac{}{}` and wondering which hole is which. What they already
 * know how to type is `1/2`, `x^2`, `<=`, `sqrt9` — the notation from a
 * calculator and a textbook. So that is the input language, and LaTeX is only
 * ever an output.
 *
 * ── THE ROUND TRIP IS THE HARD REQUIREMENT ──────────────────
 * A submission is stored as LaTeX, and a student can come back and edit it.
 * Showing them `\frac{1}{2}` at that point would break the whole premise, so
 * every construct this file can produce must convert back into the shorthand
 * that produced it. `latexToShorthand` is not a nicety — it is what makes the
 * editor reopenable. The round-trip is enforced by test, over a corpus.
 *
 * LaTeX from elsewhere — a teacher's problem, a paste — may use constructs
 * this never emits. Those come back as-is rather than wrongly; the caller
 * decides whether to show them read-only.
 */

/** A parsed piece: either a value, or an operator between values. */
type Token =
  | { kind: 'val'; tex: string; word?: string; grouped?: boolean }
  | { kind: 'op'; op: string }

/**
 * Words that name a symbol.
 *
 * Sourced from BARE_COMMANDS in lib/mathtext-core.ts, which is the closest
 * thing this codebase has to a list of what this classroom actually writes —
 * it is the set the worksheet renderer already treats as math. Anything not
 * here stays as typed, which is right: `abc` is three multiplied variables and
 * KaTeX already italicises it.
 */
const NAMED: Record<string, string> = {
  // relations and operators
  pm: '\\pm', times: '\\times', div: '\\div', cdot: '\\cdot',
  leq: '\\leq', geq: '\\geq', neq: '\\neq', approx: '\\approx',
  cong: '\\cong', sim: '\\sim', perp: '\\perp', parallel: '\\parallel',
  infty: '\\infty', inf: '\\infty',
  // geometry
  angle: '\\angle', triangle: '\\triangle', circ: '\\circ', bigcirc: '\\bigcirc',
  // greek
  alpha: '\\alpha', beta: '\\beta', gamma: '\\gamma', theta: '\\theta',
  lambda: '\\lambda', mu: '\\mu', pi: '\\pi', sigma: '\\sigma', omega: '\\omega',
  // functions, which must be upright rather than italic
  sin: '\\sin', cos: '\\cos', tan: '\\tan', log: '\\log', ln: '\\ln',
}

/** Two-character operators, longest first so `<=` never lexes as `<` then `=`. */
const OPERATORS = ['<=', '>=', '!=', '~=', '+-', '<', '>', '=', '+', '-', '*', '/', '^', '_']

const OPERATOR_TEX: Record<string, string> = {
  '<=': '\\leq', '>=': '\\geq', '!=': '\\neq', '~=': '\\approx', '+-': '\\pm',
  '*': '\\times',
}

const isWordChar = (c: string) => /[A-Za-z]/.test(c)
const isNumChar = (c: string) => /[0-9.]/.test(c)

/** Find the ')' matching the '(' at `open`, or -1 when unbalanced. */
function matchParen(s: string, open: number): number {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')' && --depth === 0) return i
  }
  return -1
}

function lex(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    const c = input[i]

    if (/\s/.test(c)) { i++; continue }

    if (c === '(') {
      const close = matchParen(input, i)
      if (close === -1) {
        // Unbalanced: treat the bracket as a literal so a half-typed
        // expression still renders something instead of vanishing.
        tokens.push({ kind: 'val', tex: '(' })
        i++
        continue
      }
      // `grouped` remembers the brackets were the student's grouping, not part
      // of the value — so `(x+1)/2` can drop them inside \frac and keep them
      // in `2(x+1)`.
      tokens.push({ kind: 'val', tex: convertTokens(lex(input.slice(i + 1, close))), grouped: true })
      i = close + 1
      continue
    }

    if (isWordChar(c)) {
      let j = i
      while (j < input.length && isWordChar(input[j])) j++
      const word = input.slice(i, j)
      /*
        Named symbols resolve here rather than at the end, because the folding
        passes below copy a token's `tex` into a brace group and nothing looks
        at it again: mapping later left `1/pi` as \frac{1}{pi} and `x^circ` as
        x^{circ}, while `(pi)/2` came out right only because a bracketed group
        recurses through the whole pipeline. `word` is kept for the sqrt pass,
        which matches on what was typed.
      */
      tokens.push({ kind: 'val', tex: NAMED[word] ?? word, word })
      i = j
      continue
    }

    if (isNumChar(c)) {
      let j = i
      while (j < input.length && isNumChar(input[j])) j++
      tokens.push({ kind: 'val', tex: input.slice(i, j) })
      i = j
      continue
    }

    const op = OPERATORS.find(o => input.startsWith(o, i))
    if (op) {
      tokens.push({ kind: 'op', op })
      i += op.length
      continue
    }

    // Anything else — a comma, a bracket — passes through untouched.
    tokens.push({ kind: 'val', tex: c })
    i++
  }

  return tokens
}

/** The value at `index`, with grouping brackets stripped: for \frac and scripts. */
function bare(token: Token): string {
  return token.kind === 'val' ? token.tex : ''
}

/** The value as it stands alone, keeping brackets the student typed. */
function standalone(token: Token): string {
  if (token.kind !== 'val') return ''
  return token.grouped ? `(${token.tex})` : token.tex
}

function convertTokens(tokens: Token[]): string {
  let list = [...tokens]

  // ── sqrt, before anything else claims its argument ──────────
  for (let i = 0; i < list.length - 1; i++) {
    const here = list[i]
    if (here.kind === 'val' && here.word === 'sqrt' && list[i + 1].kind === 'val') {
      list.splice(i, 2, { kind: 'val', tex: `\\sqrt{${bare(list[i + 1])}}` })
      i--
    }
  }

  // ── scripts before fractions ────────────────────────────────
  // `x^2/3` reads as x² over 3, not x to the power of two-thirds, so the
  // exponent has to bind tighter than the slash.
  for (const symbol of ['^', '_']) {
    for (let i = 1; i < list.length - 1; i++) {
      const op = list[i]
      if (op.kind === 'op' && op.op === symbol && list[i - 1].kind === 'val' && list[i + 1].kind === 'val') {
        const base = list[i - 1]
        list.splice(i - 1, 3, {
          kind: 'val',
          tex: `${standalone(base)}${symbol}{${bare(list[i + 1])}}`,
        })
        i -= 2
      }
    }
  }

  // ── fractions, left to right ────────────────────────────────
  for (let i = 1; i < list.length - 1; i++) {
    const op = list[i]
    if (op.kind === 'op' && op.op === '/' && list[i - 1].kind === 'val' && list[i + 1].kind === 'val') {
      list.splice(i - 1, 3, {
        kind: 'val',
        tex: `\\frac{${bare(list[i - 1])}}{${bare(list[i + 1])}}`,
      })
      i -= 2
    }
  }

  // ── names and leftover operators ────────────────────────────
  return list
    .map(token => {
      if (token.kind === 'op') return OPERATOR_TEX[token.op] ?? token.op
      // Names were already resolved at lex time — see the note there.
      return standalone(token)
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Student shorthand → LaTeX. Never throws; half-typed input renders partly. */
export function shorthandToLatex(input: string): string {
  return convertTokens(lex(input ?? ''))
}

// ── The way back ────────────────────────────────────────────

/** Read the brace group starting at `open`, returning its body and end index. */
function readBrace(s: string, open: number): { body: string; end: number } | null {
  if (s[open] !== '{') return null
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') depth++
    else if (s[i] === '}' && --depth === 0) return { body: s.slice(open + 1, i), end: i + 1 }
  }
  return null
}

/**
 * Whether a converted body needs brackets to keep its meaning, which depends
 * on where it is going back into.
 *
 * `\frac{x+1}{2}` came from `(x+1)/2` and must not return as `x+1/2`, which
 * reads as x + ½. But `\frac{x^{2}}{3}` came from `x^2/3` and needs no
 * brackets, because the forward pass binds a script tighter than a slash — so
 * an exponent is safe above a fraction bar and unsafe inside a root, where
 * `sqrtx^2` would raise the root rather than its argument.
 *
 * A leading minus is not grouping: `-1/2` is how a person writes it.
 */
function needsBrackets(shorthand: string, context: 'fraction' | 'script'): boolean {
  const body = shorthand.replace(/^-/, '')
  return context === 'fraction'
    ? /[+\-*/<>=]/.test(body)
    : /[+\-*/^_<>=]/.test(body)
}

const NAMED_BACK: Record<string, string> = Object.fromEntries(
  // `inf` and `infty` both map to \infty; the first wins going back, which is
  // `pm`-before-`inf` order-dependent, so pick explicitly.
  Object.entries(NAMED)
    .filter(([word]) => word !== 'inf')
    .map(([word, tex]) => [tex, word]),
)

const OPERATOR_BACK: Record<string, string> = Object.fromEntries(
  Object.entries(OPERATOR_TEX).map(([op, tex]) => [tex, op]),
)

/** LaTeX → the shorthand that would produce it. Unknown constructs pass through. */
export function latexToShorthand(latex: string): string {
  const s = latex ?? ''
  let out = ''
  let i = 0

  while (i < s.length) {
    if (s.startsWith('\\frac', i)) {
      const num = readBrace(s, i + 5)
      const den = num ? readBrace(s, num.end) : null
      if (num && den) {
        const a = latexToShorthand(num.body)
        const b = latexToShorthand(den.body)
        const wrap = (s: string) => (needsBrackets(s, 'fraction') ? `(${s})` : s)
        out += `${wrap(a)}/${wrap(b)}`
        i = den.end
        continue
      }
    }

    if (s.startsWith('\\sqrt', i)) {
      const arg = readBrace(s, i + 5)
      if (arg) {
        const inner = latexToShorthand(arg.body)
        /*
          `sqrt` is a word, so a letter-shaped argument would weld onto it:
          \sqrt{\pi} came back as `sqrtpi`, which lexes as one variable named
          "sqrtpi" and no longer contains a root at all. Digits are safe —
          `sqrt9` cannot be misread — so only letters force the brackets.
        */
        const merges = /^[A-Za-z]/.test(inner)
        out += `sqrt${needsBrackets(inner, 'script') || merges ? `(${inner})` : inner}`
        i = arg.end
        continue
      }
    }

    if (s[i] === '^' || s[i] === '_') {
      const arg = readBrace(s, i + 1)
      if (arg) {
        const inner = latexToShorthand(arg.body)
        out += `${s[i]}${needsBrackets(inner, 'script') ? `(${inner})` : inner}`
        i = arg.end
        continue
      }
    }

    if (s[i] === '\\') {
      const name = /^\\[a-zA-Z]+/.exec(s.slice(i))?.[0]
      if (name) {
        const back = OPERATOR_BACK[name] ?? NAMED_BACK[name]
        // An unrecognised command is left whole — better a visible `\vec` the
        // student can delete than a silent corruption of their work.
        out += back ?? name
        i += name.length
        continue
      }
    }

    out += s[i]
    i++
  }

  // The forward pass spaces tokens out for KaTeX; the way back should read the
  // way a person types, so collapse what that added.
  return out.replace(/\s+/g, ' ').trim()
}
