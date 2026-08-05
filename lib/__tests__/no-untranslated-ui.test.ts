import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Catches UI text that was written in English instead of going through t().
 *
 * The whole catalog is worth nothing if the next feature ships with its labels
 * hardcoded: a Chinese reader gets a page that is half translated, and nobody
 * notices until they complain. This fails the build instead.
 *
 * It only looks at the shapes that are almost always user-visible — an
 * attribute a screen reader or tooltip shows, and a JSX text node. That misses
 * some things, deliberately: a check that flagged every English string in the
 * codebase would drown in class names, keys and enum values, and a noisy check
 * gets suppressed rather than fixed.
 *
 * ── ADDING A STRING? ──────────────────────────────────────────
 * Put it in lib/i18n/messages/ and render it with t('your.key'). See
 * lib/i18n/catalog.ts for which file it belongs in.
 *
 * ── GENUINELY NOT USER-VISIBLE? ───────────────────────────────
 * Add the file to ALLOWED below WITH a reason. Do not add a file just to make
 * the test pass — the point is that the next person has to think about it.
 */

const ROOTS = ['app', 'components']

/** Attributes whose value is read aloud or shown on hover. */
const VISIBLE_ATTRS = ['aria-label', 'placeholder', 'title']

const ALLOWED: Record<string, string> = {
  // Dev-only scaffolding, never rendered to a student.
  'app/api': 'API routes render no UI',
}

/**
 * Files that still contain untranslated UI, recorded as they were when this
 * check was written.
 *
 * This list may SHRINK, never grow. A new file appearing here means a feature
 * shipped without translations — which is exactly what the check exists to stop.
 *
 * Most of these are components rather than pages: the i18n sweep worked through
 * app/**\/page.tsx, and the shared components under components/ were never on
 * that list. The rest are the AI generator and editor screens that were
 * deliberately deferred as admin-only.
 */
const BASELINE = new Set([
  'app/admin/challenge-bank/page.tsx',
  'app/admin/challenge-rooms/page.tsx',
  'app/admin/shop/page.tsx',
  'app/admin/tags/page.tsx',
  'app/book-skins/page.tsx',
  'app/challenges/[id]/edit/page.tsx',
  'app/challenges/[id]/page.tsx',
  'app/challenges/batch-import/page.tsx',
  'app/challenges/new/page.tsx',
  'app/challenges/page.tsx',
  'app/classes/[id]/edit/page.tsx',
  'app/classes/new/page.tsx',
  'app/dashboard/page.tsx',
  'app/decorations/pet-room/page.tsx',
  'app/grading/page.tsx',
  'components/BookCoverLivePreview.tsx',
  'components/ChallengeTemplates.tsx',
  'components/CommentThread.tsx',
  'components/EnrollmentManager.tsx',
  'components/GradingInterface.tsx',
  'components/HenryProblemSheet.tsx',
  'components/HomeworkForm.tsx',
  'components/JoinRequestManager.tsx',
  'components/MagicBookReveal.tsx',
  'components/MaterialUpload.tsx',
  'components/NotificationBell.tsx',
  'components/NotificationPreferences.tsx',
  'components/ProgressDashboard.tsx',
  'components/SessionDetail.tsx',
  'components/SessionsList.tsx',
  'components/SubmissionForm.tsx',
  'components/bubble-room/TAPendingPanel.tsx',
  'components/challenge-room/Book3DReveal.tsx',
  'components/challenge-room/BundleCollection.tsx',
  'components/challenge-room/RoomCollection.tsx',
  'components/desktop-pet/DesktopPet.tsx',
  'components/desktop-pet/MusicPlayer.tsx',
  'components/pet-room/AnimationZoneEditor.tsx',
  'components/pet/AccessoryInventory.tsx',
  'components/pet/PetPreviewCard.tsx',
  'components/pet/XpBar.tsx',
  // Card.tsx and Input.tsx were removed once plain /* */ comments stopped being
  // read as UI text — their only findings had always been prose in a comment.
])

interface Finding {
  file: string
  line: number
  text: string
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      walk(full, out)
    } else if (entry.endsWith('.tsx')) {
      out.push(full.replace(/\\/g, '/'))
    }
  }
  return out
}

function findUntranslated(file: string): Finding[] {
  const findings: Finding[] = []
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)

  /**
   * A line sandwiched between an opening tag and a closing tag is JSX text,
   * whatever it says:
   *
   *   <button …>
   *     Settings        <- this
   *   </button>
   *
   * That bracketing is what makes a single word safe to flag. Without it,
   * "Settings" alone could be an object key, an enum member or a type name, and
   * a check that guessed would be too noisy to keep — which is why single-word
   * labels were invisible until the dashboard header turned one up.
   */
  const isBracketedByTags = (i: number) =>
    /(^|>)\s*$/.test(lines[i - 1] ?? '') && /^\s*<\//.test(lines[i + 1] ?? '')

  // A block comment spans lines and its continuations are bare prose:
  //
  //   {/* Dropped by container query when the strip
  //       itself is narrow */}                        <- looks like UI text
  //
  // Tracked rather than pattern-matched, because only the first line carries
  // the opening marker.
  //
  // Plain /* */ blocks count too, not just the {/* */} JSX form. A continuation
  // line that happens to read like a sentence — "It has to come after countMap
  // exists." — was flagged as untranslated UI, which sends whoever hit it
  // hunting for a string that does not exist. Prose in a comment is never UI
  // text, whichever bracket opened it.
  let inJsxComment = false

  lines.forEach((line, i) => {
    const opensComment = /\{\/\*|\/\*/.test(line) && !line.includes('*/')
    const closesComment = inJsxComment && line.includes('*/')
    const skipAsComment = inJsxComment
    if (opensComment) inJsxComment = true
    if (closesComment) inJsxComment = false
    if (skipAsComment) return

    // An attribute holding a bare English string rather than {t(...)}.
    for (const attr of VISIBLE_ATTRS) {
      const m = line.match(new RegExp(`${attr}="([A-Z][^"]{2,})"`))
      // A single capitalised word is usually an enum or a proper noun; require
      // a space, which is what separates "Submit answer" from "Monday".
      if (m && m[1].includes(' ')) {
        findings.push({ file, line: i + 1, text: `${attr}="${m[1]}"` })
      }
    }

    // A JSX text node written inline: >Some English Words<
    // `&apos;` and friends count as word characters — "Henry&apos;s Math
    // Classroom" sat in the dashboard header unnoticed because they did not.
    const inline = line.match(/>([A-Z][a-z&;]+(?: [A-Za-z’'&;]+){1,8})</)
    if (inline) findings.push({ file, line: i + 1, text: inline[1] })

    // A JSX text node on its own line, which is how Prettier formats anything
    // long enough to matter:
    //
    //   <h1 className="…">
    //     Welcome to your math learning platform      <- this line
    //   </h1>
    //
    // Missing this was a real blind spot: the public landing page was fully
    // untranslated and the check said nothing.
    const bare = line.trim()
    const multiWord = /^[A-Z][a-z&;]+(?:[ ,’'-][A-Za-z’'&;]+){1,10}[.!?]?$/.test(bare)
    // A lone capitalised word only counts when tags bracket it, so "Settings"
    // as a button label is caught while "Settings" as a type name is not.
    const loneWord = /^[A-Z][a-z]{2,}$/.test(bare) && isBracketedByTags(i)

    const isOwnLineText =
      (multiWord || loneWord) &&
      // Not markup, an expression, a prop, or a comment.
      !/[<>{}=]/.test(bare) &&
      !bare.startsWith('*') &&
      !bare.startsWith('//') &&
      // A line of Tailwind classes inside a multi-line className string.
      !/^[a-z-]+:/.test(bare)
    if (isOwnLineText && !inline) findings.push({ file, line: i + 1, text: bare })
  })

  return findings
}

function scan(): Finding[] {
  const findings: Finding[] = []
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      if (Object.keys(ALLOWED).some(prefix => file.startsWith(prefix))) continue
      findings.push(...findUntranslated(file))
    }
  }
  return findings
}

describe('UI strings go through the catalog', () => {
  it('adds no new file with hardcoded English', () => {
    const offenders = [...new Set(scan().map(f => f.file))]
    const newlyBroken = offenders.filter(file => !BASELINE.has(file))

    // If this fails, the named file has UI text that a Chinese reader will see
    // in English. Move it into lib/i18n/messages/ and render it with t().
    expect(newlyBroken).toEqual([])
  })

  it('keeps the baseline honest — no stale entries', () => {
    const offenders = new Set(scan().map(f => f.file))
    const fixed = [...BASELINE].filter(file => !offenders.has(file))

    // A file listed here that is now clean should be deleted from BASELINE, so
    // the list keeps shrinking and cannot quietly re-admit an offender.
    expect(fixed).toEqual([])
  })
})
