import { useId } from 'react'

interface OrbProps {
  size?: number
  /** 0..1 — today's progress, brightens the glow */
  progress?: number
  /** 0..4 evolution stage from long-term progress */
  stage?: number
  /** 0..100 energy, tints the orb from lavender to gold */
  energy?: number
  rings?: boolean
  star?: boolean
  breathe?: boolean
  className?: string
  children?: React.ReactNode
}

/** The Becoming Orb — pearl sphere with orbital ring and four-point star. */
export function Orb({ size = 240, progress = 0, stage = 0, energy = 60, rings = true, star = true, breathe = true, className = '', children }: OrbProps) {
  const id = useId().replace(/:/g, '')
  const warm = Math.max(0, Math.min(1, energy / 100))
  const glow = 0.25 + progress * 0.55
  const starScale = 0.5 + stage * 0.12 + progress * 0.15
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <div
        className="absolute inset-[-12%] rounded-full blur-2xl transition-opacity duration-1000"
        style={{ background: `radial-gradient(circle, rgba(233,216,180,${glow}) 0%, rgba(169,154,203,${glow * 0.6}) 45%, transparent 70%)` }}
        aria-hidden
      />
      <svg viewBox="0 0 200 200" width={size} height={size} className={`relative ${breathe ? 'anim-breathe' : ''}`} aria-hidden>
        <defs>
          <radialGradient id={`g${id}`} cx="35%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#fffaf0" />
            <stop offset={`${30 + warm * 10}%`} stopColor="#e9d8b4" />
            <stop offset="68%" stopColor="#c8b8e0" />
            <stop offset="100%" stopColor="#9c8cc4" />
          </radialGradient>
          <linearGradient id={`r${id}`} x1="0" x2="1">
            <stop offset="0%" stopColor="#fff7e6" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#fff7e6" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        {rings && (
          <g className="anim-spin" style={{ transformOrigin: '100px 100px' }}>
            <ellipse cx="100" cy="100" rx="96" ry="34" fill="none" stroke={`url(#r${id})`} strokeWidth="2.2" transform="rotate(-28 100 100)" strokeDasharray="160 18 400" />
            <circle cx="183" cy="56" r="3.6" fill="#fff" />
            <circle cx="17" cy="144" r="3.6" fill="#fff" />
          </g>
        )}
        <circle cx="100" cy="100" r="66" fill={`url(#g${id})`} stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" />
        {stage >= 2 && <circle cx="100" cy="100" r="72" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />}
        {stage >= 3 && <circle cx="100" cy="100" r="78" fill="none" stroke="rgba(233,216,180,0.6)" strokeWidth="0.6" strokeDasharray="2 5" />}
        {star && (
          <path
            transform={`translate(100 100) scale(${starScale}) translate(-100 -100)`}
            d="M100 50 C104 86 114 96 150 100 C114 104 104 114 100 150 C96 114 86 104 50 100 C86 96 96 86 100 50 Z"
            fill="#fff8e8"
            opacity={0.95}
          />
        )}
        <ellipse cx="78" cy="68" rx="22" ry="12" fill="#fff" opacity="0.35" transform="rotate(-30 78 68)" />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>}
    </div>
  )
}
