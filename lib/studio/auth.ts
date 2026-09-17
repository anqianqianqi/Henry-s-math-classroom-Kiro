/**
 * Who may use the Studio routes, decided once for all of them.
 *
 * Two ways in, in this order:
 *
 *   1. The import key, STUDIO_IMPORT_KEY, as the Bearer token. Meant for an
 *      app that should work with one click and no sign-in. The caller then
 *      acts as STUDIO_IMPORT_TEACHER, given as a user id or an email, and the
 *      writes use the service role because there is no session to carry them.
 *      The key is a teacher's full power over the routes that accept it, so
 *      it lives only in the site environment and in the app that needs it.
 *   2. A teacher's Supabase access token. Every write then runs as that
 *      teacher under the site's own row-level policies.
 *
 * These routes read only the Authorization header and never a cookie, which
 * is why they can answer cross-origin requests from anywhere without opening
 * a hole: a browser cannot make a signed-in call here by accident.
 *
 * Environment is read at call time rather than at import, so a test can set
 * it per case and a missing variable is a missing variable, not a stale one.
 */

import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type StudioDb = SupabaseClient<any, any, any>

export interface StudioCaller {
  supabase: StudioDb
  userId: string
  /** True when the import key let the caller in, false for a teacher's own token. */
  viaKey: boolean
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Safe to open wide: nothing here is authorised by a cookie. */
export const STUDIO_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
}

export function studioJson(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: STUDIO_CORS })
}

export function studioFail(message: string, status: number) {
  return studioJson({ error: message }, status)
}

export function studioPreflight() {
  return new NextResponse(null, { status: 204, headers: STUDIO_CORS })
}

export function bearerToken(req: NextRequest): string {
  const header = req.headers.get('authorization') || ''
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
}

export function isTeacherRole(roles: unknown): boolean {
  return ((roles as any[] | null) || []).some(
    (r: any) => r.roles?.name === 'teacher' || r.roles?.name === 'administrator'
  )
}

/** Constant-time, so a wrong key takes as long to refuse as a nearly right one. */
export function isImportKey(token: string): boolean {
  const expected = process.env.STUDIO_IMPORT_KEY || ''
  if (!expected || !token) return false
  const given = Buffer.from(token)
  const wanted = Buffer.from(expected)
  return given.length === wanted.length && timingSafeEqual(given, wanted)
}

/** The import key's teacher: STUDIO_IMPORT_TEACHER as an id, or looked up by email. */
async function importTeacher(supabase: StudioDb): Promise<string | NextResponse> {
  const configured = (process.env.STUDIO_IMPORT_TEACHER || '').trim()
  if (!configured) {
    return studioFail('The import key is set, but STUDIO_IMPORT_TEACHER is not. Set it to the teacher the uploads belong to.', 500)
  }
  let userId = configured
  if (!UUID.test(configured)) {
    const { data } = await supabase.from('profiles').select('id').eq('email', configured.toLowerCase()).maybeSingle()
    if (!data?.id) return studioFail(`STUDIO_IMPORT_TEACHER names ${configured}, but no account has that email.`, 500)
    userId = String((data as any).id)
  }
  const { data: roles } = await supabase
    .from('user_roles')
    .select('roles!inner(name)')
    .eq('user_id', userId)
    .is('class_id', null)
  if (!isTeacherRole(roles)) return studioFail('STUDIO_IMPORT_TEACHER is not a teacher or administrator.', 500)
  return userId
}

/** A client acting as the caller, plus who they are, or the refusal. */
export async function authenticateStudio(req: NextRequest): Promise<StudioCaller | NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const token = bearerToken(req)
  if (!token) return studioFail('Sign in first and send the access token as a Bearer token, or send the import key.', 401)

  if (isImportKey(token)) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!serviceKey) return studioFail('The import key needs SUPABASE_SERVICE_ROLE_KEY in the site environment.', 500)
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const teacher = await importTeacher(supabase)
    if (teacher instanceof NextResponse) return teacher
    return { supabase, userId: teacher, viaKey: true }
  }

  const supabase = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return studioFail('This token is not valid or has expired. Sign in again.', 401)

  const { data: roles } = await supabase
    .from('user_roles')
    .select('roles!inner(name)')
    .eq('user_id', user.id)
    .is('class_id', null)
  if (!isTeacherRole(roles)) return studioFail('Only teachers can use this.', 403)

  return { supabase, userId: user.id, viaKey: false }
}
