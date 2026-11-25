import { Link } from 'react-router-dom'
import { Briefcase, BookOpen, Gift, Moon, Settings, CalendarCheck, Target, FlaskConical, Timer, ChevronRight } from 'lucide-react'
import { PageHeader } from '../../components/ui/controls'
import { Orb } from '../../components/graphics/Orb'
import { useStore } from '../../store/useStore'
import { level, orbStage, totals } from '../../engine/rewards'

const LINKS = [
  { to: '/founder', label: 'Founder Mode', th: 'ธุรกิจ แบรนด์ พาร์ทเนอร์ รายได้', icon: Briefcase },
  { to: '/missions', label: 'Annual Missions', th: 'ภารกิจและเป้าหมายประจำปี', icon: Target },
  { to: '/journal', label: 'Journal', th: 'บันทึกและไอเดีย', icon: BookOpen },
  { to: '/rewards', label: 'Reward Universe', th: 'XP ของขวัญ และ Sanctuary', icon: Gift },
  { to: '/focus', label: 'Focus Mode', th: 'จับเวลาโฟกัส', icon: Timer },
  { to: '/evening', label: 'Evening Debrief', th: 'ปิดวันใน 1 นาที', icon: Moon },
  { to: '/weekly', label: 'Weekly Review', th: 'ประชุมทีมประจำสัปดาห์', icon: CalendarCheck },
  { to: '/experiment', label: '7-Day Experiment', th: 'ทดลองใช้จริง 7 วัน', icon: FlaskConical },
  { to: '/settings', label: 'Settings', th: 'ตั้งค่า สำรองข้อมูล', icon: Settings },
]

export function MePage() {
  const s = useStore()
  const { xp } = totals(s.transactions)
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Me" title={s.profile.name || 'ตัวฉัน'} />
      <div className="glass mb-4 flex items-center gap-4 rounded-[1.75rem] p-4">
        <Orb size={84} stage={orbStage(xp)} rings={false} breathe={false} />
        <div>
          <p className="text-sm text-soft">CEO ของชีวิตตัวเอง</p>
          <p className="text-lg">Level {level(xp).level} · {xp} XP</p>
          <p className="text-xs text-soft">You don't have to do everything. Just become who you want to be.</p>
        </div>
      </div>
      <ul className="space-y-2">
        {LINKS.map(({ to, label, th, icon: Icon }) => (
          <li key={to}>
            <Link to={to} className="glass flex items-center gap-3 rounded-[1.5rem] p-4">
              <Icon size={20} strokeWidth={1.6} />
              <span className="flex-1">
                <span className="block">{label}</span>
                <span className="block text-xs text-soft">{th}</span>
              </span>
              <ChevronRight size={16} className="text-soft" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
