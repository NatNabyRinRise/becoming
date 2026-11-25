interface Props {
  value: number // 0..1
  size?: number
  stroke?: number
  color?: string
  track?: string
  children?: React.ReactNode
  label?: string
}
export function ProgressRing({ value, size = 64, stroke = 5, color = 'var(--c-plum)', track = 'rgba(255,255,255,0.5)', children, label }: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 800ms ease' }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center text-center">{children}</div>}
    </div>
  )
}
