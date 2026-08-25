'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { OceanAuthShell } from '@/components/auth/OceanAuthShell'
import { ArrowLeft, MailCheck } from 'lucide-react'

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
    <OceanAuthShell>
      <div className="w-full max-w-lg">
        <a
          href="/login"
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/12 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-cyan-950/20 backdrop-blur-md transition hover:bg-white/20"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('action.back')}
        </a>

        {emailSent ? (
          <div className="landing-auth-card overflow-hidden rounded-lg border border-white/30 bg-white/76 shadow-2xl shadow-cyan-950/35 backdrop-blur-xl">
            <div className="px-6 py-10 text-center">
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[#8fe6d2] text-[#08314d] shadow-[0_5px_0_rgba(3,74,87,0.22)]">
                <MailCheck className="h-8 w-8" aria-hidden="true" />
              </div>
              <div className="space-y-4">
                <h1 className="text-3xl font-black leading-tight text-[#08314d]">{t('auth.checkEmail')}</h1>
                <p className="font-semibold leading-6 text-cyan-950/72">
                  {t('auth.confirmationSent', { email })}
                </p>
                <p className="text-sm font-semibold text-cyan-950/58">
                  {t('auth.didNotReceive')}
                </p>
                <a href="/login" className="landing-auth-submit inline-flex rounded-full px-5 py-2.5 text-sm font-black text-[#13334c] shadow-[0_4px_0_rgba(110,71,0,0.2)] transition">
                  {t('auth.goToSignIn')}
                </a>
              </div>
            </div>
          </div>
        ) : (
        <div className="landing-auth-card overflow-hidden rounded-lg border border-white/30 bg-white/76 shadow-2xl shadow-cyan-950/35 backdrop-blur-xl">
          <div className="border-b border-cyan-900/10 px-6 py-6 text-center">
            <h1 className="text-3xl font-black leading-tight text-[#08314d]">
              {t('auth.appName')}
            </h1>
            <p className="mt-2 text-sm font-semibold text-cyan-900/70">{t('auth.signUpSubtitle')}</p>
          </div>

          <div className="px-6 py-5">
            <form onSubmit={handleSignUp} className="space-y-4 landing-auth-form">
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
                className="w-full !rounded-full !text-[#13334c] focus:!ring-[#ffd166]"
              >
                {t('auth.createAccount')}
              </Button>
            </form>
          </div>

          <div className="border-t border-cyan-900/10 bg-cyan-50/65 px-6 py-4">
            <p className="text-center text-sm font-semibold text-cyan-950/70">
              {t('auth.haveAccount')}{' '}
              <a href="/login" className="text-[#087579] hover:underline">
                {t('auth.signIn')}
              </a>
            </p>
          </div>
        </div>
        )}
      </div>
    </OceanAuthShell>
  )
}
