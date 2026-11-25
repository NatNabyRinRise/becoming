import { Link } from 'react-router-dom'
import { Avatar } from '../../components/companions/Avatar'
import { COMPANIONS, COMPANION_ORDER } from '../../data/seed'
import { useFollowUps } from '../../hooks/useToday'
import { useStore } from '../../store/useStore'

/** Optional contextual companion panel on wide desktop screens. */
export function CompanionAside() {
  const follow = useFollowUps()
  const dismiss = useStore((s) => s.dismissFollowUp)
  const snooze = useStore((s) => s.snoozeFollowUp)
  const top = follow[0]
  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col gap-4 p-6 xl:flex" aria-label="ทีมผู้ช่วย">
      <p className="eyebrow">Your team</p>
      <div className="flex -space-x-3">
        {COMPANION_ORDER.map((id) => (
          <Link key={id} to="/team" aria-label={COMPANIONS[id].name}><Avatar id={id} size={44} /></Link>
        ))}
      </div>
      {top ? (
        <div className="glass rounded-[1.5rem] p-4">
          <div className="flex items-center gap-2">
            <Avatar id={top.companionId} size={32} />
            <span className="text-xs text-soft">{COMPANIONS[top.companionId].name} · ติดตามงาน</span>
          </div>
          <p className="mt-2 text-sm font-medium">{top.title}</p>
          <p className="mt-1 text-sm text-soft">{top.message}</p>
          <div className="mt-3 flex gap-2 text-xs">
            <button className="rounded-full bg-white/60 px-3 py-1.5" onClick={() => snooze(top.key, 180)}>เตือนทีหลัง</button>
            <button className="rounded-full px-3 py-1.5 text-soft" onClick={() => dismiss(top.key)}>ไม่ต้องเตือน</button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-soft">ไม่มีเรื่องต้องติดตามตอนนี้ ✨</p>
      )}
    </aside>
  )
}
