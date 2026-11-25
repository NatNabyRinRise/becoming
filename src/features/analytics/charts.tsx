import { thaiShortDate } from '../../utils/date'

/** Smooth "energy wave" from self-reported check-ins. Gaps are shown as missing points. */
export function EnergyWave({ data }: { data: { date: string; energy: number | null }[] }) {
  const W = 300
  const H = 90
  const pts = data.map((d, i) => ({ x: (i / Math.max(1, data.length - 1)) * W, y: d.energy === null ? null : H - (d.energy / 100) * (H - 10) - 5, d }))
  const known = pts.filter((p): p is { x: number; y: number; d: (typeof data)[number] } => p.y !== null)
  let path = ''
  known.forEach((p, i) => {
    if (i === 0) path = `M${p.x},${p.y}`
    else {
      const prev = known[i - 1]
      const cx = (prev.x + p.x) / 2
      path += ` C${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`
    }
  })
  return (
    <svg viewBox={`0 -4 ${W} ${H + 24}`} className="w-full" role="img" aria-label={`พลังงานที่ประเมินเอง ${known.map((k) => `${thaiShortDate(k.d.date)} ${k.d.energy}%`).join(', ') || 'ยังไม่มีข้อมูล'}`}>
      <defs>
        <linearGradient id="ew" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a99acb" stopOpacity=".45" />
          <stop offset="1" stopColor="#a99acb" stopOpacity="0" />
        </linearGradient>
      </defs>
      {known.length > 1 && <path d={`${path} L${known[known.length - 1].x},${H} L${known[0].x},${H} Z`} fill="url(#ew)" />}
      {known.length > 1 && <path d={path} fill="none" stroke="#645b7c" strokeWidth="2" strokeLinecap="round" />}
      {known.map((p) => <circle key={p.d.date} cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="#645b7c" strokeWidth="1.5" />)}
      {pts.map((p) => (
        <text key={p.d.date} x={p.x} y={H + 16} fontSize="9" textAnchor="middle" fill="#5f5873">{thaiShortDate(p.d.date).split(' ')[0]}</text>
      ))}
    </svg>
  )
}

export function Bars({ data, unit = '′', color = '#a99acb' }: { data: { label: string; value: number }[]; unit?: string; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex h-32 items-end gap-2" role="img" aria-label={data.map((d) => `${d.label} ${d.value}${unit}`).join(', ')}>
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] text-soft">{d.value > 0 ? `${d.value}${unit}` : ''}</span>
          <div className="w-full max-w-[28px] rounded-full" style={{ height: `${Math.max(4, (d.value / max) * 88)}px`, background: d.value ? `linear-gradient(180deg, #e9d8b4, ${color})` : 'rgba(255,255,255,.5)' }} />
          <span className="text-[10px] text-soft">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

/** Mission "planet": size is fixed, the fill ring shows target progress. */
export function Planet({ color, value, label, sub }: { color: string; value: number; label: string; sub: string }) {
  const r = 30
  const c = 2 * Math.PI * (r + 6)
  return (
    <div className="flex flex-col items-center text-center">
      <svg viewBox="0 0 84 84" width="84" height="84" aria-hidden>
        <circle cx="42" cy="42" r={r + 6} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="2" />
        <circle cx="42" cy="42" r={r + 6} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 42 42)" />
        <defs>
          <radialGradient id={`p${label.replace(/\W/g, '')}`} cx="35%" cy="30%" r="80%">
            <stop offset="0" stopColor="#fffaf0" />
            <stop offset="1" stopColor={color} />
          </radialGradient>
        </defs>
        <circle cx="42" cy="42" r={r} fill={`url(#p${label.replace(/\W/g, '')})`} />
        <text x="42" y="47" textAnchor="middle" fontSize="14" fill="#302b3d" fontWeight="300">{value}%</text>
      </svg>
      <p className="mt-1 text-xs leading-tight">{label}</p>
      <p className="text-[10px] text-soft">{sub}</p>
    </div>
  )
}
