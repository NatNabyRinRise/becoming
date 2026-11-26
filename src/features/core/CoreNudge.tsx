import { Link } from 'react-router-dom'
import { Brain, ChevronRight } from 'lucide-react'
import { useCore } from '../../intelligence/useCore'
import { dueForEvaluation } from '../../intelligence/learning'

/** Small Home card: the core has something waiting for the user's decision. */
export function CoreNudge() {
  const recs = useCore((c) => c.recommendations)
  const mems = useCore((c) => c.memories)
  const now = useCore((c) => c.now)()
  const proposed = recs.filter((r) => !r.deletedAt && r.status === 'proposed').length
  const due = dueForEvaluation(recs, now).length
  const memories = mems.filter((m) => !m.deletedAt && m.status === 'proposed').length
  const n = proposed + due + memories
  if (!n) return null
  const text = [proposed && `คำแนะนำใหม่ ${proposed}`, due && `รอประเมินผล ${due}`, memories && `ความจำรออนุมัติ ${memories}`].filter(Boolean).join(' · ')
  return (
    <Link to="/core" className="glass mt-3 flex items-center gap-3 rounded-[1.75rem] p-4">
      <Brain size={20} strokeWidth={1.6} />
      <span className="flex-1 text-sm"><span className="block">ทีมมีเรื่องรอเธอตัดสินใจ</span><span className="block text-xs text-soft">{text}</span></span>
      <ChevronRight size={16} className="text-soft" />
    </Link>
  )
}
