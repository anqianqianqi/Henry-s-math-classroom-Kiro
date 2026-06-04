'use client'

import Link from 'next/link'

/**
 * Dashboard text link for page headers.
 * Without noSlash: renders "/ Dashboard" — sits after a back button as a breadcrumb.
 * With noSlash: renders just "Dashboard" — used when it's the only nav link.
 */
export function HomeButton({ noSlash = false }: { noSlash?: boolean }) {
  if (noSlash) {
    return (
      <Link
        href="/dashboard"
        className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        ← Dashboard
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
        Dashboard
      </Link>
    </span>
  )
}
