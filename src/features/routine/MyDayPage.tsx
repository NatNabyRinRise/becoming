import { useState } from 'react'
import { Plus, Check, SkipForward, Pencil, ArrowUp, ArrowDown, Lock, Wind, Undo2 } from 'lucide-react'
import { PageHeader, Card, Empty } from '../../components/ui/controls'
import { Sheet } from '../../components/ui/Sheet'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { useToday } from '../../hooks/useToday'
import { ANCHOR_LABEL, CATEGORY_META, type DayItem } from '../../engine/scheduling/day'
import { minToHhmm, thaiShortDate } from '../../utils/date'
import type { Anchor, Priority, Recurrence, RoutineBlock, RoutineCategory } from '../../types'
import { TaskList } from '../founder/TaskList'

export function MyDayPage() {
  const { items, date, nowMin } = useToday()
  const [editing, setEditing] = useState<RoutineBlock | 'new' | null>(null)
  const tasks = useStore((s) => s.tasks)
  const fixed = items.filter((i) => i.block.flexibility === 'fixed' && i.start !== null)
  const flexibleTimed = items.filter((i) => i.block.flexibility === 'flexible' && i.start !== null)
  const anchored = items.filter((i) => i.start === null)
  const todayTasks = tasks.filter((t) => t.scheduledDate === date && t.status !== 'archived')

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={thaiShortDate(date)}
        title="My Day"
        right={
          <button className="btn btn-soft !px-4" onClick={() => setEditing('new')}>
            <Plus size={16} /> เพิ่ม
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-base"><Lock size={16} /> นัดหมายคงที่</h2>
          {fixed.length ? <Timeline items={fixed} nowMin={nowMin} onEdit={setEditing} /> : <Empty>ยังไม่มีนัดหมายคงที่</Empty>}
        </Card>
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-base"><Wind size={16} /> ยืดหยุ่นได้</h2>
            {flexibleTimed.length ? <Timeline items={flexibleTimed} nowMin={nowMin} onEdit={setEditing} /> : <Empty>ไม่มีกิจกรรมที่ระบุเวลา</Empty>}
          </Card>
          <Card>
            <h2 className="mb-1 text-base">ตามจังหวะชีวิต</h2>
            <p className="mb-3 text-xs text-soft">ไม่ต้องตรงเวลา ทำเมื่อถึงจังหวะนั้น</p>
            {anchored.length ? <Timeline items={anchored} nowMin={nowMin} onEdit={setEditing} /> : <Empty>ยังไม่มี</Empty>}
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 text-base">งานของวันนี้</h2>
        <TaskList tasks={todayTasks} empty="ยังไม่มีงานที่ลงไว้วันนี้ ใช้ Morning Briefing เลือก One Thing ได้" />
      </Card>

      <RoutineEditor value={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function Timeline({ items, nowMin, onEdit }: { items: DayItem[]; nowMin: number; onEdit: (b: RoutineBlock) => void }) {
  const s = useStore()
  const toast = useUI((u) => u.showToast)
  const [moving, setMoving] = useState<string | null>(null)
  const [time, setTime] = useState('')
  return (
    <ol className="relative space-y-2">
      {items.map((it) => {
        const b = it.block
        const meta = CATEGORY_META[b.category]
        const st = it.entry.status
        const current = it.start !== null && it.end !== null && nowMin >= it.start && nowMin < it.end && st === 'pending'
        return (
          <li key={b.id} className={`rounded-2xl p-3 transition ${current ? 'bg-white/70 shadow-sm' : 'bg-white/35'} ${st !== 'pending' ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-3">
              <span className="mt-1 h-8 w-1.5 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-soft">
                  {it.start !== null ? `${minToHhmm(it.start)}–${minToHhmm(it.end!)}` : b.anchor ? ANCHOR_LABEL[b.anchor] : 'ยืดหยุ่น'} · {meta.emoji} {meta.label}
                  {b.essential && ' · จำเป็น'}
                </p>
                <p className={`truncate ${st === 'done' ? 'line-through' : ''}`}>{b.title}</p>
                {st === 'rescheduled' && <p className="text-[11px] text-soft">เลื่อนไป {it.entry.movedTo ?? 'ภายหลัง'}</p>}
                {st === 'skipped' && <p className="text-[11px] text-soft">ข้ามวันนี้</p>}
              </div>
              <div className="flex shrink-0 items-center">
                {st === 'pending' ? (
                  <>
                    <IconBtn label="ทำแล้ว" onClick={() => { s.setRoutineStatus(b.id, 'done'); toast(`เยี่ยม! ${b.title} ✓`) }}><Check size={16} /></IconBtn>
                    <IconBtn label="ข้ามวันนี้" onClick={() => s.setRoutineStatus(b.id, 'skipped')}><SkipForward size={16} /></IconBtn>
                  </>
                ) : (
                  <IconBtn label="ย้อนสถานะ" onClick={() => s.setRoutineStatus(b.id, 'pending')}><Undo2 size={16} /></IconBtn>
                )}
                <IconBtn label="แก้ไข" onClick={() => onEdit(b)}><Pencil size={15} /></IconBtn>
              </div>
            </div>
            {st === 'pending' && (
              <div className="mt-2 flex flex-wrap items-center gap-1 pl-4">
                <button className="rounded-full px-2.5 py-1 text-[11px] text-soft hover:bg-white/50" onClick={() => { setMoving(moving === b.id ? null : b.id); setTime(it.start !== null ? minToHhmm(it.start) : '') }}>ย้ายเวลาวันนี้</button>
                <button className="rounded-full p-1 text-soft hover:bg-white/50" aria-label="เลื่อนขึ้น" onClick={() => s.moveRoutine(b.id, -1)}><ArrowUp size={13} /></button>
                <button className="rounded-full p-1 text-soft hover:bg-white/50" aria-label="เลื่อนลง" onClick={() => s.moveRoutine(b.id, 1)}><ArrowDown size={13} /></button>
              </div>
            )}
            {moving === b.id && (
              <div className="mt-2 flex items-center gap-2 pl-4">
                <input type="time" className="field !w-auto !py-2" value={time} onChange={(e) => setTime(e.target.value)} aria-label="เวลาใหม่" />
                <button
                  className="btn btn-primary !min-h-0 !py-2 text-xs"
                  onClick={() => {
                    const r = s.rescheduleRoutineToday(b.id, time || null)
                    if (!r.ok) toast(`ชนกับ: ${r.conflicts.join(', ')}`, 'warn')
                    else setMoving(null)
                  }}
                >
                  ย้าย
                </button>
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button className="flex h-10 w-10 items-center justify-center rounded-full text-soft hover:bg-white/60 hover:text-ink" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  )
}

const CATS = Object.keys(CATEGORY_META) as RoutineCategory[]

function RoutineEditor({ value, onClose }: { value: RoutineBlock | 'new' | null; onClose: () => void }) {
  return (
    <Sheet open={value !== null} onClose={onClose} title={value === 'new' ? 'เพิ่มกิจวัตร' : 'แก้ไขกิจวัตร'}>
      {value !== null && <RoutineForm key={value === 'new' ? 'new' : value.id} initial={value === 'new' ? null : value} onClose={onClose} />}
    </Sheet>
  )
}

function RoutineForm({ initial, onClose }: { initial: RoutineBlock | null; onClose: () => void }) {
  const s = useStore()
  const toast = useUI((u) => u.showToast)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [category, setCategory] = useState<RoutineCategory>(initial?.category ?? 'work')
  const [mode, setMode] = useState<'time' | 'anchor'>(initial?.anchor ? 'anchor' : 'time')
  const [startTime, setStart] = useState(initial?.startTime ?? '09:00')
  const [anchor, setAnchor] = useState<Anchor>(initial?.anchor ?? 'baby_sleeps')
  const [duration, setDuration] = useState(initial?.duration ?? 30)
  const [recurrence, setRecurrence] = useState<Recurrence>(initial?.recurrence ?? 'daily')
  const [flex, setFlex] = useState(initial?.flexibility ?? 'flexible')
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'medium')
  const [essential, setEssential] = useState(initial?.essential ?? false)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [conflicts, setConflicts] = useState<string[]>([])
  const { date } = useToday()

  const save = () => {
    if (!title.trim()) return
    const data: Partial<RoutineBlock> & Pick<RoutineBlock, 'title' | 'category' | 'duration'> = {
      title: title.trim(),
      category,
      duration,
      startTime: mode === 'time' ? startTime : null,
      anchor: mode === 'anchor' ? anchor : null,
      recurrence,
      weekday: recurrence === 'weekly' ? new Date(date + 'T00:00:00Z').getUTCDay() : null,
      date: recurrence === 'none' ? date : null,
      flexibility: flex,
      priority,
      essential,
      notes,
    }
    const r = initial ? s.updateRoutine(initial.id, data) : s.addRoutine(data)
    if (!r.ok) {
      setConflicts(r.conflicts)
      return
    }
    toast('บันทึกแล้ว')
    onClose()
  }

  return (
    <div className="space-y-4">
      <input className="field" placeholder="ชื่อกิจวัตร" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="ชื่อกิจวัตร" />
      <div>
        <p className="label mb-2">หมวด</p>
        <div className="flex flex-wrap gap-1.5">
          {CATS.map((c) => (
            <button key={c} className="chip !min-h-[34px] !px-3 !py-1 text-xs" aria-pressed={category === c} onClick={() => setCategory(c)}>
              {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button className="chip" aria-pressed={mode === 'time'} onClick={() => setMode('time')}>ระบุเวลา</button>
        <button className="chip" aria-pressed={mode === 'anchor'} onClick={() => setMode('anchor')}>ตามจังหวะ</button>
      </div>
      {mode === 'time' ? (
        <input type="time" className="field" value={startTime} onChange={(e) => setStart(e.target.value)} aria-label="เวลาเริ่ม" />
      ) : (
        <select className="field" value={anchor} onChange={(e) => setAnchor(e.target.value as Anchor)} aria-label="จังหวะ">
          {(Object.keys(ANCHOR_LABEL) as Anchor[]).map((a) => <option key={a} value={a}>{ANCHOR_LABEL[a]}</option>)}
        </select>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">ระยะเวลา (นาที)</span>
          <input type="number" min={5} step={5} className="field mt-1" value={duration} onChange={(e) => setDuration(Math.max(5, Number(e.target.value)))} />
        </label>
        <label className="block">
          <span className="label">ทำซ้ำ</span>
          <select className="field mt-1" value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
            <option value="daily">ทุกวัน</option>
            <option value="weekly">ทุกสัปดาห์ (วันนี้)</option>
            <option value="none">เฉพาะวันนี้</option>
          </select>
        </label>
        <label className="block">
          <span className="label">ความยืดหยุ่น</span>
          <select className="field mt-1" value={flex} onChange={(e) => setFlex(e.target.value as 'fixed' | 'flexible')}>
            <option value="flexible">ยืดหยุ่น</option>
            <option value="fixed">คงที่</option>
          </select>
        </label>
        <label className="block">
          <span className="label">ความสำคัญ</span>
          <select className="field mt-1" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="high">สูง</option>
            <option value="medium">กลาง</option>
            <option value="low">ต่ำ</option>
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={essential} onChange={(e) => setEssential(e.target.checked)} /> จำเป็น (Rescue Mode จะปกป้องไว้เสมอ)
      </label>
      <textarea className="field" rows={2} placeholder="โน้ต" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="โน้ต" />
      {conflicts.length > 0 && <p className="rounded-2xl bg-[#f6d6d6]/70 p-3 text-sm">เวลาชนกับ: {conflicts.join(', ')} ลองเลือกเวลาอื่นนะ</p>}
      <div className="flex gap-2">
        {initial && (
          <button className="btn btn-ghost text-[#a0465a]" onClick={() => { if (confirm('ลบกิจวัตรนี้?')) { s.deleteRoutine(initial.id); onClose() } }}>ลบ</button>
        )}
        <button className="btn btn-primary flex-1" onClick={save}>บันทึก</button>
      </div>
    </div>
  )
}
