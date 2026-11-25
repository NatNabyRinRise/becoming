import { daysBetween } from '../utils/date'

export interface ComebackState {
  lastActiveDate: string | null
  pending: { since: string; returnDate: string } | null
}

/** Detects a return after inactivity. Does not touch XP or streaks. */
export function detectComeback(lastActiveDate: string | null, today: string, afterDays: number) {
  if (!lastActiveDate) return null
  const gap = daysBetween(lastActiveDate, today)
  if (gap >= afterDays) return { since: lastActiveDate, returnDate: today, gap }
  return null
}

export function comebackEventId(returnDate: string): string {
  return `comeback:${returnDate}`
}
