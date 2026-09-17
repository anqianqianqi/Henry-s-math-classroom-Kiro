/**
 * GET /api/mega/[id] — fetch full workflow state
 * Auth: teacher sees own, admin sees all
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const maxDuration = 30

async function authenticate(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return null
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const supabaseUser = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return null
  const { data: roles } = await supabase
    .from('user_roles').select('roles!inner(name)').eq('user_id', user.id).is('class_id', null)
  const isTeacher = (roles as any[])?.some((r: any) =>
    ['teacher', 'administrator'].includes(r.roles?.name)
  )
  if (!isTeacher) return null
  const isAdmin = (roles as any[])?.some((r: any) => r.roles?.name === 'administrator')
  return { userId: user.id, isAdmin, supabase }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticate(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await auth.supabase
    .from('mega_workflows')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })

  // Access control: teacher can only see their own unless admin
  if (data.created_by !== auth.userId && !auth.isAdmin) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, workflow: data })
}
