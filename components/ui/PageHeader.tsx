'use client'

import Link from 'next/link'
import { ReactNode } from 'react'

interface BreadcrumbItem {
  label: string
  href?: string        // if omitted, renders as plain text (current page)
  onClick?: () => void // for router.back() style navigation
}

interface PageHeaderProps {
  /** Breadcrumb trail after the brand. Last item is usually the current page (no href). */
  breadcrumbs: BreadcrumbItem[]
  /** Optional right-side content (action buttons, selects, etc.) */
  actions?: ReactNode
  /** Max width class — defaults to max-w-7xl */
  maxWidth?: string
}

/**
 * Shared page header — consistent across all pages.
 *
 * Layout:
 *   [Henry's Math]  >  [parent page]  >  Current Page    [actions]
 *
 * Usage:
 *   <PageHeader
 *     breadcrumbs={[
 *       { label: 'Challenges', href: '/challenges' },
 *       { label: 'Challenge Detail' },
 *     ]}
 *     actions={<Button size="sm">Edit</Button>}
 *   />
 */
export function PageHeader({ breadcrumbs, actions, maxWidth = 'max-w-7xl' }: PageHeaderProps) {
  return (
    <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
      <div className={`${maxWidth} mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4`}>
        {/* Left: brand + breadcrumbs */}
        <nav className="flex items-center gap-1.5 min-w-0" aria-label="Breadcrumb">
          {/* Brand — always links home */}
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors shrink-0"
          >
            Henry&apos;s Math
          </Link>

          {/* Breadcrumb items */}
          {breadcrumbs.map((item, i) => (
            <span key={i} className="flex items-center gap-1.5 min-w-0">
              {/* Chevron separator */}
              <svg
                className="w-3 h-3 text-gray-300 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>

              {/* Clickable parent */}
              {item.href ? (
                <Link
                  href={item.href}
                  className="text-sm text-gray-500 hover:text-gray-800 transition-colors truncate"
                >
                  {item.label}
                </Link>
              ) : item.onClick ? (
                <button
                  onClick={item.onClick}
                  className="text-sm text-gray-500 hover:text-gray-800 transition-colors truncate"
                >
                  {item.label}
                </button>
              ) : (
                /* Current page — not clickable, slightly darker */
                <span className="text-sm font-medium text-gray-800 truncate">
                  {item.label}
                </span>
              )}
            </span>
          ))}
        </nav>

        {/* Right: action buttons */}
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}
