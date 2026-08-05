'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

function CallbackHandler() {
  const { t } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const code = searchParams.get('code')
    const next = searchParams.get('next') || '/dashboard'

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(() => {
        router.push(next)
      })
    } else {
      router.push(next)
    }
  }, [])

  return <p className="text-gray-600">{t('auth.signingIn')}</p>
}

export default function AuthCallback() {
  const { t } = useLanguage()
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Suspense fallback={<p className="text-gray-600">{t('status.loading')}</p>}>
        <CallbackHandler />
      </Suspense>
    </div>
  )
}
