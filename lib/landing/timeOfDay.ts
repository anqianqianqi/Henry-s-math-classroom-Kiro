export type OceanTimeOfDay = 'day' | 'night'

export function getOceanTimeOfDay(date = new Date()): OceanTimeOfDay {
  const hour = date.getHours()

  return hour >= 18 || hour < 6 ? 'night' : 'day'
}

export function getOceanTimeClass(date = new Date()) {
  return `landing-ocean-${getOceanTimeOfDay(date)}`
}
