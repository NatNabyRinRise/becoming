import { Link, useNavigate } from 'react-router-dom'
import { Sun, Play, Sparkles, LifeBuoy, ChevronRight, Moon } from 'lucide-react'
import { Orb } from '../../components/graphics/Orb'
import { ProgressRing } from '../../components/graphics/ProgressRing'
import { Avatar } from '../../components/companions/Avatar'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { useFollowUps, useToday } from '../../hooks/useToday'
import { homeMessage } from '../../engine/companions'
import { orbStage, totals } from '../../engine/rewards'
import { COMPANIONS } from '../../data/seed'
import { CoreNudge } from '../core/CoreNudge'
import { daysBetween, greeting, hhmmToMin, thaiShortDate } from '../../utils/date'

export function HomePage() {
  const s = useStore()
  const { date, nowMin, checkIn, oneThing, items } = useToday()
  const followUps = useFollowUps()
  const setRescue = useUI((u) => u.setRescue)
  const setOpp = useUI((u) => u.setOpportunity)
  const nav = useNavigate()
  const { xp } = totals(s.transactions)
  const journeyDay = Math.max(1, daysBetween(s.profile.startedAt, date) + 1)

  const counted = items.filter((i) => i.entry.status !== 'rescheduled')
  const doneBlocks = counted.filter((i) => i.entry.status === 'done').length
  const oneDone = oneThing?.status === 'done' ? 1 : 0
  const progress = counted.length + 1 > 0 ? (doneBlocks + oneDone * 3) / (counted.length + 3) : 0
  const upcoming = items.find((i) => i.entry.status === 'pending' && i.start !== null && i.start >= nowMin && i.block.flexibility === 'fixed') ?? null
  const gift = s.gifts[date]
  const msg = homeMessage({
    nowMin,
    checkIn,
    oneThing,
    upcoming,
    followUp: followUps[0] ?? null,
    recoveryThreshold: s.settings.energyThresholds.recovery,
    sleepMin: hhmmToMin(s.profile.preferences.sleepTime),
    giftReady: !!gift?.unlocked && !gift.revealedRewardId,
  })
  const unfinished = s.tasks.filter((t) => t.status === 'in_progress' && t.id !== oneThing?.id)
  const evening = nowMin >= 18 * 60

  const onMsgAction = () => {
    if (!msg.action) return
    if (msg.action.to === '#rescue') setRescue(true)
    else nav(msg.action.to)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="eyebrow">{thaiShortDate(date)}</p>
          <h1 className="text-2xl">
            {greeting(nowMin)}{s.profile.name ? `, ${s.profile.name}` : ''}
          </h1>
        </div>
        <Link to="/rewards" className="glass rounded-full px-3 py-1.5 text-xs" aria-label={`${xp} XP ดู Reward Universe`}>
          ✦ {xp} XP
        </Link>
      </header>

      {/* Becoming Orb */}
      <section className="relative flex flex-col items-center py-4" aria-label="Becoming Orb">
        <Orb size={260} progress={progress} stage={orbStage(xp)} energy={checkIn?.energy ?? 60} className="max-w-[72vw]" />
        <p className="eyebrow -mt-2">Your personal universe</p>
        <dl className="mt-5 grid w-full grid-cols-4 gap-2 text-center">
          <Stat label="Journey" value={`${journeyDay}`} sub="วัน" />
          <Stat label="Energy" value={checkIn ? `${checkIn.energy}` : '–'} sub={checkIn ? '%' : 'ยังไม่เช็ก'} />
          <div className="flex flex-col items-center">
            <ProgressRing value={progress} size={52} label={`ความคืบหน้าวันนี้ ${Math.round(progress * 100)}%`}>
              <span className="text-sm">{Math.round(progress * 100)}</span>
            </ProgressRing>
            <dt className="mt-1 text-[11px] text-soft">Today</dt>
          </div>
          <Stat label="One Thing" value={oneThing ? (oneThing.status === 'done' ? '✓' : oneThing.status === 'in_progress' ? '◐' : '○') : '–'} sub={oneThing ? (oneThing.status === 'done' ? 'สำเร็จ' : 'รอทำ') : 'ยังไม่เลือก'} />
        </dl>
      </section>

      {/* Companion message (one, most relevant) */}
      <section className="glass mt-2 flex items-center gap-3 rounded-[1.75rem] p-4" aria-live="polite">
        <Avatar id={msg.companionId} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-soft">{COMPANIONS[msg.companionId].name} · {COMPANIONS[msg.companionId].roleTh}</p>
          <p className="text-[15px] leading-snug">{msg.text}</p>
        </div>
        {msg.action && (
          <button className="btn btn-soft shrink-0 !px-3 !py-2 text-xs" onClick={onMsgAction}>
            {msg.action.label}
          </button>
        )}
      </section>

      <CoreNudge />

      {/* One Thing card */}
      {oneThing && (
        <section className="glass mt-3 rounded-[1.75rem] p-4">
          <p className="label">Today's One Thing</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className={`text-lg ${oneThing.status === 'done' ? 'line-through opacity-60' : ''}`}>{oneThing.title}</p>
            {oneThing.status !== 'done' && (
              <button
                className="btn btn-primary shrink-0 !px-4"
                onClick={() => {
                  s.startFocus(oneThing.id, oneThing.title, Math.max(5, oneThing.estimatedMinutes - oneThing.actualMinutes))
                  nav('/focus')
                }}
                aria-label="เริ่มโฟกัส One Thing"
              >
                <Play size={16} />
              </button>
            )}
          </div>
        </section>
      )}

      {/* Quick actions */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="ทางลัด">
        <Quick icon={evening ? Moon : Sun} label={evening ? 'Evening Debrief' : 'Morning Briefing'} onClick={() => nav(evening ? '/evening' : '/briefing')} />
        <Quick
          icon={Play}
          label="Continue One Thing"
          disabled={!oneThing || oneThing.status === 'done'}
          onClick={() => {
            if (!oneThing) return
            if (s.focus?.taskId === oneThing.id) return nav('/focus')
            s.startFocus(oneThing.id, oneThing.title, Math.max(5, oneThing.estimatedMinutes - oneThing.actualMinutes))
            nav('/focus')
          }}
        />
        <Quick icon={Sparkles} label="I Have a Moment" onClick={() => setOpp(true)} />
        <Quick icon={LifeBuoy} label="Rescue Mode" onClick={() => setRescue(true)} />
      </section>

      {s.focus && (
        <Link to="/focus" className="glass mt-3 flex items-center justify-between rounded-full px-5 py-3 text-sm">
          <span>⏱ กำลังโฟกัส: {s.focus.title}</span>
          <ChevronRight size={16} />
        </Link>
      )}

      {unfinished.length > 0 && (
        <details className="glass mt-3 rounded-[1.75rem] p-4">
          <summary className="cursor-pointer text-sm">งานที่ทำค้างไว้ ({unfinished.length})</summary>
          <ul className="mt-3 space-y-2">
            {unfinished.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{t.title}</span>
                <button className="btn btn-ghost !min-h-0 !px-3 !py-1.5 text-xs" onClick={() => { s.startFocus(t.id, t.title, Math.max(5, t.estimatedMinutes - t.actualMinutes)); nav('/focus') }}>ทำต่อ</button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-8 text-center text-xs text-soft">Less reading. Less deciding. More becoming.</p>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <dd className="big-num text-[28px]">{value}</dd>
      <dt className="mt-1 text-[11px] text-soft">{label}<br />{sub}</dt>
    </div>
  )
}

function Quick({ icon: Icon, label, onClick, disabled }: { icon: typeof Sun; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="glass flex min-h-[84px] flex-col items-start justify-between rounded-[1.5rem] p-4 text-left text-sm transition hover:bg-white/40 disabled:opacity-40" onClick={onClick} disabled={disabled}>
      <Icon size={20} strokeWidth={1.6} aria-hidden />
      <span>{label}</span>
    </button>
  )
}
