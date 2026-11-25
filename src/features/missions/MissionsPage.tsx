import { useState } from 'react'
import { Plus, Minus, ArrowUp } from 'lucide-react'
import { PageHeader, Card } from '../../components/ui/controls'
import { useStore } from '../../store/useStore'
import { MISSION_META } from '../../data/seed'
import { missionProgress } from '../../engine/analytics'
import { ProgressRing } from '../../components/graphics/ProgressRing'
import type { MissionId } from '../../types'

export function MissionsPage() {
  const s = useStore()
  const order = s.profile.preferences.missionPriorities
  const missions = [...s.missions].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
  const promote = (id: MissionId) => {
    const o = order.filter((x) => x !== id)
    s.updatePreferences({ missionPriorities: [id, ...o] })
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader eyebrow="Annual Missions" title="ภารกิจประจำปี" back />
      <p className="-mt-3 text-sm text-soft">ตัวเลขทั้งหมดแก้ได้ แอปไม่สร้างความสำเร็จให้เอง ลำดับด้านบนคือความสำคัญที่ระบบแนะนำงานใช้</p>
      {missions.map((m, i) => (
        <MissionCard key={m.id} id={m.id} rank={i + 1} onPromote={i > 0 ? () => promote(m.id) : undefined} pct={missionProgress(m)} />
      ))}
    </div>
  )
}

function MissionCard({ id, rank, pct, onPromote }: { id: MissionId; rank: number; pct: number; onPromote?: () => void }) {
  const s = useStore()
  const m = s.missions.find((x) => x.id === id)!
  const [label, setLabel] = useState('')
  const [target, setTarget] = useState(10)
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <div className="flex items-center gap-4">
        <ProgressRing value={pct / 100} size={60} color={MISSION_META[id].color} label={`${m.title} ${pct}%`}>
          <span className="text-sm">{pct}%</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-soft">#{rank} · {m.titleTh}</p>
          <h2 className="text-lg">{m.title}</h2>
        </div>
        {onPromote && <button className="btn btn-ghost !px-3 text-xs" onClick={onPromote} aria-label="ย้ายขึ้นเป็นอันดับแรก"><ArrowUp size={14} /> สำคัญสุด</button>}
      </div>
      <button className="mt-2 text-xs text-plum underline" onClick={() => setOpen((v) => !v)}>{open ? 'ซ่อน' : 'ดูและแก้เป้าหมาย'}</button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-soft">{m.description}</p>
          <ul className="space-y-2">
            {m.targets.map((t) => (
              <li key={t.id} className="rounded-2xl bg-white/40 p-3">
                <p className="text-sm">{t.label}</p>
                <div className="mt-2 flex items-center gap-2">
                  <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/60" aria-label="ลด" onClick={() => s.updateTarget(id, t.id, { current: Math.max(0, t.current - 1) })}><Minus size={14} /></button>
                  <input type="number" min={0} className="field !w-20 !py-1.5 text-center" value={t.current} onChange={(e) => s.updateTarget(id, t.id, { current: Math.max(0, Number(e.target.value)) })} aria-label={`ค่าปัจจุบัน ${t.label}`} />
                  <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/60" aria-label="เพิ่ม" onClick={() => s.updateTarget(id, t.id, { current: t.current + 1 })}><Plus size={14} /></button>
                  <span className="text-sm text-soft">/</span>
                  <input type="number" min={1} className="field !w-20 !py-1.5 text-center" value={t.target} onChange={(e) => s.updateTarget(id, t.id, { target: Math.max(1, Number(e.target.value)) })} aria-label={`เป้าหมาย ${t.label}`} />
                  <span className="text-xs text-soft">{t.unit}</span>
                </div>
              </li>
            ))}
          </ul>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (label.trim()) { s.addTarget(id, label.trim(), 'ครั้ง', target); setLabel('') } }}>
            <input className="field" placeholder="ตัวชี้วัดใหม่" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="ตัวชี้วัดใหม่" />
            <input type="number" min={1} className="field !w-20" value={target} onChange={(e) => setTarget(Number(e.target.value))} aria-label="เป้าหมาย" />
            <button className="btn btn-soft !px-3" aria-label="เพิ่มตัวชี้วัด"><Plus size={16} /></button>
          </form>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={m.status === 'paused'} onChange={(e) => s.updateMission(id, { status: e.target.checked ? 'paused' : 'active' })} /> พักภารกิจนี้ไว้ก่อน
          </label>
        </div>
      )}
    </Card>
  )
}
