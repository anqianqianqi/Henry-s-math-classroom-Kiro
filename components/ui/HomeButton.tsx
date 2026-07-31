'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

/**
 * Brand home link for page headers — matches the PageHeader "Henry's Math" style.
 * Green (primary-600), no arrow, links to /dashboard.
 * Without noSlash: renders "/ Henry's Math" as a breadcrumb separator.
 * With noSlash: renders just "Henry's Math".
 */
export function HomeButton({ noSlash = false }: { noSlash?: boolean }) {
  const { t } = useLanguage()
  if (noSlash) {
    return (
      <Link
        href="/dashboard"
        className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
      >
        {t('auth.appNameShort')}
      </Link>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-sm">
      <svg className="w-3 h-3 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
      <Link
        href="/dashboard"
        className="font-semibold text-primary-600 hover:text-primary-700 transition-colors"
      >
        {t('auth.appNameShort')}
      </Link>
    </span>
  )
}
