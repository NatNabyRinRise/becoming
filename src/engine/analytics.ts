import type { DailyCheckIn, FocusSession, MissionId, RescueSession, RevenueEntry, RoutineCategory, RoutineDayEntry, RoutineBlock, Task, AnnualMission } from '../types'
import { addDays } from '../utils/date'

export interface WeekStats {
  from: string
  to: string
  tasksDone: Task[]
  oneThingsDone: number
  focusMinutes: number
  focusByDay: { date: string; minutes: number }[]
  energy: { date: string; energy: number | null }[]
  avgEnergy: number | null
  energyTrend: 'up' | 'down' | 'flat' | 'unknown'
  postponed: Task[]
  rescueCount: number
  routineByCategory: { category: RoutineCategory; done: number; planned: number }[]
  missionActivity: Record<MissionId, number>
}

export function weekStats(args: {
  today: string
  tasks: Task[]
  checkIns: Record<string, DailyCheckIn>
  focusLog: FocusSession[]
  rescues: RescueSession[]
  routines: RoutineBlock[]
  dayLogs: Record<string, Record<string, RoutineDayEntry>>
}): WeekStats {
  const days = Array.from({ length: 7 }, (_, i) => addDays(args.today, i - 6))
  const from = days[0]
  const to = days[6]
  const inRange = (iso: string | null) => !!iso && iso.slice(0, 10) >= from && iso.slice(0, 10) <= to
  const tasksDone = args.tasks.filter((t) => t.status === 'done' && inRange(t.completedAt))
  const oneThingIds = new Set(days.map((d) => args.checkIns[d]?.oneThingId).filter(Boolean))
  const oneThingsDone = tasksDone.filter((t) => oneThingIds.has(t.id)).length

  const focusByDay = days.map((d) => ({
    date: d,
    minutes: Math.round(args.focusLog.filter((f) => f.startedAt.slice(0, 10) === d).reduce((s, f) => s + f.elapsedSeconds, 0) / 60),
  }))
  const focusMinutes = focusByDay.reduce((s, x) => s + x.minutes, 0)
  const energy = days.map((d) => ({ date: d, energy: args.checkIns[d]?.energy ?? null }))
  const vals = energy.map((e) => e.energy).filter((e): e is number => e !== null)
  const avgEnergy = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  let energyTrend: WeekStats['energyTrend'] = 'unknown'
  if (vals.length >= 3) {
    const half = Math.floor(vals.length / 2)
    const a = vals.slice(0, half).reduce((x, y) => x + y, 0) / half
    const b = vals.slice(-half).reduce((x, y) => x + y, 0) / half
    energyTrend = b - a > 5 ? 'up' : a - b > 5 ? 'down' : 'flat'
  }
  const postponed = args.tasks.filter((t) => t.postponementCount >= 2 && t.status !== 'done')
  const rescueCount = args.rescues.filter((r) => r.confirmedAt && r.localDate >= from && r.localDate <= to).length

  const cats = new Map<RoutineCategory, { done: number; planned: number }>()
  for (const d of days) {
    const log = args.dayLogs[d] ?? {}
    for (const b of args.routines) {
      if (b.recurrence !== 'daily') continue
      const c = cats.get(b.category) ?? { done: 0, planned: 0 }
      c.planned++
      if (log[b.id]?.status === 'done') c.done++
      cats.set(b.category, c)
    }
  }
  const missionActivity = { influence: 0, people: 0, empire: 0, freedom: 0, life: 0 } as Record<MissionId, number>
  for (const t of tasksDone) missionActivity[t.missionId]++

  return {
    from,
    to,
    tasksDone,
    oneThingsDone,
    focusMinutes,
    focusByDay,
    energy,
    avgEnergy,
    energyTrend,
    postponed,
    rescueCount,
    routineByCategory: [...cats.entries()].map(([category, v]) => ({ category, ...v })),
    missionActivity,
  }
}

export function missionProgress(m: AnnualMission): number {
  if (!m.targets.length) return 0
  const r = m.targets.reduce((s, t) => s + Math.min(1, t.target > 0 ? t.current / t.target : 0), 0) / m.targets.length
  return Math.round(r * 100)
}

export function revenueBySource(entries: RevenueEntry[]): { source: string; amount: number; recurring: number }[] {
  const m = new Map<string, { amount: number; recurring: number }>()
  for (const e of entries) {
    const v = m.get(e.source) ?? { amount: 0, recurring: 0 }
    v.amount += e.amount
    if (e.recurring) v.recurring += e.amount
    m.set(e.source, v)
  }
  return [...m.entries()].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.amount - a.amount)
}

export function revenueByMonth(entries: RevenueEntry[]): { month: string; amount: number }[] {
  const m = new Map<string, number>()
  for (const e of entries) m.set(e.localDate.slice(0, 7), (m.get(e.localDate.slice(0, 7)) ?? 0) + e.amount)
  return [...m.entries()].sort().map(([month, amount]) => ({ month, amount }))
}
