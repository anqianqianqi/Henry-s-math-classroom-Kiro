'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { OceanAuthShell } from '@/components/auth/OceanAuthShell'
import { ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      if (data.user) {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      setError(t('auth.unexpectedError'))
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <OceanAuthShell>
      <div className="w-full max-w-md">
        <a
          href="/"
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/12 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-cyan-950/20 backdrop-blur-md transition hover:bg-white/20"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('action.back')}
        </a>

        <div className="landing-auth-card overflow-hidden rounded-lg border border-white/30 bg-white/76 shadow-2xl shadow-cyan-950/35 backdrop-blur-xl">
          <div className="border-b border-cyan-900/10 px-6 py-6 text-center">
            <h1 className="text-3xl font-black leading-tight text-[#08314d]">
              {t('auth.appName')}
            </h1>
            <p className="mt-2 text-sm font-semibold text-cyan-900/70">{t('auth.signInSubtitle')}</p>
          </div>

          <div className="px-6 py-5">
            <form onSubmit={handleLogin} className="space-y-4 landing-auth-form">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

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
                required
              />

              <div className="text-right -mt-2">
                <a href="/forgot-password" className="text-sm font-semibold text-[#087579] hover:underline">
                  {t('auth.forgotPassword')}
                </a>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                className="w-full !rounded-full !text-[#13334c] focus:!ring-[#ffd166]"
              >
                {t('auth.signIn')}
              </Button>
            </form>
          </div>

          <div className="border-t border-cyan-900/10 bg-cyan-50/65 px-6 py-4">
            <p className="text-center text-sm font-semibold text-cyan-950/70">
              {t('auth.noAccount')}{' '}
              <a href="/signup" className="text-[#087579] hover:underline">
                {t('auth.signUpLink')}
              </a>
            </p>
          </div>
        </div>
      </div>
    </OceanAuthShell>
  )
}
