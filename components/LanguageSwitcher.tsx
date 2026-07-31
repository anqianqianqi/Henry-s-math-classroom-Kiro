'use client'

/**
 * EN / CN switcher.
 *
 * Mounted once in the root layout rather than in PageHeader, because
 * PageHeader is only on 16 of the 36 pages — the other 20 have bespoke headers,
 * so putting it there would have left the control missing exactly where a
 * student is most likely to be stuck.
 *
 * Fixed and small so it never has to be fitted into each page's own layout.
 */

import { useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { LANGUAGES } from '@/lib/i18n/catalog'

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()
  const [open, setOpen] = useState(false)

  const current = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0]

  return (
    <div
      className="fixed right-3 z-[70] print:hidden"
      // Below the safe-area inset so it clears a notch on iOS
      style={{ top: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={language === 'zh' ? '切换语言' : 'Change language'}
          className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/90 px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-md backdrop-blur-sm transition-colors hover:bg-white"
        >
          {current.short}
          <span aria-hidden="true" className="text-[11px] opacity-60">▼</span>
        </button>

        {open && (
          <>
            {/* Click-away, behind the menu */}
            <div className="fixed inset-0 -z-10" onClick={() => setOpen(false)} />
            <ul
              role="listbox"
              className="absolute right-0 mt-1.5 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg"
            >
              {LANGUAGES.map(option => (
                <li key={option.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.code === language}
                    onClick={() => { setLanguage(option.code); setOpen(false) }}
                    className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-base transition-colors hover:bg-gray-50 ${
                      option.code === language ? 'font-semibold text-primary-600' : 'text-gray-700'
                    }`}
                  >
                    {option.short}
                    {option.code === language && <span aria-hidden="true">✓</span>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
