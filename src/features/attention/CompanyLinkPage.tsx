import { useState } from 'react'
import { RefreshCw, Send, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../../components/ui/controls'
import { Avatar } from '../../components/companions/Avatar'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { reloadSources, sendOutbox, suggestToCompany, useAttention } from '../../orchestration/useOrchestration'
import { weeklySynthesis } from '../../orchestration/roles/j'
import { learningSignals } from '../../orchestration/roles/nexus'
import { outcomeLabel, pendingEvents } from '../../orchestration/writeback'
import { activeAdapter } from '../../orchestration/sources'
import type { RoleId } from '../../orchestration/types'
import { RoleChips } from './AttentionUI'

const GUARDRAILS = [
  'Business Truth อยู่ที่ AI Company',
  'BECOMING ไม่สร้าง Committed Business Task เอง',
  'คำแนะนำของ BECOMING ติดสถานะ Suggestion เสมอ',
  'Business Suggestion ต้องกลับ AI Company ก่อน Commit',
  'Review เก็บงานต้นฉบับและลิงก์ไว้',
  'Decision เก็บบริบทและผลการตัดสิน',
  'J เป็นผู้ประสาน ไม่ใช่ผู้สร้างงาน',
  'Spark ช่วยลงมือ ไม่ใช่วางกลยุทธ์',
  'Bloom ลดภาระที่แนะนำได้ แต่ไม่เปลี่ยน Business Priority',
  'Feedback ของเธอถูกเก็บให้ Nexus เรียนรู้',
]

const ROLES: { id: RoleId; does: string }[] = [
  { id: 'j', does: 'รับ Context, Dispatch, รวมผล, จัดลำดับ Attention' },
  { id: 'atlas', does: 'Strategic Fit, Pros/Cons, Risk, Decision Frame' },
  { id: 'bloom', does: 'Capacity, Workload Limit, Overload, Recovery' },
  { id: 'muse', does: 'ขยายไอเดีย มุมสร้างสรรค์ (เป็น Suggestion เท่านั้น)' },
  { id: 'spark', does: 'Micro Step, Start Now, Sprint หลัง J เลือกแล้ว' },
  { id: 'nexus', does: 'Context Pack, Pattern, Decision เก่า, Preference' },
]

/** AI Company Link: sources BECOMING reads, Weekly CEO Review synthesis, and the write-back outbox. */
export function CompanyLinkPage() {
  const { ctx, queue, loading } = useAttention()
  const orch = useStore((s) => s.orchestration)
  const toast = useUI((u) => u.showToast)
  const [title, setTitle] = useState('')
  const [why, setWhy] = useState('')
  const pending = pendingEvents(orch)
  const weekly = ctx && queue ? weeklySynthesis(ctx, queue, orch.events) : null
  const signals = learningSignals(orch.events)
  const counts = ctx
    ? [
        { label: 'Company Tasks', n: ctx.companyTasks.filter((t) => t.readyForBecoming).length, sub: `พร้อมให้ BECOMING จาก ${ctx.companyTasks.length}` },
        { label: 'Idea Inbox & Lab', n: ctx.ideas.length, sub: 'ไอเดีย' },
        { label: 'Discipline & Life OS', n: ctx.life.items.length, sub: 'กิจวัตร/ข้อจำกัด' },
        { label: 'Weekly CEO Review', n: ctx.ceoReview ? 1 : 0, sub: ctx.ceoReview ? `สัปดาห์ ${ctx.ceoReview.weekStart}` : 'ยังไม่มี' },
      ]
    : []

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader eyebrow="Personal Orchestration Layer" title="AI Company Link" back />
      <p className="-mt-4 text-sm text-soft">AI Company ตัดสินว่ามีงานอะไรบ้าง · BECOMING ตัดสินว่าอะไรควรได้ความสนใจของเธอตอนนี้</p>

      <section className="glass rounded-[1.75rem] p-4">
        <div className="flex items-center justify-between">
          <p className="label">แหล่งข้อมูล · {activeAdapter().label}</p>
          <button className="btn btn-ghost !min-h-0 !px-2 !py-1 text-xs" onClick={() => void reloadSources().then(() => toast('โหลดข้อมูลใหม่แล้ว'))} disabled={loading}><RefreshCw size={14} /> โหลดใหม่</button>
        </div>
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {counts.map((c) => (
            <li key={c.label} className="rounded-2xl bg-white/50 p-3">
              <p className="big-num text-2xl">{c.n}</p>
              <p className="text-xs">{c.label}</p>
              <p className="text-[11px] text-soft">{c.sub}</p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-soft">ตอนนี้ใช้ข้อมูลจำลอง (Local JSON) โครงสร้างพร้อมต่อ Notion / API จริงภายหลังโดยไม่ต้องรื้อ</p>
      </section>

      {weekly && (
        <section className="glass space-y-3 rounded-[1.75rem] p-4">
          <div className="flex items-center justify-between"><p className="label">Weekly CEO Review · J + Atlas + Bloom</p><RoleChips plan={weekly.dispatch} compact /></div>
          <Grid title="ขยับแล้ว" items={weekly.moved} />
          <Grid title="ค้างอยู่" items={weekly.stalled} />
          <Grid title="ต้องตัดสินใจ" items={weekly.needsDecision} />
          <Grid title="ควรหยุด" items={weekly.stop} />
          <Grid title="ทำต่อ" items={weekly.continue} />
          <p className="text-sm"><span className="label block">Capacity จริง</span>{weekly.capacityReality}</p>
          <div className="rounded-2xl bg-white/60 p-3">
            <p className="label mb-1">Priority สัปดาห์หน้า</p>
            <ol className="list-decimal space-y-0.5 pl-5 text-sm">{weekly.priorities.map((p) => <li key={p}>{p}</li>)}</ol>
          </div>
        </section>
      )}

      <section className="glass space-y-2 rounded-[1.75rem] p-4">
        <div className="flex items-center justify-between">
          <p className="label">ส่งกลับ AI Company (Write-back) · รอส่ง {pending.length}</p>
          <button className="btn btn-soft !min-h-0 !px-3 !py-1.5 text-xs" disabled={pending.length === 0} onClick={() => void sendOutbox().then(() => toast('ส่งแล้ว'))}><Send size={14} /> ส่งตอนนี้</button>
        </div>
        {orch.events.length === 0 ? (
          <p className="text-sm text-soft">ยังไม่มีคำตอบที่ต้องส่งกลับ</p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {[...orch.events].reverse().slice(0, 30).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 rounded-2xl bg-white/40 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{e.title}</span>
                <span className="shrink-0 text-xs">{outcomeLabel(e.payload)} · <span className={e.delivery === 'sent' ? 'text-soft' : ''}>{e.delivery === 'sent' ? 'ส่งแล้ว' : e.delivery === 'failed' ? 'ส่งไม่สำเร็จ' : 'รอส่ง'}</span></span>
              </li>
            ))}
          </ul>
        )}
        {signals.length > 0 && <p className="flex items-center gap-2 pt-1 text-xs text-soft"><Avatar id="nexus" size={22} /> {signals.join(' · ')}</p>}
      </section>

      <section className="glass space-y-2 rounded-[1.75rem] p-4">
        <p className="label">เสนอไอเดียธุรกิจให้ AI Company</p>
        <p className="text-xs text-soft">จะถูกส่งเป็น Suggestion ให้ทีมพิจารณา ไม่กลายเป็นงานเองอัตโนมัติ</p>
        <input className="w-full rounded-2xl bg-white/60 p-3 text-sm" placeholder="ไอเดีย" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="w-full rounded-2xl bg-white/60 p-3 text-sm" rows={2} placeholder="ทำไมน่าสนใจ" value={why} onChange={(e) => setWhy(e.target.value)} />
        <button
          className="btn btn-primary w-full"
          disabled={!title.trim()}
          onClick={() => {
            suggestToCompany({ title: title.trim(), rationale: why.trim(), proposedBy: 'j' })
            setTitle('')
            setWhy('')
            toast('ส่ง Suggestion ไป AI Company แล้ว')
          }}
        >
          ส่งเป็น Suggestion
        </button>
        {orch.suggestions.length > 0 && (
          <ul className="space-y-1 pt-1 text-sm">
            {[...orch.suggestions].reverse().slice(0, 10).map((sg) => (
              <li key={sg.id} className="flex justify-between gap-2"><span className="truncate">{sg.title}</span><span className="shrink-0 text-xs text-soft">{{ suggestion: 'Suggestion', sent: 'ส่งแล้ว · รอพิจารณา', accepted: 'Committed', declined: 'ไม่รับ' }[sg.status]}</span></li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass rounded-[1.75rem] p-4">
        <p className="label mb-2">ทีม BECOMING</p>
        <ul className="space-y-2">
          {ROLES.map((r) => (
            <li key={r.id} className="flex items-center gap-3 text-sm"><Avatar id={r.id} size={34} /><span><b className="font-medium">{r.id === 'j' ? 'J' : r.id[0].toUpperCase() + r.id.slice(1)}</b> · {r.does}</span></li>
          ))}
        </ul>
      </section>

      <details className="glass rounded-[1.75rem] p-4">
        <summary className="flex cursor-pointer items-center gap-2 text-sm"><ShieldCheck size={16} /> Guardrails ของ BECOMING</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{GUARDRAILS.map((g) => <li key={g}>{g}</li>)}</ol>
      </details>
    </div>
  )
}

function Grid({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="label">{title}</p>
      <ul className="text-sm">{items.map((i) => <li key={i}>• {i}</li>)}</ul>
    </div>
  )
}
