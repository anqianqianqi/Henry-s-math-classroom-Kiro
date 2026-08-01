'use client'

/**
 * The one-time card that asks a student where they are and which language to
 * read in.
 *
 * ── WHY IT IS BILINGUAL RATHER THAN TRANSLATED ──────────────
 * It appears BEFORE anyone has chosen a language, so it cannot rely on one
 * having been chosen. Rendering it through t() would show it in whatever the
 * browser guessed, to someone whose entire purpose here is to correct that
 * guess. So every line appears in both languages at once.
 *
 * The wording still comes from the catalog — translate() is asked for each
 * language explicitly. Hardcoding it in the component would put the site's
 * words in two places and leave the second one out of every future edit.
 *
 * ── WHY IT ASKS FOR A CITY, NOT A TIMEZONE ──────────────────
 * Nobody knows their IANA zone name; everybody knows their city. The zone is
 * derived and shown back so the answer can be checked without anyone needing
 * to know what America/New_York means.
 *
 * ── SHOWN ONCE ──────────────────────────────────────────────
 * Gated on profiles.region_onboarded_at, stamped on save. Not on region being
 * null: "not set" is a legitimate answer somebody may return to in Settings,
 * and it must not summon this card again.
 */

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { translate } from '@/lib/i18n/catalog'
import type { Language } from '@/lib/i18n/catalog'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { placeFromTimeZone } from '@/lib/utils/places'
import { detectTimeZone } from '@/lib/utils/timezone'
import { PlacePicker, type PlaceSelection } from '@/components/ui/PlacePicker'

/** Both languages, stacked. The card's whole reason for existing. */
function Bilingual({ k, className = '' }: { k: string; className?: string }) {
  return (
    <div className={className}>
      <p>{translate(k as any, 'en')}</p>
      <p className="mt-0.5">{translate(k as any, 'zh')}</p>
    </div>
  )
}

/** A label in both languages, on one line — for compact form fields. */
function label(k: string): string {
  return `${translate(k as any, 'en')} / ${translate(k as any, 'zh')}`
}

export function RegionWelcomeCard() {
  const { setLanguage } = useLanguage()
  const [show, setShow] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const detected = useMemo(() => detectTimeZone(), [])
  const [place, setPlace] = useState<PlaceSelection>(() => placeFromTimeZone(detected))
  const [chosenLanguage, setChosenLanguage] = useState<Language>('en')

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function check() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.info('[welcome] signed out — waiting for sign-in')
          return
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('region_onboarded_at, preferred_language')
          .eq('id', user.id)
          .maybeSingle()

        // Loud on purpose. A missing column returns an error here and nothing
        // else — the card simply never appears, with no clue why. That is the
        // one failure mode worth a console line.
        if (error) {
          console.error('[welcome] could not read profile:', error.message,
            '— has supabase/add-timezones-and-regions.sql been run?')
          return
        }
        if (cancelled || !data) {
          console.warn('[welcome] no profile row for this user')
          return
        }
        if ((data as any).region_onboarded_at) {
          console.info('[welcome] already answered at',
            (data as any).region_onboarded_at, '— clear it to see the card again')
          return
        }

        setUserId(user.id)
        const existing = (data as any).preferred_language
        if (existing === 'en' || existing === 'zh') setChosenLanguage(existing)
        setShow(true)
      } catch (err) {
        // Never block the site on this: someone who does not see the card keeps
        // the detected zone and can set it in Settings. But say so.
        console.error('[welcome] unexpected failure:', err)
      }
    }

    /*
      Checked again on sign-in, not only on mount.

      This lives in the root layout, and Next does NOT remount that on a
      client-side navigation. So the only run used to happen on whatever page
      the tab first opened — usually /login, while still signed out — and
      logging in navigated to the dashboard without ever asking again. The card
      appeared only after a hard reload, which is exactly nobody's first visit.
    */
    check()
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') check()
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  if (!show) return null

  async function save() {
    if (!userId) return
    setSaving(true)
    try {
      const supabase = createClient()
      await supabase
        .from('profiles')
        .update({
          timezone: place.timezone,
          region: place.region,
          preferred_language: chosenLanguage,
          region_onboarded_at: new Date().toISOString(),
        })
        .eq('id', userId)
      // Through the provider, so localStorage and the toggle agree immediately.
      setLanguage(chosenLanguage)
      setShow(false)
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <Bilingual k="welcome.title" className="text-base font-bold text-gray-900" />
        <Bilingual k="welcome.choose" className="mt-3 text-sm text-gray-600" />

        <div className="mt-5">
          <PlacePicker
            countryCode={place.countryCode}
            cityName={place.cityName}
            onChange={setPlace}
            countryLabel={label('welcome.country')}
            cityLabel={label('welcome.city')}
            zoneCaption={label('welcome.detectedZone')}
            idPrefix="welcome"
          />
        </div>

        <div className="mt-5">
          <p className="mb-1.5 text-xs font-medium text-gray-700">{label('welcome.language')}</p>
          <div className="flex gap-2">
            {(['en', 'zh'] as Language[]).map(code => (
              <button
                key={code}
                type="button"
                onClick={() => setChosenLanguage(code)}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                  chosenLanguage === code
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {code === 'en' ? 'EN / 英文' : 'CN / 简体中文'}
              </button>
            ))}
          </div>
        </div>

        <Bilingual k="welcome.later" className="mt-5 text-xs leading-relaxed text-gray-500" />

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-5 w-full rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-60"
        >
          {saving ? label('welcome.saving') : label('welcome.confirm')}
        </button>
      </div>
    </div>
  )
}
