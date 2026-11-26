import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Play, RefreshCw, Pencil, Check } from 'lucide-react'
import { PageHeader, TimeChips } from '../../components/ui/controls'
import { Orb } from '../../components/graphics/Orb'
import { Avatar } from '../../components/companions/Avatar'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { useToday } from '../../hooks/useToday'
import { recommend } from '../../engine/recommendations'
import { COMPANIONS, MISSION_META } from '../../data/seed'
import type { Circumstance, Mood } from '../../types'
import { BriefingView } from '../attention/BriefingView'

export const MOODS: { id: Mood; emoji: string; label: string }[] = [
  { id: 'great', emoji: '🤩', label: 'ดีมาก' },
  { id: 'good', emoji: '😊', label: 'ดี' },
  { id: 'okay', emoji: '🙂', label: 'เฉย ๆ' },
  { id: 'tired', emoji: '😮‍💨', label: 'เหนื่อย' },
  { id: 'low', emoji: '🥺', label: 'ไม่ค่อยดี' },
]

const REALITY: { id: Circumstance; emoji: string; label: string }[] = [
  { id: 'normal', emoji: '☀️', label: 'วันปกติ' },
  { id: 'baby', emoji: '👶', label: 'ยุ่งกับลูก' },
  { id: 'low_energy', emoji: '🔋', label: 'พลังงานต่ำ' },
  { id: 'unexpected', emoji: '🌪️', label: 'มีเรื่องไม่คาดคิด' },
  { id: 'high_focus', emoji: '🎯', label: 'วันโฟกัสสูง' },
]

export function BriefingPage() {
  const s = useStore()
  const { checkIn } = useToday()
  const nav = useNavigate()
  const toast = useUI((u) => u.showToast)
  const [step, setStep] = useState(0)
  const [energy, setEnergy] = useState(checkIn?.energy ?? 60)
  const [mood, setMood] = useState<Mood>(checkIn?.mood ?? 'okay')
  const [sleep, setSleep] = useState(checkIn?.sleepDuration ?? 7)
  const [minutes, setMinutes] = useState<number>(checkIn?.availableMinutes ?? s.profile.preferences.typicalWorkMinutes ?? 30)
  const [reality, setReality] = useState<Circumstance>(checkIn?.circumstances ?? 'normal')
  const [skip, setSkip] = useState<string[]>([])
  const [editing, setEditing] = useState(false)
  const [pickId, setPickId] = useState<string | null>(null)
  const primary = s.projects.find((p) => p.isPrimaryBusiness)
  const planned = checkIn?.oneThingId ?? null

  const rec = useMemo(
    () =>
      recommend({
        tasks: s.tasks,
        availableMinutes: minutes,
        energy,
        circumstances: reality,
        thresholds: s.settings.energyThresholds,
        missionPriorities: s.profile.preferences.missionPriorities,
        primaryProjectId: primary?.id ?? null,
        excludeIds: skip,
      }),
    [s.tasks, minutes, energy, reality, s.settings.energyThresholds, s.profile.preferences.missionPriorities, primary, skip],
  )
  const plannedTask = planned && !skip.includes(planned) ? s.tasks.find((t) => t.id === planned && t.status !== 'done') : undefined
  const chosen = pickId ? s.tasks.find((t) => t.id === pickId) : plannedTask ?? (rec.kind === 'task' ? rec.task : null)
  const chosenMinutes = chosen ? Math.max(5, chosen.estimatedMinutes - chosen.actualMinutes) : 0

  const accept = (start: boolean) => {
    s.saveCheckIn({ energy, mood, sleepDuration: sleep, availableMinutes: minutes, circumstances: reality, completedAt: s.now().toISOString() })
    s.setOneThing(chosen?.id ?? null)
    if (start && chosen) {
      s.startFocus(chosen.id, chosen.title, Math.min(chosenMinutes, Math.max(5, minutes)))
      nav('/focus')
    } else {
      toast('บันทึก One Thing วันนี้แล้ว ✨')
      nav('/')
    }
  }

  const actionable = s.tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress')

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader eyebrow={`Morning Briefing · ${step + 1}/4`} title={['Energy Check', "Today's Reality", 'Your Briefing', "Today's One Thing"][step]} back />

      {step === 0 && (
        <div className="space-y-6">
          <div className="flex flex-col items-center">
            <Orb size={200} energy={energy} progress={energy / 100} rings={false}>
              <span className="big-num text-5xl text-ink">{energy}</span>
              <span className="text-xs text-soft">พลังงาน %</span>
            </Orb>
            <input type="range" min={0} max={100} step={5} value={energy} onChange={(e) => setEnergy(Number(e.target.value))} className="mt-4 w-full max-w-xs" aria-label="พลังงาน 0 ถึง 100" />
            <p className="mt-1 text-[11px] text-soft">ประเมินความรู้สึกเอง ไม่ใช่ค่าทางการแพทย์</p>
          </div>
          <div>
            <p className="label mb-2">อารมณ์</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="อารมณ์">
              {MOODS.map((m) => (
                <button key={m.id} role="radio" aria-checked={mood === m.id} className="chip" onClick={() => setMood(m.id)}>
                  <span aria-hidden>{m.emoji}</span> {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label mb-2">นอนไปกี่ชั่วโมง: <span className="text-ink">{sleep} ชม.</span></p>
            <input type="range" min={0} max={12} step={0.5} value={sleep} onChange={(e) => setSleep(Number(e.target.value))} className="w-full" aria-label="ชั่วโมงการนอน" />
          </div>
          <div>
            <p className="label mb-2">เวลาที่มีให้งานสำคัญวันนี้</p>
            <TimeChips value={minutes} onChange={setMinutes} />
          </div>
          <button className="btn btn-primary w-full" onClick={() => setStep(1)}>ต่อไป <ArrowRight size={16} /></button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <p className="text-soft">วันนี้เป็นวันแบบไหน?</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {REALITY.map((r) => (
              <button
                key={r.id}
                aria-pressed={reality === r.id}
                className={`glass flex min-h-[96px] flex-col items-center justify-center gap-1 rounded-[1.5rem] p-3 text-sm transition ${reality === r.id ? '!bg-plum text-white' : ''}`}
                onClick={() => setReality(r.id)}
              >
                <span className="text-2xl" aria-hidden>{r.emoji}</span>
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => setStep(0)}>ย้อนกลับ</button>
            <button className="btn btn-primary flex-1" onClick={() => setStep(2)}>ดู Briefing <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <BriefingView energy={energy} minutes={minutes} reality={reality} />
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>ย้อนกลับ</button>
            <button className="btn btn-primary flex-1" onClick={() => setStep(3)}>เลือก One Thing ส่วนตัว <ArrowRight size={16} /></button>
          </div>
          <button
            className="btn btn-soft w-full"
            onClick={() => {
              s.saveCheckIn({ energy, mood, sleepDuration: sleep, availableMinutes: minutes, circumstances: reality, completedAt: s.now().toISOString() })
              toast('บันทึกเช็กอินแล้ว ✨')
              nav('/')
            }}
          >
            <Check size={16} /> บันทึกเช็กอินแล้วไปหน้าหลัก
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <TimeChips value={minutes} onChange={(m) => { setMinutes(m); setPickId(null) }} />
          {chosen ? (
            <section className="glass rounded-[1.75rem] p-5">
              <div className="mb-3 flex items-center gap-2">
                <Avatar id={rec.companionId} size={40} />
                <p className="text-sm text-soft">{COMPANIONS[rec.kind === 'task' ? rec.companionId : 'j'].name} {plannedTask && !pickId ? '· จากที่วางไว้เมื่อวาน' : 'เลือกให้'}</p>
              </div>
              <p className="text-xl leading-snug">{chosen.title}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white/60 px-3 py-1">⏱ {chosenMinutes} นาที</span>
                <span className="rounded-full px-3 py-1" style={{ background: MISSION_META[chosen.missionId].color + '55' }}>{MISSION_META[chosen.missionId].title}</span>
              </div>
              {rec.kind === 'task' && rec.task.id === chosen.id && <p className="mt-3 text-sm text-soft">{rec.reason}</p>}
              {chosenMinutes > minutes && <p className="mt-3 text-sm text-soft">งานนี้ยาวกว่าเวลาที่มี ทำเท่าที่ได้ แล้วค่อยต่อทีหลัง</p>}
            </section>
          ) : (
            <section className="glass rounded-[1.75rem] p-5">
              <div className="mb-2 flex items-center gap-2"><Avatar id="bloom" size={40} /><span className="text-sm text-soft">Bloom</span></div>
              <p className="text-lg">{rec.kind === 'task' ? '' : rec.title}</p>
              <p className="mt-1 text-sm text-soft">{rec.kind === 'task' ? '' : rec.reason}</p>
            </section>
          )}

          {editing && (
            <div className="glass max-h-64 overflow-y-auto rounded-3xl p-2">
              {actionable.map((t) => (
                <button key={t.id} className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm hover:bg-white/50" onClick={() => { setPickId(t.id); setEditing(false) }}>
                  <span>{t.title}</span>
                  <span className="text-xs text-soft">{t.estimatedMinutes}′</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button className="btn btn-primary" onClick={() => accept(true)} disabled={!chosen}><Play size={16} /> เริ่มเลย</button>
            <button className="btn btn-soft" onClick={() => accept(false)}><Check size={16} /> {chosen ? 'ตกลง ไว้ทำทีหลัง' : 'บันทึกเช็กอิน'}</button>
            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1" onClick={() => { if (chosen) setSkip((x) => [...x, chosen.id]); setPickId(null) }}><RefreshCw size={16} /> เปลี่ยน</button>
              <button className="btn btn-ghost flex-1" onClick={() => setEditing((v) => !v)}><Pencil size={16} /> เลือกเอง</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
