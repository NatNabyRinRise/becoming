import { useMemo } from 'react'
import { Avatar } from '../../components/companions/Avatar'
import { useStore } from '../../store/useStore'
import { useCore } from '../../intelligence/useCore'
import { useAttention } from '../../orchestration/useOrchestration'
import { buildQueue, morningBriefing } from '../../orchestration/roles/j'
import type { AttentionItem, PersonalContext } from '../../orchestration/types'
import { AttentionRow, TYPE_META } from './AttentionUI'

const LEVEL_TH = { recovery: 'ควรพักเป็นหลัก', light: 'ทำเบา ๆ', steady: 'พอดี', strong: 'พร้อมลุย' } as const

/** Morning Briefing (spec §8): Capacity → Business Attention → Thinking → Life → J Recommendation. */
export function BriefingView({ energy, minutes, reality }: { energy: number; minutes: number; reality: PersonalContext['circumstance'] }) {
  const { ctx, personal } = useAttention()
  const orch = useStore((s) => s.orchestration)
  const name = useStore((s) => s.profile.name)
  const memories = useCore((c) => c.memories)
  const brief = useMemo(() => {
    if (!ctx) return null
    const mem = memories.filter((m) => !m.deletedAt && m.status === 'active').map((m) => ({ kind: m.kind, content: m.content }))
    const q = buildQueue({ ctx, personal: { ...personal, energy, availableMinutes: minutes, circumstance: reality }, state: orch, memories: mem })
    return morningBriefing(q)
  }, [ctx, personal, energy, minutes, reality, orch, memories])

  if (!brief) return <p className="text-sm text-soft">กำลังอ่านข้อมูลจาก AI Company…</p>
  const c = brief.capacity
  return (
    <div className="space-y-4">
      <p className="text-xl">Good morning{name ? `, ${name}` : ''}.</p>

      <section className="glass rounded-[1.75rem] p-4">
        <div className="mb-2 flex items-center gap-2"><Avatar id="bloom" size={32} /><p className="label">Capacity</p></div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div><dd className="big-num text-2xl">{c.energy}</dd><dt className="text-[11px] text-soft">Energy %</dt></div>
          <div><dd className="big-num text-2xl">{c.focusMinutes}</dd><dt className="text-[11px] text-soft">นาทีโฟกัส</dt></div>
          <div><dd className="big-num text-2xl">{c.workloadLimit}</dd><dt className="text-[11px] text-soft">เรื่องสูงสุด</dt></div>
        </dl>
        <p className="mt-2 text-sm">{LEVEL_TH[c.level]} · {c.recovery}</p>
        {c.constraints.length > 0 && <p className="mt-1 text-xs text-soft">ข้อจำกัดวันนี้: {c.constraints.join(' · ')}</p>}
        {c.warning && <p className="mt-1 text-xs text-soft">⚠️ {c.warning}</p>}
      </section>

      <section className="glass rounded-[1.75rem] p-4">
        <p className="label">Business Attention</p>
        <Group type="do" items={brief.business.do} />
        <Group type="review" items={brief.business.review} />
        <Group type="decide" items={brief.business.decide} />
      </section>

      <section className="glass rounded-[1.75rem] p-4">
        <p className="label">Thinking</p>
        {brief.thinking.idea ? <AttentionRow item={brief.thinking.idea} /> : <p className="py-2 text-sm text-soft">ไม่มีไอเดียค้าง</p>}
        {brief.thinking.question && <p className="mt-1 rounded-2xl bg-white/40 px-3 py-2 text-sm">❓ {brief.thinking.question}</p>}
      </section>

      <section className="glass rounded-[1.75rem] p-4">
        <p className="label">Life</p>
        {brief.life.map((i) => <AttentionRow key={i.key} item={i} />)}
      </section>

      <section className="flex items-start gap-3 rounded-[1.75rem] bg-white/70 p-4">
        <Avatar id="j" size={44} />
        <div>
          <p className="label">J Recommendation</p>
          <p className="text-[15px]">“{brief.recommendation}”</p>
        </div>
      </section>
    </div>
  )
}

function Group({ type, items }: { type: 'do' | 'review' | 'decide'; items: AttentionItem[] }) {
  return (
    <div className="mt-2">
      <p className="text-xs text-soft">{TYPE_META[type].emoji} {TYPE_META[type].label} · {TYPE_META[type].th}</p>
      {items.length === 0 ? <p className="py-1 text-sm text-soft">—</p> : items.map((i) => <AttentionRow key={i.key} item={i} />)}
    </div>
  )
}
