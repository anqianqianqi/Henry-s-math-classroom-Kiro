'use client'

/**
 * Site-wide UI language.
 *
 * Two-tier persistence on purpose:
 *   localStorage — read synchronously on mount so the language is right on the
 *                  first paint after hydration, with no flash of English
 *   profiles     — the source of truth, so the choice follows the account to
 *                  another device
 *
 * The profile is read once and reconciled with localStorage; a signed-in
 * student who switched on their phone sees Chinese on the classroom laptop too.
 *
 * Deliberately NOT locale-routed. URLs stay as they are, which keeps existing
 * links and bookmarks working and avoids restructuring app/ into app/[locale]/.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import { translate, type Language, type TranslationKey } from './catalog'

const STORAGE_KEY = 'henry-language'

interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  /** Translate a catalog key. `params` fill `{name}` placeholders in it. */
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
  /** Pick between two already-authored strings, e.g. bilingual DB columns. */
  pick: (en: string | null | undefined, zh: string | null | undefined) => string
  /** False until the stored preference has been read, for suppressing flashes. */
  ready: boolean
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function readStored(): Language | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'en' || value === 'zh' ? value : null
  } catch {
    return null
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Starts 'en' so server and first client render agree; the stored value is
  // applied in an effect, which is what keeps hydration from mismatching.
  const [language, setLanguageState] = useState<Language>('en')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = readStored()
    if (stored) setLanguageState(stored)
    setReady(true)

    // Then reconcile with the account, which outranks this device.
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const { data } = await supabase
          .from('profiles')
          .select('preferred_language')
          .eq('id', user.id)
          .maybeSingle()
        const remote = (data as any)?.preferred_language
        if (cancelled || (remote !== 'en' && remote !== 'zh')) return
        if (remote !== stored) {
          setLanguageState(remote)
          try { window.localStorage.setItem(STORAGE_KEY, remote) } catch {}
        }
      } catch {
        // Never let a language lookup break the page — English is a fine floor.
      }
    })()
    return () => { cancelled = true }
  }, [])

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    try { window.localStorage.setItem(STORAGE_KEY, next) } catch {}

    // Fire-and-forget: the UI has already switched, and a failed write only
    // means the choice does not follow them to another device.
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase
          .from('profiles')
          .update({ preferred_language: next })
          .eq('id', user.id)
      } catch (err) {
        console.error('[i18n] could not save language to profile:', err)
      }
    })()
  }, [])

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key: TranslationKey, params?: Record<string, string | number>) => translate(key, language, params),
    pick: (en, zh) => (language === 'zh' ? (zh || en || '') : (en || zh || '')),
    ready,
  }), [language, setLanguage, ready])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

/**
 * Falls back to English rather than throwing when used outside the provider,
 * so a stray component can never blank a page over a missing wrapper.
 */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (ctx) return ctx
  return {
    language: 'en',
    setLanguage: () => {},
    t: (key: TranslationKey, params?: Record<string, string | number>) => translate(key, 'en', params),
    pick: (en, zh) => en || zh || '',
    ready: true,
  }
}

/** Shorthand for the common case. */
export function useT() {
  return useLanguage().t
}
