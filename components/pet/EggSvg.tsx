interface EggSvgProps {
  /** Optional CSS class name applied to the root <svg> element */
  className?: string
  /** Display size in CSS pixels (width and height). Defaults to 200. */
  size?: number
}

/**
 * Shared egg SVG illustration used before a student selects a species.
 * Rendered entirely as inline SVG paths and shapes — no emoji, no external images.
 * viewBox is 200×200.
 */
export default function EggSvg({ className, size = 200 }: EggSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      aria-label="Egg"
      role="img"
    >
      {/* ── Egg body ── */}
      {/* Main egg shape: wider at the bottom, narrower at the top */}
      <ellipse cx="100" cy="112" rx="58" ry="72" fill="#FFF8E7" />

      {/* Subtle shadow at the base */}
      <ellipse cx="100" cy="178" rx="46" ry="8" fill="#E8D5A3" opacity="0.5" />

      {/* ── Shell gradient overlay (lighter top, slightly warmer bottom) ── */}
      <defs>
        <radialGradient id="eggGradient" cx="38%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#FFFDF5" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#F5E6C0" stopOpacity="0.4" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="112" rx="58" ry="72" fill="url(#eggGradient)" />

      {/* ── Egg outline ── */}
      <ellipse
        cx="100"
        cy="112"
        rx="58"
        ry="72"
        fill="none"
        stroke="#D4A843"
        strokeWidth="2.5"
      />

      {/* ── Decorative spots ── */}
      {/* Large spot — upper left */}
      <ellipse cx="72" cy="88" rx="9" ry="7" fill="#F0C060" opacity="0.7" />
      {/* Large spot — right */}
      <ellipse cx="136" cy="110" rx="8" ry="6" fill="#F0C060" opacity="0.65" />
      {/* Medium spot — lower left */}
      <ellipse cx="78" cy="140" rx="6" ry="5" fill="#E8B040" opacity="0.6" />
      {/* Small spot — upper right */}
      <ellipse cx="122" cy="78" rx="5" ry="4" fill="#F0C060" opacity="0.55" />
      {/* Tiny spot — center-right */}
      <ellipse cx="130" cy="148" rx="4" ry="3" fill="#E8B040" opacity="0.5" />

      {/* ── Shine highlights ── */}
      {/* Primary shine — upper left */}
      <ellipse
        cx="78"
        cy="68"
        rx="14"
        ry="9"
        fill="white"
        opacity="0.55"
        transform="rotate(-30 78 68)"
      />
      {/* Secondary shine — smaller, slightly lower */}
      <ellipse
        cx="88"
        cy="82"
        rx="6"
        ry="4"
        fill="white"
        opacity="0.35"
        transform="rotate(-25 88 82)"
      />

      {/* ── Subtle crack lines (hint of life inside) ── */}
      {/* Crack 1 */}
      <path
        d="M 96 95 L 100 102 L 94 108"
        fill="none"
        stroke="#C49030"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
      {/* Crack 2 */}
      <path
        d="M 100 102 L 106 99"
        fill="none"
        stroke="#C49030"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.4"
      />
    </svg>
  )
}
