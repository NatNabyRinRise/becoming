import type {
  EnergyThresholds,
  MissionId,
  PlanChange,
  PlanSnapshot,
  RescuePlan,
  RescueReason,
  RoutineBlock,
  RoutineDayEntry,
  Task,
} from '../../types'
import { addDays, minToHhmm } from '../../utils/date'
import { recommend } from '../recommendations'
import { blocksForDate, findConflicts, isProtected } from './day'

export const RESCUE_REASONS: { id: RescueReason; label: string; emoji: string }[] = [
  { id: 'baby', label: 'ต้องดูแลลูก', emoji: '👶' },
  { id: 'urgent_work', label: 'มีงานด่วน', emoji: '⚡' },
  { id: 'fatigue', label: 'เหนื่อยกะทันหัน', emoji: '🫠' },
  { id: 'lost_focus', label: 'หลุดโฟกัส', emoji: '🌀' },
  { id: 'no_time', label: 'เวลาไม่พอ', emoji: '⏳' },
  { id: 'other', label: 'เหตุผลอื่น', emoji: '💭' },
]

/** Ladder of smaller meaningful deliverables (spec §20 examples). */
export const RESCUE_LADDER: Record<number, string> = {
  0: 'ย้ายงานธุรกิจที่ไม่ด่วนไปคิวทบทวน แล้วพักได้เลย',
  5: 'เลือก AI Agent 1 ตัวที่จะเปิดใช้งาน',
  15: 'เขียนภารกิจจริงให้ AI Agent 1 ตัว',
  30: 'สร้าง Prompt ของ Agent และกำหนดการทดสอบ',
  60: 'ทดลอง Agent 1 ครั้งที่มีความหมาย และบันทึกผล',
  120: 'ทำ Founder milestone ให้เสร็จ 1 ชิ้น',
}

export interface RescueInput {
  date: string
  nowMin: number
  routines: RoutineBlock[]
  dayLog: Record<string, RoutineDayEntry>
  tasks: Task[]
  reason: RescueReason
  remainingMinutes: number
  energy: number
  thresholds: EnergyThresholds
  currentOneThingId: string | null
  missionPriorities?: MissionId[]
  primaryProjectId?: string | null
}

export function snapshotPlan(
  routines: RoutineBlock[],
  dayLog: Record<string, RoutineDayEntry>,
  tasks: Task[],
  oneThingId: string | null,
): PlanSnapshot {
  return {
    dayLog: structuredClone(dayLog),
    routines: structuredClone(routines),
    tasks: tasks.map((t) => ({ id: t.id, status: t.status, scheduledDate: t.scheduledDate, postponementCount: t.postponementCount })),
    oneThingId,
  }
}

/** Pure: builds a proposal. Nothing is changed until the user confirms. */
export function buildRescuePlan(input: RescueInput): RescuePlan {
  const { date, nowMin, remainingMinutes, energy, thresholds } = input
  const items = blocksForDate(input.routines, date, input.dayLog)
  const tomorrow = addDays(date, 1)
  const protectedList: RescuePlan['protected'] = []
  const rescheduled: PlanChange[] = []
  const lowEnergy = energy < thresholds.recovery

  for (const it of items) {
    const b = it.block
    if (it.entry.status === 'done') {
      protectedList.push({ id: b.id, title: b.title, reason: 'ทำเสร็จแล้ว เก็บความคืบหน้าไว้' })
      continue
    }
    if (it.entry.status !== 'pending') continue
    const past = it.end !== null && it.end <= nowMin
    if (past) continue
    if (isProtected(b)) {
      protectedList.push({ id: b.id, title: b.title, reason: b.category === 'childcare' ? 'ดูแลลูกมาก่อนเสมอ' : b.category === 'sleep' ? 'ปกป้องการนอน' : b.flexibility === 'fixed' ? 'นัดหมายที่ย้ายไม่ได้' : 'จำเป็นต่อการพักฟื้น' })
      continue
    }
    const optionalWork = b.category === 'work' || b.category === 'business'
    const dropExercise = b.category === 'exercise' && (remainingMinutes < 30 || lowEnergy)
    if (optionalWork || dropExercise) {
      rescheduled.push({ type: 'routine', id: b.id, title: b.title, from: it.start !== null ? `วันนี้ ${minToHhmm(it.start)}` : 'วันนี้', to: 'พรุ่งนี้' })
    } else {
      protectedList.push({ id: b.id, title: b.title, reason: 'เวลาเติมพลังของเธอ' })
    }
  }

  // Revised One Thing
  const current = input.tasks.find((t) => t.id === input.currentOneThingId) ?? null
  let oneThingId: string | null = null
  let oneThingTitle = ''
  let oneThingMinutes = 0
  let suggestion = false
  let note = ''

  if (remainingMinutes <= 0) {
    oneThingTitle = 'ไม่มีงานเพิ่มวันนี้'
    note = RESCUE_LADDER[0]
  } else {
    const rec = recommend({
      tasks: input.tasks,
      availableMinutes: remainingMinutes,
      energy,
      thresholds,
      circumstances: input.reason === 'fatigue' ? 'low_energy' : input.reason === 'baby' ? 'baby' : 'unexpected',
      missionPriorities: input.missionPriorities,
      primaryProjectId: input.primaryProjectId,
      preferMission: current?.missionId ?? 'empire',
    })
    if (rec.kind === 'task') {
      oneThingId = rec.task.id
      oneThingTitle = rec.task.title
      oneThingMinutes = rec.minutes
      note = rec.reason
    } else if (rec.kind === 'smaller') {
      oneThingTitle = rec.title
      oneThingMinutes = rec.minutes
      suggestion = true
      note = rec.reason
    } else {
      oneThingTitle = rec.title
      oneThingMinutes = rec.minutes
      suggestion = true
      note = rec.reason
    }
  }

  // Optional tasks scheduled for today that are not the new One Thing get rescheduled.
  for (const t of input.tasks) {
    if (t.status === 'done' || t.status === 'archived') continue
    const isToday = t.scheduledDate === date || t.id === input.currentOneThingId
    if (!isToday || t.id === oneThingId) continue
    if (t.kind === 'health' || t.kind === 'family' || t.kind === 'recovery') continue
    rescheduled.push({
      type: 'task',
      id: t.id,
      title: t.title,
      from: 'วันนี้',
      to: remainingMinutes <= 0 ? 'คิวทบทวน' : 'พรุ่งนี้',
    })
  }

  // ensure no duplicate changes
  const seen = new Set<string>()
  const uniq = rescheduled.filter((c) => (seen.has(c.type + c.id) ? false : (seen.add(c.type + c.id), true)))

  // conflict guard: one-off blocks moved to tomorrow must not overlap
  const tomorrowItems = blocksForDate(input.routines, tomorrow, {})
  for (const c of uniq) {
    if (c.type !== 'routine') continue
    const b = input.routines.find((x) => x.id === c.id)
    if (b && b.recurrence === 'none' && b.startTime) {
      const st = Number(b.startTime.slice(0, 2)) * 60 + Number(b.startTime.slice(3))
      if (findConflicts(tomorrowItems, st, b.duration, b.id).length) c.to = 'พรุ่งนี้ (เวลายืดหยุ่น)'
    }
  }

  return { oneThingId, oneThingTitle, oneThingMinutes, suggestion, protected: protectedList, rescheduled: uniq, note }
}

export interface AppliedPlan {
  routines: RoutineBlock[]
  dayLog: Record<string, RoutineDayEntry>
  tasks: Task[]
  oneThingId: string | null
}

/** Applies a confirmed plan. Never touches completed work or recorded minutes. */
export function applyRescuePlan(
  plan: RescuePlan,
  date: string,
  routines: RoutineBlock[],
  dayLog: Record<string, RoutineDayEntry>,
  tasks: Task[],
  nowIso: string,
): AppliedPlan {
  const tomorrow = addDays(date, 1)
  const newLog = { ...dayLog }
  let newRoutines = routines
  let newTasks = tasks
  for (const c of plan.rescheduled) {
    if (c.type === 'routine') {
      const b = routines.find((x) => x.id === c.id)
      if (!b) continue
      if (b.recurrence === 'none') {
        const flexible = c.to.includes('ยืดหยุ่น')
        newRoutines = newRoutines.map((x) => (x.id === b.id ? { ...x, date: tomorrow, startTime: flexible ? null : x.startTime } : x))
      } else {
        newLog[b.id] = { ...(newLog[b.id] ?? {}), status: 'rescheduled', movedTo: tomorrow }
      }
    } else {
      newTasks = newTasks.map((t) =>
        t.id === c.id && t.status !== 'done'
          ? {
              ...t,
              status: c.to === 'คิวทบทวน' ? 'deferred' : t.status === 'in_progress' ? 'in_progress' : 'todo',
              scheduledDate: c.to === 'คิวทบทวน' ? null : tomorrow,
              postponementCount: t.postponementCount + 1,
              updatedAt: nowIso,
            }
          : t,
      )
    }
  }
  if (plan.oneThingId) {
    newTasks = newTasks.map((t) => (t.id === plan.oneThingId ? { ...t, scheduledDate: date, updatedAt: nowIso } : t))
  }
  return {
    routines: newRoutines,
    dayLog: newLog,
    tasks: newTasks,
    oneThingId: plan.oneThingId,
  }
}

/** Restore a snapshot while preserving anything completed after it was taken. */
export function undoRescue(
  snap: PlanSnapshot,
  routines: RoutineBlock[],
  dayLog: Record<string, RoutineDayEntry>,
  tasks: Task[],
): AppliedPlan {
  const restoredLog = { ...snap.dayLog }
  for (const [id, e] of Object.entries(dayLog)) if (e.status === 'done') restoredLog[id] = e
  const snapTasks = new Map(snap.tasks.map((t) => [t.id, t]))
  const restoredTasks = tasks.map((t) => {
    const s = snapTasks.get(t.id)
    if (!s || t.status === 'done') return t
    return { ...t, status: s.status, scheduledDate: s.scheduledDate, postponementCount: s.postponementCount }
  })
  // keep blocks created after snapshot; restore dates/times of existing ones
  const snapBlocks = new Map(snap.routines.map((b) => [b.id, b]))
  const restoredRoutines = routines.map((b) => {
    const s = snapBlocks.get(b.id)
    return s ? { ...b, date: s.date, startTime: s.startTime } : b
  })
  return { routines: restoredRoutines, dayLog: restoredLog, tasks: restoredTasks, oneThingId: snap.oneThingId }
}
