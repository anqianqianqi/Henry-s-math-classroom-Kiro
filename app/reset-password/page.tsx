'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Card } from '@/components/ui/Card'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    // Supabase puts tokens in the URL hash — onAuthStateChange picks them up
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true)
      }
    })
    // Also check if already has a session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
    // If no session after 3 seconds, redirect
    const timeout = setTimeout(() => {
      if (!ready) router.push('/forgot-password')
    }, 3000)
    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError(t('auth.passwordTooShort'))
      return
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'))
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError(updateError.message)
        return
      }

      // Success — redirect to dashboard
      router.push('/dashboard')
    } catch (err) {
      setError(t('auth.unexpectedError'))
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">{t('auth.verifyingLink')}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <a
          href="/login"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 py-2 px-3 -ml-3 rounded-lg active:bg-gray-100"
        >
          ← {t('action.back')}
        </a>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('auth.appName')}</h1>
          <p className="mt-2 text-gray-600">{t('auth.setNewPassword')}</p>
        </div>

        <Card>
          <Card.Body>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <FormField
                label={t('auth.newPassword')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                helperText={t('auth.passwordHint')}
                required
              />

              <FormField
                label={t('auth.confirmNewPassword')}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                className="w-full"
              >
                {t('auth.updatePassword')}
              </Button>
            </form>
          </Card.Body>
        </Card>
      </div>
    </div>
  )
}
