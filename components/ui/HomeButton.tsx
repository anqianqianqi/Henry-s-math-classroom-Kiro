'use client'

import Link from 'next/link'

/**
 * Small home icon button — links to /dashboard.
 * Drop it anywhere in a page header for a quick shortcut home.
 */
export function HomeButton() {
  return (
    <Link
      href="/dashboard"
      aria-label="Go to Dashboard"
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
      title="Dashboard"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="w-4 h-4"
      >
        <path
          fillRule="evenodd"
          d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z"
          clipRule="evenodd"
        />
      </svg>
    </Link>
  )
}
