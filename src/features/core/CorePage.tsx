import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Brain, Check, X, Pencil, Trash2, ThumbsUp, ThumbsDown, Sparkles, Plus } from 'lucide-react'
import { PageHeader, Card, Empty, Segmented } from '../../components/ui/controls'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { useCore, visibleMemories } from '../../intelligence/useCore'
import { AGENTS, agentName } from '../../intelligence/agents'
import { computeWeights, dueForEvaluation, eventCounts } from '../../intelligence/learning'
import type { Memory, MemoryKind } from '../../intelligence/types'
import { CapturePanel } from './CapturePanel'

type Tab = 'recs' | 'memory' | 'capture' | 'behavior' | 'team'

const KIND_TH: Record<MemoryKind, string> = { fact: 'ข้อเท็จจริง', preference: 'ความชอบ', pattern: 'รูปแบบพฤติกรรม', goal: 'เป้าหมาย', context: 'บริบทชีวิต' }
const EVENT_TH: Record<string, string> = {
  'task.completed': 'งานที่เสร็จ',
  'task.postponed': 'งานที่เลื่อน',
  'focus.completed': 'โฟกัสจบรอบ',
  'focus.stopped': 'โฟกัสหยุดกลางทาง',
  'checkin.saved': 'เช็กอิน',
  'journal.added': 'บันทึก Journal',
  'rescue.confirmed': 'ใช้ Rescue',
  'recommendation.approved': 'รับคำแนะนำ',
  'recommendation.dismissed': 'ปฏิเสธคำแนะนำ',
  'recommendation.evaluated': 'ประเมินคำแนะนำ',
  'capture.imported': 'นำเข้าจากภาพ',
}

export function CorePage({ initialTab = 'recs' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab)
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader eyebrow="Intelligence Core" title="สมองกลางของทีม" back />
      <LoopStrip />
      <Segmented label="หมวด" value={tab} onChange={setTab} options={[
        { id: 'recs', label: 'คำแนะนำ' },
        { id: 'memory', label: 'ความจำ' },
        { id: 'capture', label: 'อ่านจากภาพ' },
        { id: 'behavior', label: 'พฤติกรรม' },
        { id: 'team', label: 'ทีม AI' },
      ]} />
      {tab === 'recs' && <RecsTab />}
      {tab === 'memory' && <MemoryTab />}
      {tab === 'capture' && <CapturePanel />}
      {tab === 'behavior' && <BehaviorTab />}
      {tab === 'team' && <TeamTab />}
    </div>
  )
}

function LoopStrip() {
  const steps = ['Observe เก็บข้อมูล', 'Analyze วิเคราะห์', 'Recommend เสนอ', 'Evaluate ประเมิน', 'Learn ปรับความเข้าใจ']
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-[11px] text-soft" aria-label="วงจรการเรียนรู้">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className="rounded-full bg-white/50 px-2 py-0.5">{s}</span>
          {i < steps.length - 1 && <span aria-hidden>→</span>}
        </li>
      ))}
    </ol>
  )
}

function RecsTab() {
  const c = useCore()
  const s = useStore()
  const toast = useUI((u) => u.showToast)
  const now = c.now()
  const live = c.recommendations.filter((r) => !r.deletedAt)
  const proposed = live.filter((r) => r.status === 'proposed')
  const due = dueForEvaluation(live, now)
  const trying = live.filter((r) => r.status === 'approved' && !due.includes(r))
  const history = live.filter((r) => r.status === 'dismissed' || r.status === 'evaluated').slice(-10).reverse()

  const analyze = () => {
    const n = c.runAnalysis({ tasks: s.tasks, timezone: s.settings.timezone })
    toast(n ? `มีคำแนะนำใหม่ ${n} ข้อ` : 'ยังไม่มีอะไรใหม่ ระบบต้องการข้อมูลการใช้งานเพิ่มอีกหน่อย')
  }

  return (
    <div className="space-y-3">
      {due.map((r) => (
        <Card key={r.id} className="space-y-2">
          <p className="eyebrow">ประเมินผล · {agentName(r.agentId)}</p>
          <p>{r.title}</p>
          <p className="text-sm text-soft">ลองทำมาสักพักแล้ว ได้ผลไหม คำตอบนี้ช่วยให้ทีมรู้ว่าคำแนะนำแบบไหนเหมาะกับเธอ</p>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={() => { c.evaluate(r.id, true); toast('ขอบคุณ ทีมจะจำไว้') }}><ThumbsUp size={16} /> ได้ผล</button>
            <button className="btn btn-soft flex-1" onClick={() => { c.evaluate(r.id, false); toast('รับทราบ จะแนะนำแบบนี้น้อยลง') }}><ThumbsDown size={16} /> ไม่ค่อยได้ผล</button>
          </div>
        </Card>
      ))}
      {proposed.map((r) => (
        <Card key={r.id} className="space-y-2">
          <p className="eyebrow">คำแนะนำ · {agentName(r.agentId)}</p>
          <p className="text-lg">{r.title}</p>
          <p className="text-sm">{r.body}</p>
          <p className="text-[11px] text-soft">เหตุผล: {r.rationale}</p>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={() => c.decide(r.id, true)}><Check size={16} /> ลองทำ</button>
            <button className="btn btn-soft flex-1" onClick={() => c.decide(r.id, false)}><X size={16} /> ไม่ใช่ตอนนี้</button>
          </div>
        </Card>
      ))}
      {proposed.length === 0 && due.length === 0 && <Empty>ยังไม่มีคำแนะนำใหม่ ยิ่งใช้งาน (เช็กอิน ทำงาน โฟกัส) ทีมยิ่งเข้าใจเธอ</Empty>}
      <button className="btn btn-soft w-full" onClick={analyze}><Sparkles size={16} /> วิเคราะห์ตอนนี้</button>
      {trying.length > 0 && (
        <Card>
          <h2 className="mb-2 text-base">กำลังลองอยู่</h2>
          <ul className="space-y-1 text-sm">{trying.map((r) => <li key={r.id}>• {r.title}</li>)}</ul>
        </Card>
      )}
      {history.length > 0 && (
        <Card>
          <h2 className="mb-2 text-base">ประวัติ</h2>
          <ul className="space-y-1 text-sm">
            {history.map((r) => (
              <li key={r.id} className="flex justify-between gap-2">
                <span className="text-soft">{r.title}</span>
                <span className="shrink-0 text-[11px]">{r.status === 'dismissed' ? 'ไม่รับ' : r.outcome === 'helpful' ? 'ได้ผล' : 'ไม่ได้ผล'}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function MemoryTab() {
  const c = useCore()
  const toast = useUI((u) => u.showToast)
  const mems = visibleMemories(c.memories)
  const proposed = mems.filter((m) => m.status === 'proposed')
  const active = mems.filter((m) => m.status === 'active')
  const [text, setText] = useState('')
  const [kind, setKind] = useState<MemoryKind>('fact')

  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <p className="text-sm text-soft">ทุกอย่างที่ทีมจำเกี่ยวกับเธออยู่ที่นี่ เธอแก้หรือลบได้ทุกข้อ ความจำที่ระบบเรียนรู้เองจะรอให้เธออนุมัติก่อนถูกใช้</p>
        <textarea className="field min-h-[72px]" placeholder="เช่น ลูกตื่นประมาณ 6 โมงเช้า / อยากมีรายได้ 1 แสนต่อเดือนภายในปีนี้" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <select className="field !w-auto !py-2" value={kind} onChange={(e) => setKind(e.target.value as MemoryKind)} aria-label="ประเภท">
            {(Object.keys(KIND_TH) as MemoryKind[]).map((k) => <option key={k} value={k}>{KIND_TH[k]}</option>)}
          </select>
          <button className="btn btn-primary" disabled={!text.trim()} onClick={() => { c.addMemory({ content: text, kind }); setText(''); toast('จำไว้แล้ว') }}><Plus size={16} /> เพิ่มความจำ</button>
        </div>
      </Card>
      {proposed.length > 0 && (
        <Card className="space-y-2">
          <h2 className="text-base">รออนุมัติ</h2>
          {proposed.map((m) => <MemoryRow key={m.id} m={m} />)}
        </Card>
      )}
      <Card className="space-y-2">
        <h2 className="text-base">ความจำระยะยาว ({active.length})</h2>
        {active.length === 0 ? <Empty>ยังไม่มีความจำ</Empty> : active.map((m) => <MemoryRow key={m.id} m={m} />)}
      </Card>
    </div>
  )
}

function MemoryRow({ m }: { m: Memory }) {
  const c = useCore()
  const [edit, setEdit] = useState(false)
  const [text, setText] = useState(m.content)
  const src = m.source === 'user' ? 'เธอบอก' : m.source === 'capture' ? 'จากภาพ' : m.source === 'learned' ? 'เรียนรู้จากพฤติกรรม' : agentName(m.agentId)
  return (
    <div className="rounded-2xl bg-white/40 p-3">
      {edit ? (
        <div className="space-y-2">
          <textarea className="field" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={() => { c.updateMemory(m.id, { content: text.trim() }); setEdit(false) }}>บันทึก</button>
            <button className="btn btn-ghost" onClick={() => { setText(m.content); setEdit(false) }}>ยกเลิก</button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm">{m.content}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[11px] text-soft">{KIND_TH[m.kind]} · {src}</span>
            <span className="flex gap-1">
              {m.status === 'proposed' && <button className="btn btn-primary !px-3 !py-1 text-xs" onClick={() => c.updateMemory(m.id, { status: 'active' })}><Check size={14} /> ถูกต้อง</button>}
              <button className="btn-ghost rounded-full p-1.5" aria-label="แก้ไข" onClick={() => setEdit(true)}><Pencil size={14} /></button>
              <button className="btn-ghost rounded-full p-1.5" aria-label="ลบ" onClick={() => c.deleteMemory(m.id)}><Trash2 size={14} /></button>
            </span>
          </div>
        </>
      )}
    </div>
  )
}

function BehaviorTab() {
  const c = useCore()
  const now = c.now().getTime()
  const counts = useMemo(() => eventCounts(c.events, now - 30 * 86_400_000), [c.events, now])
  const weights = useMemo(() => Object.values(computeWeights(c.recommendations)), [c.recommendations])
  const recent = c.events.slice(-30).reverse()
  return (
    <div className="space-y-3">
      <Card>
        <h2 className="mb-2 text-base">30 วันล่าสุด</h2>
        {Object.keys(counts).length === 0 ? <Empty>ยังไม่มีข้อมูลพฤติกรรม</Empty> : (
          <ul className="grid grid-cols-2 gap-1 text-sm">
            {Object.entries(counts).map(([k, n]) => <li key={k}>{EVENT_TH[k] ?? k}: <b>{n}</b></li>)}
          </ul>
        )}
      </Card>
      {weights.length > 0 && (
        <Card>
          <h2 className="mb-1 text-base">สิ่งที่ทีมเรียนรู้จากผลตอบรับ</h2>
          <p className="mb-2 text-[11px] text-soft">น้ำหนักสูง = คำแนะนำแบบนี้ได้ผลกับเธอ ต่ำกว่า 0.3 จะหยุดแนะนำ</p>
          <ul className="space-y-1 text-sm">
            {weights.map((w) => (
              <li key={w.signalKey} className="flex justify-between"><span className="text-soft">{w.signalKey}</span><span>{w.weight.toFixed(2)} ({w.helpful}👍 {w.notHelpful}👎)</span></li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <h2 className="mb-2 text-base">บันทึกล่าสุด</h2>
        {recent.length === 0 ? <Empty>ยังไม่มี</Empty> : (
          <ul className="space-y-1 text-sm">
            {recent.map((e) => (
              <li key={e.id} className="flex justify-between gap-2"><span>{EVENT_TH[e.type] ?? e.type}</span><span className="text-[11px] text-soft">{new Date(e.occurredAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</span></li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function TeamTab() {
  return (
    <div className="space-y-2">
      {AGENTS.map((a) => (
        <Card key={a.id} className="flex items-center gap-3 !p-4">
          <Brain size={20} strokeWidth={1.6} />
          <div className="flex-1">
            <p>{a.name} <span className="text-xs text-soft">· {a.role}</span></p>
            <p className="text-xs text-soft">{a.roleTh}</p>
          </div>
          <span className="rounded-full bg-white/50 px-2.5 py-0.5 text-[11px]">{a.status === 'active' ? 'ทำงานอยู่' : 'รอเปิดใช้'}</span>
        </Card>
      ))}
      <p className="px-1 text-[11px] text-soft">ผู้ช่วยแต่ละคนจะถูกเปิดทีละคน ทุกคนใช้ความจำและวงจรการเรียนรู้เดียวกันนี้ และทุกคำแนะนำต้องผ่านการอนุมัติของเธอ ดูหน้า <Link className="underline" to="/team">ทีมของฉัน</Link></p>
    </div>
  )
}
