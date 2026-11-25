import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Undo2, ShieldCheck, CalendarClock, Target } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { EnergySlider, TimeChips } from '../../components/ui/controls'
import { Avatar } from '../../components/companions/Avatar'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { useToday } from '../../hooks/useToday'
import { buildRescuePlan, RESCUE_REASONS, snapshotPlan } from '../../engine/scheduling/rescue'
import type { RescuePlan, RescueReason } from '../../types'

export function RescueSheet() {
  const open = useUI((s) => s.rescueOpen)
  const setOpen = useUI((s) => s.setRescue)
  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Rescue Mode">
      {open && <RescueFlow onDone={() => setOpen(false)} />}
    </Sheet>
  )
}

function RescueFlow({ onDone }: { onDone: () => void }) {
  const s = useStore()
  const { date, nowMin, checkIn } = useToday()
  const toast = useUI((u) => u.showToast)
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [reason, setReason] = useState<RescueReason | null>(null)
  const [minutes, setMinutes] = useState<number | null>(null)
  const [energy, setEnergy] = useState(checkIn?.energy ?? 50)
  const [showDiff, setShowDiff] = useState(false)
  const lastUndoable = [...s.rescues].reverse().find((r) => r.undoStatus === 'available' && r.localDate === date)
  const primary = s.projects.find((p) => p.isPrimaryBusiness)

  const plan: RescuePlan | null = useMemo(() => {
    if (step < 3 || reason === null || minutes === null) return null
    return buildRescuePlan({
      date,
      nowMin,
      routines: s.routines,
      dayLog: s.dayLogs[date] ?? {},
      tasks: s.tasks,
      reason,
      remainingMinutes: minutes,
      energy,
      thresholds: s.settings.energyThresholds,
      currentOneThingId: checkIn?.oneThingId ?? null,
      missionPriorities: s.profile.preferences.missionPriorities,
      primaryProjectId: primary?.id ?? null,
    })
  }, [step, reason, minutes, energy, date, nowMin, s.routines, s.dayLogs, s.tasks, s.settings.energyThresholds, checkIn, s.profile.preferences.missionPriorities, primary])

  const confirm = () => {
    if (!plan || reason === null || minutes === null) return
    const prev = snapshotPlan(s.routines, s.dayLogs[date] ?? {}, s.tasks, checkIn?.oneThingId ?? null)
    s.confirmRescue({ localDate: date, reason, remainingMinutes: minutes, remainingEnergy: energy, previousPlan: prev, proposedPlan: plan })
    toast('ปรับแผนแล้ว เปลี่ยนแผน ไม่ใช่เปลี่ยนความฝัน 🌙')
    onDone()
  }

  const addSuggestion = () => {
    if (!plan) return
    const exists = s.tasks.find((t) => t.title === plan.oneThingTitle && t.status !== 'done')
    const t = exists ?? s.addTask({ title: plan.oneThingTitle, missionId: 'empire', estimatedMinutes: plan.oneThingMinutes, kind: 'business', energyRequirement: 'low' })
    const prev = snapshotPlan(s.routines, s.dayLogs[date] ?? {}, s.tasks, checkIn?.oneThingId ?? null)
    s.confirmRescue({ localDate: date, reason: reason!, remainingMinutes: minutes!, remainingEnergy: energy, previousPlan: prev, proposedPlan: { ...plan, oneThingId: t.id, suggestion: false } })
    toast('ปรับแผนแล้ว')
    onDone()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-3xl bg-white/50 p-3">
        <Avatar id="j" size={44} />
        <p className="text-sm">
          <span className="font-medium">Change the plan, not the dream.</span>
          <br />
          <span className="text-soft">เปลี่ยนแผน ไม่ใช่เปลี่ยนความฝัน</span>
        </p>
      </div>

      {lastUndoable && step === 0 && (
        <button
          className="btn btn-soft w-full"
          onClick={() => {
            s.undoLastRescue()
            toast('ย้อนกลับแผนเดิมแล้ว งานที่ทำเสร็จยังอยู่ครบ')
            onDone()
          }}
        >
          <Undo2 size={16} /> ย้อนกลับการปรับแผนล่าสุด
        </button>
      )}

      <Steps step={step} />

      {step === 0 && (
        <div>
          <p className="mb-3 font-medium">เกิดอะไรขึ้น?</p>
          <div className="grid grid-cols-2 gap-2">
            {RESCUE_REASONS.map((r) => (
              <button key={r.id} className="chip justify-start !rounded-2xl !py-3" aria-pressed={reason === r.id} onClick={() => { setReason(r.id); setStep(1) }}>
                <span className="text-lg" aria-hidden>{r.emoji}</span> {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <p className="mb-3 font-medium">เหลือเวลาทำงานได้อีกเท่าไหร่?</p>
          <TimeChips value={minutes} options={[0, 5, 15, 30, 60, 120]} onChange={(m) => { setMinutes(m); setStep(2) }} />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="font-medium">พลังงานตอนนี้เหลือเท่าไหร่?</p>
          <EnergySlider value={energy} onChange={setEnergy} />
          <button className="btn btn-primary w-full" onClick={() => setStep(3)}>
            คำนวณแผนใหม่ <ArrowRight size={16} />
          </button>
        </div>
      )}

      {step >= 3 && plan && (
        <div className="space-y-4">
          <section className="rounded-3xl bg-white/60 p-4">
            <p className="label mb-1 flex items-center gap-1.5"><Target size={14} /> One Thing ใหม่</p>
            <p className="text-lg">{plan.oneThingTitle}</p>
            {plan.oneThingMinutes > 0 && <p className="text-sm text-soft">{plan.oneThingMinutes} นาที{plan.suggestion ? ' · ข้อเสนอแนะ (ยังไม่ใช่งานในระบบ)' : ''}</p>}
            <p className="mt-2 text-sm text-soft">{plan.note}</p>
          </section>
          <section>
            <p className="label mb-2 flex items-center gap-1.5"><ShieldCheck size={14} /> ปกป้องไว้ ({plan.protected.length})</p>
            <ul className="flex flex-wrap gap-1.5">
              {plan.protected.slice(0, showDiff ? 99 : 6).map((p) => (
                <li key={p.id} className="rounded-full bg-white/50 px-3 py-1 text-xs" title={p.reason}>{p.title}</li>
              ))}
            </ul>
          </section>
          <section>
            <p className="label mb-2 flex items-center gap-1.5"><CalendarClock size={14} /> เลื่อนออกไป ({plan.rescheduled.length})</p>
            {plan.rescheduled.length === 0 ? (
              <p className="text-sm text-soft">ไม่มีอะไรต้องเลื่อน</p>
            ) : (
              <ul className="space-y-1">
                {plan.rescheduled.slice(0, showDiff ? 99 : 4).map((c) => (
                  <li key={c.type + c.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{c.title}</span>
                    <span className="shrink-0 text-xs text-soft">{showDiff ? `${c.from} → ${c.to}` : c.to}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <button className="btn-ghost text-xs underline" onClick={() => setShowDiff((v) => !v)}>
            {showDiff ? 'ซ่อนรายละเอียด' : 'ดูก่อน–หลังทั้งหมด'}
          </button>
          <p className="text-xs text-soft">ยังไม่มีอะไรเปลี่ยนจนกว่าเธอจะกดยืนยัน งานที่ทำเสร็จและเวลาโฟกัสที่บันทึกไว้จะอยู่ครบ</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {plan.suggestion && plan.oneThingMinutes > 0 && plan.oneThingTitle.startsWith('ขั้นแรก') ? (
              <button className="btn btn-primary flex-1" onClick={addSuggestion}>เพิ่มเป็นงานและยืนยัน</button>
            ) : (
              <button className="btn btn-primary flex-1" onClick={confirm}>ยืนยันแผนใหม่</button>
            )}
            {plan.oneThingId && (
              <button
                className="btn btn-soft flex-1"
                onClick={() => {
                  confirm()
                  s.startFocus(plan.oneThingId, plan.oneThingTitle, plan.oneThingMinutes)
                  nav('/focus')
                }}
              >
                ยืนยันและเริ่มเลย
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setStep(0)}>เริ่มใหม่</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Steps({ step }: { step: number }) {
  const labels = ['เหตุผล', 'เวลา', 'พลังงาน', 'ทบทวน']
  return (
    <ol className="flex gap-1.5" aria-label="ขั้นตอน">
      {labels.map((l, i) => (
        <li key={l} className="flex-1">
          <div className={`h-1 rounded-full ${i <= step ? 'bg-plum' : 'bg-white/60'}`} />
          <span className={`mt-1 block text-[10px] ${i === step ? 'text-ink' : 'text-soft'}`}>{l}</span>
        </li>
      ))}
    </ol>
  )
}
