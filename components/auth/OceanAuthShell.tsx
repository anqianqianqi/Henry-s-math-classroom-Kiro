'use client'

import { landingTheme, type LandingAsset } from '@/lib/landing/scene'
import { getOceanTimeClass } from '@/lib/landing/timeOfDay'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

type LandingCssVars = CSSProperties & Record<`--${string}`, string | number | undefined>

function getSwimDurationScale() {
  if (typeof window === 'undefined') return 1

  return Math.min(1.75, Math.max(0.72, window.innerWidth / 1440))
}

function themeVars(swimDurationScale = 1): LandingCssVars {
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
    '--landing-swim-duration-scale': swimDurationScale,
  }
}

function scaledSwimTime(time: string, swimDurationScale: number) {
  const seconds = Number(time.replace(/s$/, ''))

  if (!Number.isFinite(seconds)) {
    return time
  }

  return `${seconds * swimDurationScale}s`
}

function swimTiming(asset: Extract<LandingAsset, { delay: string; speed: string }>, swimDurationScale: number): LandingCssVars {
  return {
    animationDelay: scaledSwimTime(asset.delay, swimDurationScale),
    animationDuration: scaledSwimTime(asset.speed, swimDurationScale),
  }
}

function assetStyle(asset: LandingAsset, swimDurationScale = 1): LandingCssVars {
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
      ...swimTiming(asset, swimDurationScale),
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
      ...swimTiming(asset, swimDurationScale),
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

function renderAsset(asset: LandingAsset, index: number, swimDurationScale = 1) {
  if (asset.kind === 'bubble') {
    return (
      <span
        key={`bubble-${index}`}
        className="landing-air-bubble"
        aria-hidden="true"
        style={assetStyle(asset, swimDurationScale)}
      />
    )
  }

  if (asset.kind === 'math') {
    return (
      <span
        key={`math-${index}`}
        className={`landing-math-bubble ${asset.className ?? ''}`}
        aria-hidden="true"
        style={assetStyle(asset, swimDurationScale)}
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
          style={assetStyle(asset, swimDurationScale)}
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
        style={assetStyle(asset, swimDurationScale)}
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
          style={assetStyle(asset, swimDurationScale)}
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
          style={assetStyle(asset, swimDurationScale)}
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
        style={assetStyle(asset, swimDurationScale)}
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
        style={assetStyle(asset, swimDurationScale)}
      />
    )
  }

  return (
    <span
      key={`${asset.kind}-${index}`}
      className={`landing-${asset.kind} ${asset.className ?? ''}`}
      aria-hidden="true"
      style={assetStyle(asset, swimDurationScale)}
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

export function OceanAuthShell({ children }: { children: ReactNode }) {
  const [oceanTimeClass, setOceanTimeClass] = useState('landing-ocean-day')
  const [swimDurationScale, setSwimDurationScale] = useState(1)
  const floatingAssets = landingTheme.assets.filter(asset => assetLayer(asset) === 'background')
  const seabedAssets = landingTheme.assets.filter(asset => assetLayer(asset) === 'seabed')

  useEffect(() => {
    setOceanTimeClass(getOceanTimeClass())
    setSwimDurationScale(getSwimDurationScale())

    const updateSwimDurationScale = () => {
      setSwimDurationScale(getSwimDurationScale())
    }

    window.addEventListener('resize', updateSwimDurationScale)

    const interval = window.setInterval(() => {
      setOceanTimeClass(getOceanTimeClass())
    }, 60_000)

    return () => {
      window.removeEventListener('resize', updateSwimDurationScale)
      window.clearInterval(interval)
    }
  }, [])

  return (
    <main className={`${landingTheme.className} ${oceanTimeClass} relative min-h-screen overflow-hidden text-white`} style={themeVars(swimDurationScale)}>
      <div className="landing-sunbeams" aria-hidden="true" />
      <div className="landing-current landing-current-one" aria-hidden="true" />
      <div className="landing-current landing-current-two" aria-hidden="true" />
      {floatingAssets.map((asset, index) => renderAsset(asset, index, swimDurationScale))}

      <section className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
        {children}
      </section>

      <div className="landing-seabed" aria-hidden="true">
        {seabedAssets.map((asset, index) => renderAsset(asset, index, swimDurationScale))}
      </div>
    </main>
  )
}
