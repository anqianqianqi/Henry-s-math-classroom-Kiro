'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Card } from '@/components/ui/Card'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

export default function SignUpPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'))
      return
    }

    if (password.length < 6) {
      setError(t('auth.passwordTooShort'))
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          nickname: nickname.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? t('auth.unexpectedError'))
        return
      }

      setEmailSent(true)
    } catch (err) {
      setError(t('auth.unexpectedError'))
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-start justify-center bg-gray-50 px-4 py-16 pt-[max(4rem,calc(env(safe-area-inset-top)+1rem))]">
      <div className="w-full max-w-md">
        <a
          href="/login"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 py-2 px-3 -ml-3 rounded-lg active:bg-gray-100"
        >
          ← {t('action.back')}
        </a>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {t('auth.appName')}
          </h1>
          <p className="mt-2 text-gray-600">{t('auth.signUpSubtitle')}</p>
        </div>

        {emailSent ? (
          <Card>
            <Card.Body>
              <div className="text-center py-6 space-y-4">
                <span className="text-5xl">📧</span>
                <h2 className="text-xl font-semibold text-gray-900">{t('auth.checkEmail')}</h2>
                <p className="text-gray-600">
                  {t('auth.confirmationSent', { email })}
                </p>
                <p className="text-sm text-gray-500">
                  {t('auth.didNotReceive')}
                </p>
                <a href="/login" className="text-blue-600 hover:underline text-sm">
                  {t('auth.goToSignIn')}
                </a>
              </div>
            </Card.Body>
          </Card>
        ) : (
        <Card>
          <Card.Body>
            <form onSubmit={handleSignUp} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label={t('auth.firstName')}
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  required
                />

                <FormField
                  label={t('auth.lastName')}
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  required
                />
              </div>

              <FormField
                label={t('auth.nickname')}
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Johnny"
                helperText={t('auth.nicknameHint')}
              />

              <FormField
                label={t('auth.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />

              <FormField
                label={t('auth.password')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                helperText={t('auth.passwordHint')}
                required
              />

              <FormField
                label={t('auth.confirmPassword')}
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
                {t('auth.createAccount')}
              </Button>
            </form>
          </Card.Body>
          <Card.Footer>
            <p className="text-sm text-center text-gray-600">
              {t('auth.haveAccount')}{' '}
              <a href="/login" className="text-blue-600 hover:underline">
                {t('auth.signIn')}
              </a>
            </p>
          </Card.Footer>
        </Card>
        )}
      </div>
    </div>
  )
}
