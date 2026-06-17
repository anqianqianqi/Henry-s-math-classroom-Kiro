'use client'

import { useState, useEffect, useRef } from 'react'

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
   * URL for the open-page background image (tiled or stretched).
   * Defaults to the built-in aged parchment gradient.
   * Override with a shop-purchased page skin URL.
   */
  pageImageUrl?: string
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
export function MagicBookReveal({ title, date, children, solutionSlot, coverImageUrl, pageImageUrl }: MagicBookRevealProps) {
  const [phase, setPhase] = useState<'closed' | 'opening' | 'open'>('closed')
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; angle: number; delay: number }[]
  >([])
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const bookRef = useRef<HTMLDivElement>(null)

  function openBook() {
    if (phase !== 'closed') return
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

  const activeCoverImage = coverImageUrl ?? DEFAULT_COVER_IMAGE
  const parchmentBg = pageImageUrl
    ? `url(${pageImageUrl}) center/cover no-repeat`
    : DEFAULT_PAGE_BG

  return (
    <>
      <div ref={bookRef} className="relative w-full mb-6" style={{ perspective: '1400px' }}>

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
            className="relative w-full cursor-pointer select-none"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Spine — worn, darker at edges */}
            <div
              className="absolute inset-y-0 left-0 w-8 rounded-l-sm z-10"
              style={{
                background: 'linear-gradient(to right, #2c1e0a, #4a3218, #5c4020)',
                boxShadow: 'inset -3px 0 8px rgba(0,0,0,0.6), 2px 0 6px rgba(0,0,0,0.4)',
              }}
            />

            {/* Front cover — aged, uneven, treasure-map worn */}
            <div
              className="relative overflow-hidden rounded-r-lg rounded-l-none"
              style={{
                /*
                 * Cover skin: custom image (or default treasure map) as base layer.
                 * All the wear-and-tear overlays sit on top via child divs.
                 */
                backgroundImage: `url(${activeCoverImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                boxShadow:
                  phase === 'opening'
                    ? '8px 10px 32px rgba(0,0,0,0.75), inset 0 0 50px rgba(0,0,0,0.35)'
                    : '5px 7px 22px rgba(0,0,0,0.6), inset 0 0 35px rgba(0,0,0,0.25)',
                minHeight: '480px',
                transformOrigin: 'left center',
                animation: phase === 'opening'
                  ? 'page-turn 1s cubic-bezier(0.4,0,0.2,1) forwards'
                  : undefined,
              }}
            >
              {/* ── Wear & tear layers ── */}

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

              {/* Faded / chipped gold border — gaps simulated by low opacity */}
              <div
                className="absolute pointer-events-none"
                style={{
                  inset: '14px',
                  border: '2px solid rgba(180,140,50,0.38)',
                  borderRadius: '4px',
                  boxShadow: 'inset 0 0 16px rgba(160,120,30,0.08)',
                  /* Chip effect: mask parts of the border using box-shadow hack */
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

              {/* Cover content */}
              <div className="relative z-10 flex flex-col items-center justify-center min-h-[480px] px-12 py-16 text-center">
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
