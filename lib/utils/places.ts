/**
 * Where a student can say they are: country, then city, which gives the zone.
 *
 * ── WHY NOT ASK FOR A TIMEZONE DIRECTLY ─────────────────────
 * Nobody knows their IANA zone name. They know their city. So the question is
 * "where are you", the zone is derived, and it is shown back so the answer can
 * be checked without anyone needing to know what America/New_York means.
 *
 * ── WHY COUNTRY CARRIES THE REGION ──────────────────────────
 * Region decides what can be posted to someone, which is a country-level fact,
 * not a city-level one. Deriving it here means a student answers one question
 * about themselves rather than two, and the two can never disagree.
 *
 * Names are bilingual in the data because the card that shows them is
 * bilingual — it appears once, before anyone has chosen a language, so it
 * cannot rely on a language having been chosen. This file is .ts rather than
 * .tsx precisely so that is honest: it is data, not untranslated UI.
 */

import type { Region } from './timezone'

export interface Place {
  nameEn: string
  nameZh: string
  timezone: string
}

export interface Country {
  code: string
  region: Region
  nameEn: string
  nameZh: string
  cities: Place[]
}

/**
 * Deliberately short. Every entry is somewhere a student actually is, and an
 * unlisted country is covered by asking them to pick the nearest city with the
 * same clock — a wrong city name is harmless, a wrong zone is not.
 */
export const COUNTRIES: Country[] = [
  {
    code: 'US', region: 'us', nameEn: 'United States', nameZh: '美国',
    cities: [
      { nameEn: 'New York', nameZh: '纽约', timezone: 'America/New_York' },
      { nameEn: 'Boston', nameZh: '波士顿', timezone: 'America/New_York' },
      { nameEn: 'Atlanta', nameZh: '亚特兰大', timezone: 'America/New_York' },
      { nameEn: 'Chicago', nameZh: '芝加哥', timezone: 'America/Chicago' },
      { nameEn: 'Houston', nameZh: '休斯顿', timezone: 'America/Chicago' },
      { nameEn: 'Denver', nameZh: '丹佛', timezone: 'America/Denver' },
      { nameEn: 'Phoenix', nameZh: '凤凰城', timezone: 'America/Phoenix' },
      { nameEn: 'Los Angeles', nameZh: '洛杉矶', timezone: 'America/Los_Angeles' },
      { nameEn: 'Seattle', nameZh: '西雅图', timezone: 'America/Los_Angeles' },
      { nameEn: 'Honolulu', nameZh: '檀香山', timezone: 'Pacific/Honolulu' },
    ],
  },
  {
    // One clock nationwide, so the city is asked only so the answer feels
    // like an address rather than a setting.
    code: 'CN', region: 'cn', nameEn: 'China', nameZh: '中国',
    cities: [
      { nameEn: 'Beijing', nameZh: '北京', timezone: 'Asia/Shanghai' },
      { nameEn: 'Shanghai', nameZh: '上海', timezone: 'Asia/Shanghai' },
      { nameEn: 'Shenzhen', nameZh: '深圳', timezone: 'Asia/Shanghai' },
      { nameEn: 'Guangzhou', nameZh: '广州', timezone: 'Asia/Shanghai' },
      { nameEn: 'Chengdu', nameZh: '成都', timezone: 'Asia/Shanghai' },
      { nameEn: 'Elsewhere in China', nameZh: '中国其他城市', timezone: 'Asia/Shanghai' },
    ],
  },
  {
    code: 'CA', region: 'other', nameEn: 'Canada', nameZh: '加拿大',
    cities: [
      { nameEn: 'Toronto', nameZh: '多伦多', timezone: 'America/Toronto' },
      { nameEn: 'Vancouver', nameZh: '温哥华', timezone: 'America/Vancouver' },
      { nameEn: 'Calgary', nameZh: '卡尔加里', timezone: 'America/Edmonton' },
    ],
  },
  {
    code: 'HK', region: 'other', nameEn: 'Hong Kong', nameZh: '香港',
    cities: [{ nameEn: 'Hong Kong', nameZh: '香港', timezone: 'Asia/Hong_Kong' }],
  },
  {
    code: 'TW', region: 'other', nameEn: 'Taiwan', nameZh: '台湾',
    cities: [{ nameEn: 'Taipei', nameZh: '台北', timezone: 'Asia/Taipei' }],
  },
  {
    code: 'SG', region: 'other', nameEn: 'Singapore', nameZh: '新加坡',
    cities: [{ nameEn: 'Singapore', nameZh: '新加坡', timezone: 'Asia/Singapore' }],
  },
  {
    code: 'JP', region: 'other', nameEn: 'Japan', nameZh: '日本',
    cities: [{ nameEn: 'Tokyo', nameZh: '东京', timezone: 'Asia/Tokyo' }],
  },
  {
    code: 'AU', region: 'other', nameEn: 'Australia', nameZh: '澳大利亚',
    cities: [
      { nameEn: 'Sydney', nameZh: '悉尼', timezone: 'Australia/Sydney' },
      { nameEn: 'Melbourne', nameZh: '墨尔本', timezone: 'Australia/Melbourne' },
      { nameEn: 'Perth', nameZh: '珀斯', timezone: 'Australia/Perth' },
    ],
  },
  {
    code: 'GB', region: 'other', nameEn: 'United Kingdom', nameZh: '英国',
    cities: [{ nameEn: 'London', nameZh: '伦敦', timezone: 'Europe/London' }],
  },
]

/** The country a zone most likely belongs to, for pre-selecting the card. */
export function countryForTimeZone(timeZone: string): Country | null {
  return COUNTRIES.find(c => c.cities.some(city => city.timezone === timeZone)) ?? null
}

/** The city matching a zone within a country, for pre-selecting the card. */
export function cityForTimeZone(country: Country, timeZone: string): Place | null {
  return country.cities.find(city => city.timezone === timeZone) ?? null
}
