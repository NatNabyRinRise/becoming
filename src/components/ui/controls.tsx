import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export const TIME_OPTIONS = [5, 15, 30, 60, 120]

export function TimeChips({ value, onChange, options = TIME_OPTIONS, label = 'เวลาที่มี' }: { value: number | null; onChange: (v: number) => void; options?: number[]; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((m) => (
        <button key={m} type="button" role="radio" aria-checked={value === m} className="chip" onClick={() => onChange(m)}>
          {m === 0 ? '0 นาที' : m >= 60 ? `${m / 60} ชม.` : `${m} นาที`}
        </button>
      ))}
    </div>
  )
}

export function EnergySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="label">พลังงาน (ประเมินเอง)</span>
        <span className="big-num text-3xl">{value}<span className="text-base">%</span></span>
      </div>
      <input type="range" min={0} max={100} step={5} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" aria-label="พลังงาน 0 ถึง 100" />
      <div className="mt-1 flex justify-between text-[11px] text-soft">
        <span>หมดแรง</span>
        <span>พอไหว</span>
        <span>เต็มที่</span>
      </div>
    </div>
  )
}

export function PageHeader({ title, eyebrow, back, right }: { title: string; eyebrow?: string; back?: boolean; right?: React.ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="mb-6 flex items-end justify-between gap-3 pt-2">
      <div className="flex items-center gap-2">
        {back && (
          <button className="btn-ghost -ml-2 rounded-full p-2" onClick={() => nav(-1)} aria-label="ย้อนกลับ">
            <ChevronLeft size={22} />
          </button>
        )}
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="text-2xl sm:text-3xl">{title}</h1>
        </div>
      </div>
      {right}
    </header>
  )
}

export function Card({ children, className = '', as: As = 'section' }: { children: React.ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <As className={`glass rounded-[1.75rem] p-5 ${className}`}>{children}</As>
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-white/60 p-4 text-center text-sm text-soft">{children}</p>
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className="chip" onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
