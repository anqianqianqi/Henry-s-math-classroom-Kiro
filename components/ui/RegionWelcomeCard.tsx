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
import { COUNTRIES, cityForTimeZone, countryForTimeZone } from '@/lib/utils/places'
import { detectTimeZone, zoneLabel } from '@/lib/utils/timezone'

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
  const [countryCode, setCountryCode] = useState(
    () => countryForTimeZone(detected)?.code ?? 'US',
  )
  /*
    The city is tracked by NAME, not by its timezone. New York, Boston and
    Atlanta all sit in America/New_York, so a select keyed on the zone would
    snap back to whichever shares it first — pick Boston, watch it say New York.
  */
  const [cityName, setCityName] = useState<string>(
    () => {
      const c = countryForTimeZone(detected)
      return (c && cityForTimeZone(c, detected)?.nameEn) ?? ''
    },
  )
  const [chosenLanguage, setChosenLanguage] = useState<Language>('en')

  const country = COUNTRIES.find(c => c.code === countryCode) ?? COUNTRIES[0]
  const city = country.cities.find(c => c.nameEn === cityName) ?? country.cities[0]
  const timezone = city.timezone

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.info('[welcome] signed out — card not shown')
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
    })()
    return () => { cancelled = true }
  }, [])

  // Changing country invalidates the city, so fall back to its first.
  useEffect(() => {
    if (!country.cities.some(c => c.nameEn === cityName)) {
      setCityName(country.cities[0].nameEn)
    }
  }, [country, cityName])

  if (!show) return null

  async function save() {
    if (!userId) return
    setSaving(true)
    try {
      const supabase = createClient()
      await supabase
        .from('profiles')
        .update({
          timezone,
          region: country.region,
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

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="w-country" className="block text-xs font-medium text-gray-700 mb-1">
              {label('welcome.country')}
            </label>
            <select
              id="w-country"
              value={countryCode}
              onChange={e => setCountryCode(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.nameEn} / {c.nameZh}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="w-city" className="block text-xs font-medium text-gray-700 mb-1">
              {label('welcome.city')}
            </label>
            <select
              id="w-city"
              value={city.nameEn}
              onChange={e => setCityName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              {country.cities.map(c => (
                <option key={c.nameEn} value={c.nameEn}>
                  {c.nameEn} / {c.nameZh}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Shown back so the answer can be checked. */}
        <p className="mt-3 text-xs text-gray-500">
          {label('welcome.detectedZone')}: <span className="font-medium text-gray-700">
            {timezone.replace(/_/g, ' ')} · {zoneLabel(timezone)}
          </span>
        </p>

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
