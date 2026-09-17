/**
 * The Studio's gate.
 *
 * Two locks, checked on the server before a byte of the desk renders:
 *
 *   1. STUDIO_ENABLED=1 in the environment. `npm run studio` sets it on the
 *      teacher's machine; nothing sets it on Vercel, so on the deployed site
 *      this whole route group is a 404, not a hidden page.
 *   2. A signed-in teacher or administrator. Anyone else also gets the 404,
 *      because a "forbidden" would confirm there is something here.
 *
 * The worksheet palette is set here as CSS variables, from the same source the
 * printed sheet uses (lib/henry-theme), so the desk and the paper it shows are
 * one object rather than a green-and-blue tool holding a cream page.
 */

import type { CSSProperties } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { henryPalette } from '@/lib/henry-theme'

export const dynamic = 'force-dynamic'

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  if (process.env.STUDIO_ENABLED !== '1') notFound()

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // The desk opens in a window with no address bar, so login has to bring people back here.
  if (!user) redirect('/login?next=/studio')

  const { data: roles } = await supabase
    .from('user_roles')
    .select('roles!inner(name)')
    .eq('user_id', user.id)
    .is('class_id', null)
  const isTeacher = ((roles as any[] | null) || []).some(
    (r: any) => r.roles?.name === 'teacher' || r.roles?.name === 'administrator'
  )
  if (!isTeacher) notFound()

  const palette = {
    '--sd-paper': henryPalette.paper,
    '--sd-card': henryPalette.card,
    '--sd-ink': henryPalette.ink,
    '--sd-muted': henryPalette.muted,
    '--sd-rule': henryPalette.border,
    '--sd-green': henryPalette.green,
    '--sd-orange': henryPalette.orange,
    '--sd-yellow': henryPalette.yellow,
    '--sd-mint': henryPalette.mint,
    '--sd-rose': henryPalette.rose,
    '--sd-blue': henryPalette.blue,
  } as CSSProperties

  return (
    <div className="studio" style={palette}>
      {children}
    </div>
  )
}
