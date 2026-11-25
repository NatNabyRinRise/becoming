import { useState } from 'react'
import { Plus, Star, Trash2, ArrowRightCircle, Check } from 'lucide-react'
import { PageHeader, Card, Empty, Segmented } from '../../components/ui/controls'
import { Sheet } from '../../components/ui/Sheet'
import { Avatar } from '../../components/companions/Avatar'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { TaskList, TaskEditor } from './TaskList'
import { MISSION_META, MISSION_ORDER } from '../../data/seed'
import { revenueBySource } from '../../engine/analytics'
import type { AgentStatus, MissionId, Partner, Project } from '../../types'

type Tab = 'business' | 'ideas' | 'brand' | 'partners' | 'agents' | 'revenue'
const TABS: { id: Tab; label: string }[] = [
  { id: 'business', label: 'ธุรกิจหลัก' },
  { id: 'ideas', label: 'Idea Inbox' },
  { id: 'brand', label: 'Personal Brand' },
  { id: 'partners', label: 'Partners' },
  { id: 'agents', label: 'Prototype' },
  { id: 'revenue', label: 'Revenue' },
]

export function FounderPage() {
  const [tab, setTab] = useState<Tab>('business')
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Founder Mode" title="พื้นที่ธุรกิจ" back />
      <div className="no-scrollbar -mx-4 mb-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2">
          <Segmented label="ส่วนของ Founder Mode" value={tab} options={TABS} onChange={setTab} />
        </div>
      </div>
      {tab === 'business' && <Business />}
      {tab === 'ideas' && <Ideas />}
      {tab === 'brand' && <Brand />}
      {tab === 'partners' && <Partners />}
      {tab === 'agents' && <Agents />}
      {tab === 'revenue' && <Revenue />}
    </div>
  )
}

function Business() {
  const s = useStore()
  const [newTask, setNewTask] = useState<string | null>(null)
  const [editProject, setEditProject] = useState<Project | 'new' | null>(null)
  const [ms, setMs] = useState('')
  const primary = s.projects.find((p) => p.isPrimaryBusiness)
  const supporting = s.projects.filter((p) => !p.isPrimaryBusiness && p.status !== 'done')
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-[1.5rem] bg-white/40 p-3">
        <Avatar id="atlas" size={40} />
        <p className="text-sm">โฟกัสธุรกิจหลักหนึ่งเดียว โปรเจกต์อื่นควรช่วยธุรกิจนี้ ไอเดียที่ไม่เกี่ยวเก็บไว้ใน Idea Inbox ก่อน</p>
      </div>
      {primary ? (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label flex items-center gap-1"><Star size={12} /> Primary Business</p>
              <h2 className="text-xl">{primary.title}</h2>
              <p className="mt-1 text-sm text-soft">{primary.description}</p>
            </div>
            <button className="btn btn-ghost !px-3 text-xs" onClick={() => setEditProject(primary)}>แก้ไข</button>
          </div>
          <div className="mt-4">
            <p className="label mb-2">Milestones</p>
            <ul className="space-y-1.5">
              {primary.milestones.map((m) => (
                <li key={m.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={m.done} onChange={() => s.toggleMilestone(primary.id, m.id)} />
                    <span className={m.done ? 'line-through opacity-60' : ''}>{m.title}</span>
                  </label>
                </li>
              ))}
            </ul>
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (ms.trim()) { s.addMilestone(primary.id, ms.trim()); setMs('') } }}>
              <input className="field !py-2" placeholder="เพิ่ม milestone" value={ms} onChange={(e) => setMs(e.target.value)} aria-label="เพิ่ม milestone" />
              <button className="btn btn-soft !px-3" aria-label="เพิ่ม"><Plus size={16} /></button>
            </form>
          </div>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="label">Micro-tasks</p>
              <button className="btn btn-ghost !min-h-0 !px-3 !py-1 text-xs" onClick={() => setNewTask(primary.id)}><Plus size={14} /> งาน</button>
            </div>
            <TaskList tasks={s.tasks.filter((t) => t.projectId === primary.id && t.status !== 'archived')} />
          </div>
        </Card>
      ) : (
        <Empty>ยังไม่ได้เลือกธุรกิจหลัก ไม่เป็นไร ใช้แอปไปก่อนได้ เมื่อพร้อมค่อยตั้งโปรเจกต์ด้านล่างเป็นธุรกิจหลัก</Empty>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base">โปรเจกต์ที่สนับสนุน</h2>
          <button className="btn btn-soft !min-h-0 !px-3 !py-1.5 text-xs" onClick={() => setEditProject('new')}><Plus size={14} /> โปรเจกต์</button>
        </div>
        {supporting.length === 0 ? <Empty>ยังไม่มี</Empty> : (
          <ul className="space-y-3">
            {supporting.map((p) => (
              <li key={p.id} className="rounded-2xl bg-white/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <button className="text-left" onClick={() => setEditProject(p)}>
                    <p>{p.title}</p>
                    <p className="text-[11px] text-soft">{MISSION_META[p.missionId].title} · {p.status === 'active' ? 'กำลังทำ' : 'พักไว้'}</p>
                  </button>
                  <button className="btn btn-ghost !min-h-0 !px-3 !py-1 text-xs" onClick={() => setNewTask(p.id)}><Plus size={14} /> งาน</button>
                </div>
                <div className="mt-2"><TaskList compact tasks={s.tasks.filter((t) => t.projectId === p.id && t.status !== 'archived')} empty="ยังไม่มีงาน" /></div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-base">คิวทบทวน (งานที่เลื่อนออกไป)</h2>
        <TaskList tasks={s.tasks.filter((t) => t.status === 'deferred')} empty="ไม่มีงานในคิว" />
      </Card>

      <TaskEditor task={newTask ? 'new' : null} defaults={{ projectId: newTask, missionId: s.projects.find((p) => p.id === newTask)?.missionId }} onClose={() => setNewTask(null)} />
      <ProjectEditor value={editProject} onClose={() => setEditProject(null)} />
    </div>
  )
}

function ProjectEditor({ value, onClose }: { value: Project | 'new' | null; onClose: () => void }) {
  return (
    <Sheet open={value !== null} onClose={onClose} title={value === 'new' ? 'โปรเจกต์ใหม่' : 'แก้ไขโปรเจกต์'}>
      {value !== null && <ProjectForm key={value === 'new' ? 'n' : value.id} initial={value === 'new' ? null : value} onClose={onClose} />}
    </Sheet>
  )
}

function ProjectForm({ initial, onClose }: { initial: Project | null; onClose: () => void }) {
  const s = useStore()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [desc, setDesc] = useState(initial?.description ?? '')
  const [missionId, setMission] = useState<MissionId>(initial?.missionId ?? 'empire')
  const [status, setStatus] = useState(initial?.status ?? 'active')
  const save = () => {
    if (!title.trim()) return
    if (initial) s.updateProject(initial.id, { title, description: desc, missionId, status })
    else s.addProject({ title, description: desc, missionId, status })
    onClose()
  }
  return (
    <div className="space-y-3">
      <input className="field" placeholder="ชื่อโปรเจกต์" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="ชื่อโปรเจกต์" />
      <textarea className="field" rows={2} placeholder="คำอธิบาย" value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="คำอธิบาย" />
      <select className="field" value={missionId} onChange={(e) => setMission(e.target.value as MissionId)} aria-label="ภารกิจ">
        {MISSION_ORDER.map((m) => <option key={m} value={m}>{MISSION_META[m].title}</option>)}
      </select>
      <select className="field" value={status} onChange={(e) => setStatus(e.target.value as Project['status'])} aria-label="สถานะ">
        <option value="active">กำลังทำ</option><option value="paused">พักไว้</option><option value="done">เสร็จแล้ว</option>
      </select>
      {initial && !initial.isPrimaryBusiness && (
        <button className="btn btn-soft w-full" onClick={() => { if (confirm('ตั้งเป็นธุรกิจหลัก? (ธุรกิจหลักเดิมจะกลายเป็นโปรเจกต์สนับสนุน)')) { s.setPrimaryProject(initial.id); onClose() } }}>
          <Star size={16} /> ตั้งเป็นธุรกิจหลัก
        </button>
      )}
      <div className="flex gap-2">
        {initial && <button className="btn btn-ghost text-[#a0465a]" onClick={() => { if (confirm('ลบโปรเจกต์นี้? (งานจะยังอยู่)')) { s.deleteProject(initial.id); onClose() } }}>ลบ</button>}
        <button className="btn btn-primary flex-1" onClick={save}>บันทึก</button>
      </div>
    </div>
  )
}

function Ideas() {
  const s = useStore()
  const [text, setText] = useState('')
  const inbox = s.ideas.filter((i) => i.status === 'inbox')
  return (
    <Card>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { s.addIdea(text.trim()); setText('') } }}>
        <input className="field" placeholder="จดไอเดียไว้ก่อน ไม่ต้องตัดสินใจตอนนี้" value={text} onChange={(e) => setText(e.target.value)} aria-label="ไอเดียใหม่" />
        <button className="btn btn-primary !px-4" aria-label="บันทึกไอเดีย"><Plus size={18} /></button>
      </form>
      <ul className="mt-4 space-y-2">
        {inbox.length === 0 && <Empty>Inbox ว่าง ไอเดียที่ไม่เกี่ยวกับธุรกิจหลักควรมาพักไว้ที่นี่</Empty>}
        {inbox.map((i) => (
          <li key={i.id} className="flex items-center gap-2 rounded-2xl bg-white/40 p-3">
            <p className="flex-1 text-sm">{i.text}</p>
            <button className="rounded-full p-2 text-soft hover:bg-white/60" aria-label="แปลงเป็นงาน" title="แปลงเป็นงาน" onClick={() => s.ideaToTask(i.id)}><ArrowRightCircle size={18} /></button>
            <button className="rounded-full p-2 text-soft hover:bg-white/60" aria-label="เก็บเข้ากรุ" title="เก็บเข้ากรุ" onClick={() => s.updateIdea(i.id, { status: 'archived' })}><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Brand() {
  const s = useStore()
  const [title, setTitle] = useState('')
  const toast = useUI((u) => u.showToast)
  const published = s.content.filter((c) => c.status === 'published').length
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-[1.5rem] bg-white/40 p-3">
        <Avatar id="muse" size={40} />
        <p className="text-sm">เรื่องจริงของเธอคือคอนเทนต์ที่ดีที่สุด เก็บประเด็นสั้น ๆ ไว้ก่อน ค่อยเกลาทีหลัง</p>
      </div>
      <Card>
        <p className="label">เผยแพร่แล้ว</p>
        <p className="big-num text-4xl">{published}</p>
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (title.trim()) { s.upsertContent({ title: title.trim() }); setTitle('') } }}>
          <input className="field" placeholder="ไอเดียคอนเทนต์" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="ไอเดียคอนเทนต์" />
          <button className="btn btn-primary !px-4" aria-label="เพิ่ม"><Plus size={18} /></button>
        </form>
        <ul className="mt-4 space-y-2">
          {s.content.length === 0 && <Empty>ยังไม่มีคอนเทนต์</Empty>}
          {s.content.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-2xl bg-white/40 p-3 text-sm">
              <span className="flex-1">{c.title}</span>
              <select className="rounded-full bg-white/60 px-2 py-1 text-xs" value={c.status} aria-label="สถานะคอนเทนต์" onChange={(e) => { s.upsertContent({ id: c.id, title: c.title, status: e.target.value as 'idea' }); if (e.target.value === 'published') toast('เผยแพร่แล้ว! ✨', 'xp') }}>
                <option value="idea">ไอเดีย</option><option value="draft">ร่าง</option><option value="published">เผยแพร่แล้ว</option>
              </select>
              <button className="rounded-full p-1.5 text-soft" aria-label="ลบ" onClick={() => s.deleteContent(c.id)}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

const STAGES: { id: Partner['stage']; label: string }[] = [
  { id: 'candidate', label: 'ผู้สมัคร' },
  { id: 'talking', label: 'คุยกันอยู่' },
  { id: 'evaluating', label: 'ประเมิน' },
  { id: 'experimenting', label: 'ทดลองทำงาน' },
  { id: 'partner', label: 'พาร์ทเนอร์' },
  { id: 'not_fit', label: 'ไม่เข้ากัน' },
]

function Partners() {
  const s = useStore()
  const [name, setName] = useState('')
  return (
    <Card>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { s.upsertPartner({ name: name.trim() }); setName('') } }}>
        <input className="field" placeholder="ชื่อคนที่น่าสนใจ" value={name} onChange={(e) => setName(e.target.value)} aria-label="ชื่อพาร์ทเนอร์" />
        <button className="btn btn-primary !px-4" aria-label="เพิ่ม"><Plus size={18} /></button>
      </form>
      <ul className="mt-4 space-y-2">
        {s.partners.length === 0 && <Empty>Partnership pipeline ยังว่าง</Empty>}
        {s.partners.map((p) => (
          <li key={p.id} className="space-y-2 rounded-2xl bg-white/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{p.name}</p>
              <button className="rounded-full p-1.5 text-soft" aria-label="ลบ" onClick={() => confirm('ลบรายชื่อนี้?') && s.deletePartner(p.id)}><Trash2 size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className="field !py-2 text-sm" value={p.stage} onChange={(e) => s.upsertPartner({ id: p.id, name: p.name, stage: e.target.value as Partner['stage'] })} aria-label="ขั้น">
                {STAGES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
              <label className="flex items-center gap-2 text-xs text-soft">
                คุณค่าตรงกัน
                <input type="range" min={1} max={5} value={p.valuesFit} onChange={(e) => s.upsertPartner({ id: p.id, name: p.name, valuesFit: Number(e.target.value) })} className="flex-1" aria-label="คะแนนคุณค่าตรงกัน" />
                {p.valuesFit}/5
              </label>
            </div>
            <input className="field !py-2 text-sm" placeholder="ทักษะที่เสริมกัน" value={p.skills} onChange={(e) => s.upsertPartner({ id: p.id, name: p.name, skills: e.target.value })} aria-label="ทักษะ" />
          </li>
        ))}
      </ul>
    </Card>
  )
}

const AGENT_STATUS: { id: AgentStatus; label: string }[] = [
  { id: 'planned', label: 'วางแผน' },
  { id: 'prompt_created', label: 'มี Prompt' },
  { id: 'tested', label: 'ทดสอบแล้ว' },
  { id: 'operational', label: 'ใช้งานจริง' },
]

function Agents() {
  const s = useStore()
  const toast = useUI((u) => u.showToast)
  const operational = s.agents.filter((a) => a.status === 'operational').length
  return (
    <Card>
      <h2 className="text-base">AI Company — Prototype Tracker</h2>
      <p className="mt-1 text-sm text-soft">ทุกตำแหน่งเริ่มที่ "วางแผน" ยังไม่มี Agent ตัวไหนทำงานจริงจนกว่าเธอจะอัปเดตเอง</p>
      <div className="mt-3 flex gap-1" aria-label={`ใช้งานจริง ${operational} จาก ${s.agents.length}`}>
        {s.agents.map((a) => (
          <span key={a.id} className="h-2 flex-1 rounded-full" style={{ background: ['rgba(255,255,255,0.6)', '#dccfe8', '#a99acb', '#645b7c'][AGENT_STATUS.findIndex((x) => x.id === a.status)] }} />
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {s.agents.map((a, i) => {
          const task = s.tasks.find((t) => t.id === a.taskId)
          return (
            <li key={a.id} className="rounded-2xl bg-white/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm">{i + 1}. {a.name}</p>
                  <p className="text-[11px] text-soft">{a.nameTh}</p>
                </div>
                <select className="rounded-full bg-white/70 px-2 py-1.5 text-xs" value={a.status} onChange={(e) => s.updateAgent(a.id, { status: e.target.value as AgentStatus })} aria-label={`สถานะ ${a.name}`}>
                  {AGENT_STATUS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              </div>
              {task ? (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-soft">{task.status === 'done' && <Check size={12} />} งาน: {task.title}</p>
              ) : (
                <button className="mt-1.5 text-xs text-plum underline" onClick={() => { const t = prompt(`งานจริงสำหรับ ${a.name}:`, `กำหนดภารกิจจริงให้ ${a.name}`); if (t) { s.createAgentTask(a.id, t); toast('สร้างงานแล้ว') } }}>
                  + สร้างงานจริงให้ตำแหน่งนี้
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Revenue() {
  const s = useStore()
  const [amount, setAmount] = useState('')
  const [source, setSource] = useState('')
  const [recurring, setRecurring] = useState(false)
  const total = s.revenue.reduce((a, b) => a + b.amount, 0)
  const rec = s.revenue.filter((r) => r.recurring).reduce((a, b) => a + b.amount, 0)
  const by = revenueBySource(s.revenue)
  const max = Math.max(1, ...by.map((b) => b.amount))
  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-2 gap-4">
          <div><p className="label">รายได้ทั้งหมด (บันทึกเอง)</p><p className="big-num text-3xl">฿{total.toLocaleString()}</p></div>
          <div><p className="label">รายได้ประจำ</p><p className="big-num text-3xl">฿{rec.toLocaleString()}</p></div>
        </div>
        <form
          className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault()
            const n = Number(amount)
            if (!n || !source.trim()) return
            s.addRevenue({ amount: n, source: source.trim(), recurring, localDate: s.today() })
            setAmount('')
          }}
        >
          <input className="field" inputMode="decimal" placeholder="จำนวน ฿" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="จำนวนเงิน" />
          <input className="field" placeholder="แหล่งรายได้" value={source} onChange={(e) => setSource(e.target.value)} aria-label="แหล่งรายได้" list="sources" />
          <datalist id="sources">{by.map((b) => <option key={b.source} value={b.source} />)}</datalist>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} /> ประจำ</label>
          <button className="btn btn-primary">บันทึก</button>
        </form>
      </Card>
      <Card>
        <h2 className="mb-3 text-base">ตามแหล่งรายได้</h2>
        {by.length === 0 ? <Empty>ยังไม่มีรายได้ที่บันทึก (แอปจะไม่สมมติตัวเลขให้)</Empty> : (
          <ul className="space-y-2">
            {by.map((b) => (
              <li key={b.source}>
                <div className="flex justify-between text-sm"><span>{b.source}</span><span>฿{b.amount.toLocaleString()}</span></div>
                <div className="mt-1 h-2 rounded-full bg-white/50"><div className="h-2 rounded-full bg-lavender" style={{ width: `${(b.amount / max) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        )}
        {s.revenue.length > 0 && (
          <details className="mt-4">
            <summary className="label cursor-pointer">รายการทั้งหมด</summary>
            <ul className="mt-2 space-y-1 text-sm">
              {[...s.revenue].reverse().map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span>{r.localDate} · {r.source}{r.recurring ? ' (ประจำ)' : ''}</span>
                  <span className="flex items-center gap-1">฿{r.amount.toLocaleString()}<button className="p-1 text-soft" aria-label="ลบ" onClick={() => confirm('ลบรายการนี้?') && s.deleteRevenue(r.id)}><Trash2 size={13} /></button></span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>
    </div>
  )
}
