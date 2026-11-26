import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, RefreshCw, Eye } from 'lucide-react'
import { Avatar } from '../../components/companions/Avatar'
import { useStore } from '../../store/useStore'
import { useAttention } from '../../orchestration/useOrchestration'
import { buildQueue, pickForWindow } from '../../orchestration/roles/j'
import { TypeBadge, useAttentionUI } from './AttentionUI'

/**
 * Free-time logic (spec §7): time → energy → life constraint → Ready for BECOMING → fitting item.
 * Never invents business work to fill a gap.
 */
export function MomentPick({ minutes, energy, onDone }: { minutes: number; energy: number; onDone: () => void }) {
  const { ctx, personal } = useAttention()
  const orch = useStore((s) => s.orchestration)
  const startFocus = useStore((s) => s.startFocus)
  const openItem = useAttentionUI((u) => u.open)
  const nav = useNavigate()
  const [skip, setSkip] = useState<string[]>([])
  const pick = useMemo(() => {
    if (!ctx) return null
    const q = buildQueue({ ctx, personal: { ...personal, energy, availableMinutes: minutes }, state: orch })
    return pickForWindow(q, minutes, skip)
  }, [ctx, personal, energy, minutes, orch, skip])
  if (!pick) return null
  const it = pick.item
  return (
    <div className="space-y-3 rounded-3xl bg-white/60 p-4">
      <div className="flex items-center gap-2"><Avatar id="j" size={36} /><span className="text-sm text-soft">J เลือกจากสิ่งที่พร้อมให้เธอ</span></div>
      {it && (
        <>
          <p className="flex items-center gap-2"><TypeBadge type={it.type} /> <span className="text-xs text-soft">{it.minutes} นาที</span></p>
          <p className="text-lg leading-snug">{it.title}</p>
          <p className="text-sm">{pick.reason}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button className="btn btn-primary" onClick={() => { onDone(); openItem(it.key) }}><Eye size={16} /> เปิดดู</button>
            <button className="btn btn-soft" onClick={() => setSkip((x) => [...x, it.key])}><RefreshCw size={16} /> อันอื่น</button>
          </div>
        </>
      )}
      {pick.microStep && (
        <>
          <p className="text-lg leading-snug">{pick.microStep.title}</p>
          <p className="text-sm text-soft">Micro Step · {pick.reason}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button className="btn btn-primary" onClick={() => { startFocus(null, pick.microStep!.title, pick.microStep!.minutes); onDone(); nav('/focus') }}><Play size={16} /> เริ่ม {pick.microStep.minutes} นาที</button>
            <button className="btn btn-soft" onClick={() => setSkip((x) => [...x, pick.microStep!.basedOn.key])}><RefreshCw size={16} /> อันอื่น</button>
          </div>
        </>
      )}
      {!it && !pick.microStep && <p className="text-sm">{pick.reason}</p>}
      <details className="text-xs text-soft">
        <summary className="cursor-pointer">J ตรวจอะไรบ้าง</summary>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4">{pick.trace.map((t, i) => <li key={i}>{t}</li>)}</ol>
      </details>
    </div>
  )
}
