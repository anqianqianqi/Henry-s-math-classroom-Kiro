'use client'

import { landingTheme, type LandingAsset } from '@/lib/landing/scene'
import { getOceanTimeClass } from '@/lib/landing/timeOfDay'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

type LandingCssVars = CSSProperties & Record<`--${string}`, string | number | undefined>

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

  if (asset.kind === 'fish') {
    return {
      top: asset.top,
      animationDelay: asset.delay,
      animationDuration: asset.speed,
      '--fish-scale': asset.scale ?? 1,
      backgroundColor: asset.src ? undefined : asset.color,
      backgroundImage: asset.src ? `url(${asset.src})` : undefined,
    }
  }

  if (
    asset.kind === 'clownfish' ||
    asset.kind === 'seahorse' ||
    asset.kind === 'turtle' ||
    asset.kind === 'ray' ||
    asset.kind === 'octopus' ||
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
      backgroundImage: asset.src ? `url(${asset.src})` : undefined,
    }
  }

  if (asset.kind === 'jellyfish') {
    return {
      backgroundImage: asset.src ? `url(${asset.src})` : undefined,
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

  if (asset.kind === 'fish') {
    if (asset.src) {
      return (
        <span
          key={`fish-${index}`}
          className={`landing-art landing-art-fish ${asset.className ?? ''}`}
          aria-hidden="true"
          style={assetStyle(asset)}
        />
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
      return (
        <span
          key={`jellyfish-${index}`}
          className={`landing-art landing-art-jellyfish ${asset.className ?? ''}`}
          aria-hidden="true"
          style={assetStyle(asset)}
        />
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
    asset.kind === 'starfish' ||
    asset.kind === 'crab' ||
    asset.kind === 'shell'
  ) {
    if (asset.src) {
      return (
        <span
          key={`${asset.kind}-${index}`}
          className={`landing-art landing-art-${asset.kind} ${asset.className ?? ''}`}
          aria-hidden="true"
          style={assetStyle(asset)}
        />
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
  const floatingAssets = landingTheme.assets.filter(asset => assetLayer(asset) === 'background')
  const seabedAssets = landingTheme.assets.filter(asset => assetLayer(asset) === 'seabed')

  useEffect(() => {
    setOceanTimeClass(getOceanTimeClass())

    const interval = window.setInterval(() => {
      setOceanTimeClass(getOceanTimeClass())
    }, 60_000)

    return () => window.clearInterval(interval)
  }, [])

  return (
    <main className={`${landingTheme.className} ${oceanTimeClass} relative min-h-screen overflow-hidden text-white`} style={themeVars()}>
      <div className="landing-sunbeams" aria-hidden="true" />
      <div className="landing-current landing-current-one" aria-hidden="true" />
      <div className="landing-current landing-current-two" aria-hidden="true" />
      {floatingAssets.map(renderAsset)}

      <section className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
        {children}
      </section>

      <div className="landing-seabed" aria-hidden="true">
        {seabedAssets.map(renderAsset)}
      </div>
    </main>
  )
}
