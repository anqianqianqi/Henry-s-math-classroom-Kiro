/**
 * Report every untranslated UI string the current check can see, ignoring the
 * BASELINE. Answers "how much is actually left" rather than "does the suite
 * pass" — the suite passes by construction, because the baseline exists.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      walk(full, out)
    } else if (entry.endsWith('.tsx')) {
      out.push(full.split('\\').join('/'))
    }
  }
  return out
}

const ATTRS = ['aria-label', 'placeholder', 'title']
const rows = []

for (const file of [...walk('app'), ...walk('components')]) {
  if (file.startsWith('app/api')) continue
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  const bracketed = i =>
    /(^|>)\s*$/.test(lines[i - 1] ?? '') && /^\s*<\//.test(lines[i + 1] ?? '')

  let inComment = false
  let count = 0
  const samples = []

  lines.forEach((line, i) => {
    const opens = line.includes('{/*') && !line.includes('*/')
    const closes = inComment && line.includes('*/')
    const skip = inComment
    if (opens) inComment = true
    if (closes) inComment = false
    if (skip) return

    for (const attr of ATTRS) {
      const m = line.match(new RegExp(`${attr}="([A-Z][^"]{2,})"`))
      if (m && m[1].includes(' ')) { count++; if (samples.length < 2) samples.push(m[1]) }
    }

    const inline = line.match(/>([A-Z][a-z&;]+(?: [A-Za-z’'&;]+){1,8})</)
    if (inline) { count++; if (samples.length < 2) samples.push(inline[1]); return }

    const bare = line.trim()
    const multi = /^[A-Z][a-z&;]+(?:[ ,’'-][A-Za-z’'&;]+){1,10}[.!?]?$/.test(bare)
    const lone = /^[A-Z][a-z]{2,}$/.test(bare) && bracketed(i)
    if ((multi || lone) && !/[<>{}=]/.test(bare) && !bare.startsWith('*') &&
        !bare.startsWith('//') && !/^[a-z-]+:/.test(bare)) {
      count++
      if (samples.length < 2) samples.push(bare)
    }
  })

  if (count) rows.push({ count, file, samples })
}

rows.sort((a, b) => b.count - a.count)
const total = rows.reduce((s, r) => s + r.count, 0)

console.log(`files: ${rows.length}    strings: ${total}\n`)
for (const r of rows) {
  console.log(`  ${String(r.count).padStart(3)}  ${r.file}`)
  console.log(`       e.g. ${r.samples.join(' · ')}`)
}
