import 'server-only'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function requireMangaTeacher() {
  const supabase = createRouteHandlerClient({ cookies }) as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('UNAUTHORIZED')
  const { data: roles } = await supabase.from('user_roles').select('roles!inner(name)').eq('user_id', session.user.id).is('class_id', null)
  if (!roles?.some((row: any) => row.roles?.name === 'teacher' || row.roles?.name === 'administrator')) throw new Error('FORBIDDEN')
  return { user: session.user, supabase }
}

export function mangaServiceDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service configuration is missing')
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function mangaError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Manga workflow failed'
  const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 400
  return { message, status }
}
