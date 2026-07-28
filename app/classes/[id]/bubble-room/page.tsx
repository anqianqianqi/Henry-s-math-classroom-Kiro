/**
 * Bubble Room Q&A — Next.js Server Component route.
 *
 * Route: /classes/[id]/bubble-room
 *
 * Responsibilities:
 *  - Authenticate user; redirect to /login if unauthenticated (Req 8.2)
 *  - Fetch initial BubbleQuestion[] server-side for SSR hydration
 *  - Resolve currentUserId, currentUserRole, currentUserDisplayName
 *  - Render <BubbleRoomPage> with initial props
 *  - Accept optional ?challengeId= query param (Req 1.3)
 *
 * Requirements: 8.2
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BubbleRoomPage } from '@/components/bubble-room/BubbleRoomPage'
import { fetchInitialQuestions } from '@/lib/actions/bubbleRoom'

interface BubbleRoomRouteProps {
  params: { id: string }
  searchParams: { challengeId?: string }
}

export default async function BubbleRoomRoute({
  params,
  searchParams,
}: BubbleRoomRouteProps) {
  const supabase = createClient()

  // ── Auth check (Req 8.2) ──────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // ── Resolve display name ──────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, nickname')
    .eq('id', user.id)
    .maybeSingle()

  const displayName =
    (profile as any)?.nickname ?? (profile as any)?.full_name ?? 'Unknown'

  // ── Resolve role ──────────────────────────────────────────────────────────
  let currentUserRole: 'teacher' | 'student' = 'student'
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('roles ( name )')
    .eq('user_id', user.id)
    .is('class_id', null)

  const isTeacher = (userRoles ?? []).some((r: any) => {
    const name = r.roles?.name as string | undefined
    return name === 'teacher' || name === 'administrator'
  })

  if (isTeacher) {
    currentUserRole = 'teacher'
  }

  // ── Fetch initial questions (SSR hydration) ───────────────────────────────
  const initialQuestions = await fetchInitialQuestions()

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <BubbleRoomPage
      initialQuestions={initialQuestions}
      currentUserId={user.id}
      currentUserRole={currentUserRole}
      currentUserDisplayName={displayName}
      initialChallengeId={searchParams.challengeId ?? null}
    />
  )
}
