'use client'

/**
 * DriveBook Logo Component
 *
 * Usage:
 *   <Logo />                          — icon + wordmark (default)
 *   <Logo variant="icon" size={40} /> — D-mark only
 *   <Logo variant="wordmark" />       — text wordmark only
 *   <Logo dark />                     — dark background version (white "Drive" text)
 */

interface LogoProps {
  variant?: 'full' | 'icon' | 'wordmark'
  /** Icon height in px. Wordmark scales proportionally. */
  size?: number
  /** Use on dark backgrounds — flips "Drive" text to white */
  dark?: boolean
  className?: string
}

export default function Logo({ variant = 'full', size = 36, dark = false, className = '' }: LogoProps) {
  if (variant === 'icon')     return <DMark size={size} className={className} />
  if (variant === 'wordmark') return <Wordmark size={size} dark={dark} className={className} />
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <DMark size={size} />
      <Wordmark size={size} dark={dark} />
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// D-mark icon
// ─────────────────────────────────────────────────────────────────────────────
function DMark({ size, className = '' }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="db-dg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#4338ca" />
          <stop offset="55%"  stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <radialGradient id="db-wg" cx="50%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <clipPath id="db-dc">
          <path
            d="M10 6 L10 154 L58 154 C108 154 150 138 150 80 C150 22 108 6 58 6 Z
               M38 30 L58 30 C88 30 120 44 120 80 C120 116 88 130 58 130 L38 130 Z"
            fillRule="evenodd"
          />
        </clipPath>
      </defs>

      {/* D letterform */}
      <path
        d="M10 6 L10 154 L58 154 C108 154 150 138 150 80 C150 22 108 6 58 6 Z
           M38 30 L58 30 C88 30 120 44 120 80 C120 116 88 130 58 130 L38 130 Z"
        fill="url(#db-dg)"
        fillRule="evenodd"
      />

      {/* Road — clipped inside D */}
      <g clipPath="url(#db-dc)">
        {/* Dark tarmac */}
        <path
          d="M18 158 C26 132 36 118 50 106 C64 94 80 86 96 76 C112 66 122 58 128 42"
          stroke="#1e1b4b"
          strokeWidth="27"
          strokeLinecap="round"
          fill="none"
        />
        {/* Centre dashes */}
        <path
          d="M18 158 C26 132 36 118 50 106 C64 94 80 86 96 76 C112 66 122 58 128 42"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="9 8"
          fill="none"
          opacity={0.85}
        />
      </g>

      {/* Steering wheel @ (66, 96) */}
      <circle cx="66" cy="96" r="21" fill="url(#db-wg)" />
      <circle cx="66" cy="96" r="13" fill="#fbbf24" />
      <circle cx="66" cy="96" r="5"  fill="#d97706" />
      {/* Spokes */}
      <line x1="66" y1="75"  x2="66" y2="83"  stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="66" y1="109" x2="66" y2="117" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="45" y1="96"  x2="53" y2="96"  stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="79" y1="96"  x2="87" y2="96"  stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="51" y1="81"  x2="57" y2="87"  stroke="#d97706" strokeWidth="3"   strokeLinecap="round" />
      <line x1="81" y1="81"  x2="75" y2="87"  stroke="#d97706" strokeWidth="3"   strokeLinecap="round" />
      <line x1="51" y1="111" x2="57" y2="105" stroke="#d97706" strokeWidth="3"   strokeLinecap="round" />
      <line x1="81" y1="111" x2="75" y2="105" stroke="#d97706" strokeWidth="3"   strokeLinecap="round" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Wordmark  "Drive" + "Book"
// ─────────────────────────────────────────────────────────────────────────────
function Wordmark({ size, dark, className = '' }: { size: number; dark?: boolean; className?: string }) {
  const fs = Math.round(size * 0.75)
  const driveColour = dark ? 'text-white' : 'text-slate-900'
  return (
    <span
      className={`font-extrabold leading-none tracking-tight ${className}`}
      style={{ fontSize: fs }}
    >
      <span className={driveColour}>Drive</span>
      <span className="bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">
        Book
      </span>
    </span>
  )
}
