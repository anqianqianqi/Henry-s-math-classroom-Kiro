// app/api/pet/login-xp/route.ts
// Called once per session on page load to grant the daily login XP bonus.
// Delegates to the grant_daily_login_xp() Supabase RPC which is fully idempotent
// (safe to call multiple times — only grants XP once per calendar day).
//
// Returns:
//   { already_granted: true }                    — already got XP today
//   { already_granted: false, xp_gained, new_xp, new_stage, streak, freeze_used }

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase.rpc('grant_daily_login_xp')

    if (error) {
      // If the RPC doesn't exist yet (migration not run), return gracefully
      if (error.message?.includes('does not exist') || error.code === '42883') {
        return NextResponse.json({ already_granted: true, note: 'migration_pending' }, { status: 200 })
      }
      console.error('[pet/login-xp] RPC error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json(data ?? { already_granted: true }, { status: 200 })
  } catch (err) {
    console.error('[pet/login-xp] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
