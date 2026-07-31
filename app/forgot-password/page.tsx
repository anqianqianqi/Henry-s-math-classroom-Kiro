'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Card } from '@/components/ui/Card'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

export default function ForgotPasswordPage() {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/reset-password`,
      })

      if (resetError) {
        setError(resetError.message)
        return
      }

      setSent(true)
    } catch (err) {
      setError(t('auth.unexpectedError'))
      console.error(err)
    } finally {
      setIsLoading(false)
    }
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
          <p className="mt-2 text-gray-600">{t('auth.resetSubtitle')}</p>
        </div>

        <Card>
          <Card.Body>
            {sent ? (
              <div className="text-center py-4 space-y-3">
                <div className="text-4xl">📧</div>
                <h2 className="text-lg font-semibold text-gray-900">{t('auth.checkEmail')}</h2>
                <p className="text-gray-600 text-sm">
                  {t('auth.resetSent', { email })}
                </p>
                <p className="text-xs text-gray-400">{t('auth.didNotGetIt')}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <p className="text-sm text-gray-600">
                  {t('auth.resetIntro')}
                </p>

                <FormField
                  label={t('auth.email')}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoading}
                  className="w-full"
                >
                  {t('auth.sendResetLink')}
                </Button>
              </form>
            )}
          </Card.Body>
          <Card.Footer>
            <p className="text-sm text-center text-gray-600">
              {t('auth.rememberPassword')}{' '}
              <a href="/login" className="text-blue-600 hover:underline">
                {t('auth.signIn')}
              </a>
            </p>
          </Card.Footer>
        </Card>
      </div>
    </div>
  )
}
