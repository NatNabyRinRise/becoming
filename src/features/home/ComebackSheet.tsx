import { useNavigate } from 'react-router-dom'
import { Sheet } from '../../components/ui/Sheet'
import { Orb } from '../../components/graphics/Orb'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'

export function ComebackSheet() {
  const comeback = useStore((s) => s.comeback)
  const onboarded = useStore((s) => s.profile.onboardingStatus !== 'pending')
  const resolve = useStore((s) => s.resolveComeback)
  const bonus = useStore((s) => s.settings.rewardRules.comeback)
  const toast = useUI((s) => s.showToast)
  const setOpp = useUI((s) => s.setOpportunity)
  const nav = useNavigate()
  const done = (a: 'review' | 'mission' | 'reset') => {
    resolve(a)
    toast(`Comeback Bonus +${bonus} XP ✨`, 'xp')
    if (a === 'review') nav('/founder')
    if (a === 'mission') setOpp(true)
    if (a === 'reset') nav('/briefing')
  }
  return (
    <Sheet open={!!comeback && onboarded} onClose={() => resolve('review')} title="">
      <div className="flex flex-col items-center text-center">
        <Orb size={150} progress={0.4} />
        <h2 className="mt-2 text-2xl">Welcome back.</h2>
        <p className="mt-1 text-soft">Let's begin with one small step.<br />ยินดีต้อนรับกลับมา เริ่มจากก้าวเล็ก ๆ ก้าวเดียวกัน</p>
        <div className="mt-6 flex w-full flex-col gap-2">
          <button className="btn btn-primary" onClick={() => done('mission')}>เริ่มภารกิจ 5 นาที</button>
          <button className="btn btn-soft" onClick={() => done('review')}>ทบทวนสิ่งสำคัญตอนนี้</button>
          <button className="btn btn-soft" onClick={() => done('reset')}>รีเซ็ตแผนวันนี้</button>
        </div>
        <p className="mt-4 text-xs text-soft">XP และความคืบหน้าทั้งหมดยังอยู่ครบ ไม่มีอะไรถูกรีเซ็ต</p>
      </div>
    </Sheet>
  )
}
