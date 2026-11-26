import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Coffee, Play, RefreshCw } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { EnergySlider, TimeChips } from '../../components/ui/controls'
import { Avatar } from '../../components/companions/Avatar'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { useToday } from '../../hooks/useToday'
import { recommend } from '../../engine/recommendations'
import { COMPANIONS, MISSION_META } from '../../data/seed'
import { MomentPick } from '../attention/MomentPick'

export function OpportunitySheet() {
  const open = useUI((s) => s.opportunityOpen)
  const setOpen = useUI((s) => s.setOpportunity)
  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="I Have a Moment">
      {open && <OpportunityFlow onDone={() => setOpen(false)} />}
    </Sheet>
  )
}

export function OpportunityFlow({ onDone }: { onDone: () => void }) {
  const s = useStore()
  const { checkIn } = useToday()
  const nav = useNavigate()
  const [minutes, setMinutes] = useState<number | null>(null)
  const [energy, setEnergy] = useState(checkIn?.energy ?? 60)
  const [confirmed, setConfirmed] = useState(false)
  const [skip, setSkip] = useState<string[]>([])
  const primary = s.projects.find((p) => p.isPrimaryBusiness)

  const rec = useMemo(
    () =>
      minutes === null || !confirmed
        ? null
        : recommend({
            tasks: s.tasks,
            availableMinutes: minutes,
            energy,
            thresholds: s.settings.energyThresholds,
            missionPriorities: s.profile.preferences.missionPriorities,
            primaryProjectId: primary?.id ?? null,
            excludeIds: skip,
          }),
    [minutes, confirmed, energy, s.tasks, s.settings.energyThresholds, s.profile.preferences.missionPriorities, primary, skip],
  )

  const startRest = (m: number) => {
    s.startFocus(null, 'พักฟื้นพลัง', m)
    onDone()
    nav('/focus')
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-soft">มีเวลาว่างกะทันหัน? เลือกเวลา แล้วรับงานเดียวที่พอดี ไม่ต้องไล่ดูทั้งลิสต์</p>
      <div>
        <p className="mb-2 font-medium">มีเวลาเท่าไหร่?</p>
        <TimeChips value={minutes} onChange={(m) => { setMinutes(m); setConfirmed(false); setSkip([]) }} />
      </div>
      {minutes !== null && !confirmed && (
        <div className="space-y-4">
          <EnergySlider value={energy} onChange={setEnergy} />
          <button className="btn btn-primary w-full" onClick={() => setConfirmed(true)}>หางานที่พอดีให้หน่อย</button>
        </div>
      )}
      {minutes !== null && confirmed && <MomentPick minutes={minutes} energy={energy} onDone={onDone} />}
      {rec && rec.kind !== 'recovery' && <p className="label -mb-3">หรืองานส่วนตัวใน BECOMING</p>}
      {rec && (
        <div className="space-y-3 rounded-3xl bg-white/60 p-4">
          <div className="flex items-center gap-2">
            <Avatar id={rec.companionId} size={36} />
            <span className="text-sm text-soft">{COMPANIONS[rec.companionId].name} แนะนำ</span>
          </div>
          {rec.kind === 'task' && (
            <>
              <p className="text-lg">{rec.task.title}</p>
              <p className="text-sm text-soft">{rec.minutes} นาที · {MISSION_META[rec.task.missionId].title}</p>
              <p className="text-sm">{rec.reason}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button className="btn btn-primary" onClick={() => { s.startFocus(rec.task.id, rec.task.title, rec.minutes); onDone(); nav('/focus') }}>
                  <Play size={16} /> เริ่มเลย
                </button>
                <button className="btn btn-soft" onClick={() => setSkip((x) => [...x, rec.task.id])}><RefreshCw size={16} /> อันอื่น</button>
                <button className="btn btn-ghost" onClick={onDone}>ไม่เป็นไร</button>
              </div>
            </>
          )}
          {rec.kind === 'smaller' && (
            <>
              <p className="text-lg">{rec.title}</p>
              <p className="text-sm text-soft">ข้อเสนอแนะ · {rec.reason}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button className="btn btn-primary" onClick={() => { s.startFocus(rec.basedOn.id, rec.basedOn.title, rec.minutes); onDone(); nav('/focus') }}>
                  <Play size={16} /> เริ่ม {rec.minutes} นาที
                </button>
                <button className="btn btn-ghost" onClick={onDone}>ไม่เป็นไร</button>
              </div>
            </>
          )}
          {rec.kind === 'recovery' && (
            <>
              <p className="text-lg">{rec.title}</p>
              <p className="text-sm">{rec.reason}</p>
              {rec.light && <p className="text-sm text-soft">ถ้าอยากขยับเบา ๆ: {rec.light.title}</p>}
              <button className="btn btn-primary" onClick={() => startRest(Math.max(5, rec.minutes))}><Coffee size={16} /> พัก {Math.max(5, rec.minutes)} นาที</button>
            </>
          )}
        </div>
      )}
      {minutes !== null && (
        <button className="btn btn-ghost w-full text-sm" onClick={() => startRest(Math.min(minutes, 20))}>
          <Coffee size={16} /> หรือใช้เวลานี้พักแทน (ไม่ต้องเปลี่ยนทุกช่วงว่างให้เป็นงาน)
        </button>
      )}
    </div>
  )
}
