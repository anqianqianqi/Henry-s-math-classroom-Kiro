'use client'

import Link from 'next/link'

/**
 * Brand home link for page headers — always reads "Henry's Math" and links to /dashboard.
 * Without noSlash: renders "/ Henry's Math" — sits after a back button as a breadcrumb.
 * With noSlash: renders just "← Henry's Math" — used when it's the only nav link.
 */
export function HomeButton({ noSlash = false }: { noSlash?: boolean }) {
  if (noSlash) {
    return (
      <Link
        href="/dashboard"
        className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        ← Henry&apos;s Math
      </Link>
    )
  }
  return (
    <span className="flex items-center gap-2 text-sm text-gray-400">
      <span>/</span>
      <Link
        href="/dashboard"
        className="text-gray-500 hover:text-gray-800 transition-colors"
      >
        Henry&apos;s Math
      </Link>
    </span>
  )
}
