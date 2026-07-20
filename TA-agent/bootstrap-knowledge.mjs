/**
 * TA Agent Bootstrap Script
 *
 * Pulls all graded submissions + Henry's comments from the database,
 * feeds them to GPT-4o, and generates the initial knowledge files:
 *   - TA-agent/grading-style.md
 *   - TA-agent/correction-log.md
 *
 * Run from repo root:
 *   node --env-file=.env.local TA-agent/bootstrap-knowledge.mjs
 *
 * (Node 20+ supports --env-file natively. If on Node 18, use:
 *   export $(grep -v '^#' .env.local | xargs) && node TA-agent/bootstrap-knowledge.mjs)
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const OPENAI_KEY   = process.env.OPENAI_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_KEY) {
  console.error('❌  Missing env vars. Run with:')
  console.error('   node --env-file=.env.local TA-agent/bootstrap-knowledge.mjs')
  console.error('\nRequired: NEXT_PUBLIC_SUPABASE_URL, OPENAI_API_KEY,')
  console.error('          and either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// OpenAI chat completions via fetch (no openai package needed)
async function chatGPT(systemPrompt, userPrompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2500,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.choices[0].message.content ?? ''
}

// ── Fetch graded data ─────────────────────────────────────────────────────────

async function fetchGradedSubmissions() {
  console.log('📥  Fetching graded submissions from database...')

  const { data: submissions, error } = await supabase
    .from('challenge_submissions')
    .select('id, content, points, submitted_at, challenge_id')
    .not('points', 'is', null)
    .order('submitted_at', { ascending: false })
    .limit(200)

  if (error) throw new Error('Failed to fetch submissions: ' + error.message)
  console.log(`    Found ${submissions?.length ?? 0} graded submissions`)
  if (!submissions?.length) return []

  // Fetch challenge titles
  const challengeIds = [...new Set(submissions.map(s => s.challenge_id).filter(Boolean))]
  const { data: challenges } = await supabase
    .from('daily_challenges')
    .select('id, title, description')
    .in('id', challengeIds)

  const challengeMap = new Map((challenges ?? []).map(c => [c.id, c]))

  // Fetch teacher comments on these submissions
  const subIds = submissions.map(s => s.id)
  const { data: comments } = await supabase
    .from('submission_comments')
    .select('submission_id, content, created_at')
    .in('submission_id', subIds)
    .order('created_at', { ascending: true })

  const commentMap = new Map()
  for (const c of comments ?? []) {
    const list = commentMap.get(c.submission_id) ?? []
    list.push(c.content)
    commentMap.set(c.submission_id, list)
  }

  const examples = submissions
    .map(s => {
      const ch = challengeMap.get(s.challenge_id)
      if (!ch) return null
      return {
        challenge_title:       ch.title,
        challenge_description: ch.description ?? '',
        submission:            s.content ?? '',
        score:                 s.points,
        teacher_comments:      commentMap.get(s.id) ?? [],
      }
    })
    .filter(Boolean)

  console.log(`    Kept ${examples.length} examples with matching challenges`)
  const withComments = examples.filter(e => e.teacher_comments.length > 0)
  console.log(`    Of which ${withComments.length} have teacher comments`)
  return examples
}

// ── Generate grading-style.md ─────────────────────────────────────────────────

async function generateGradingStyle(examples) {
  console.log('\n🧠  Asking GPT-4o to infer grading style...')
  const sample = examples.slice(0, 60)

  const exText = sample.map((e, i) => [
    `[Example ${i + 1}]`,
    `Problem: ${e.challenge_title}`,
    e.challenge_description ? `Context: ${e.challenge_description.slice(0, 200)}` : null,
    `Submission: ${e.submission.slice(0, 400)}`,
    `Score: ${e.score} points`,
    e.teacher_comments.length
      ? `Teacher comments: ${e.teacher_comments.join(' | ')}`
      : '(no comments left)',
  ].filter(Boolean).join('\n')).join('\n\n---\n\n')

  const resp = await chatGPT(
    `You are analyzing a math teacher's grading history to extract their grading philosophy.
You will receive examples of student submissions with the score the teacher gave and any feedback comments.
Infer the teacher's grading style and write it as a clear guide for an AI grading assistant.

Output a well-structured markdown document with these sections:
## Philosophy
## Point Distribution Guidelines  
## Partial Credit Rules
## How the Teacher Uses Comments
## What Patterns Lead to Higher Scores
## What Patterns Lead to Score Deductions

Be specific — cite patterns you actually observed in the examples.
Write as if explaining "this is how this teacher grades" to an AI that will grade on their behalf.`,
    `Analyze these ${sample.length} graded examples and write the grading style guide:\n\n${exText}`
  )
  return resp
}

// ── Generate correction-log.md ────────────────────────────────────────────────

function buildCorrectionLog(examples) {
  const withComments = examples.filter(e => e.teacher_comments.length > 0).slice(0, 120)

  if (withComments.length === 0) {
    return `# Correction Log\n\n*(Bootstrapped empty — will grow as Henry reviews AI grades)*\n`
  }

  const entries = withComments.map((e, i) => {
    const sub = e.submission.length > 500
      ? e.submission.slice(0, 500) + '…'
      : e.submission
    return [
      `### Example #${i + 1} — Bootstrapped ${new Date().toISOString().split('T')[0]}`,
      `**Problem**: ${e.challenge_title}`,
      `**Student submission**: ${sub}`,
      `**Henry's grade**: ${e.score} points`,
      `**Henry's comments**: ${e.teacher_comments.join(' | ')}`,
    ].join('\n')
  }).join('\n\n---\n\n')

  return `# Correction Log

This file is Henry's grading history — the ground truth the AI learns from.
The first batch was bootstrapped from existing graded submissions in the database.
New entries are added automatically whenever Henry overrides an AI grade.

**How to read this**: Each entry shows a problem, what the student wrote,
what score Henry gave, and any comments Henry left. The AI reads this file
to understand Henry's grading patterns before grading new submissions.

---

${entries}
`
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== TA Agent Knowledge Bootstrap ===\n')

  const examples = await fetchGradedSubmissions()

  if (examples.length === 0) {
    console.log('\n⚠️   No graded submissions found. Nothing to bootstrap yet.')
    console.log('    Once Henry has graded some submissions, run this script again.')
    process.exit(0)
  }

  // Generate grading-style.md via GPT-4o
  const gradingStyle = await generateGradingStyle(examples)
  const gradingStylePath = join(__dirname, 'grading-style.md')
  writeFileSync(gradingStylePath, [
    '# Henry\'s Grading Style Guide',
    '',
    `> Auto-generated on ${new Date().toISOString().split('T')[0]} from ${examples.length} graded submissions.`,
    '> Review this file and edit anything that looks wrong before using the TA agent.',
    '',
    '---',
    '',
    gradingStyle,
  ].join('\n'), 'utf-8')
  console.log(`\n✅  Written: TA-agent/grading-style.md`)

  // Build correction-log.md from raw examples (no extra API call needed)
  const correctionLog = buildCorrectionLog(examples)
  const correctionLogPath = join(__dirname, 'correction-log.md')
  writeFileSync(correctionLogPath, correctionLog, 'utf-8')
  console.log(`✅  Written: TA-agent/correction-log.md`)

  console.log('\n=== Bootstrap complete ===')
  console.log('\nNext steps:')
  console.log('  1. Open TA-agent/grading-style.md — review and edit as needed')
  console.log('  2. Skim TA-agent/correction-log.md — remove anything sensitive')
  console.log('  3. Build the grading API routes (Phase 1)')
}

main().catch(err => {
  console.error('\n❌  Bootstrap failed:', err.message)
  process.exit(1)
})
