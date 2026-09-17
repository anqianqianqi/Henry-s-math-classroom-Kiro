/**
 * GET  /api/mega  — list mega workflows for the current user
 * POST /api/mega  — create a new workflow from a challenge
 *
 * POST body: {
 *   source: 'daily_challenge' | 'bank_item'
 *   challenge_id?: string   (required when source = 'daily_challenge')
 *   bank_item_id?: string   (required when source = 'bank_item')
 * }
 *
 * Auth: teacher/admin session token — same dual-token pattern as /api/ta/grade
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const maxDuration = 30

// ── Auth helper ───────────────────────────────────────────────────────────

async function authenticate(req: NextRequest): Promise<{ userId: string; supabase: ReturnType<typeof createClient> } | NextResponse> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const supabaseUser = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { data: roles } = await supabase
    .from('user_roles').select('roles!inner(name)').eq('user_id', user.id).is('class_id', null)
  const isTeacher = (roles as any[])?.some((r: any) =>
    ['teacher', 'administrator'].includes(r.roles?.name)
  )
  if (!isTeacher) return NextResponse.json({ error: 'Teacher only' }, { status: 403 })

  return { userId: user.id, supabase }
}

// ── GET — list workflows ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await authenticate(req)
  if (auth instanceof NextResponse) return auth

  const { data, error } = await auth.supabase
    .from('mega_workflows')
    .select('id, challenge_title, status, created_at, updated_at, challenge_id, bank_item_id')
    .eq('created_by', auth.userId)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, workflows: data })
}

// ── POST — create workflow ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await authenticate(req)
  if (auth instanceof NextResponse) return auth

  let body: { source: 'daily_challenge' | 'bank_item'; challenge_id?: string; bank_item_id?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const { source, challenge_id, bank_item_id } = body
  if (source === 'daily_challenge' && !challenge_id)
    return NextResponse.json({ error: 'challenge_id required' }, { status: 400 })
  if (source === 'bank_item' && !bank_item_id)
    return NextResponse.json({ error: 'bank_item_id required' }, { status: 400 })
  if (!source)
    return NextResponse.json({ error: 'source required' }, { status: 400 })

  // Fetch challenge snapshot
  let title = '', description = '', imageUrl: string | null = null

  if (source === 'daily_challenge') {
    const { data, error } = await auth.supabase
      .from('daily_challenges')
      .select('title, description, image_url')
      .eq('id', challenge_id!)
      .single()
    if (error || !data) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    title = data.title
    description = data.description ?? ''
    imageUrl = data.image_url ?? null
  } else {
    const { data, error } = await auth.supabase
      .from('challenge_bank')
      .select('title, description, image_url')
      .eq('id', bank_item_id!)
      .single()
    if (error || !data) return NextResponse.json({ error: 'Challenge bank item not found' }, { status: 404 })
    title = data.title
    description = data.description ?? ''
    imageUrl = data.image_url ?? null
  }

  const { data: workflow, error: insertErr } = await auth.supabase
    .from('mega_workflows')
    .insert({
      challenge_id:       source === 'daily_challenge' ? challenge_id : null,
      bank_item_id:       source === 'bank_item'       ? bank_item_id : null,
      created_by:         auth.userId,
      challenge_title:    title,
      challenge_body:     description,
      challenge_image_url: imageUrl,
      status:             'step1_pending',
    })
    .select('id')
    .single()

  if (insertErr || !workflow)
    return NextResponse.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500 })

  return NextResponse.json({ ok: true, workflow_id: workflow.id }, { status: 201 })
}
