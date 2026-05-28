'use client'

interface EvolutionSparkleProps {
  /**
   * When true, the 8-particle radial burst animation plays.
   * When false, nothing is rendered.
   */
  active: boolean
}

/**
 * CSS radial particle burst animation centered on the pet.
 *
 * Renders 8 particles spread evenly at 45° intervals (0°, 45°, 90°, …, 315°).
 * Each particle travels outward from the center over 800ms using CSS keyframes.
 * Positioned absolutely so it overlays the pet SVG without affecting layout.
 *
 * Colors cycle through gold, yellow, orange, and pink for a celebratory effect.
 */
export default function EvolutionSparkle({ active }: EvolutionSparkleProps) {
  if (!active) return null

  return (
    <>
      <style>{`
        @keyframes sparkle-burst {
          0% {
            transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0px) scale(1);
            opacity: 1;
          }
          60% {
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) rotate(var(--angle)) translateY(-70px) scale(0.3);
            opacity: 0;
          }
        }

        .sparkle-particle {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          animation: sparkle-burst 800ms ease-out forwards;
          pointer-events: none;
        }
      `}</style>

      {/* Absolutely-positioned container centered over the pet */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        {/* 8 particles at 45° increments */}
        {PARTICLES.map((particle) => (
          <div
            key={particle.angle}
            className="sparkle-particle"
            style={{
              backgroundColor: particle.color,
              '--angle': `${particle.angle}deg`,
              animationDelay: `${particle.delay}ms`,
              boxShadow: `0 0 6px 2px ${particle.color}`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    </>
  )
}

/** Particle definitions: 8 directions × celebratory colors */
const PARTICLES: Array<{ angle: number; color: string; delay: number }> = [
  { angle: 0,   color: '#FFD700', delay: 0   }, // gold       — up
  { angle: 45,  color: '#FF8C00', delay: 30  }, // orange     — up-right
  { angle: 90,  color: '#FF69B4', delay: 0   }, // pink       — right
  { angle: 135, color: '#FFD700', delay: 30  }, // gold       — down-right
  { angle: 180, color: '#FFEC40', delay: 0   }, // yellow     — down
  { angle: 225, color: '#FF8C00', delay: 30  }, // orange     — down-left
  { angle: 270, color: '#FF69B4', delay: 0   }, // pink       — left
  { angle: 315, color: '#FFEC40', delay: 30  }, // yellow     — up-left
]
