import { useMemo } from 'react'
import { Avatar } from '../../components/companions/Avatar'
import { useStore } from '../../store/useStore'
import { useAttention } from '../../orchestration/useOrchestration'
import { rescuePlan, type RescueOutput } from '../../orchestration/roles/j'
import type { AttentionItem } from '../../orchestration/types'
import { TypeBadge } from './AttentionUI'

/** J's Rescue (spec §9): recalc capacity → only Ready work → split by mode → delay non-critical → minimum viable day. */
export function useRescueAttention(minutes: number | null, energy: number): RescueOutput | null {
  const { ctx, personal } = useAttention()
  const orch = useStore((s) => s.orchestration)
  return useMemo(() => (ctx && minutes !== null ? rescuePlan({ ctx, personal, state: orch, minutes, energy }) : null), [ctx, personal, orch, minutes, energy])
}

function Line({ label, item, note }: { label: string; item: AttentionItem | null; note?: string }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="w-16 shrink-0 text-xs font-semibold tracking-wider text-soft">{label}</span>
      {item ? (
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug">{item.title}</p>
          <p className="flex items-center gap-1.5 text-xs text-soft"><TypeBadge type={item.type} /> {item.minutes} นาที</p>
        </div>
      ) : (
        <p className="text-sm text-soft">{note ?? '—'}</p>
      )}
    </div>
  )
}

export function RescueAttention({ plan }: { plan: RescueOutput }) {
  return (
    <section className="rounded-3xl bg-white/60 p-4">
      <p className="label mb-1">Minimum Viable Day · J</p>
      <p className="mb-2 text-xs text-soft">
        Capacity ใหม่ {plan.capacity.score} · รองาน Action {plan.split.action} · Review {plan.split.review} · Decision {plan.split.decision}
      </p>
      {plan.mustMicro ? (
        <div className="flex items-start gap-3 py-1.5">
          <span className="w-16 shrink-0 text-xs font-semibold tracking-wider text-soft">MUST</span>
          <div><p className="text-[15px] leading-snug">{plan.mustMicro.title}</p><p className="text-xs text-soft">Micro Step จาก Spark · {plan.mustMicro.minutes} นาที (ไม่ใช่งานใหม่)</p></div>
        </div>
      ) : (
        <Line label="MUST" item={plan.must} note="วันนี้ไม่ต้องทำงานธุรกิจ" />
      )}
      <Line label="SHOULD" item={plan.should} />
      <Line label="COULD" item={plan.could} note="ไม่ต้องก็ได้" />
      <details className="mt-1">
        <summary className="cursor-pointer text-xs text-soft">DROP / DELAY · เลื่อนไปพรุ่งนี้ {plan.delay.length} เรื่อง</summary>
        <ul className="mt-1 space-y-0.5 text-sm">{plan.delay.map((d) => <li key={d.key} className="flex items-center gap-1.5"><TypeBadge type={d.type} /> <span className="truncate">{d.title}</span></li>)}</ul>
      </details>
      <div className="mt-3 flex items-start gap-2 rounded-2xl bg-white/50 p-3">
        <Avatar id="bloom" size={28} />
        <div className="text-sm">
          <p>{plan.recovery.text}</p>
          {plan.recovery.protect.length > 0 && <p className="mt-1 text-xs text-soft">ปกป้องไว้: {plan.recovery.protect.map((p) => p.title).join(' · ')}</p>}
        </div>
      </div>
    </section>
  )
}
