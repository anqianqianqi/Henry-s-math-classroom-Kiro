'use client'

import { landingTheme, type LandingAsset, type LandingIconId } from '@/lib/landing/scene'
import { getOceanTimeClass } from '@/lib/landing/timeOfDay'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import {
  CalendarDays,
  GraduationCap,
  LogIn,
  MessageSquareText,
  ShoppingBag,
  Target,
  UserPlus,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'

type LandingCssVars = CSSProperties & Record<`--${string}`, string | number | undefined>
type PreviewCalendarCell = {
  day: string
  problem?: string
  status?: 'todo' | 'done' | 'comment' | 'locked'
  today?: boolean
}

const iconMap = {
  calendar: CalendarDays,
  graduation: GraduationCap,
  login: LogIn,
  message: MessageSquareText,
  shopping: ShoppingBag,
  target: Target,
  userPlus: UserPlus,
  users: Users,
} satisfies Record<LandingIconId, typeof CalendarDays>

function themeVars(): LandingCssVars {
  const { colors } = landingTheme

  return {
    '--landing-surface-deep': colors.surfaceDeep,
    '--landing-surface-mid': colors.surfaceMid,
    '--landing-surface-light': colors.surfaceLight,
    '--landing-sunlight': colors.sunlight,
    '--landing-accent': colors.accent,
    '--landing-coral': colors.coral,
    '--landing-sand': colors.sand,
    '--landing-sand-deep': colors.sandDeep,
    '--landing-cta': colors.cta,
    '--landing-cta-hover': colors.ctaHover,
    '--landing-cta-text': colors.ctaText,
    '--landing-icon-ink': colors.iconInk,
    '--landing-panel-ink': colors.panelInk,
  }
}

function assetStyle(asset: LandingAsset): LandingCssVars {
  if (asset.kind === 'bubble') {
    return {
      left: asset.left,
      width: asset.size,
      height: asset.size,
      animationDelay: asset.delay,
      animationDuration: asset.speed,
    }
  }

  if (asset.kind === 'math') {
    return {
      left: asset.left,
      animationDelay: asset.delay,
      animationDuration: asset.speed,
      '--math-bubble-scale': asset.scale ?? 1,
    }
  }

  if (asset.kind === 'fish') {
    return {
      top: asset.top,
      animationDelay: asset.delay,
      animationDuration: asset.speed,
      '--fish-scale': asset.scale ?? 1,
      '--art-image': asset.src ? `url(${asset.src})` : undefined,
      '--art-frame-image': asset.frameSrcs?.[0] ? `url(${asset.frameSrcs[0]})` : asset.frameSrc ? `url(${asset.frameSrc})` : undefined,
      backgroundColor: asset.src ? undefined : asset.color,
    }
  }

  if (
    asset.kind === 'clownfish' ||
    asset.kind === 'seahorse' ||
    asset.kind === 'turtle' ||
    asset.kind === 'ray' ||
    asset.kind === 'octopus' ||
    asset.kind === 'whale' ||
    asset.kind === 'starfish' ||
    asset.kind === 'crab' ||
    asset.kind === 'shell'
  ) {
    return {
      left: asset.left,
      top: asset.top,
      bottom: asset.bottom,
      animationDelay: asset.delay,
      animationDuration: asset.speed,
      '--creature-scale': asset.scale ?? 1,
      '--art-image': asset.src ? `url(${asset.src})` : undefined,
      '--art-frame-image': asset.frameSrcs?.[0] ? `url(${asset.frameSrcs[0]})` : asset.frameSrc ? `url(${asset.frameSrc})` : undefined,
    }
  }

  if (asset.kind === 'jellyfish') {
    return {
      '--art-image': asset.src ? `url(${asset.src})` : undefined,
      '--art-frame-image': asset.frameSrcs?.[0] ? `url(${asset.frameSrcs[0]})` : asset.frameSrc ? `url(${asset.frameSrc})` : undefined,
    }
  }

  if (asset.kind === 'image') {
    return {
      left: asset.left,
      top: asset.top,
      right: asset.right,
      bottom: asset.bottom,
      width: asset.width,
      height: asset.height,
      backgroundImage: `url(${asset.src})`,
      animationDelay: asset.delay,
      animationDuration: asset.speed,
      '--asset-scale': asset.scale ?? 1,
    }
  }

  return {}
}

function renderAsset(asset: LandingAsset, index: number) {
  if (asset.kind === 'bubble') {
    return (
      <span
        key={`bubble-${index}`}
        className="landing-air-bubble"
        aria-hidden="true"
        style={assetStyle(asset)}
      />
    )
  }

  if (asset.kind === 'math') {
    return (
      <span
        key={`math-${index}`}
        className={`landing-math-bubble ${asset.className ?? ''}`}
        aria-hidden="true"
        style={assetStyle(asset)}
      >
        <span className="landing-math-bubble-symbol">{asset.symbol}</span>
      </span>
    )
  }

  if (asset.kind === 'fish') {
    if (asset.src) {
      const frames = artFrames(asset)
      return (
        <span
          key={`fish-${index}`}
          className={`landing-art landing-art-fish ${asset.className ?? ''}`}
          aria-hidden="true"
          style={assetStyle(asset)}
        >
          <span className={`landing-art-body ${frames.length > 1 ? 'landing-art-body-has-frame' : ''}`}>
            {frames.map((src, frameIndex) => (
              <span
                key={`${src}-${frameIndex}`}
                className="landing-art-frame"
                style={{
                  '--frame-image': `url(${src})`,
                  '--frame-index': frameIndex,
                } as LandingCssVars}
              />
            ))}
          </span>
        </span>
      )
    }

    return (
      <span
        key={`fish-${index}`}
        className="landing-fish"
        aria-hidden="true"
        style={assetStyle(asset)}
      >
        <span className="landing-creature-detail" />
        <span className="landing-creature-symbol">=</span>
      </span>
    )
  }

  if (asset.kind === 'jellyfish') {
    if (asset.src) {
      const frames = artFrames(asset)
      return (
        <span
          key={`jellyfish-${index}`}
          className={`landing-art landing-art-jellyfish ${asset.className ?? ''}`}
          aria-hidden="true"
          style={assetStyle(asset)}
        >
          <span className={`landing-art-body ${frames.length > 1 ? 'landing-art-body-has-frame' : ''}`}>
            {frames.map((src, frameIndex) => (
              <span
                key={`${src}-${frameIndex}`}
                className="landing-art-frame"
                style={{
                  '--frame-image': `url(${src})`,
                  '--frame-index': frameIndex,
                } as LandingCssVars}
              />
            ))}
          </span>
        </span>
      )
    }

    return (
      <div
        key={`jellyfish-${index}`}
        className={`landing-jellyfish ${asset.className ?? ''}`}
        aria-hidden="true"
      >
        <span className="landing-jelly-tentacle" />
        <span className="landing-jelly-tentacle" />
        <span className="landing-jelly-tentacle" />
        <span className="landing-creature-symbol">√</span>
      </div>
    )
  }

  if (
    asset.kind === 'clownfish' ||
    asset.kind === 'seahorse' ||
    asset.kind === 'turtle' ||
    asset.kind === 'ray' ||
    asset.kind === 'octopus' ||
    asset.kind === 'whale' ||
    asset.kind === 'starfish' ||
    asset.kind === 'crab' ||
    asset.kind === 'shell'
  ) {
    if (asset.src) {
      const frames = artFrames(asset)
      return (
        <span
          key={`${asset.kind}-${index}`}
          className={`landing-art landing-art-${asset.kind} ${asset.className ?? ''}`}
          aria-hidden="true"
          style={assetStyle(asset)}
        >
          <span className={`landing-art-body ${frames.length > 1 ? 'landing-art-body-has-frame' : ''}`}>
            {frames.map((src, frameIndex) => (
              <span
                key={`${src}-${frameIndex}`}
                className="landing-art-frame"
                style={{
                  '--frame-image': `url(${src})`,
                  '--frame-index': frameIndex,
                } as LandingCssVars}
              />
            ))}
          </span>
        </span>
      )
    }

    return (
      <span
        key={`${asset.kind}-${index}`}
        className={`landing-creature landing-${asset.kind}`}
        aria-hidden="true"
        style={assetStyle(asset)}
      >
        <span className="landing-creature-detail" />
        <span className="landing-creature-symbol">{creatureSymbol(asset.kind)}</span>
      </span>
    )
  }

  if (asset.kind === 'image') {
    return (
      <span
        key={`image-${index}`}
        className={`landing-image-asset ${asset.className ?? ''}`}
        aria-label={asset.alt || undefined}
        aria-hidden={asset.alt ? undefined : true}
        style={assetStyle(asset)}
      />
    )
  }

  return (
    <span
      key={`${asset.kind}-${index}`}
      className={`landing-${asset.kind} ${asset.className ?? ''}`}
      aria-hidden="true"
      style={assetStyle(asset)}
    />
  )
}

function artFrames(
  asset: Extract<LandingAsset, { kind: 'fish' | 'clownfish' | 'seahorse' | 'turtle' | 'ray' | 'octopus' | 'whale' | 'starfish' | 'crab' | 'shell' | 'jellyfish' }>
) {
  if (!asset.src) {
    return []
  }

  return [asset.src, ...(asset.frameSrcs ?? (asset.frameSrc ? [asset.frameSrc] : []))]
}

function creatureSymbol(kind: LandingAsset['kind']) {
  switch (kind) {
    case 'clownfish':
      return '='
    case 'seahorse':
      return '?'
    case 'turtle':
      return 'π'
    case 'ray':
      return '∑'
    case 'octopus':
      return '∞'
    case 'whale':
      return '≈'
    case 'starfish':
      return '*'
    case 'crab':
      return '≤'
    case 'shell':
      return '∪'
    default:
      return ''
  }
}

function assetLayer(asset: LandingAsset): 'background' | 'panel' | 'seabed' {
  if (asset.layer) return asset.layer
  if (asset.kind === 'coral' || asset.kind === 'kelp') return 'seabed'
  return 'background'
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function buildCalendarPreview(date: Date): { label: string; cells: PreviewCalendarCell[] } {
  const today = startOfDay(date)
  const start = new Date(today)
  start.setDate(today.getDate() - today.getDay())

  const label = today.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const plannedWork: Record<number, Pick<PreviewCalendarCell, 'problem' | 'status'>> = {
    [-1]: { problem: 'Fractions', status: 'done' },
    0: { problem: 'Linear', status: 'todo' },
    3: { problem: 'Class 4:30' },
    5: { problem: 'Graphing', status: 'todo' },
  }

  return {
    label,
    cells: Array.from({ length: 14 }, (_, index) => {
      const cellDate = new Date(start)
      cellDate.setDate(start.getDate() + index)
      const offset = Math.round((cellDate.getTime() - today.getTime()) / 86_400_000)
      const work = plannedWork[offset]

      return {
        day: String(cellDate.getDate()),
        today: offset === 0,
        ...work,
      }
    }),
  }
}

export default function Home() {
  const { t } = useLanguage()
  const [oceanTimeClass, setOceanTimeClass] = useState('landing-ocean-day')
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const LoginIcon = iconMap.login
  const SignupIcon = iconMap.userPlus
  const preview = landingTheme.dashboardPreview
  const previewCalendar = useMemo(() => buildCalendarPreview(calendarDate), [calendarDate])
  const titleWhaleAsset = landingTheme.assets.find(asset => asset.kind === 'whale')
  const floatingAssets = landingTheme.assets.filter(asset => assetLayer(asset) === 'background' && asset.kind !== 'whale')
  const panelAssets = landingTheme.assets.filter(asset => assetLayer(asset) === 'panel')
  const seabedAssets = landingTheme.assets.filter(asset => assetLayer(asset) === 'seabed')

  useEffect(() => {
    setOceanTimeClass(getOceanTimeClass())
    setCalendarDate(new Date())

    const interval = window.setInterval(() => {
      setOceanTimeClass(getOceanTimeClass())
      setCalendarDate(new Date())
    }, 60_000)

    return () => window.clearInterval(interval)
  }, [])

  return (
    <main className={`${landingTheme.className} ${oceanTimeClass} relative min-h-screen overflow-hidden text-white`} style={themeVars()}>
      <div className="landing-sunbeams" aria-hidden="true" />
      <div className="landing-current landing-current-one" aria-hidden="true" />
      <div className="landing-current landing-current-two" aria-hidden="true" />

      {floatingAssets.map(renderAsset)}

      <section className="relative flex min-h-screen items-center px-5 py-8 sm:px-8 sm:py-14 lg:px-14">
        <div className="mx-auto grid w-full max-w-[88rem] items-center gap-6 sm:gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,0.95fr)]">
          <div className="relative max-w-3xl pt-6 sm:pt-0">
            <div className="landing-title-wrap relative">
              <h1 className="relative z-0 max-w-4xl text-4xl font-black leading-[0.98] tracking-normal text-white drop-shadow-2xl sm:text-6xl lg:text-7xl">
                {t(landingTheme.content.headline)}
              </h1>

              {titleWhaleAsset ? renderAsset(Object.assign({}, titleWhaleAsset, { className: 'landing-title-whale' }) as LandingAsset, 0) : null}
            </div>

            <div className="relative z-30 mt-10 flex flex-col gap-3 sm:mt-12 sm:flex-row sm:justify-end">
              <a
                href="/login"
                className="landing-primary-cta inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-7 text-base font-black shadow-[0_7px_0_rgba(110,71,0,0.28)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-white/60 active:translate-y-1 active:shadow-none"
              >
                <span className="landing-cta-icon" aria-hidden="true">
                  <LoginIcon className="h-4 w-4" />
                </span>
                <span className="relative z-10">{t(landingTheme.content.primaryCta)}</span>
              </a>
              <a
                href="/signup"
                className="landing-secondary-cta inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-white/55 bg-white/14 px-7 text-base font-black text-white shadow-lg shadow-cyan-950/20 backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/22 focus:outline-none focus:ring-4 focus:ring-white/45"
              >
                <span className="landing-cta-icon landing-cta-icon-secondary" aria-hidden="true">
                  <SignupIcon className="h-4 w-4" />
                </span>
                <span className="relative z-10">{t(landingTheme.content.secondaryCta)}</span>
              </a>
            </div>
          </div>

          <div className="landing-aquarium-panel relative z-30 mx-auto w-full max-w-2xl overflow-hidden rounded-lg border border-white/30 bg-white/16 p-3 shadow-2xl shadow-cyan-950/35 backdrop-blur-xl sm:p-5">
            {panelAssets.map(renderAsset)}
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-100/85">
                  {t('auth.appNameShort')}
                </p>
              </div>

              <div className="landing-dashboard mt-3 rounded-lg p-2.5 text-cyan-50 sm:mt-4 sm:p-4">
                <div className="grid grid-cols-[0.9fr_1.35fr] gap-3 sm:gap-4">
                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-cyan-100/82">
                      {t('dash.yourProblems')}
                    </p>
                    <div className="space-y-2">
                      {preview.problems.map(problem => (
                        <div key={problem.title} className="landing-problem-row rounded-lg border px-3 py-2.5">
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-cyan-100/78">
                              {problem.dateKey === 'dash.today' ? `🎯 ${t(problem.dateKey)}` : `📅 ${t(problem.dateKey)}`}
                            </span>
                            <span className={`landing-status-chip landing-status-${problem.statusTone}`}>
                              {problem.statusTone === 'done' ? '✓ ' : problem.statusTone === 'todo' ? '⏳ ' : '💬 '}
                              {t(problem.statusKey)}
                            </span>
                          </div>
                          <p className="truncate text-xs font-bold text-white">{problem.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="landing-calendar-shell rounded-lg border p-2 sm:p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex-1 font-serif text-sm font-semibold text-white">{previewCalendar.label}</span>
                      <span className="grid h-6 w-6 place-items-center rounded-full border border-cyan-100/28 text-xs text-cyan-100/76">‹</span>
                      <span className="grid h-6 w-6 place-items-center rounded-full border border-cyan-100/28 text-xs text-cyan-100/76">›</span>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                        <span key={`${day}-${index}`} className="text-center text-[9px] font-black text-cyan-100/72">
                          {day}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1 grid grid-cols-7 gap-1">
                      {previewCalendar.cells.map((cell, index) => (
                        <div
                          key={`${cell.day}-${index}-${cell.problem ?? 'empty'}`}
                          className={`landing-calendar-cell ${cell.today ? 'landing-calendar-today' : ''}`}
                        >
                          <span className="text-[9px] font-black">{cell.day}</span>
                          {cell.problem && (
                            <span className={`landing-calendar-problem landing-calendar-${cell.status ?? 'class'}`}>
                              {cell.status === 'locked' ? '🔒' : cell.status ? '✎' : '◆'} {cell.problem}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {preview.stats.map(stat => {
                    const StatIcon = iconMap[stat.icon]

                    return (
                      <div key={stat.labelKey} className="landing-stat-tile rounded-lg border px-2.5 py-2.5 text-center">
                        <div className="mb-1 flex items-center justify-center gap-1.5">
                          <StatIcon className="h-4 w-4 text-cyan-100" aria-hidden="true" />
                          <span className="text-lg font-black leading-none text-white">{stat.value}</span>
                        </div>
                        <p className="truncate text-[10px] font-bold text-cyan-100/78">{t(stat.labelKey)}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      <div className="landing-seabed" aria-hidden="true">
        {seabedAssets.map(renderAsset)}
      </div>
    </main>
  )
}
