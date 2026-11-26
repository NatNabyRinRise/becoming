import { useNow } from './useNow'
import { elapsedSeconds } from '../engine/focus'
import type { FocusSession } from '../types'

/** Seconds left in a focus session; negative = over the planned time. Timestamp-based, so it keeps going while the app is closed. */
export function secondsLeft(f: FocusSession, nowMs: number) {
  return f.plannedMinutes * 60 - elapsedSeconds(f, nowMs)
}

/** Remaining minutes for messages ("อีกแค่ X นาที"), live while focusing. */
export function useLiveMinutesLeft(focus: FocusSession | null): number | null {
  const now = useNow(focus ? 1000 : 60_000)
  if (!focus) return null
  return Math.ceil(secondsLeft(focus, now.getTime()) / 60)
}
