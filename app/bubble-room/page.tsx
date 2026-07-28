/**
 * Global Bubble Room — Next.js Server Component route.
 * Route: /bubble-room
 *
 * Universal Q&A room not scoped to any specific class.
 * All authenticated users see the same floating bubble stream.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BubbleRoomPage } from '@/components/bubble-room/BubbleRoomPage'
import { fetchInitialQuestions } from '@/lib/actions/bubbleRoom'

interface BubbleRoomRouteProps {
  searchParams: { challengeId?: string }
}

export default async function GlobalBubbleRoomRoute({
  searchParams,
}: BubbleRoomRouteProps) {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, nickname')
    .eq('id', user.id)
    .maybeSingle()

  const displayName =
    (profile as any)?.nickname ?? (profile as any)?.full_name ?? 'Unknown'

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
  if (isTeacher) currentUserRole = 'teacher'

  const initialQuestions = await fetchInitialQuestions()

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
