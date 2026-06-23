'use client'

import { useState, useEffect, useRef } from 'react'
import { BookCoverWithOverlays, type OverlayObject } from './BookCoverWithOverlays'
import { buildKeyframesCSS, buildAnimCSS, getTransformOrigin, overlayWidthPct, overlayEdgeFadeStyle } from '@/lib/overlayAnimations'
import { OverlayBurstRenderer } from './OverlayBurstRenderer'
import { OverlayAuraWrapper } from './OverlayAuraWrapper'

interface MagicBookRevealProps {
  title: string
  date: string
  /** Left page: the problem content */
  children: React.ReactNode
  /**
   * Right page: the solution form / submitted answer.
   * On desktop this renders as the right-hand page of the open book.
   * On mobile it renders below the problem page as a normal flow section.
   */
  solutionSlot?: React.ReactNode
  /**
   * URL for the book cover background image.
   * Defaults to the built-in treasure-map image at /book-cover-default.jpg.
   * Override with a shop-purchased skin URL to personalise the cover.
   */
  coverImageUrl?: string
  /**
   * Optional layout for text overlays on the cover (from DB).
   * Only used when coverImageUrl is set. Falls back to built-in defaults.
   */
  coverLayout?: {
    title?: { x: number; y: number; fontSize: number; color: string; shadow: boolean }
    prompt?: { x: number; y: number; fontSize: number; color: string; shadow: boolean }
  }
  /**
   * URL for the open-page background image.
   * Defaults to the built-in aged parchment gradient.
   */
  pageImageUrl?: string
  /**
   * Frame URLs for animated opening sequence (cover skins with is_animated=true).
   * When provided, clicking the cover plays through these frames at ~10fps
   * instead of the CSS flip animation. Last frame = transition complete → open.
   */
  coverFrameUrls?: string[]
  /**
   * Overlay objects from book_skin_overlays — rendered as animated transparent PNGs
   * composited on top of the cover image.
   */
  coverOverlays?: import('./BookCoverWithOverlays').OverlayObject[]
}

/**
 * MagicBookReveal — ancient book opening animation for challenge problems.
 *
 * Desktop (≥ 768 px):
 *   Closed  → full-height dark leather cover with gold filigree + "Open the Book" prompt
 *   Opening → 3-D page-turn with gold sparkles
 *   Open    → two-page spread: left = problem, right = solution form
 *             Clicking the challenge image opens a full-screen lightbox (no new tab)
 *
 * Mobile (< 768 px):
 *   Same cover/animation, single parchment page for the problem, solution slot below.
 */
export function MagicBookReveal({ title, date, children, solutionSlot, coverImageUrl, pageImageUrl, coverLayout, coverFrameUrls, coverOverlays }: MagicBookRevealProps) {
  const [phase, setPhase] = useState<'closed' | 'opening' | 'open'>('closed')
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; angle: number; delay: number }[]
  >([])
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const bookRef = useRef<HTMLDivElement>(null)
  // Frame animation state
  const [currentFrame, setCurrentFrame] = useState(0)
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [framesLoaded, setFramesLoaded] = useState(false)

  // Preload all frames as soon as URLs are available
  useEffect(() => {
    if (!coverFrameUrls || coverFrameUrls.length < 2) return
    setFramesLoaded(false)
    let loaded = 0
    coverFrameUrls.forEach(url => {
      const img = new window.Image()
      img.onload = img.onerror = () => {
        loaded++
        if (loaded === coverFrameUrls.length) setFramesLoaded(true)
      }
      img.src = url
    })
  }, [coverFrameUrls?.join(',')])

  function openBook() {
    if (phase !== 'closed') return

    // If frame sequence provided, play frames instead of CSS flip
    if (coverFrameUrls && coverFrameUrls.length >= 2) {
      setPhase('opening')
      setCurrentFrame(0)
      let idx = 0
      // 8fps gives each frame ~125ms — enough time for the img to paint
      const fps = 8
      const delay = 1000 / fps
      const totalFrames = coverFrameUrls.length

      function nextFrame() {
        idx++
        setCurrentFrame(idx)
        if (idx >= totalFrames - 1) {
          // Hold last frame briefly then open
          setTimeout(() => setPhase('open'), 200)
        } else {
          frameTimerRef.current = setTimeout(nextFrame, delay) as any
        }
      }
      frameTimerRef.current = setTimeout(nextFrame, delay) as any
      return
    }

    // Default: sparkles + CSS flip
    const newParticles = Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: 30 + Math.random() * 40,
      y: 20 + Math.random() * 60,
      angle: Math.random() * 360,
      delay: Math.random() * 0.4,
    }))
    setParticles(newParticles)
    setPhase('opening')
    setTimeout(() => setPhase('open'), 1100)
    setTimeout(() => setParticles([]), 1600)
  }

  // Keyboard: Enter/Space opens book, Escape closes lightbox
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setLightboxSrc(null); return }
      if ((e.key === 'Enter' || e.key === ' ') && phase === 'closed') {
        e.preventDefault()
        openBook()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  // Intercept image clicks inside the left page to open lightbox instead of new tab
  function handlePageClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG') {
      const src = (target as HTMLImageElement).src
      if (src) {
        e.preventDefault()
        e.stopPropagation()
        setLightboxSrc(src)
      }
    }
  }

  /* ─── shared parchment decorations ─── */
  const ParchmentDecor = () => (
    <>
      <div
        className="absolute inset-x-0 top-0 bottom-0 pointer-events-none opacity-10"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(100,60,10,0.5) 27px, rgba(100,60,10,0.5) 28px)',
          backgroundPositionY: '56px',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(80,40,5,0.10) 100%)' }}
      />
      <div
        className="absolute top-0 inset-x-0 h-1 pointer-events-none opacity-60"
        style={{ background: 'linear-gradient(to right, #c8a05a, #d4a842, #c8a05a, #d4a842, #c8a05a)' }}
      />
      <div
        className="absolute bottom-0 inset-x-0 h-1 pointer-events-none opacity-60"
        style={{ background: 'linear-gradient(to right, #c8a05a, #d4a842, #c8a05a, #d4a842, #c8a05a)' }}
      />
    </>
  )

  const DEFAULT_COVER_IMAGE = '/book-cover-default.jpg'
  const DEFAULT_PAGE_BG = 'linear-gradient(to bottom, #faf6ee 0%, #f2e8d5 50%, #ede0c4 100%)'

  /**
   * SVG treasure map used as CSS background when no cover image file is present.
   * Rendered as a data URI — works with no network access or file saves.
   * Replace DEFAULT_COVER_IMAGE with a real .jpg once uploaded to public/.
   */
  const TREASURE_MAP_SVG = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 620" width="400" height="620">
  <defs>
    <radialGradient id="pg" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#e8d5a0"/>
      <stop offset="60%" stop-color="#c8a86a"/>
      <stop offset="100%" stop-color="#8a6030"/>
    </radialGradient>
    <radialGradient id="stain1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#7a5020" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#7a5020" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="stain2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#5a3810" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#5a3810" stop-opacity="0"/>
    </radialGradient>
    <filter id="rough">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
      <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="blend"/>
    </filter>
    <linearGradient id="edgeDark" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#3a2000" stop-opacity="0.5"/>
      <stop offset="8%" stop-color="#3a2000" stop-opacity="0"/>
      <stop offset="92%" stop-color="#3a2000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#3a2000" stop-opacity="0.4"/>
    </linearGradient>
    <linearGradient id="edgeDarkV" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3a2000" stop-opacity="0.45"/>
      <stop offset="10%" stop-color="#3a2000" stop-opacity="0"/>
      <stop offset="88%" stop-color="#3a2000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#3a2000" stop-opacity="0.5"/>
    </linearGradient>
  </defs>

  <!-- Base parchment -->
  <rect width="400" height="620" fill="url(#pg)" filter="url(#rough)"/>

  <!-- Torn/ragged edge effect top -->
  <path d="M0,0 Q20,8 40,3 Q60,-2 80,5 Q100,12 120,4 Q140,-3 160,6 Q180,14 200,3 Q220,-4 240,7 Q260,15 280,4 Q300,-2 320,8 Q340,14 360,3 Q380,-1 400,6 L400,0 Z" fill="#5a3818" opacity="0.6"/>
  <!-- Torn edge bottom -->
  <path d="M0,620 Q25,612 50,618 Q75,622 100,614 Q125,608 150,617 Q175,623 200,613 Q225,606 250,616 Q275,622 300,612 Q325,605 350,615 Q375,621 400,613 L400,620 Z" fill="#5a3818" opacity="0.55"/>
  <!-- Torn edge left -->
  <path d="M0,0 Q8,40 2,80 Q-3,120 6,160 Q13,200 3,240 Q-4,280 5,320 Q12,360 2,400 Q-3,440 7,480 Q14,520 3,560 Q-2,590 4,620 L0,620 Z" fill="#4a2e10" opacity="0.5"/>

  <!-- Water stains -->
  <ellipse cx="280" cy="140" rx="70" ry="45" fill="url(#stain1)"/>
  <ellipse cx="80" cy="350" rx="55" ry="38" fill="url(#stain2)"/>
  <ellipse cx="310" cy="480" rx="45" ry="30" fill="url(#stain1)" opacity="0.7"/>
  <ellipse cx="150" cy="90" rx="30" ry="20" fill="url(#stain2)" opacity="0.6"/>

  <!-- Crease lines -->
  <line x1="0" y1="195" x2="400" y2="210" stroke="#5a3010" stroke-width="0.8" opacity="0.3"/>
  <line x1="0" y1="197" x2="400" y2="212" stroke="#e8cc90" stroke-width="0.4" opacity="0.2"/>
  <line x1="0" y1="430" x2="400" y2="418" stroke="#5a3010" stroke-width="0.7" opacity="0.25"/>
  <line x1="40" y1="0" x2="55" y2="620" stroke="#5a3010" stroke-width="0.6" opacity="0.2"/>
  <!-- Diagonal scratch -->
  <line x1="220" y1="300" x2="380" y2="240" stroke="#4a2800" stroke-width="0.5" opacity="0.2"/>

  <!-- Rough coastline map lines (right side) -->
  <path d="M320,180 Q340,220 330,260 Q345,300 335,340 Q350,380 340,420 Q355,460 345,500" fill="none" stroke="#7a5028" stroke-width="1.2" opacity="0.5" stroke-dasharray="3,2"/>
  <path d="M340,190 Q355,230 348,275 Q360,310 352,350" fill="none" stroke="#7a5028" stroke-width="0.8" opacity="0.35"/>
  <!-- Bottom map text area -->
  <text x="200" y="560" text-anchor="middle" font-family="Georgia,serif" font-size="9" fill="#5a3818" opacity="0.55" letter-spacing="3">NO PARTIN</text>
  <text x="200" y="575" text-anchor="middle" font-family="Georgia,serif" font-size="7" fill="#5a3818" opacity="0.4" letter-spacing="2">· CALIOT · AGUDER ·</text>

  <!-- Main compass rose (centre-right) -->
  <g transform="translate(270,340)">
    <circle cx="0" cy="0" r="36" fill="none" stroke="#7a5028" stroke-width="1" opacity="0.6"/>
    <circle cx="0" cy="0" r="28" fill="none" stroke="#7a5028" stroke-width="0.6" opacity="0.45"/>
    <circle cx="0" cy="0" r="6" fill="#8a6030" opacity="0.7"/>
    <!-- 8 main points -->
    <g stroke="#6a4020" stroke-width="0.8" opacity="0.7">
      <line x1="0" y1="-36" x2="0" y2="36"/>
      <line x1="-36" y1="0" x2="36" y2="0"/>
      <line x1="-25" y1="-25" x2="25" y2="25"/>
      <line x1="25" y1="-25" x2="-25" y2="25"/>
    </g>
    <!-- Arrow points -->
    <path d="M0,-36 L-5,-20 L0,-24 L5,-20 Z" fill="#6a4020" opacity="0.75"/>
    <path d="M0,36 L-4,22 L0,26 L4,22 Z" fill="#8a6030" opacity="0.6"/>
    <path d="M-36,0 L-22,-4 L-26,0 L-22,4 Z" fill="#8a6030" opacity="0.6"/>
    <path d="M36,0 L22,-4 L26,0 L22,4 Z" fill="#8a6030" opacity="0.6"/>
    <!-- Cardinal labels -->
    <text x="0" y="-40" text-anchor="middle" font-family="Georgia,serif" font-size="8" fill="#6a4020" opacity="0.8">N</text>
    <text x="40" y="3" text-anchor="middle" font-family="Georgia,serif" font-size="8" fill="#6a4020" opacity="0.7">E</text>
    <text x="-40" y="3" text-anchor="middle" font-family="Georgia,serif" font-size="8" fill="#6a4020" opacity="0.7">W</text>
  </g>

  <!-- Small compass top-left -->
  <g transform="translate(80,95)" opacity="0.65">
    <circle cx="0" cy="0" r="26" fill="none" stroke="#7a5028" stroke-width="1"/>
    <circle cx="0" cy="0" r="18" fill="none" stroke="#7a5028" stroke-width="0.5"/>
    <circle cx="0" cy="0" r="4" fill="#8a6030"/>
    <g stroke="#6a4020" stroke-width="0.7">
      <line x1="0" y1="-26" x2="0" y2="26"/>
      <line x1="-26" y1="0" x2="26" y2="0"/>
      <line x1="-18" y1="-18" x2="18" y2="18"/>
      <line x1="18" y1="-18" x2="-18" y2="18"/>
    </g>
    <path d="M0,-26 L-3,-14 L0,-18 L3,-14 Z" fill="#6a4020"/>
    <text x="0" y="-29" text-anchor="middle" font-family="Georgia,serif" font-size="7" fill="#6a4020">N</text>
  </g>

  <!-- Tiny bottom-left compass -->
  <g transform="translate(70,480)" opacity="0.55">
    <circle cx="0" cy="0" r="20" fill="none" stroke="#7a5028" stroke-width="0.8"/>
    <g stroke="#6a4020" stroke-width="0.6">
      <line x1="0" y1="-20" x2="0" y2="20"/>
      <line x1="-20" y1="0" x2="20" y2="0"/>
      <line x1="-14" y1="-14" x2="14" y2="14"/>
      <line x1="14" y1="-14" x2="-14" y2="14"/>
    </g>
    <circle cx="0" cy="0" r="3" fill="#8a6030"/>
  </g>

  <!-- Decorative border frame -->
  <rect x="12" y="12" width="376" height="596" fill="none" stroke="#8a6030" stroke-width="1.5" opacity="0.5" rx="3"/>
  <rect x="18" y="18" width="364" height="584" fill="none" stroke="#a07840" stroke-width="0.7" opacity="0.35" rx="2"/>

  <!-- Edge darkening overlay -->
  <rect width="400" height="620" fill="url(#edgeDark)"/>
  <rect width="400" height="620" fill="url(#edgeDarkV)"/>
</svg>`)}`

  const activeCoverImage = coverImageUrl ?? DEFAULT_COVER_IMAGE
  const parchmentBg = pageImageUrl
    ? `url(${pageImageUrl}) center/cover no-repeat`
    : DEFAULT_PAGE_BG

  /**
   * Cover style: uses the custom image if provided, otherwise the inline SVG treasure map.
   * The two-layer fallback was causing the SVG to win over slow-loading images.
   */
  const coverStyle: React.CSSProperties = activeCoverImage !== DEFAULT_COVER_IMAGE
    ? {
        // Real skin image from DB — use it exclusively, centered
        backgroundImage: `url(${activeCoverImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
      }
    : {
        // No custom skin — use the inline SVG treasure map
        backgroundImage: `url(${TREASURE_MAP_SVG})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#b8966a',
      }

  return (
    <>
      {/* Overlay animation keyframes — injected once */}
      <style>{buildKeyframesCSS('bov')}</style>
      <div ref={bookRef} className="relative w-full mb-6" style={{ perspective: '1400px', background: 'transparent' }}>

        {/* ── Sparkle particles ── */}
        {particles.map(p => (
          <div
            key={p.id}
            className="pointer-events-none absolute z-50 text-yellow-400 text-lg select-none"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              animation: 'sparkle-fly 1.2s ease-out forwards',
              animationDelay: `${p.delay}s`,
              opacity: 0,
              transform: `rotate(${p.angle}deg)`,
            }}
          >
            ✦
          </div>
        ))}

        {/* ── Closed / opening cover ── */}
        {phase !== 'open' && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Open the challenge book"
            onClick={openBook}
            className="cursor-pointer select-none flex justify-center"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {coverImageUrl ? (
              /* ── Custom image mode: flip animation, no backing layer ── */
              <div
                className="relative"
                style={{
                  width: 'min(480px, 90vw)',
                  maxHeight: '85vh',
                  perspective: '1200px',
                }}
              >
                {/* Cover — frame player or CSS flip */}
                <div
                  style={{
                    position: 'relative',
                    transformOrigin: 'left center',
                    transformStyle: 'preserve-3d',
                    // Only apply CSS animation when NOT using frame sequence
                    animation: phase === 'opening' && (!coverFrameUrls || coverFrameUrls.length < 2)
                      ? 'book-cover-open 1.1s cubic-bezier(0.4,0,0.2,1) forwards'
                      : undefined,
                    // During frame playback, fade out on last frame
                    opacity: (phase === 'opening' && coverFrameUrls && coverFrameUrls.length >= 2 && currentFrame >= coverFrameUrls.length - 1) ? 0 : 1,
                    transition: (phase === 'opening' && coverFrameUrls && coverFrameUrls.length >= 2) ? 'opacity 0.1s' : undefined,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={(coverFrameUrls && coverFrameUrls.length >= 2 && phase !== 'closed')
                      ? coverFrameUrls[Math.min(currentFrame, coverFrameUrls.length - 1)]
                      : coverImageUrl}
                    alt="Book cover"
                    className="w-full h-auto object-contain"
                    style={{ display: 'block', maxHeight: '85vh' }}
                  />
                  {/* Hidden prerender: keep all frame images decoded in memory */}
                  {coverFrameUrls && coverFrameUrls.length >= 2 && (
                    <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', visibility: 'hidden' }}>
                      {coverFrameUrls.map((url, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={url} alt="" width={1} height={1} />
                      ))}
                    </div>
                  )}
                  {/* Animated overlay objects — paused during book flip */}
                  {coverOverlays && coverOverlays.length > 0 && coverOverlays.map((obj) => {
                    const cfg = obj.overlay_config
                    if (!cfg) return null
                    const sz = overlayWidthPct(cfg.scale ?? 1.0)

                    // Burst animation — canvas-based renderer
                    if ((cfg as any).animation === 'burst' && (cfg as any).burst?.polygon?.length >= 3) {
                      const containerPx = bookRef.current?.offsetWidth ?? 480
                      return (
                        <OverlayBurstRenderer
                          key={obj.id}
                          imageUrl={obj.image_url}
                          containerWidthPx={containerPx}
                          scale={cfg.scale ?? 1.0}
                          speed={(cfg as any).speed ?? 1.0}
                          burst={(cfg as any).burst}
                          paused={phase === 'opening'}
                          style={{ left: `${cfg.x}%`, top: `${cfg.y}%`, transform: 'translate(-50%,-50%)' }}
                        />
                      )
                    }

                    const anim = cfg.animation && cfg.animation !== 'none' ? buildAnimCSS(cfg.animation as any, 'bov', (cfg as any).speed ?? 1.0) : undefined
                    const transformOrigin = getTransformOrigin(cfg.animation as any)
                    const auraStrength = (cfg as any).auraStrength ?? 0
                    return (
                      <div key={obj.id} style={{
                        position: 'absolute', left: `${cfg.x}%`, top: `${cfg.y}%`,
                        width: sz, height: sz, transform: 'translate(-50%,-50%)', pointerEvents: 'none',
                      }}>
                        {auraStrength > 0 && (
                          <OverlayAuraWrapper
                            coverImageUrl={activeCoverImage}
                            xPct={cfg.x} yPct={cfg.y} widthPct={sz}
                            auraStrength={auraStrength}
                            containerWidthPx={bookRef.current?.offsetWidth ?? 480}
                            style={{ position: 'absolute', inset: 0, transform: 'none', left: 0, top: 0, width: '100%', height: '100%' }}
                          ><span /></OverlayAuraWrapper>
                        )}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={obj.image_url} alt={obj.label} draggable={false}
                          style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
                            animation: anim, transformOrigin,
                            animationPlayState: phase === 'opening' ? 'paused' : 'running',
                            ...overlayEdgeFadeStyle((cfg as any).edgeFade),
                          }}
                        />
                      </div>
                    )
                  })}
                  {/* Title overlay */}
                  <div
                    className="absolute text-center px-4 w-full"
                    style={{
                      left: `${coverLayout?.title?.x ?? 50}%`,
                      top: `${coverLayout?.title?.y ?? 22}%`,
                      transform: 'translate(-50%, -50%)',
                      pointerEvents: 'none',
                    }}
                  >
                    <h2
                      className="font-bold leading-snug"
                      style={{
                        fontSize: coverLayout?.title?.fontSize ?? 20,
                        color: coverLayout?.title?.color ?? '#2d1a00',
                        fontFamily: '"Georgia", "Times New Roman", serif',
                        textShadow: (coverLayout?.title?.shadow ?? true)
                          ? '0 1px 8px rgba(255,255,255,0.6), 0 0 16px rgba(0,0,0,0.4)'
                          : undefined,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {title}
                    </h2>
                  </div>
                  {/* Open prompt */}
                  <div
                    className="absolute flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap"
                    style={{
                      left: `${coverLayout?.prompt?.x ?? 50}%`,
                      top: `${coverLayout?.prompt?.y ?? 82}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: coverLayout?.prompt?.fontSize ?? 14,
                      color: coverLayout?.prompt?.color ?? 'rgba(240,215,140,0.97)',
                      textShadow: (coverLayout?.prompt?.shadow ?? true)
                        ? '0 1px 4px rgba(0,0,0,0.8)'
                        : undefined,
                      background: 'rgba(40,25,5,0.72)',
                      border: '1px solid rgba(200,160,60,0.55)',
                      backdropFilter: 'blur(6px)',
                      animation: 'pulse-glow 2.5s ease-in-out infinite',
                    }}
                  >
                    <span style={{ animation: 'wiggle 2s ease-in-out infinite', display: 'inline-block' }}>📜</span>
                    <span style={{ letterSpacing: '0.06em' }}>Open the Book</span>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Default CSS skin mode: spine + cover with wear overlays ── */
            <div
              className="relative flex"
              style={{
                width: 'min(480px, 90vw)',
                aspectRatio: '2 / 3',
                maxHeight: '85vh',
                animation: phase === 'opening'
                  ? 'book-cover-open 1.1s cubic-bezier(0.4,0,0.2,1) forwards'
                  : undefined,
                transformOrigin: 'left center',
                boxShadow:
                  phase === 'opening'
                    ? '8px 10px 32px rgba(0,0,0,0.75)'
                    : '5px 7px 22px rgba(0,0,0,0.6)',
              }}
            >
            {/* Spine */}
            <div
              className="flex-shrink-0 rounded-l-sm"
              style={{
                width: '28px',
                background: 'linear-gradient(to right, #2c1e0a, #4a3218, #5c4020)',
                boxShadow: 'inset -3px 0 8px rgba(0,0,0,0.6)',
              }}
            />

            {/* Front cover — fills remaining width */}
            <div
              className="relative overflow-hidden rounded-r-lg flex-1"
              style={{
                ...coverStyle,
                boxShadow: 'inset 0 0 35px rgba(0,0,0,0.25)',
              }}
            >
              {/* ── Wear & tear layers — only shown when using the default CSS skin, not a custom image ── */}
              {!coverImageUrl && (<>
              {/* Coarse leather grain */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  opacity: 0.18,
                  backgroundImage:
                    'repeating-linear-gradient(17deg, transparent, transparent 1px, rgba(0,0,0,0.08) 1px, rgba(0,0,0,0.08) 2px), ' +
                    'repeating-linear-gradient(107deg, transparent, transparent 3px, rgba(255,255,255,0.04) 3px, rgba(255,255,255,0.04) 4px)',
                }}
              />

              {/* Horizontal crease lines — like folded old leather */}
              <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.22 }}>
                <div style={{ position: 'absolute', top: '28%', left: 0, right: 0, height: '1px', background: 'linear-gradient(to right, transparent 5%, rgba(30,10,0,0.6) 20%, rgba(60,30,0,0.3) 50%, rgba(30,10,0,0.5) 80%, transparent 95%)' }} />
                <div style={{ position: 'absolute', top: '29%', left: '10%', right: '8%', height: '1px', background: 'linear-gradient(to right, transparent, rgba(255,220,140,0.25) 40%, transparent)' }} />
                <div style={{ position: 'absolute', top: '68%', left: 0, right: 0, height: '1px', background: 'linear-gradient(to right, transparent 8%, rgba(30,10,0,0.5) 25%, rgba(60,30,0,0.25) 60%, rgba(20,8,0,0.45) 85%, transparent 96%)' }} />
                <div style={{ position: 'absolute', top: '69%', left: '6%', right: '12%', height: '1px', background: 'linear-gradient(to right, transparent, rgba(255,220,140,0.2) 50%, transparent)' }} />
                {/* Faint diagonal scratch */}
                <div style={{ position: 'absolute', top: '40%', left: '60%', width: '28%', height: '1px', background: 'rgba(20,8,0,0.3)', transform: 'rotate(8deg)', transformOrigin: 'left center' }} />
              </div>

              {/* Water stain blotches */}
              <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.13 }}>
                <div style={{ position: 'absolute', top: '15%', left: '55%', width: '22%', height: '14%', borderRadius: '60% 40% 55% 45%', background: 'radial-gradient(ellipse, rgba(60,30,5,0.7) 0%, transparent 70%)' }} />
                <div style={{ position: 'absolute', top: '55%', left: '8%',  width: '18%', height: '12%', borderRadius: '45% 55% 50% 50%', background: 'radial-gradient(ellipse, rgba(50,25,5,0.6) 0%, transparent 70%)' }} />
                <div style={{ position: 'absolute', top: '72%', left: '65%', width: '14%', height: '10%', borderRadius: '50% 50% 40% 60%', background: 'radial-gradient(ellipse, rgba(40,20,5,0.5) 0%, transparent 70%)' }} />
              </div>

              {/* Edge darkening — worn away from handling */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `
                    linear-gradient(to right,  rgba(0,0,0,0.0) 4%, transparent 18%),
                    linear-gradient(to left,   rgba(0,0,0,0.18) 0%, transparent 15%),
                    linear-gradient(to bottom, rgba(0,0,0,0.22) 0%, transparent 12%),
                    linear-gradient(to top,    rgba(0,0,0,0.25) 0%, transparent 14%)
                  `,
                }}
              />

              {/* Faded / chipped gold border */}
              <div
                className="absolute pointer-events-none"
                style={{
                  inset: '14px',
                  border: '2px solid rgba(180,140,50,0.38)',
                  borderRadius: '4px',
                  boxShadow: 'inset 0 0 16px rgba(160,120,30,0.08)',
                  outline: '1px solid rgba(80,50,10,0.15)',
                  outlineOffset: '3px',
                }}
              />
              <div
                className="absolute pointer-events-none"
                style={{
                  inset: '20px',
                  border: '1px solid rgba(160,120,40,0.22)',
                  borderRadius: '2px',
                }}
              />

              {/* Corner wear marks — scuffed, not crisp ornaments */}
              {[
                { pos: 'top-3 left-3',     rot: '0deg'   },
                { pos: 'top-3 right-3',    rot: '90deg'  },
                { pos: 'bottom-3 right-3', rot: '180deg' },
                { pos: 'bottom-3 left-3',  rot: '270deg' },
              ].map(({ pos, rot }) => (
                <div
                  key={pos}
                  className={`absolute ${pos} pointer-events-none`}
                  style={{
                    width: '28px', height: '28px',
                    transform: `rotate(${rot})`,
                    opacity: 0.5,
                  }}
                >
                  {/* L-shaped corner bracket, faded */}
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '2px', background: 'linear-gradient(to right, rgba(180,140,50,0.7), transparent)' }} />
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '2px', height: '100%', background: 'linear-gradient(to bottom, rgba(180,140,50,0.7), transparent)' }} />
                </div>
              ))}

              {/* Torn / rough top edge illusion */}
              <div
                className="absolute top-0 inset-x-0 pointer-events-none"
                style={{
                  height: '6px',
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 100%)',
                  borderTopLeftRadius: '0',
                  borderTopRightRadius: '4px',
                }}
              />
              </>)}

              {/* Cover content */}
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-12 py-16 text-center">
                {/* Faded compass-rose / seal icon */}
                <div
                  className="mb-5 text-5xl"
                  style={{
                    filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.8)) sepia(0.6) brightness(0.85)',
                    opacity: 0.9,
                  }}
                >
                  🧭
                </div>

                {/* Worn top rule */}
                <div className="flex items-center gap-2 mb-4 w-4/5" style={{ opacity: 0.55 }}>
                  <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(200,160,60,0.8))' }} />
                  <span style={{ color: 'rgba(200,160,60,0.8)', fontSize: '10px' }}>✦</span>
                  <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, rgba(200,160,60,0.8))' }} />
                </div>

                <h2
                  className="text-2xl font-bold mb-3 leading-snug"
                  style={{
                    color: '#f0dea0',
                    fontFamily: '"Georgia", "Times New Roman", serif',
                    textShadow: '0 1px 8px rgba(0,0,0,0.9), 0 0 24px rgba(180,140,40,0.2)',
                    letterSpacing: '0.06em',
                    maxWidth: '80%',
                    /* Slight fade to simulate age-bleached ink */
                    opacity: 0.92,
                  }}
                >
                  {title}
                </h2>

                <p
                  className="text-sm mb-5"
                  style={{
                    color: 'rgba(230,200,130,0.55)',
                    fontFamily: '"Georgia", serif',
                    fontStyle: 'italic',
                    letterSpacing: '0.1em',
                  }}
                >
                  {date}
                </p>

                {/* Worn bottom rule */}
                <div className="flex items-center gap-2 mb-6 w-4/5" style={{ opacity: 0.45 }}>
                  <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(200,160,60,0.7))' }} />
                  <span style={{ color: 'rgba(200,160,60,0.7)', fontSize: '10px' }}>✦</span>
                  <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, rgba(200,160,60,0.7))' }} />
                </div>

                {/* Open prompt — looks like a wax-seal button */}
                <div
                  className="flex items-center gap-3 px-6 py-3 rounded-full text-sm font-semibold"
                  style={{
                    background: 'rgba(100,70,20,0.55)',
                    border: '1px solid rgba(200,160,60,0.4)',
                    color: 'rgba(240,215,140,0.9)',
                    animation: 'pulse-glow 2.5s ease-in-out infinite',
                    boxShadow: 'inset 0 1px 0 rgba(255,220,100,0.1)',
                  }}
                >
                  <span style={{ animation: 'wiggle 2s ease-in-out infinite', display: 'inline-block' }}>📜</span>
                  <span style={{ letterSpacing: '0.08em' }}>Open the Book</span>
                </div>
              </div>
            </div>
            </div>
            )}
          </div>
        )}

        {/* ── Open book ── */}
        {phase === 'open' && (
          <>
            {/* ════ DESKTOP: two-page spread ════ */}
            <div
              className="hidden md:flex relative rounded-lg overflow-hidden"
              style={{
                animation: 'book-settle 0.4s ease-out forwards',
                boxShadow: '0 10px 40px rgba(0,0,0,0.45)',
                minHeight: '540px',
              }}
            >
              {/* ── Left page: Problem ── */}
              <div
                className="relative flex-1 overflow-y-auto"
                style={{
                  background: parchmentBg,
                  borderRight: '3px solid rgba(100,60,10,0.2)',
                  boxShadow: 'inset -6px 0 18px rgba(0,0,0,0.1)',
                  maxHeight: '80vh',
                }}
                onClick={handlePageClick}
              >
                <ParchmentDecor />
                <div
                  className="absolute inset-y-0 left-8 w-px pointer-events-none opacity-25"
                  style={{ background: 'rgba(180,100,40,0.6)' }}
                />
                <div
                  className="relative z-10 px-10 py-8"
                  style={{ animation: 'content-fade-in 0.5s ease-out 0.1s both' }}
                >
                  <div className="text-center mb-5">
                    <div
                      className="inline-flex items-center gap-3 text-sm"
                      style={{ color: 'rgba(100,60,10,0.6)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
                    >
                      <span>— ✦ —</span>
                      <span>{date}</span>
                      <span>— ✦ —</span>
                    </div>
                  </div>
                  <div
                    style={{ fontFamily: '"Georgia", "Times New Roman", serif', color: '#2d1a00', lineHeight: '1.8' }}
                  >
                    {children}
                  </div>
                  <div
                    className="text-center mt-6 text-xs"
                    style={{ color: 'rgba(100,60,10,0.4)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
                  >
                    i
                  </div>
                </div>
              </div>

              {/* Spine shadow */}
              <div
                className="absolute inset-y-0 pointer-events-none z-10"
                style={{
                  left: '50%',
                  width: '12px',
                  transform: 'translateX(-50%)',
                  background:
                    'linear-gradient(to right, rgba(0,0,0,0.18), rgba(0,0,0,0.04) 40%, rgba(0,0,0,0.04) 60%, rgba(0,0,0,0.18))',
                }}
              />

              {/* ── Right page: Solution ── */}
              <div
                className="relative flex-1 overflow-y-auto"
                style={{ background: parchmentBg, maxHeight: '80vh' }}
              >
                <ParchmentDecor />
                <div
                  className="absolute inset-y-0 left-8 w-px pointer-events-none opacity-25"
                  style={{ background: 'rgba(180,100,40,0.6)' }}
                />
                <div
                  className="relative z-10 px-10 py-8"
                  style={{ animation: 'content-fade-in 0.5s ease-out 0.2s both' }}
                >
                  <div className="text-center mb-5">
                    <p
                      className="text-sm font-semibold tracking-widest uppercase"
                      style={{ color: 'rgba(100,60,10,0.55)', fontFamily: 'Georgia, serif', letterSpacing: '0.15em' }}
                    >
                      ✍ Your Answer
                    </p>
                  </div>
                  {solutionSlot ? (
                    <div style={{ fontFamily: '"Georgia", "Times New Roman", serif', color: '#2d1a00' }}>
                      {solutionSlot}
                    </div>
                  ) : (
                    <p
                      className="text-center text-sm italic"
                      style={{ color: 'rgba(100,60,10,0.4)', fontFamily: 'Georgia, serif' }}
                    >
                      — this page is blank —
                    </p>
                  )}
                  <div
                    className="text-center mt-6 text-xs"
                    style={{ color: 'rgba(100,60,10,0.4)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
                  >
                    ii
                  </div>
                </div>
              </div>
            </div>

            {/* ════ MOBILE: single parchment page ════ */}
            <div
              className="block md:hidden relative rounded-lg overflow-hidden"
              style={{
                animation: 'book-settle 0.4s ease-out forwards',
                background: parchmentBg,
                boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
              }}
              onClick={handlePageClick}
            >
              <ParchmentDecor />
              <div
                className="absolute inset-y-0 left-6 w-px pointer-events-none opacity-25"
                style={{ background: 'rgba(180,100,40,0.6)' }}
              />
              <div
                className="relative z-10 px-6 py-6"
                style={{ animation: 'content-fade-in 0.5s ease-out 0.1s both' }}
              >
                <div className="text-center mb-4">
                  <div
                    className="inline-flex items-center gap-2 text-xs"
                    style={{ color: 'rgba(100,60,10,0.6)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
                  >
                    <span>— ✦ —</span>
                    <span>{date}</span>
                    <span>— ✦ —</span>
                  </div>
                </div>
                <div
                  style={{ fontFamily: '"Georgia", "Times New Roman", serif', color: '#2d1a00', lineHeight: '1.8' }}
                >
                  {children}
                </div>
              </div>
            </div>

            {/* Mobile: solution slot below */}
            {solutionSlot && (
              <div className="block md:hidden mt-4">
                {solutionSlot}
              </div>
            )}
          </>
        )}

        {/* ── Keyframe styles ── */}
        <style jsx>{`
          @keyframes page-turn {
            0%   { transform: rotateY(0deg);    box-shadow: 6px 8px 24px rgba(0,0,0,0.55); }
            60%  { transform: rotateY(-90deg);  box-shadow: 0 10px 50px rgba(0,0,0,0.75); }
            100% { transform: rotateY(-175deg); opacity: 0; box-shadow: none; }
          }
          @keyframes book-cover-open {
            0%   { transform: rotateY(0deg);     opacity: 1; }
            50%  { transform: rotateY(-70deg);   opacity: 1; }
            85%  { transform: rotateY(-108deg);  opacity: 0.6; }
            100% { transform: rotateY(-115deg);  opacity: 0; }
          }
          @keyframes book-settle {
            from { transform: scale(0.97) translateY(8px); opacity: 0.8; }
            to   { transform: scale(1)    translateY(0);   opacity: 1; }
          }
          @keyframes content-fade-in {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 0 0    rgba(212,175,55,0); }
            50%       { box-shadow: 0 0 16px rgba(212,175,55,0.45); }
          }
          @keyframes wiggle {
            0%, 100% { transform: rotate(-8deg); }
            50%       { transform: rotate(8deg); }
          }
          @keyframes sparkle-fly {
            0%   { opacity: 0; transform: rotate(0deg) translateY(0)    scale(0.5); }
            30%  { opacity: 1; }
            100% { opacity: 0; transform: rotate(0deg) translateY(-60px) scale(1.5); }
          }
        `}</style>
      </div>

      {/* ── Lightbox overlay ── */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
          onClick={() => setLightboxSrc(null)}
        >
          {/* Close button */}
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 text-white text-3xl leading-none hover:text-yellow-300 transition-colors"
            aria-label="Close image"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
          >
            ✕
          </button>

          {/* Image — constrained to viewport, click stops propagation so overlay click still closes */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt="Challenge image enlarged"
            className="max-w-[92vw] max-h-[90vh] rounded-lg object-contain"
            style={{
              boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
              animation: 'content-fade-in 0.2s ease-out both',
            }}
            onClick={(e) => e.stopPropagation()}
          />

          <p
            className="absolute bottom-4 text-xs"
            style={{ color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}
          >
            Click anywhere to close
          </p>

          <style jsx>{`
            @keyframes content-fade-in {
              from { opacity: 0; transform: scale(0.95); }
              to   { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </div>
      )}
    </>
  )
}
