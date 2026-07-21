/**
 * POST /api/ta/bootstrap
 *
 * One-time bootstrap: pulls all graded submissions + Henry's comments
 * from the database, feeds them to GPT-4o, and writes:
 *   - TA-agent/grading-style.md
 *   - TA-agent/correction-log.md
 *
 * Only callable by admin. Writes files to the filesystem (works locally
 * and on Vercel — on Vercel the files will be written to /tmp and
 * returned as JSON since the filesystem is read-only there).
 *
 * Call once from the admin panel or with:
 *   curl -X POST https://your-site.com/api/ta/bootstrap \
 *     -H "Authorization: Bearer <your-session-token>"
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const OPENAI_KEY  = process.env.OPENAI_API_KEY!

// Where the knowledge files live relative to project root
const TA_DIR = join(process.cwd(), 'TA-agent')

// ── Fetch graded data ──────────────────────────────────────────────────────

async function fetchGradedSubmissions(supabase: any) {
  const { data: submissions, error } = await supabase
    .from('challenge_submissions')
    .select('id, content, points, submitted_at, challenge_id')
    .not('points', 'is', null)
    .order('submitted_at', { ascending: false })
    .limit(200)

  if (error) throw new Error('fetch submissions: ' + error.message)
  if (!submissions?.length) return []

  const challengeIds = [...new Set(submissions.map((s: any) => s.challenge_id).filter(Boolean))]
  const { data: challenges } = await supabase
    .from('daily_challenges')
    .select('id, title, description')
    .in('id', challengeIds)

  const challengeMap = new Map((challenges ?? []).map((c: any) => [c.id, c]))

  const subIds = submissions.map((s: any) => s.id)
  const { data: comments } = await supabase
    .from('submission_comments')
    .select('submission_id, content, created_at')
    .in('submission_id', subIds)
    .order('created_at', { ascending: true })

  const commentMap = new Map<string, string[]>()
  for (const c of comments ?? []) {
    const list = commentMap.get(c.submission_id) ?? []
    list.push(c.content)
    commentMap.set(c.submission_id, list)
  }

  return submissions
    .map((s: any) => {
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
}

// ── Generate grading-style.md via GPT-4o ──────────────────────────────────

async function generateGradingStyle(examples: any[]) {
  const sample = examples.slice(0, 60)

  const exText = sample.map((e: any, i: number) => [
    `[Example ${i + 1}]`,
    `Problem: ${e.challenge_title}`,
    e.challenge_description ? `Context: ${String(e.challenge_description).slice(0, 200)}` : null,
    `Submission: ${String(e.submission).slice(0, 400)}`,
    `Score: ${e.score} points`,
    e.teacher_comments.length
      ? `Teacher comments: ${(e.teacher_comments as string[]).join(' | ')}`
      : '(no comments)',
  ].filter(Boolean).join('\n')).join('\n\n---\n\n')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are analyzing a math teacher's grading history to infer their grading philosophy.
You will receive examples of student submissions with scores and optional feedback comments.
Write a clear, specific grading style guide for an AI assistant that will grade on this teacher's behalf.

Output markdown with these sections:
## Philosophy
## Point Distribution Guidelines
## Partial Credit Rules
## How the Teacher Uses Comments
## What Leads to Higher Scores
## What Leads to Deductions

Be specific — cite patterns actually observed. Write as "this teacher" explaining their style.`,
        },
        {
          role: 'user',
          content: `Analyze these ${sample.length} graded examples and write the grading style guide:\n\n${exText}`,
        },
      ],
      max_tokens: 2500,
    }),
  })

  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json.choices[0].message.content as string
}

// ── Build correction-log.md ────────────────────────────────────────────────

function buildCorrectionLog(examples: any[]) {
  const withComments = examples.filter((e: any) => e.teacher_comments.length > 0).slice(0, 120)

  if (withComments.length === 0) {
    return `# Correction Log\n\n*(Will grow as Henry reviews AI grades)*\n`
  }

  const today = new Date().toISOString().split('T')[0]
  const entries = withComments.map((e: any, i: number) => {
    const sub = String(e.submission).length > 500
      ? String(e.submission).slice(0, 500) + '…'
      : String(e.submission)
    return [
      `### Example #${i + 1} — Bootstrapped ${today}`,
      `**Problem**: ${e.challenge_title}`,
      `**Student submission**: ${sub}`,
      `**Henry's grade**: ${e.score} points`,
      `**Henry's comments**: ${(e.teacher_comments as string[]).join(' | ')}`,
    ].join('\n')
  }).join('\n\n---\n\n')

  return `# Correction Log

The ground truth the AI learns from. Bootstrapped from existing graded submissions.
New entries are added automatically when Henry overrides an AI grade.

---

${entries}
`
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Basic auth check — only admin can run bootstrap
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY)

  // Verify the caller is an admin via their token
  const token = authHeader.replace('Bearer ', '')
  const supabaseUser = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { data: roles } = await supabaseAdmin
    .from('user_roles')
    .select('roles!inner(name)')
    .eq('user_id', user.id)
    .is('class_id', null)

  const isAdmin = (roles as any[])?.some((r: any) => r.roles?.name === 'administrator')
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  try {
    // 1. Fetch data
    const examples = await fetchGradedSubmissions(supabaseAdmin)

    if (examples.length === 0) {
      return NextResponse.json({
        ok: false,
        message: 'No graded submissions found yet. Grade some submissions first, then run bootstrap.',
        count: 0,
      })
    }

    // 2. Generate grading-style.md
    const gradingStyle = await generateGradingStyle(examples)
    const today = new Date().toISOString().split('T')[0]
    const gradingStyleFull = [
      `# Henry's Grading Style Guide`,
      ``,
      `> Auto-generated on ${today} from ${examples.length} graded submissions.`,
      `> Review and edit anything that looks wrong.`,
      ``,
      `---`,
      ``,
      gradingStyle,
    ].join('\n')

    // 3. Build correction-log.md
    const correctionLog = buildCorrectionLog(examples)

    // 4. Write files (works locally; on Vercel returns content as JSON instead)
    const isVercel = process.env.VERCEL === '1'
    let writtenFiles: string[] = []

    if (!isVercel) {
      writeFileSync(join(TA_DIR, 'grading-style.md'), gradingStyleFull, 'utf-8')
      writeFileSync(join(TA_DIR, 'correction-log.md'), correctionLog, 'utf-8')
      writtenFiles = ['TA-agent/grading-style.md', 'TA-agent/correction-log.md']
    }

    return NextResponse.json({
      ok: true,
      examples_used: examples.length,
      examples_with_comments: examples.filter((e: any) => e.teacher_comments.length > 0).length,
      written_files: isVercel ? [] : writtenFiles,
      // Return content so you can see/copy it even on Vercel
      grading_style_md: gradingStyleFull,
      correction_log_md: correctionLog,
      note: isVercel
        ? 'Running on Vercel — files not written to disk. Copy the content above into the TA-agent/ directory.'
        : 'Files written to disk. Review them before using the TA agent.',
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
