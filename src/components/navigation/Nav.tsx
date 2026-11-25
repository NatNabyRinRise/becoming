import { NavLink } from 'react-router-dom'
import { Home, CalendarDays, Users, Sprout, UserRound, LifeBuoy, Sparkles, Briefcase, BookOpen, Gift, Moon, Settings } from 'lucide-react'
import { useUI } from '../../store/useUI'

export const PRIMARY = [
  { to: '/', label: 'Home', th: 'หน้าหลัก', icon: Home },
  { to: '/day', label: 'My Day', th: 'วันของฉัน', icon: CalendarDays },
  { to: '/team', label: 'My Team', th: 'ทีมของฉัน', icon: Users },
  { to: '/growth', label: 'Growth', th: 'การเติบโต', icon: Sprout },
  { to: '/me', label: 'Me', th: 'ฉัน', icon: UserRound },
]

const SECONDARY = [
  { to: '/founder', label: 'Founder Mode', icon: Briefcase },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/rewards', label: 'Reward Universe', icon: Gift },
  { to: '/evening', label: 'Evening Debrief', icon: Moon },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function BottomNav() {
  return (
    <nav aria-label="เมนูหลัก" className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:hidden">
      <ul className="glass-strong flex w-full max-w-md items-center justify-between rounded-full px-2 py-1.5">
        {PRIMARY.map(({ to, label, th, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-full text-[10.5px] transition ${isActive ? 'bg-white/70 text-ink shadow-sm' : 'text-soft'}`
              }
              aria-label={th}
            >
              <Icon size={20} strokeWidth={1.6} aria-hidden />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function SideNav() {
  const setRescue = useUI((s) => s.setRescue)
  const setOpp = useUI((s) => s.setOpportunity)
  const item = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition ${isActive ? 'bg-white/70 text-ink shadow-sm' : 'text-soft hover:bg-white/30'}`
  return (
    <nav aria-label="เมนูหลัก" className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 p-5 lg:flex">
      <p className="eyebrow mb-6 px-4 pt-2">B E C O M I N G</p>
      {PRIMARY.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} className={item}>
          <Icon size={18} strokeWidth={1.6} aria-hidden /> {label}
        </NavLink>
      ))}
      <div className="my-4 h-px bg-white/50" />
      {SECONDARY.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={item}>
          <Icon size={18} strokeWidth={1.6} aria-hidden /> {label}
        </NavLink>
      ))}
      <div className="mt-auto flex flex-col gap-2">
        <button className="btn btn-soft justify-start" onClick={() => setOpp(true)}>
          <Sparkles size={18} /> I Have a Moment
        </button>
        <button className="btn btn-soft justify-start" onClick={() => setRescue(true)}>
          <LifeBuoy size={18} /> Rescue Mode
        </button>
      </div>
    </nav>
  )
}

/** Floating Rescue button available on working screens (mobile). */
export function RescueFab() {
  const setRescue = useUI((s) => s.setRescue)
  return (
    <button
      onClick={() => setRescue(true)}
      className="glass-strong fixed bottom-[calc(env(safe-area-inset-bottom)+6rem)] right-4 z-30 flex h-12 items-center gap-2 rounded-full px-4 text-sm lg:hidden"
      aria-label="Rescue Mode — ปรับแผน"
    >
      <LifeBuoy size={18} /> Rescue
    </button>
  )
}
