import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { create } from 'zustand'
import { Check, Clock, ExternalLink, Play, ShieldAlert, ThumbsUp, PencilLine, X, Lightbulb, ChevronRight } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { Avatar } from '../../components/companions/Avatar'
import { COMPANIONS } from '../../data/seed'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { answer, useAttention } from '../../orchestration/useOrchestration'
import type { AttentionItem, AttentionType, DispatchPlan, IdeaStage, RoleId } from '../../orchestration/types'

export const TYPE_META: Record<AttentionType, { label: string; th: string; emoji: string; color: string }> = {
  do: { label: 'DO', th: 'ลงมือทำ', emoji: '✋', color: '#E9C27A' },
  review: { label: 'REVIEW', th: 'อ่าน / ตรวจ', emoji: '👀', color: '#A99ACB' },
  decide: { label: 'DECIDE', th: 'ตัดสินใจ', emoji: '⚖️', color: '#645B7C' },
  think: { label: 'THINK', th: 'คิด / ไอเดีย', emoji: '💡', color: '#D9A6C4' },
  life: { label: 'LIFE', th: 'ชีวิต / พลังงาน', emoji: '🌿', color: '#9CC5B0' },
}

const SOURCE_TH = { company_tasks: 'Company Tasks', idea_lab: 'Idea Inbox & Lab', life_os: 'Discipline & Life OS', ceo_review: 'Weekly CEO Review' } as const

/** Which attention item is open (any screen can open one). */
export const useAttentionUI = create<{ openKey: string | null; open: (k: string) => void; close: () => void }>((set) => ({
  openKey: null,
  open: (k) => set({ openKey: k }),
  close: () => set({ openKey: null }),
}))

export function TypeBadge({ type }: { type: AttentionType }) {
  const m = TYPE_META[type]
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider" style={{ background: m.color + '40' }}>
      <span aria-hidden>{m.emoji}</span> {m.label}
    </span>
  )
}

export function RoleChips({ plan, compact }: { plan: DispatchPlan; compact?: boolean }) {
  const roles: { id: RoleId; primary: boolean }[] = [...plan.primary.map((id) => ({ id, primary: true })), ...plan.support.filter((r) => !plan.primary.includes(r)).map((id) => ({ id, primary: false }))]
  return (
    <span className="inline-flex items-center -space-x-1.5" aria-label={`ทีมที่ดูแล: ${roles.map((r) => COMPANIONS[r.id].name).join(', ')}`}>
      {roles.map((r) => (
        <span key={r.id} className={r.primary ? '' : 'opacity-70'} title={`${COMPANIONS[r.id].name}${r.primary ? ' (หลัก)' : ' (ช่วย)'}`}>
          <Avatar id={r.id} size={compact ? 22 : 28} />
        </span>
      ))}
    </span>
  )
}

export function AttentionRow({ item }: { item: AttentionItem }) {
  const open = useAttentionUI((u) => u.open)
  return (
    <button className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-white/40" onClick={() => open(item.key)}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px]">{item.title}</p>
        <p className="truncate text-xs text-soft">{item.subtitle}</p>
      </div>
      <span className="shrink-0 text-xs text-soft">{item.minutes}′</span>
      <RoleChips plan={item.dispatch} compact />
      <ChevronRight size={16} className="shrink-0 text-soft" aria-hidden />
    </button>
  )
}

/** Mounted once in the app shell. */
export function AttentionSheet() {
  const key = useAttentionUI((u) => u.openKey)
  const close = useAttentionUI((u) => u.close)
  const { queue } = useAttention()
  const item = key ? queue?.items.find((i) => i.key === key) ?? null : null
  return (
    <Sheet open={!!item} onClose={close} title={item ? `${TYPE_META[item.type].label} · ${TYPE_META[item.type].th}` : ''}>
      {item && <AttentionDetail item={item} onDone={close} />}
    </Sheet>
  )
}

function Flow({ plan }: { plan: DispatchPlan }) {
  return (
    <details className="rounded-2xl bg-white/40 p-3 text-xs">
      <summary className="flex cursor-pointer items-center gap-2"><RoleChips plan={plan} compact /> <span className="text-soft">J ส่งให้ใครดูบ้าง</span></summary>
      <ol className="mt-2 flex flex-wrap items-center gap-1">
        {plan.flow.map((f, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-soft">→</span>}
            <span className="rounded-full bg-white/70 px-2 py-0.5">{f}</span>
          </li>
        ))}
      </ol>
    </details>
  )
}

function Block({ title, items, icon }: { title: string; items: string[]; icon?: string }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="label mb-1">{icon} {title}</p>
      <ul className="space-y-1 text-sm">
        {items.map((t, i) => <li key={i}>• {t}</li>)}
      </ul>
    </div>
  )
}

export function AttentionDetail({ item, onDone }: { item: AttentionItem; onDone: () => void }) {
  const s = useStore()
  const toast = useUI((u) => u.showToast)
  const nav = useNavigate()
  const [note, setNote] = useState('')
  const [pick, setPick] = useState<string | null>(item.type === 'decide' ? item.frame.recommendation.optionId : null)
  const reply = (fn: () => void, msg: string) => {
    fn()
    toast(msg)
    onDone()
  }
  const focus = (title: string, minutes: number) => {
    s.startFocus(null, title, Math.max(5, minutes))
    onDone()
    nav('/focus')
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <TypeBadge type={item.type} />
          {item.origin === 'becoming' && <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px]">BECOMING · {item.outputKind === 'reflection' ? 'Reflection' : 'Suggestion'}</span>}
          {item.ref && <span className="text-[11px] text-soft">จาก {SOURCE_TH[item.ref.source]}</span>}
        </div>
        <p className="text-lg leading-snug">{item.title}</p>
        <p className="text-sm text-soft">{item.subtitle} · {item.minutes} นาที{item.dueDate ? ` · ครบกำหนด ${item.dueDate}` : ''}</p>
      </div>

      {item.type === 'do' && (
        <>
          <section className="rounded-3xl bg-white/60 p-4">
            <div className="mb-2 flex items-center gap-2"><Avatar id="spark" size={32} /><p className="text-sm text-soft">Spark: เริ่มตรงนี้เลย</p></div>
            <p className="text-[15px]">{item.spark.startNow}</p>
            <ol className="mt-2 space-y-1 text-sm">
              {item.spark.steps.map((st, i) => <li key={i} className="flex justify-between gap-2"><span>{i + 1}. {st.title}</span><span className="shrink-0 text-xs text-soft">{st.minutes}′</span></li>)}
            </ol>
            <p className="mt-2 text-xs text-soft">{item.spark.challenge} · {item.spark.reward}</p>
          </section>
          <p className="text-sm text-soft">{item.task.summary}</p>
          <textarea className="w-full rounded-2xl bg-white/60 p-3 text-sm" rows={2} placeholder="โน้ตถึงทีม (ไม่บังคับ)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-primary col-span-2" onClick={() => focus(item.title, item.spark.sprintMinutes)}><Play size={16} /> เริ่ม {item.spark.sprintMinutes} นาที</button>
            <button className="btn btn-soft" onClick={() => reply(() => answer(item, { kind: 'action', outcome: 'done', note }), 'บันทึกว่าเสร็จแล้ว ส่งกลับ AI Company ✨')}><Check size={16} /> เสร็จแล้ว</button>
            <button className="btn btn-soft" onClick={() => reply(() => answer(item, { kind: 'action', outcome: 'deferred', note }), 'เลื่อนไปพรุ่งนี้ แจ้งทีมแล้ว')}><Clock size={16} /> เลื่อน</button>
            <button className="btn btn-ghost col-span-2" onClick={() => reply(() => answer(item, { kind: 'action', outcome: 'blocked', note }), 'แจ้งทีมว่าติดปัญหาแล้ว')}><ShieldAlert size={16} /> ติดปัญหา (บอกทีม)</button>
          </div>
        </>
      )}

      {item.type === 'review' && (
        <>
          <section className="space-y-3 rounded-3xl bg-white/60 p-4">
            <p className="text-[15px]"><span className="label block">AI ทำอะไรมา</span>{item.frame.whatAiCreated}</p>
            <p className="text-sm"><span className="label block">ทำไมสำคัญ</span>{item.frame.whyItMatters}</p>
            <Block title="3 จุดที่ควรดู" items={item.frame.keyPoints} icon="🔎" />
            <Block title="อาจไม่ตรงกับเธอตรงไหน" items={item.frame.possibleMismatch} icon="⚠️" />
            <Block title="คำถามถึงเธอ" items={item.frame.questions} icon="💬" />
          </section>
          <details className="rounded-2xl bg-white/40 p-3 text-sm">
            <summary className="cursor-pointer">ดูงานต้นฉบับ</summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{item.frame.original}</pre>
            {item.frame.originalUrl && <a className="mt-2 inline-flex items-center gap-1 text-xs text-plum underline" href={item.frame.originalUrl} target="_blank" rel="noreferrer"><ExternalLink size={12} /> เปิดใน AI Company</a>}
          </details>
          <NexusBox item={item} />
          <textarea className="w-full rounded-2xl bg-white/60 p-3 text-sm" rows={3} placeholder="Feedback ถึงทีม (ตรง/ไม่ตรงกับแนวคิดเธอตรงไหน)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <button className="btn btn-primary" onClick={() => reply(() => answer(item, { kind: 'review', outcome: 'approved', feedback: note }), 'อนุมัติแล้ว ส่ง Feedback กลับทีม')}><ThumbsUp size={16} /> Approve</button>
            <button className="btn btn-soft" disabled={!note.trim()} onClick={() => reply(() => answer(item, { kind: 'review', outcome: 'revise', feedback: note }), 'ส่งคำขอแก้กลับทีมแล้ว')}><PencilLine size={16} /> Revise</button>
            <button className="btn btn-ghost" disabled={!note.trim()} onClick={() => reply(() => answer(item, { kind: 'review', outcome: 'rejected', feedback: note }), 'แจ้งทีมว่าไม่ผ่านแล้ว')}><X size={16} /> Reject</button>
          </div>
          {!note.trim() && <p className="-mt-2 text-[11px] text-soft">Revise / Reject ต้องเขียน Feedback สั้น ๆ ให้ทีมรู้ว่าแก้ตรงไหน</p>}
        </>
      )}

      {item.type === 'decide' && (
        <>
          <section className="rounded-3xl bg-white/60 p-4">
            <p className="label">คำถามที่ต้องตัดสิน</p>
            <p className="text-[17px]">{item.frame.question}</p>
            <p className="mt-1 text-xs text-soft">{item.task.decision?.context}</p>
          </section>
          <div role="radiogroup" aria-label="ตัวเลือก" className="space-y-2">
            {item.frame.options.map((o, i) => (
              <button key={o.id} role="radio" aria-checked={pick === o.id} onClick={() => setPick(o.id)} className={`w-full rounded-3xl p-3 text-left text-sm transition ${pick === o.id ? 'bg-plum text-white' : 'glass'}`}>
                <p className="font-medium">Option {String.fromCharCode(65 + i)}: {o.label}{item.frame.recommendation.optionId === o.id ? ' ⭐' : ''}</p>
                <p className={pick === o.id ? 'opacity-90' : 'text-soft'}>{o.summary}</p>
                {(o.pros.length > 0 || o.cons.length > 0) && <p className="mt-1 text-xs opacity-90">＋ {o.pros.join(', ') || '–'} · − {o.cons.join(', ') || '–'}</p>}
              </button>
            ))}
          </div>
          <section className="space-y-3 rounded-3xl bg-white/60 p-4">
            <div className="flex items-start gap-2"><Avatar id="atlas" size={32} /><p className="text-sm">{item.frame.recommendation.text}</p></div>
            <Block title="ความเสี่ยง" items={item.frame.risks} icon="⚠️" />
            <Block title="ผลกระทบ" items={[...item.frame.impact, ...(item.frame.capacityImpact ? [item.frame.capacityImpact] : [])]} icon="🌊" />
            {item.frame.deadline && <p className="text-sm"><span className="label">ควรตัดสินใจภายใน</span> {item.frame.deadline}</p>}
            <p className="text-sm"><span className="label block">หลังตัดสินใจ</span>{item.frame.next}</p>
          </section>
          <NexusBox item={item} />
          <textarea className="w-full rounded-2xl bg-white/60 p-3 text-sm" rows={2} placeholder="เหตุผลสั้น ๆ (Decision Note)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button
            className="btn btn-primary w-full"
            disabled={!pick}
            onClick={() => {
              const o = item.frame.options.find((x) => x.id === pick)!
              reply(() => answer(item, { kind: 'decision', optionId: o.id, optionLabel: o.label, note, decidedOn: s.today(), question: item.frame.question, context: item.task.decision?.context ?? '' }), `ตัดสินใจแล้ว: ${o.label} ทีมเดินต่อได้เลย`)
            }}
          >
            <Check size={16} /> ตัดสินใจ
          </button>
        </>
      )}

      {item.type === 'think' && item.idea && item.frame && (
        <>
          <Pipeline stage={item.idea.stage} />
          {item.idea.note && <p className="text-sm text-soft">{item.idea.note}</p>}
          <section className="space-y-3 rounded-3xl bg-white/60 p-4">
            <div className="flex items-center gap-2"><Avatar id="muse" size={28} /><p className="text-sm text-soft">Muse ขยายไอเดีย</p></div>
            <Block title="คำถามชวนคิด" items={item.frame.expansion} />
            <p className="text-sm"><span className="label">มุมเล่า</span> {item.frame.angle}</p>
            <p className="text-sm"><span className="label">การทดลอง</span> {item.frame.experiment}</p>
            <p className="text-sm"><span className="label">ทางเลือกอื่น</span> {item.frame.alternative}</p>
            <div className="flex items-center gap-2 pt-1"><Avatar id="atlas" size={28} /><p className="text-sm text-soft">Atlas ท้าทาย</p></div>
            <Block title="" items={item.frame.challenge} />
            <p className="text-sm"><span className="label">สิ่งที่ยังไม่ควรทำ</span> {item.frame.whatNotToDo}</p>
          </section>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-soft" onClick={() => reply(() => answer(item, { kind: 'idea', outcome: 'explore' }), 'เก็บไว้สำรวจต่อ')}>สำรวจต่อ</button>
            <button className="btn btn-soft" onClick={() => reply(() => answer(item, { kind: 'idea', outcome: 'validate' }), 'ย้ายไปขั้น Validate')}>ทดสอบ (Validate)</button>
            <button className="btn btn-ghost" onClick={() => reply(() => answer(item, { kind: 'idea', outcome: 'park' }), 'พักไอเดียไว้ก่อน')}>พักไว้</button>
            <button className="btn btn-ghost" onClick={() => reply(() => answer(item, { kind: 'idea', outcome: 'kill' }), 'ปิดไอเดียนี้แล้ว')}>ปิดไอเดีย</button>
            <button className="btn btn-primary col-span-2" disabled={item.idea.stage !== 'validate'} onClick={() => reply(() => answer(item, { kind: 'idea', outcome: 'commit' }), 'ส่งคำขอ Commit ไป AI Company แล้ว')}>
              <Lightbulb size={16} /> ขอ AI Company Commit
            </button>
          </div>
          <p className="text-[11px] text-soft">BECOMING ไม่สร้างโปรเจกต์หรืองานเอง ไอเดียต้องผ่าน Validate แล้ว AI Company เป็นคน Commit</p>
        </>
      )}

      {item.type === 'think' && item.prompt && (
        <>
          <p className="text-sm text-soft">{item.why}</p>
          <textarea className="w-full rounded-2xl bg-white/60 p-3 text-sm" rows={4} placeholder="คิดออกมาดัง ๆ ตรงนี้…" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn btn-primary w-full" disabled={!note.trim()} onClick={() => reply(() => s.addJournal({ content: `${item.prompt}\n\n${note}`, type: 'reflection', tags: ['ceo-review'] }), 'บันทึกลง Journal แล้ว')}>
            บันทึกเป็น Reflection
          </button>
        </>
      )}

      {item.type === 'life' && (
        <>
          <div className="flex items-start gap-2 rounded-3xl bg-white/60 p-4"><Avatar id="bloom" size={32} /><p className="text-sm">{item.why}</p></div>
          {item.ref ? (
            <div className="grid grid-cols-3 gap-2">
              <button className="btn btn-primary" onClick={() => reply(() => answer(item, { kind: 'life', outcome: 'done', note: '' }), 'ดีมาก ดูแลตัวเองแล้ว 🌿')}><Check size={16} /> ทำแล้ว</button>
              <button className="btn btn-soft" onClick={() => reply(() => answer(item, { kind: 'life', outcome: 'adjusted', note: 'ทำแบบสั้นลง' }), 'ปรับให้เบาลงแล้ว')}>ปรับ</button>
              <button className="btn btn-ghost" onClick={() => reply(() => answer(item, { kind: 'life', outcome: 'skipped', note: '' }), 'ข้ามวันนี้ ไม่เป็นไร')}>ข้าม</button>
            </div>
          ) : (
            <button className="btn btn-primary w-full" onClick={() => focus('พักฟื้นพลัง', item.minutes)}><Play size={16} /> พัก {item.minutes} นาที</button>
          )}
        </>
      )}

      <Flow plan={item.dispatch} />
    </div>
  )
}

function NexusBox({ item }: { item: AttentionItem }) {
  const c = item.context
  if (!c || (c.similarPast.length === 0 && c.preferences.length === 0 && c.patterns.length === 0)) return null
  return (
    <section className="space-y-2 rounded-3xl bg-white/40 p-4">
      <div className="flex items-center gap-2"><Avatar id="nexus" size={28} /><p className="text-sm text-soft">Nexus เติมบริบท</p></div>
      <Block title="การตัดสินใจที่คล้ายกัน" items={c.similarPast} />
      <Block title="สิ่งที่เธอเคยบอกไว้" items={c.preferences} />
      <Block title="รูปแบบที่สังเกตเห็น" items={c.patterns} />
    </section>
  )
}

const STAGES: { id: IdeaStage; label: string }[] = [
  { id: 'capture', label: 'Capture' },
  { id: 'expand', label: 'Expand' },
  { id: 'validate', label: 'Validate' },
  { id: 'committed', label: 'Commit' },
]
export function Pipeline({ stage }: { stage: IdeaStage }) {
  const idx = stage === 'commit_requested' || stage === 'committed' ? 3 : STAGES.findIndex((x) => x.id === stage)
  return (
    <ol className="flex gap-1.5" aria-label="ขั้นของไอเดีย">
      {STAGES.map((st, i) => (
        <li key={st.id} className="flex-1">
          <div className={`h-1 rounded-full ${i <= idx ? 'bg-plum' : 'bg-white/60'}`} />
          <span className={`mt-1 block text-[10px] ${i === idx ? 'text-ink' : 'text-soft'}`}>{st.label}{i === 3 ? ' (AI Company)' : ''}</span>
        </li>
      ))}
    </ol>
  )
}
