import { useState } from 'react'
import { Plus, Star, Trash2, Pin, PinOff, Send, X } from 'lucide-react'
import { PageHeader, Card, Empty, Segmented } from '../../components/ui/controls'
import { Avatar } from '../../components/companions/Avatar'
import { useStore } from '../../store/useStore'
import { pushToNotion } from '../../orchestration/sources/notion'
import { useUI } from '../../store/useUI'
import { TaskList } from './TaskList'
import { revenueBySource } from '../../engine/analytics'
import { uid } from '../../utils/id'
import { PIN_LIMIT, changedSinceSent, ideaPush, microTasksOf, nextPin, pinnedCount, projectPush, sortProjects } from './sandbox'
import type { MicroTaskText, Milestone, Partner, Project } from '../../types'

type Tab = 'business' | 'ideas' | 'brand' | 'partners' | 'revenue'
const TABS: { id: Tab; label: string }[] = [
  { id: 'business', label: 'ธุรกิจหลัก' },
  { id: 'ideas', label: 'Idea Inbox' },
  { id: 'brand', label: 'Personal Brand' },
  { id: 'partners', label: 'Partners' },
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
      {tab === 'revenue' && <Revenue />}
    </div>
  )
}

function Business() {
  const s = useStore()
  const toast = useUI((u) => u.showToast)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const projects = sortProjects(s.projects)
  const deferred = s.tasks.filter((t) => t.status === 'deferred')
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-[1.5rem] bg-white/40 p-3">
        <Avatar id="atlas" size={40} />
        <p className="text-sm">พื้นที่ทดข้อมูลของเธอเอง จดโปรเจกต์ไว้ก่อน แก้ได้ทุกส่วน อันไหนน่าสนใจค่อยส่งเข้า Notion (ส่งทางเดียว ไม่ดึงกลับ)</p>
      </div>

      <Card>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim()) return
            s.addProject({ title: title.trim(), description: desc.trim(), missionId: 'empire', microTasks: [] })
            setTitle('')
            setDesc('')
            toast('เพิ่ม Project แล้ว')
          }}
        >
          <p className="label">เพิ่ม Project</p>
          <input className="field" placeholder="ชื่อ Project" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="ชื่อ Project" />
          <textarea className="field" rows={2} placeholder="คำอธิบาย" value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="คำอธิบาย Project" />
          <button className="btn btn-primary w-full" disabled={!title.trim()}><Plus size={16} /> เพิ่ม Project</button>
        </form>
      </Card>

      {projects.length === 0 ? (
        <Empty>ยังไม่มี Project เริ่มจดอันแรกด้านบนได้เลย</Empty>
      ) : (
        <>
          <p className="px-1 text-xs text-soft">เรียงจากใหม่ไปเก่า · ปักหมุดไว้ด้านบนได้ {pinnedCount(s.projects)}/{PIN_LIMIT}</p>
          <ul className="space-y-4">
            {projects.map((p) => <li key={p.id}><ProjectCard project={p} /></li>)}
          </ul>
        </>
      )}

      {deferred.length > 0 && (
        <details className="glass rounded-[1.75rem] p-4">
          <summary className="cursor-pointer text-sm">คิวทบทวน (งานที่เลื่อนออกไป) · {deferred.length}</summary>
          <div className="mt-3"><TaskList tasks={deferred} /></div>
        </details>
      )}
    </div>
  )
}

/** Tap to edit, Enter/blur saves, Esc cancels. */
function InlineText({ value, onSave, placeholder, label, multiline = false, required = false, className = '' }: { value: string; onSave: (v: string) => void; placeholder: string; label: string; multiline?: boolean; required?: boolean; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  if (!editing) {
    return (
      <button type="button" className={`min-w-0 flex-1 cursor-text text-left ${className}`} aria-label={`แก้ไข${label}`} onClick={() => { setDraft(value); setEditing(true) }}>
        {value ? <span className="whitespace-pre-wrap break-words">{value}</span> : <span className="text-soft">{placeholder}</span>}
      </button>
    )
  }
  const commit = () => {
    const v = draft.trim()
    setEditing(false)
    if (required && !v) return
    if (v !== value) onSave(v)
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setEditing(false)
    if (e.key === 'Enter' && !(multiline && e.shiftKey)) { e.preventDefault(); commit() }
  }
  const cls = `field !py-1.5 ${className}`
  return multiline ? (
    <textarea className={cls} rows={2} autoFocus value={draft} placeholder={placeholder} aria-label={label} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKey} />
  ) : (
    <input className={cls} autoFocus value={draft} placeholder={placeholder} aria-label={label} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKey} />
  )
}

function AddLine({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState('')
  return (
    <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAdd(v.trim()); setV('') } }}>
      <input className="field !py-2 text-sm" placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} aria-label={placeholder} />
      <button className="btn btn-soft !px-3" aria-label="เพิ่ม"><Plus size={16} /></button>
    </form>
  )
}

function ProjectCard({ project: p }: { project: Project }) {
  const s = useStore()
  const toast = useUI((u) => u.showToast)
  const [sending, setSending] = useState(false)
  const micro = microTasksOf(p, s.tasks)
  const setMicro = (next: MicroTaskText[]) => s.updateProject(p.id, { microTasks: next })
  const setMilestones = (next: Milestone[]) => s.updateProject(p.id, { milestones: next })
  const pin = () => {
    const n = nextPin(s.projects, p.id, s.now().toISOString())
    if (n === 'limit') { toast(`ปักหมุดได้สูงสุด ${PIN_LIMIT} อัน`); return }
    s.updateProject(p.id, { pinnedAt: n })
  }
  const send = async () => {
    setSending(true)
    try {
      const { url } = await pushToNotion(projectPush(p, micro))
      s.updateProject(p.id, { notion: { sentAt: s.now().toISOString(), url } })
      toast('ส่งเข้า Notion แล้ว (Idea Inbox & Lab)')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'ส่งเข้า Notion ไม่สำเร็จ')
    } finally {
      setSending(false)
    }
  }
  const changed = changedSinceSent(p.updatedAt, p.notion)
  return (
    <article className={`glass rounded-[1.75rem] border p-4 ${p.pinnedAt ? 'border-plum/40' : 'border-white/60'}`}>
      <div className="flex items-start gap-2">
        <InlineText value={p.title} required label="ชื่อ Project" placeholder="ชื่อ Project" className="text-lg font-medium" onSave={(v) => s.updateProject(p.id, { title: v })} />
        <button className={`rounded-full p-2 hover:bg-white/60 ${p.pinnedAt ? 'text-plum' : 'text-soft'}`} aria-label={p.pinnedAt ? 'เลิกปักหมุด' : 'ปักหมุด'} title={p.pinnedAt ? 'เลิกปักหมุด' : 'ปักหมุด'} aria-pressed={!!p.pinnedAt} onClick={pin}>
          {p.pinnedAt ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
        <button className="rounded-full p-2 text-soft hover:bg-white/60" aria-label="ลบ Project" title="ลบ Project" onClick={() => { if (confirm(`ลบ "${p.title}"?`)) s.deleteProject(p.id) }}><Trash2 size={16} /></button>
      </div>
      {(p.pinnedAt || p.isPrimaryBusiness) && (
        <p className="mt-0.5 flex gap-2 text-[11px] text-soft">
          {p.pinnedAt && <span className="flex items-center gap-1"><Pin size={11} /> ปักหมุด</span>}
          {p.isPrimaryBusiness && <span className="flex items-center gap-1"><Star size={11} /> ธุรกิจหลัก</span>}
        </p>
      )}
      <div className="mt-2 flex text-sm text-soft">
        <InlineText value={p.description} multiline label="คำอธิบาย" placeholder="+ เพิ่มคำอธิบาย" onSave={(v) => s.updateProject(p.id, { description: v })} />
      </div>

      <div className="mt-4">
        <p className="label mb-1.5">Milestones</p>
        <ul className="space-y-1">
          {p.milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={m.done} onChange={() => s.toggleMilestone(p.id, m.id)} aria-label={`เสร็จแล้ว: ${m.title}`} />
              <InlineText value={m.title} required label="Milestone" placeholder="Milestone" className={m.done ? 'line-through opacity-60' : ''} onSave={(v) => setMilestones(p.milestones.map((x) => (x.id === m.id ? { ...x, title: v } : x)))} />
              <button className="rounded-full p-1.5 text-soft hover:bg-white/60" aria-label={`ลบ ${m.title}`} onClick={() => setMilestones(p.milestones.filter((x) => x.id !== m.id))}><X size={14} /></button>
            </li>
          ))}
        </ul>
        <AddLine placeholder="เพิ่ม Milestone" onAdd={(v) => setMilestones([...p.milestones, { id: uid('ms'), title: v, done: false }])} />
      </div>

      <div className="mt-4">
        <p className="label mb-1.5">Micro Tasks</p>
        <ul className="space-y-1">
          {micro.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <span className="text-soft" aria-hidden>•</span>
              <InlineText value={m.title} required label="Micro Task" placeholder="Micro Task" onSave={(v) => setMicro(micro.map((x) => (x.id === m.id ? { ...x, title: v } : x)))} />
              <button className="rounded-full p-1.5 text-soft hover:bg-white/60" aria-label={`ลบ ${m.title}`} onClick={() => setMicro(micro.filter((x) => x.id !== m.id))}><X size={14} /></button>
            </li>
          ))}
        </ul>
        <AddLine placeholder="เพิ่ม Micro Task" onAdd={(v) => setMicro([...micro, { id: uid('mt'), title: v }])} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/50 pt-3">
        {p.notion ? (
          <p className="text-xs text-soft">
            ส่งเข้า Notion แล้ว {p.notion.sentAt.slice(0, 10)}
            {p.notion.url && <> · <a className="underline" href={p.notion.url} target="_blank" rel="noreferrer">เปิดใน Notion</a></>}
            {changed && ' · มีการแก้ไขหลังส่ง'}
          </p>
        ) : (
          <p className="text-xs text-soft">ยังอยู่ในพื้นที่ทดของเธอ</p>
        )}
        {(!p.notion || changed) && (
          <button className="btn btn-soft !min-h-0 !px-3 !py-1.5 text-xs" disabled={sending} onClick={() => void send()}>
            <Send size={14} /> {sending ? 'กำลังส่ง…' : p.notion ? 'ส่งเข้า Notion อีกครั้ง' : 'ส่งเข้า Notion'}
          </button>
        )}
      </div>
    </article>
  )
}

function Ideas() {
  const s = useStore()
  const toast = useUI((u) => u.showToast)
  const [text, setText] = useState('')
  const [sending, setSending] = useState<string | null>(null)
  const inbox = s.ideas.filter((i) => i.status === 'inbox')
  const send = async (id: string, t: string) => {
    setSending(id)
    try {
      const { url } = await pushToNotion(ideaPush(t))
      s.updateIdea(id, { notion: { sentAt: s.now().toISOString(), url } })
      toast('ส่งเข้า Notion แล้ว (Idea Inbox & Lab)')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'ส่งเข้า Notion ไม่สำเร็จ')
    } finally {
      setSending(null)
    }
  }
  return (
    <Card>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { s.addIdea(text.trim()); setText('') } }}>
        <input className="field" placeholder="จดไอเดียไว้ก่อน ไม่ต้องตัดสินใจตอนนี้" value={text} onChange={(e) => setText(e.target.value)} aria-label="ไอเดียใหม่" />
        <button className="btn btn-primary !px-4" aria-label="บันทึกไอเดีย"><Plus size={18} /></button>
      </form>
      <ul className="mt-4 space-y-2">
        {inbox.length === 0 && <Empty>Inbox ว่าง ไอเดียที่ไม่เกี่ยวกับธุรกิจหลักควรมาพักไว้ที่นี่</Empty>}
        {inbox.map((i) => (
          <li key={i.id} className="rounded-2xl bg-white/40 p-3">
            <div className="flex items-center gap-2">
              <InlineText value={i.text} required multiline label="ไอเดีย" placeholder="ไอเดีย" className="text-sm" onSave={(v) => s.updateIdea(i.id, { text: v })} />
              {!i.notion && (
                <button className="rounded-full p-2 text-soft hover:bg-white/60" aria-label="ส่งเข้า Notion" title="ส่งเข้า Notion (ทางเดียว)" disabled={sending === i.id} onClick={() => void send(i.id, i.text)}>
                  <Send size={16} />
                </button>
              )}
              <button className="rounded-full p-2 text-soft hover:bg-white/60" aria-label="เก็บเข้ากรุ" title="เก็บเข้ากรุ" onClick={() => s.updateIdea(i.id, { status: 'archived' })}><Trash2 size={16} /></button>
            </div>
            {i.notion && (
              <p className="mt-1 text-[11px] text-soft">
                ส่งเข้า Notion แล้ว {i.notion.sentAt.slice(0, 10)}
                {i.notion.url && <> · <a className="underline" href={i.notion.url} target="_blank" rel="noreferrer">เปิดใน Notion</a></>}
              </p>
            )}
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
