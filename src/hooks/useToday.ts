import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { localDate, minutesOfDay, inQuietHours } from '../utils/date'
import { useNow } from './useNow'
import { blocksForDate } from '../engine/scheduling/day'
import { computeFollowUps } from '../engine/follow-up'

/** Common derived values for "today". Kept out of the store (derived analytics). */
export function useToday() {
  const now = useNow(30000)
  const tz = useStore((s) => s.settings.timezone)
  const date = localDate(now, tz)
  const nowMin = minutesOfDay(now, tz)
  const checkIn = useStore((s) => s.checkIns[date])
  const tasks = useStore((s) => s.tasks)
  const oneThing = useMemo(() => tasks.find((t) => t.id === checkIn?.oneThingId) ?? null, [tasks, checkIn])
  const routines = useStore((s) => s.routines)
  const dayLog = useStore((s) => s.dayLogs[date])
  const items = useMemo(() => blocksForDate(routines, date, dayLog), [routines, date, dayLog])
  return { now, date, nowMin, checkIn, oneThing, items, tz }
}

export function useFollowUps() {
  const { date, nowMin, checkIn, now } = useToday()
  const s = useStore()
  const quiet = inQuietHours(nowMin, s.settings.quietHours.start, s.settings.quietHours.end)
  return useMemo(
    () =>
      computeFollowUps({
        today: date,
        nowIso: now.toISOString(),
        tasks: s.tasks,
        projects: s.projects,
        routines: s.routines,
        dayLogs: s.dayLogs,
        content: s.content,
        energy: checkIn?.energy ?? null,
        recoveryThreshold: s.settings.energyThresholds.recovery,
        state: s.followUp,
        quiet,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, Math.floor(now.getTime() / 60000), s.tasks, s.projects, s.routines, s.dayLogs, s.content, checkIn, s.followUp, quiet],
  )
}
