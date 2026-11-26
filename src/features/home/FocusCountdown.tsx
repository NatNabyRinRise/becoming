import { useNow } from '../../hooks/useNow'
import { fmtClock } from '../../engine/focus'
import { secondsLeft } from '../../hooks/useFocusClock'
import type { FocusSession } from '../../types'

/** Live mm:ss countdown. Past zero it counts up as +mm:ss and only ends when the session is completed. */
export function FocusCountdown({ focus, className = '' }: { focus: FocusSession; className?: string }) {
  const now = useNow(1000)
  const left = secondsLeft(focus, now.getTime())
  const paused = focus.status === 'paused'
  const over = left < 0
  return (
    <span
      className={`big-num tabular-nums ${over ? 'text-[#a0465a]' : ''} ${paused ? 'opacity-60' : ''} ${className}`}
      aria-label={`${over ? 'เกินเวลา' : 'เหลือเวลา'} ${fmtClock(left)}${paused ? ' (พักอยู่)' : ''}`}
      role="timer"
    >
      {fmtClock(left)}
      {paused && <span className="ml-1 text-xs">พัก</span>}
    </span>
  )
}
