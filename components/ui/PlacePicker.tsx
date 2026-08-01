'use client'

/**
 * Country, then city, and the timezone appears.
 *
 * ── WHY IT IS SHARED ────────────────────────────────────────
 * The welcome card and Settings ask the same question, so they ask it with the
 * same control. Two copies would drift: a city added to one list and not the
 * other means somebody's answer stops being offered where they go to change it.
 *
 * ── WHY NOT ASK FOR A TIMEZONE ──────────────────────────────
 * Nobody knows their IANA zone name; everybody knows their city. The zone is
 * derived and shown back, so the answer can be checked without anyone needing
 * to know what America/New_York means.
 *
 * Labels are passed in because the two callers speak differently: the welcome
 * card is bilingual — it appears before a language has been chosen — while
 * Settings is translated like the rest of the site.
 */

import { useEffect } from 'react'
import { COUNTRIES } from '@/lib/utils/places'
import type { Region } from '@/lib/utils/timezone'
import { zoneLabel } from '@/lib/utils/timezone'

export interface PlaceSelection {
  countryCode: string
  cityName: string
  timezone: string
  region: Region
}

export interface PlacePickerProps {
  countryCode: string
  cityName: string
  onChange: (next: PlaceSelection) => void
  countryLabel: string
  cityLabel: string
  zoneCaption: string
  /** Prefix for input ids, so two pickers on one page keep distinct labels. */
  idPrefix?: string
}

export function PlacePicker({
  countryCode, cityName, onChange,
  countryLabel, cityLabel, zoneCaption, idPrefix = 'place',
}: PlacePickerProps) {
  const country = COUNTRIES.find(c => c.code === countryCode) ?? COUNTRIES[0]
  const city = country.cities.find(c => c.nameEn === cityName) ?? country.cities[0]

  const emit = (nextCountryCode: string, nextCityName: string) => {
    const c = COUNTRIES.find(x => x.code === nextCountryCode) ?? COUNTRIES[0]
    const ct = c.cities.find(x => x.nameEn === nextCityName) ?? c.cities[0]
    onChange({
      countryCode: c.code,
      cityName: ct.nameEn,
      timezone: ct.timezone,
      // Region comes from the country, never the city: what can be posted to
      // someone is a country-level fact, and deriving it here means one answer
      // rather than two that can disagree.
      region: c.region,
    })
  }

  // Changing country invalidates the city, so settle on its first.
  useEffect(() => {
    if (!country.cities.some(c => c.nameEn === cityName)) {
      emit(country.code, country.cities[0].nameEn)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country.code, cityName])

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-country`} className="block text-xs font-medium text-gray-700 mb-1">
            {countryLabel}
          </label>
          <select
            id={`${idPrefix}-country`}
            value={country.code}
            onChange={e => emit(e.target.value, '')}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>{c.nameEn} / {c.nameZh}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${idPrefix}-city`} className="block text-xs font-medium text-gray-700 mb-1">
            {cityLabel}
          </label>
          {/*
            Keyed on the city NAME, not its zone. New York, Boston and Atlanta
            all sit in America/New_York, so a select keyed on the zone snaps
            back to whichever shares it first — pick Boston, watch it say New
            York.
          */}
          <select
            id={`${idPrefix}-city`}
            value={city.nameEn}
            onChange={e => emit(country.code, e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            {country.cities.map(c => (
              <option key={c.nameEn} value={c.nameEn}>{c.nameEn} / {c.nameZh}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Shown back so the answer can be checked. */}
      <p className="mt-2 text-xs text-gray-500">
        {zoneCaption}:{' '}
        <span className="font-medium text-gray-700">
          {city.timezone.replace(/_/g, ' ')} · {zoneLabel(city.timezone)}
        </span>
      </p>
    </>
  )
}
