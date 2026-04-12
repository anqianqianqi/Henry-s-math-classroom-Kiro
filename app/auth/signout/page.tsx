'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOut() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.signOut().then(() => {
      router.push('/')
    })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-600">Signing out...</p>
    </div>
  )
}
