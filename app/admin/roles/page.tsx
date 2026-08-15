'use client'

/**
 * Role management moved into User History.
 *
 * The two pages ran nearly the same query — every profile joined to its global
 * user_roles rows — and showed the same people twice: once as a roster with
 * submission counts, once as a list of role chips. Adding a user and changing
 * what someone is now live beside the history of what they have done, which is
 * the context a teacher actually decides in.
 *
 * Kept as a redirect rather than deleted: this path is linked from elsewhere
 * and sits in people's history and bookmarks, and a 404 teaches nothing about
 * where the feature went.
 */

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminRolesRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/students') }, [router])
  return null
}
