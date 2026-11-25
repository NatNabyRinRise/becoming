import type { FocusSession } from '../types'

/** Elapsed seconds computed from timestamps — survives refreshes and tab sleep. */
export function elapsedSeconds(s: FocusSession, nowMs: number = Date.now()): number {
  if (s.status === 'running') {
    return s.elapsedSeconds + Math.max(0, Math.floor((nowMs - Date.parse(s.startedAt)) / 1000))
  }
  return s.elapsedSeconds
}

export function pauseSession(s: FocusSession, nowMs: number = Date.now()): FocusSession {
  if (s.status !== 'running') return s
  return { ...s, status: 'paused', elapsedSeconds: elapsedSeconds(s, nowMs), pausedAt: new Date(nowMs).toISOString() }
}

export function resumeSession(s: FocusSession, nowMs: number = Date.now()): FocusSession {
  if (s.status !== 'paused') return s
  return { ...s, status: 'running', startedAt: new Date(nowMs).toISOString(), pausedAt: null }
}

export function isOvertime(s: FocusSession, nowMs: number = Date.now()): boolean {
  if (s.status === 'completed' || s.status === 'stopped') return false
  return needsPrompt(s, elapsedSeconds(s, nowMs))
}

function needsPrompt(s: FocusSession, e: number): boolean {
  // prompt at planned end, then every 10 minutes after the user chose "continue"
  if (s.overtimeAcknowledgedAt === 0) return e >= s.plannedMinutes * 60
  return e >= s.overtimeAcknowledgedAt + 600
}

export function fmtClock(sec: number): string {
  const neg = sec < 0
  const a = Math.abs(sec)
  const m = Math.floor(a / 60)
  const s = a % 60
  return `${neg ? '+' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
