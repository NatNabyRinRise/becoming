import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Play, CalendarClock, Scissors, Pencil, RotateCcw } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { Empty } from '../../components/ui/controls'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { MISSION_META, MISSION_ORDER } from '../../data/seed'
import { addDays } from '../../utils/date'
import type { EnergyLevel, MissionId, Priority, Task, TaskKind } from '../../types'

export function TaskList({ tasks, empty, compact }: { tasks: Task[]; empty?: string; compact?: boolean }) {
  const s = useStore()
  const nav = useNavigate()
  const toast = useUI((u) => u.showToast)
  const [edit, setEdit] = useState<Task | null>(null)
  if (!tasks.length) return <Empty>{empty ?? 'ยังไม่มีงาน'}</Empty>
  return (
    <>
      <ul className="space-y-2">
        {tasks.map((t) => {
          const done = t.status === 'done'
          return (
            <li key={t.id} className="rounded-2xl bg-white/40 p-3">
              <div className="flex items-start gap-3">
                <button
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${done ? 'border-transparent bg-plum text-white' : 'border-plum/40'}`}
                  aria-label={done ? 'ยกเลิกเสร็จ' : 'ทำเสร็จแล้ว'}
                  onClick={() => {
                    if (done) s.reopenTask(t.id)
                    else {
                      const r = s.completeTask(t.id)
                      toast(r.xp ? `สำเร็จ! +${r.xp} XP${r.giftUnlocked ? ' · ปลดล็อกของขวัญ 🎁' : ''}` : 'สำเร็จ ✓', r.xp ? 'xp' : 'info')
                    }
                  }}
                >
                  {done && <Check size={14} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`leading-snug ${done ? 'line-through opacity-60' : ''}`}>{t.title}</p>
                  <p className="mt-0.5 text-[11px] text-soft">
                    {t.estimatedMinutes}′ · {MISSION_META[t.missionId].title}
                    {t.priority === 'high' && ' · สำคัญ'}
                    {t.status === 'in_progress' && ` · ทำไปแล้ว ${t.actualMinutes}′`}
                    {t.status === 'deferred' && ' · คิวทบทวน'}
                    {t.postponementCount > 0 && ` · เลื่อน ${t.postponementCount}×`}
                  </p>
                </div>
                {!done && (
                  <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/60" aria-label="เริ่มโฟกัส" onClick={() => { s.startFocus(t.id, t.title, Math.max(5, t.estimatedMinutes - t.actualMinutes)); nav('/focus') }}>
                    <Play size={15} />
                  </button>
                )}
              </div>
              {!compact && !done && (
                <div className="mt-1.5 flex flex-wrap gap-1 pl-10 text-[11px] text-soft">
                  <Mini onClick={() => { s.postponeTask(t.id, addDays(s.today(), 1)); toast('เลื่อนไปพรุ่งนี้แล้ว') }}><CalendarClock size={12} /> พรุ่งนี้</Mini>
                  <Mini onClick={() => { s.reduceScope(t.id); toast('ลดขอบเขตลงครึ่งหนึ่ง') }}><Scissors size={12} /> ลดขอบเขต</Mini>
                  {t.status === 'deferred' && <Mini onClick={() => s.updateTask(t.id, { status: 'todo' })}><RotateCcw size={12} /> กลับมาทำ</Mini>}
                  <Mini onClick={() => setEdit(t)}><Pencil size={12} /> แก้ไข</Mini>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <TaskEditor task={edit} onClose={() => setEdit(null)} />
    </>
  )
}

function Mini({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 hover:bg-white/60" onClick={onClick}>
      {children}
    </button>
  )
}

export function TaskEditor({ task, onClose, defaults }: { task: Task | 'new' | null; onClose: () => void; defaults?: Partial<Task> }) {
  return (
    <Sheet open={task !== null} onClose={onClose} title={task === 'new' ? 'เพิ่มงาน' : 'แก้ไขงาน'}>
      {task !== null && <TaskForm key={task === 'new' ? 'new' : task.id} initial={task === 'new' ? null : task} defaults={defaults} onClose={onClose} />}
    </Sheet>
  )
}

function TaskForm({ initial, defaults, onClose }: { initial: Task | null; defaults?: Partial<Task>; onClose: () => void }) {
  const s = useStore()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [missionId, setMission] = useState<MissionId>(initial?.missionId ?? defaults?.missionId ?? 'empire')
  const [projectId, setProject] = useState<string | null>(initial?.projectId ?? defaults?.projectId ?? null)
  const [est, setEst] = useState(initial?.estimatedMinutes ?? 15)
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'medium')
  const [energy, setEnergy] = useState<EnergyLevel>(initial?.energyRequirement ?? 'medium')
  const [kind, setKind] = useState<TaskKind>(initial?.kind ?? defaults?.kind ?? 'business')
  const [desc, setDesc] = useState(initial?.description ?? '')
  const [deps, setDeps] = useState<string[]>(initial?.dependencies ?? [])
  const others = s.tasks.filter((t) => t.id !== initial?.id && t.status !== 'done' && t.status !== 'archived')

  const save = () => {
    if (!title.trim()) return
    const data = { title: title.trim(), missionId, projectId, estimatedMinutes: est, priority, energyRequirement: energy, kind, description: desc, dependencies: deps }
    if (initial) s.updateTask(initial.id, data)
    else s.addTask(data)
    onClose()
  }
  return (
    <div className="space-y-3">
      <input className="field" placeholder="งานคืออะไร (สั้น ๆ ชัด ๆ)" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="ชื่องาน" autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="label">ภารกิจ</span>
          <select className="field mt-1" value={missionId} onChange={(e) => setMission(e.target.value as MissionId)}>
            {MISSION_ORDER.map((m) => <option key={m} value={m}>{MISSION_META[m].title}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">โปรเจกต์</span>
          <select className="field mt-1" value={projectId ?? ''} onChange={(e) => setProject(e.target.value || null)}>
            <option value="">— ไม่มี —</option>
            {s.projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">เวลาประมาณ (นาที)</span>
          <input type="number" min={5} step={5} className="field mt-1" value={est} onChange={(e) => setEst(Math.max(1, Number(e.target.value)))} />
        </label>
        <label className="block"><span className="label">ความสำคัญ</span>
          <select className="field mt-1" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="high">สูง</option><option value="medium">กลาง</option><option value="low">ต่ำ</option>
          </select>
        </label>
        <label className="block"><span className="label">ใช้พลังงาน</span>
          <select className="field mt-1" value={energy} onChange={(e) => setEnergy(e.target.value as EnergyLevel)}>
            <option value="low">น้อย</option><option value="medium">กลาง</option><option value="high">มาก</option>
          </select>
        </label>
        <label className="block"><span className="label">ประเภท</span>
          <select className="field mt-1" value={kind} onChange={(e) => setKind(e.target.value as TaskKind)}>
            <option value="business">ธุรกิจ</option><option value="brand">Personal brand</option><option value="partnership">พาร์ทเนอร์</option>
            <option value="health">สุขภาพ</option><option value="family">ครอบครัว</option><option value="recovery">พักฟื้น</option><option value="general">ทั่วไป</option>
          </select>
        </label>
      </div>
      <textarea className="field" rows={2} placeholder="รายละเอียด (ไม่บังคับ)" value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="รายละเอียด" />
      {others.length > 0 && (
        <details>
          <summary className="label cursor-pointer">ต้องทำหลังจากงาน… ({deps.length})</summary>
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {others.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={deps.includes(o.id)} onChange={(e) => setDeps((d) => (e.target.checked ? [...d, o.id] : d.filter((x) => x !== o.id)))} /> {o.title}
              </label>
            ))}
          </div>
        </details>
      )}
      <div className="flex gap-2 pt-1">
        {initial && <button className="btn btn-ghost text-[#a0465a]" onClick={() => { if (confirm('ลบงานนี้?')) { s.deleteTask(initial.id); onClose() } }}>ลบ</button>}
        {initial && initial.status !== 'archived' && <button className="btn btn-ghost" onClick={() => { s.updateTask(initial.id, { status: 'archived' }); onClose() }}>เอาออกจากลำดับความสำคัญ</button>}
        <button className="btn btn-primary flex-1" onClick={save}>บันทึก</button>
      </div>
    </div>
  )
}
