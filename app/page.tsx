'use client'

/**
 * Public landing page — the only screen a signed-out visitor sees.
 *
 * A client component purely so it can translate. It was the last page in the
 * app left in hardcoded English, and it is the first thing a Chinese-speaking
 * parent or student lands on.
 */

import { useLanguage } from '@/lib/i18n/LanguageProvider'

export default function Home() {
  const { t } = useLanguage()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-24">
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-4">
          {t('auth.appName')}
        </h1>
        <p className="text-lg sm:text-xl text-gray-600">
          {t('auth.landingTagline')}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/login"
            className="block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-center"
          >
            {t('auth.login')}
          </a>
          <a
            href="/signup"
            className="block px-6 py-3 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition text-center"
          >
            {t('auth.signUp')}
          </a>
        </div>
      </div>
    </main>
  )
}
