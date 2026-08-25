import type { TranslationKey } from '@/lib/i18n/catalog'

/**
 * Public landing scene config.
 *
 * Future visual swaps should start here: update colors, add/remove `assets`,
 * or point an `image` asset at a file in `public/`. The page renderer and CSS
 * already know how to place each supported asset kind.
 */
export type LandingIconId =
  | 'calendar'
  | 'graduation'
  | 'login'
  | 'message'
  | 'shopping'
  | 'target'
  | 'userPlus'
  | 'users'

export type LandingAsset =
  | {
      kind: 'bubble'
      layer?: 'background'
      left: string
      size: string
      delay: string
      speed: string
    }
  | {
      kind: 'fish'
      layer?: 'background'
      top: string
      color: string
      delay: string
      speed: string
      scale?: number
    }
  | {
      kind: 'clownfish' | 'seahorse' | 'turtle' | 'ray' | 'octopus'
      layer?: 'background'
      left?: string
      top: string
      bottom?: string
      delay: string
      speed: string
      scale?: number
      className?: string
    }
  | {
      kind: 'starfish' | 'crab' | 'shell'
      layer?: 'background' | 'seabed'
      left?: string
      top?: string
      bottom?: string
      delay: string
      speed: string
      scale?: number
      className?: string
    }
  | {
      kind: 'jellyfish'
      layer?: 'background' | 'panel'
      className?: string
    }
  | {
      kind: 'coral' | 'kelp'
      layer?: 'seabed'
      className?: string
    }
  | {
      kind: 'image'
      layer?: 'background' | 'panel' | 'seabed'
      src: string
      alt: string
      className?: string
      left?: string
      top?: string
      right?: string
      bottom?: string
      width?: string
      height?: string
      delay?: string
      speed?: string
      scale?: number
    }

export interface LandingTheme {
  className: string
  colors: {
    surfaceDeep: string
    surfaceMid: string
    surfaceLight: string
    sunlight: string
    accent: string
    coral: string
    sand: string
    sandDeep: string
    cta: string
    ctaHover: string
    ctaText: string
    iconInk: string
    panelInk: string
  }
  content: {
    headline: TranslationKey
    primaryCta: TranslationKey
    secondaryCta: TranslationKey
  }
  assets: LandingAsset[]
  dashboardPreview: {
    problems: {
      dateKey: TranslationKey
      title: string
      statusKey: TranslationKey
      statusTone: 'todo' | 'done' | 'comment'
    }[]
    calendar: {
      day: string
      problem?: string
      status?: 'todo' | 'done' | 'comment' | 'locked'
      today?: boolean
    }[]
    stats: {
      labelKey: TranslationKey
      value: string
      icon: LandingIconId
    }[]
  }
}

export const landingTheme: LandingTheme = {
  className: 'landing-ocean',
  colors: {
    surfaceDeep: '#285f72',
    surfaceMid: '#4aa0ac',
    surfaceLight: '#9bd8d0',
    sunlight: '#ffe6a8',
    accent: '#b9e8be',
    coral: '#f28f7c',
    sand: '#f3dba0',
    sandDeep: '#b8895d',
    cta: '#ffe39a',
    ctaHover: '#fff0bc',
    ctaText: '#35505b',
    iconInk: '#397f74',
    panelInk: '#2f6f82',
  },
  content: {
    headline: 'auth.landingHeadline',
    primaryCta: 'auth.landingPrimaryCta',
    secondaryCta: 'auth.landingSecondaryCta',
  },
  assets: [
    { kind: 'bubble', left: '8%', size: '12px', delay: '-2s', speed: '12s' },
    { kind: 'bubble', left: '18%', size: '7px', delay: '-8s', speed: '15s' },
    { kind: 'bubble', left: '31%', size: '15px', delay: '-4s', speed: '18s' },
    { kind: 'bubble', left: '43%', size: '9px', delay: '-10s', speed: '13s' },
    { kind: 'bubble', left: '58%', size: '13px', delay: '-6s', speed: '16s' },
    { kind: 'bubble', left: '72%', size: '8px', delay: '-11s', speed: '14s' },
    { kind: 'bubble', left: '86%', size: '16px', delay: '-5s', speed: '19s' },
    { kind: 'bubble', left: '94%', size: '10px', delay: '-9s', speed: '17s' },
    { kind: 'fish', top: '16%', delay: '-1.7s', speed: '23s', scale: 0.72, color: '#f8b45f' },
    { kind: 'fish', top: '38%', delay: '-17.4s', speed: '31s', scale: 0.96, color: '#ef8f84' },
    { kind: 'fish', top: '58%', delay: '-8.6s', speed: '27s', scale: 0.64, color: '#a7dca9' },
    { kind: 'clownfish', top: '27%', delay: '-12.9s', speed: '26s', scale: 0.82 },
    { kind: 'clownfish', top: '69%', delay: '-3.4s', speed: '36s', scale: 0.68 },
    { kind: 'seahorse', top: '45%', delay: '-24.2s', speed: '43s', scale: 0.76 },
    { kind: 'turtle', top: '31%', delay: '-6.8s', speed: '49s', scale: 0.86 },
    { kind: 'ray', top: '53%', delay: '-29.5s', speed: '54s', scale: 0.78 },
    { kind: 'octopus', top: '74%', delay: '-18.1s', speed: '39s', scale: 0.7 },
    { kind: 'starfish', layer: 'seabed', left: '36%', bottom: '2.2rem', delay: '-11.3s', speed: '23s', scale: 0.82 },
    { kind: 'crab', layer: 'seabed', left: '58%', bottom: '1.5rem', delay: '-2.6s', speed: '19s', scale: 0.72 },
    { kind: 'shell', layer: 'seabed', left: '24%', bottom: '1.15rem', delay: '-15.8s', speed: '21s', scale: 0.82 },
    { kind: 'jellyfish', layer: 'panel' },
    { kind: 'coral', className: 'landing-coral-left' },
    { kind: 'coral', className: 'landing-coral-right' },
    { kind: 'kelp', className: 'landing-kelp-one' },
    { kind: 'kelp', className: 'landing-kelp-two' },
    { kind: 'kelp', className: 'landing-kelp-three' },
  ],
  dashboardPreview: {
    problems: [
      {
        dateKey: 'dash.today',
        title: 'Linear equations review',
        statusKey: 'dash.statusTodo',
        statusTone: 'todo',
      },
      {
        dateKey: 'auth.landingPreviewDateRecent',
        title: 'Fraction word problems',
        statusKey: 'dash.newComment',
        statusTone: 'comment',
      },
    ],
    calendar: [
      { day: '18' },
      { day: '19', problem: 'Ratios', status: 'done' },
      { day: '20' },
      { day: '21' },
      { day: '22' },
      { day: '23', problem: 'Fractions', status: 'done' },
      { day: '24', today: true, problem: 'Linear', status: 'todo' },
      { day: '25', problem: 'Locked', status: 'locked' },
      { day: '26' },
      { day: '27', problem: 'Class 4:30' },
      { day: '28' },
      { day: '29', problem: 'Graphing', status: 'todo' },
      { day: '30' },
      { day: '31' },
    ],
    stats: [
      { labelKey: 'nav.challenges', value: '8', icon: 'target' },
      { labelKey: 'dash.totalScore', value: '320', icon: 'target' },
      { labelKey: 'dash.shopBalance', value: '210', icon: 'shopping' },
      { labelKey: 'dash.grade', value: 'A-', icon: 'graduation' },
    ],
  },
}
