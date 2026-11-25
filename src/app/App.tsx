import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { BottomNav, RescueFab, SideNav } from '../components/navigation/Nav'
import { Toast } from '../components/ui/Toast'
import { RescueSheet } from '../features/rescue/RescueSheet'
import { OpportunitySheet } from '../features/opportunity/OpportunitySheet'
import { ComebackSheet } from '../features/home/ComebackSheet'
import { CompanionAside } from '../features/team/CompanionAside'
import { HomePage } from '../features/home/HomePage'
import { BriefingPage } from '../features/morning-briefing/BriefingPage'
import { MyDayPage } from '../features/routine/MyDayPage'
import { FocusPage } from '../features/focus/FocusPage'
import { TeamPage } from '../features/team/TeamPage'
import { FounderPage } from '../features/founder/FounderPage'
import { GrowthPage } from '../features/analytics/GrowthPage'
import { MePage } from '../features/me/MePage'
import { JournalPage } from '../features/journal/JournalPage'
import { RewardsPage } from '../features/rewards/RewardsPage'
import { EveningPage } from '../features/evening-review/EveningPage'
import { WeeklyPage } from '../features/weekly-review/WeeklyPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { OnboardingPage } from '../features/onboarding/OnboardingPage'
import { ExperimentPage } from '../features/experiment/ExperimentPage'
import { MissionsPage } from '../features/missions/MissionsPage'
import { useNotifications } from '../hooks/useNotifications'
import { minutesOfDay } from '../utils/date'

const RESCUE_SCREENS = ['/', '/day', '/founder', '/team']

function Shell() {
  const loc = useLocation()
  const onboarding = useStore((s) => s.profile.onboardingStatus)
  const hydrated = useStore((s) => s.hydrated)
  const touch = useStore((s) => s.touchActive)
  const motion = useStore((s) => s.settings.reducedMotion)
  const tz = useStore((s) => s.settings.timezone)
  useNotifications()

  useEffect(() => {
    if (hydrated) touch()
    const onVis = () => document.visibilityState === 'visible' && touch()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [hydrated, touch])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('reduce-motion', motion === 'on')
    root.classList.toggle('motion-system', motion === 'system')
    const set = () => {
      const m = minutesOfDay(new Date(), tz)
      root.dataset.daypart = m >= 18 * 60 || m < 5 * 60 ? 'evening' : 'day'
    }
    set()
    const t = setInterval(set, 60000)
    return () => clearInterval(t)
  }, [motion, tz])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])

  if (!hydrated) return null
  if (onboarding === 'pending' && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  if (loc.pathname === '/onboarding') return <OnboardingPage />

  const focusScreen = loc.pathname === '/focus'
  return (
    <div className="flex min-h-dvh">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="anim-aurora absolute -left-1/4 -top-1/4 h-[70vh] w-[70vh] rounded-full bg-gold/30 blur-3xl" />
        <div className="anim-aurora absolute -bottom-1/4 -right-1/4 h-[80vh] w-[80vh] rounded-full bg-lavender/30 blur-3xl" style={{ animationDelay: '-9s' }} />
      </div>
      <SideNav />
      <main className="min-w-0 flex-1 px-4 pb-nav pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/day" element={<MyDayPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/growth" element={<GrowthPage />} />
          <Route path="/me" element={<MePage />} />
          <Route path="/briefing" element={<BriefingPage />} />
          <Route path="/focus" element={<FocusPage />} />
          <Route path="/founder" element={<FounderPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/rewards" element={<RewardsPage />} />
          <Route path="/evening" element={<EveningPage />} />
          <Route path="/weekly" element={<WeeklyPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/missions" element={<MissionsPage />} />
          <Route path="/experiment" element={<ExperimentPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!focusScreen && <CompanionAside />}
      {!focusScreen && <BottomNav />}
      {RESCUE_SCREENS.includes(loc.pathname) && loc.pathname !== '/' && <RescueFab />}
      <RescueSheet />
      <OpportunitySheet />
      <ComebackSheet />
      <Toast />
    </div>
  )
}

export function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
