import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Clock, RefreshCw, X, Info, List, Orbit } from 'lucide-react'
import { PageHeader } from '../../components/ui/controls'
import { Sheet } from '../../components/ui/Sheet'
import { Avatar } from '../../components/companions/Avatar'
import { Orb } from '../../components/graphics/Orb'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { useFollowUps, useToday } from '../../hooks/useToday'
import { recommend } from '../../engine/recommendations'
import { COMPANION_TIPS } from '../../engine/companions'
import { COMPANIONS, COMPANION_ORDER } from '../../data/seed'
import type { CompanionId, Task } from '../../types'

interface Advice {
  text: string
  context: string
  task: Task | null
  minutes: number
  followUpKey: string | null
}

/** Each companion's current recommendation (rule-based, one per companion). */
function useAdvice(skips: Record<CompanionId, string[]>): Record<CompanionId, Advice> {
  const s = useStore()
  const { checkIn, oneThing } = useToday()
  const follow = useFollowUps()
  const energy = checkIn?.energy ?? 60
  const minutes = checkIn?.availableMinutes ?? 30
  const base = { thresholds: s.settings.energyThresholds, missionPriorities: s.profile.preferences.missionPriorities, primaryProjectId: s.projects.find((p) => p.isPrimaryBusiness)?.id ?? null }
  return useMemo(() => {
    const pick = (id: CompanionId, kinds: Task['kind'][], mins: number) => {
      const r = recommend({ ...base, tasks: s.tasks, availableMinutes: mins, energy, allowKinds: kinds, excludeIds: skips[id] })
      return r.kind === 'task' ? r : null
    }
    const fu = (id: CompanionId) => follow.find((f) => f.companionId === id)
    const atlasRec = pick('atlas', ['business', 'partnership'], Math.max(minutes, 15))
    const museRec = pick('muse', ['brand'], 30)
    const sparkRec = pick('spark', ['business', 'brand', 'partnership', 'general', 'health'], 5)
    const bloomRec = pick('bloom', ['health', 'recovery', 'family'], 30)
    const jF = fu('j')
    return {
      j: oneThing && oneThing.status !== 'done' && !skips.j.includes(oneThing.id)
        ? { text: `วันนี้เรามีเวลา ${minutes} นาที ฉันเลือก "${oneThing.title}" ไว้ให้แล้ว`, context: 'One Thing ของวันนี้จาก Morning Briefing', task: oneThing, minutes: Math.max(5, oneThing.estimatedMinutes - oneThing.actualMinutes), followUpKey: null }
        : jF
          ? { text: jF.message, context: jF.title, task: s.tasks.find((t) => t.id === jF.taskId) ?? null, minutes: 15, followUpKey: jF.key }
          : { text: checkIn ? 'ภาพรวมวันนี้เรียบร้อยดี เก็บพลังไว้สำหรับสิ่งสำคัญ' : 'เริ่ม Morning Briefing กันก่อนนะ', context: 'J สรุปคำแนะนำจากทั้งทีม', task: null, minutes: 0, followUpKey: null },
      atlas: (() => {
        const f = fu('atlas')
        if (f) return { text: f.message, context: f.title, task: s.tasks.find((t) => t.id === f.taskId) ?? null, minutes: 15, followUpKey: f.key }
        return atlasRec
          ? { text: `โฟกัสธุรกิจหลัก: "${atlasRec.task.title}"`, context: atlasRec.reason, task: atlasRec.task, minutes: atlasRec.minutes, followUpKey: null }
          : { text: 'ไม่มีงานธุรกิจที่ค้าง ลองเพิ่มขั้นถัดไปใน Founder Mode', context: '', task: null, minutes: 0, followUpKey: null }
      })(),
      muse: (() => {
        const f = fu('muse')
        if (f) return { text: f.message, context: `ไอเดีย: ${f.title}`, task: null, minutes: 5, followUpKey: f.key }
        return museRec
          ? { text: `ลองใช้เวลา ${museRec.minutes} นาที: "${museRec.task.title}"`, context: 'สร้างความไว้วางใจผ่านการสื่อสาร', task: museRec.task, minutes: museRec.minutes, followUpKey: null }
          : { text: 'เก็บไอเดียคอนเทนต์ไว้ใน Founder Mode แล้วฉันจะชวนเธอกลับมาเล่าเรื่องนั้น', context: '', task: null, minutes: 0, followUpKey: null }
      })(),
      bloom: energy < s.settings.energyThresholds.recovery
        ? { text: 'วันนี้พลังงานเหลือน้อย เราเลื่อนงานที่ไม่เร่งด่วนแล้วเก็บเวลาไว้พักกันดีกว่า', context: `พลังงานที่บันทึก ${energy}%`, task: null, minutes: 15, followUpKey: null }
        : bloomRec
          ? { text: `อย่าลืมดูแลตัวเอง: "${bloomRec.task.title}"`, context: 'สุขภาพและครอบครัวมาก่อนเสมอ', task: bloomRec.task, minutes: bloomRec.minutes, followUpKey: null }
          : { text: 'ดื่มน้ำ ยืดตัว และพักสายตาสักนิดนะ', context: 'การพักคือส่วนหนึ่งของความก้าวหน้า', task: null, minutes: 5, followUpKey: null },
      spark: (() => {
        const f = fu('spark')
        if (f) return { text: f.message, context: f.title, task: s.tasks.find((t) => t.id === f.taskId) ?? null, minutes: 5, followUpKey: f.key }
        return sparkRec
          ? { text: `ภารกิจ 5 นาที: "${sparkRec.task.title}" ลุยไหม?`, context: 'Micro-challenge', task: sparkRec.task, minutes: Math.min(5, sparkRec.minutes), followUpKey: null }
          : { text: 'ทุกก้าวเล็ก ๆ นับหมด วันนี้เธอทำได้ดีแล้ว ✨', context: '', task: null, minutes: 0, followUpKey: null }
      })(),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.tasks, energy, minutes, oneThing, follow, skips, checkIn])
}

export function TeamPage() {
  const [open, setOpen] = useState<CompanionId | null>(null)
  const [view, setView] = useState<'orbit' | 'list'>('orbit')
  const [skips, setSkips] = useState<Record<CompanionId, string[]>>({ j: [], atlas: [], muse: [], bloom: [], spark: [] })
  const [hidden, setHidden] = useState<CompanionId[]>([])
  const advice = useAdvice(skips)

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Personal Board of Directors"
        title="My Team"
        right={
          <button className="btn btn-soft !px-3" onClick={() => setView(view === 'orbit' ? 'list' : 'orbit')} aria-label={view === 'orbit' ? 'แสดงเป็นรายการ' : 'แสดงเป็นวงโคจร'}>
            {view === 'orbit' ? <List size={18} /> : <Orbit size={18} />}
          </button>
        }
      />
      <p className="-mt-3 mb-4 text-sm text-soft">ทีมผู้ช่วยแบบ rule-based ที่ประสานงานกัน โดยมี J เป็นผู้ประสานหลัก</p>

      {view === 'orbit' ? (
        <div className="relative mx-auto aspect-square w-full max-w-[420px]">
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
            <circle cx="50" cy="50" r="37" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.3" strokeDasharray="1 1.5" />
            <circle cx="50" cy="50" r="24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.25" />
          </svg>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Orb size={130} rings={false} />
          </div>
          {COMPANION_ORDER.map((id, i) => {
            const a = (-90 + i * 72) * (Math.PI / 180)
            const x = 50 + 37 * Math.cos(a)
            const y = 50 + 37 * Math.sin(a)
            return (
              <button
                key={id}
                className="anim-float absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.6}s` }}
                onClick={() => setOpen(id)}
                aria-label={`เปิด ${COMPANIONS[id].name} ${COMPANIONS[id].roleTh}`}
              >
                <Avatar id={id} size={72} />
                <span className="mt-0.5 rounded-full bg-white/60 px-2.5 py-0.5 text-xs">{COMPANIONS[id].name}</span>
                {!hidden.includes(id) && advice[id].task && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-gold ring-2 ring-white" aria-hidden />}
              </button>
            )
          })}
        </div>
      ) : (
        <ul className="space-y-2">
          {COMPANION_ORDER.map((id) => (
            <li key={id}>
              <button className="glass flex w-full items-center gap-3 rounded-[1.5rem] p-3 text-left" onClick={() => setOpen(id)}>
                <Avatar id={id} size={48} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{COMPANIONS[id].name} <span className="font-normal text-soft">· {COMPANIONS[id].roleTh}</span></p>
                  <p className="truncate text-sm text-soft">{hidden.includes(id) ? 'ซ่อนคำแนะนำแล้ว' : advice[id].text}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* J summary — one coordinated recommendation, not five */}
      <section className="glass mt-6 flex items-center gap-3 rounded-[1.75rem] p-4">
        <Avatar id="j" size={44} />
        <p className="text-sm">{advice.j.text}</p>
      </section>

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open ? `${COMPANIONS[open].name} — ${COMPANIONS[open].role}` : ''}>
        {open && (
          <CompanionPanel
            id={open}
            advice={advice[open]}
            hidden={hidden.includes(open)}
            onClose={() => setOpen(null)}
            onChange={() => advice[open].task && setSkips((s) => ({ ...s, [open]: [...s[open], advice[open].task!.id] }))}
            onDismiss={() => setHidden((h) => [...h, open])}
          />
        )}
      </Sheet>
    </div>
  )
}

function CompanionPanel({ id, advice, hidden, onClose, onChange, onDismiss }: { id: CompanionId; advice: Advice; hidden: boolean; onClose: () => void; onChange: () => void; onDismiss: () => void }) {
  const s = useStore()
  const nav = useNavigate()
  const toast = useUI((u) => u.showToast)
  const [details, setDetails] = useState(false)
  const c = COMPANIONS[id]
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar id={id} size={84} />
        <div>
          <p className="text-sm text-soft">{c.roleTh}</p>
          <p className="text-sm">{c.personality}</p>
        </div>
      </div>
      <div className="rounded-3xl bg-white/60 p-4">
        <p className="text-[15px]">{hidden ? 'ซ่อนคำแนะนำนี้แล้ว ไว้ฉันจะกลับมาเมื่อมีเรื่องใหม่' : advice.text}</p>
        {details && (
          <div className="mt-3 space-y-1 text-sm text-soft">
            {advice.context && <p>{advice.context}</p>}
            {COMPANION_TIPS[id].map((t) => <p key={t}>• {t}</p>)}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          className="btn btn-primary col-span-2"
          disabled={hidden || (!advice.task && advice.minutes === 0)}
          onClick={() => {
            if (advice.task) s.startFocus(advice.task.id, advice.task.title, advice.minutes || 15)
            else s.startFocus(null, id === 'bloom' ? 'พักฟื้นพลัง' : 'เก็บไอเดีย', advice.minutes || 5)
            onClose()
            nav('/focus')
          }}
        >
          <Play size={16} /> เริ่มเลย
        </button>
        <button className="btn btn-soft" onClick={() => { if (advice.followUpKey) s.snoozeFollowUp(advice.followUpKey, 120); toast('โอเค ไว้ค่อยว่ากัน'); onClose() }}><Clock size={16} /> ทีหลัง</button>
        <button className="btn btn-soft" onClick={onChange} disabled={!advice.task}><RefreshCw size={16} /> เปลี่ยนงาน</button>
        <button className="btn btn-ghost" onClick={() => { if (advice.followUpKey) s.dismissFollowUp(advice.followUpKey); onDismiss() }}><X size={16} /> ไม่เอา</button>
        <button className="btn btn-ghost" onClick={() => setDetails((v) => !v)}><Info size={16} /> รายละเอียด</button>
      </div>
      <p className="text-center text-[11px] text-soft">ผู้ช่วยทำงานด้วยกฎที่ออกแบบไว้ ยังไม่ใช่ AI อิสระ</p>
    </div>
  )
}
