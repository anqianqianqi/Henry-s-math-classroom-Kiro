/**
 * TA Agent Bootstrap Script
 *
 * Pulls all graded submissions + Henry's comments from the database,
 * feeds them to GPT-4o, and generates the initial knowledge files:
 *   - TA-agent/grading-style.md  (Henry's grading style inferred from data)
 *   - TA-agent/correction-log.md (existing grades as example corrections)
 *
 * Run once from repo root:
 *   npx ts-node --project tsconfig.json TA-agent/bootstrap-knowledge.ts
 *
 * Or with tsx:
 *   npx tsx TA-agent/bootstrap-knowledge.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// ── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const OPENAI_KEY = process.env.OPENAI_API_KEY!

if (!SUPABASE_URL || !OPENAI_KEY) {
  console.error('Missing env vars. Make sure NEXT_PUBLIC_SUPABASE_URL and OPENAI_API_KEY are set.')
  console.error('Run with: source .env.local && npx tsx TA-agent/bootstrap-knowledge.ts')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const openai = new OpenAI({ apiKey: OPENAI_KEY })

const OUT_DIR = path.join(__dirname)

// ── Fetch graded data ─────────────────────────────────────────────────────────

async function fetchGradedSubmissions() {
  console.log('Fetching graded submissions...')

  // Get all submissions that have been graded (points is not null)
  const { data: submissions, error } = await supabase
    .from('challenge_submissions')
    .select(`
      id,
      content,
      points,
      is_locked,
      submitted_at,
      challenge_id,
      user_id
    `)
    .not('points', 'is', null)
    .order('submitted_at', { ascending: false })
    .limit(200)  // cap at 200 for the bootstrap — enough signal without huge token cost

  if (error) throw new Error('Failed to fetch submissions: ' + error.message)
  console.log(`  Found ${submissions?.length ?? 0} graded submissions`)

  if (!submissions || submissions.length === 0) return []

  // Get the challenge titles for context
  const challengeIds = [...new Set(submissions.map(s => s.challenge_id).filter(Boolean))]
  const { data: challenges } = await supabase
    .from('daily_challenges')
    .select('id, title, description')
    .in('id', challengeIds)

  const challengeMap = new Map(challenges?.map(c => [c.id, c]) ?? [])

  // Get Henry's comments on these submissions
  const submissionIds = submissions.map(s => s.id)
  const { data: comments } = await supabase
    .from('submission_comments')
    .select('submission_id, content, created_at, user_id')
    .in('submission_id', submissionIds)
    .order('created_at', { ascending: true })

  // Group comments by submission
  const commentsBySubmission = new Map<string, string[]>()
  for (const c of comments ?? []) {
    const list = commentsBySubmission.get(c.submission_id) ?? []
    list.push(c.content)
    commentsBySubmission.set(c.submission_id, list)
  }

  // Build structured examples
  return submissions.map(s => {
    const challenge = challengeMap.get(s.challenge_id)
    const teacherComments = commentsBySubmission.get(s.id) ?? []
    return {
      challenge_title: challenge?.title ?? 'Unknown challenge',
      challenge_description: challenge?.description ?? '',
      submission: s.content,
      score: s.points,
      teacher_comments: teacherComments,
    }
  }).filter(e => e.challenge_title !== 'Unknown challenge')
}

// ── Generate grading-style.md ─────────────────────────────────────────────────

async function generateGradingStyle(examples: any[]) {
  console.log('\nGenerating grading-style.md from', examples.length, 'examples...')

  // Sample up to 50 diverse examples for the style inference
  const sample = examples.slice(0, 50)

  const examplesText = sample.map((e, i) => `
Example ${i + 1}:
  Problem: ${e.challenge_title}
  ${e.challenge_description ? `Description: ${e.challenge_description.slice(0, 200)}` : ''}
  Student submission: ${e.submission.slice(0, 500)}
  Score given: ${e.score} points
  ${e.teacher_comments.length > 0 ? `Teacher's comments: ${e.teacher_comments.join(' | ')}` : '(no comments)'}
`).join('\n---\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are analyzing a teacher's grading patterns to extract their grading philosophy and style.
You will be given examples of student submissions with the scores the teacher gave and any comments.
Your job is to infer the teacher's grading style and write it as a clear, actionable guide for an AI grading assistant.

Output a markdown document with these sections:
1. Philosophy — what this teacher values most when grading
2. Point Distribution Guidelines — how they distribute points across setup, work, and final answer
3. Partial Credit Rules — patterns in how they award partial credit
4. What to Flag for Review — situations where a human should double-check

Be specific and concrete. Use patterns you observe in the examples, not generic advice.
Write in first person as if explaining "how I grade" to the AI assistant.`
      },
      {
        role: 'user',
        content: `Here are ${sample.length} graded examples from this teacher. Analyze the patterns and write the grading style guide.\n\n${examplesText}`
      }
    ],
    max_tokens: 2000,
  })

  return response.choices[0].message.content ?? ''
}

// ── Generate correction-log.md ────────────────────────────────────────────────

async function generateCorrectionLog(examples: any[]) {
  console.log('\nGenerating correction-log.md...')

  // Use examples that have teacher comments — those are the most informative
  const withComments = examples.filter(e => e.teacher_comments.length > 0).slice(0, 100)
  console.log(`  Using ${withComments.length} examples with teacher comments`)

  if (withComments.length === 0) {
    return `# Correction Log\n\n*(No corrections yet — log grows as Henry reviews AI grades)*\n`
  }

  const entries = withComments.map((e, i) => `
### Example #${i + 1} — Bootstrapped from existing grades
**Problem**: ${e.challenge_title}
**Student submission**: ${e.submission.slice(0, 400)}${e.submission.length > 400 ? '...' : ''}
**Henry's grade**: ${e.score} points
**Henry's comments**: ${e.teacher_comments.join(' | ')}
`).join('\n---\n')

  return `# Correction Log

This file records Henry's grading decisions as examples for the AI.
The first batch was bootstrapped from existing graded submissions in the database.
New entries are added automatically when Henry overrides an AI grade.

---

${entries}
`
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== TA Agent Knowledge Bootstrap ===\n')

  try {
    // 1. Fetch data
    const examples = await fetchGradedSubmissions()

    if (examples.length === 0) {
      console.log('\nNo graded submissions found in the database.')
      console.log('Bootstrap skipped — the knowledge files need to be written manually first.')
      console.log('Once students have submitted and Henry has graded, run this script again.')
      process.exit(0)
    }

    // 2. Generate grading-style.md
    const gradingStyleContent = await generateGradingStyle(examples)
    const gradingStylePath = path.join(OUT_DIR, 'grading-style.md')

    // Prepend a header explaining the file was bootstrapped
    const gradingStyleFull = `# Henry's Grading Style Guide

> This file was bootstrapped by analyzing ${examples.length} existing graded submissions.
> It should be reviewed and edited by Henry to ensure accuracy.
> Last bootstrapped: ${new Date().toISOString().split('T')[0]}

---

${gradingStyleContent}
`

    fs.writeFileSync(gradingStylePath, gradingStyleFull, 'utf-8')
    console.log(`\n✅ Written: ${gradingStylePath}`)

    // 3. Generate correction-log.md
    const correctionLogContent = await generateCorrectionLog(examples)
    const correctionLogPath = path.join(OUT_DIR, 'correction-log.md')
    fs.writeFileSync(correctionLogPath, correctionLogContent, 'utf-8')
    console.log(`✅ Written: ${correctionLogPath}`)

    console.log('\n=== Bootstrap complete ===')
    console.log('\nNext steps:')
    console.log('1. Review TA-agent/grading-style.md — edit anything that looks wrong')
    console.log('2. Skim TA-agent/correction-log.md — remove any examples with sensitive content')
    console.log('3. Run the grading API to start grading new submissions')

  } catch (err: any) {
    console.error('\nBootstrap failed:', err.message)
    process.exit(1)
  }
}

main()
