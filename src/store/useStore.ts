import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type {
  AgentRole,
  AnnualMission,
  AppSettings,
  ContentItem,
  DailyCheckIn,
  DailyReview,
  Idea,
  JournalEntry,
  MissionTarget,
  Partner,
  Project,
  RescueSession,
  RevenueEntry,
  Reward,
  RoutineBlock,
  RoutineDayEntry,
  Task,
  UserPreferences,
  UserProfile,
  WeeklyReviewRecord,
} from '../types'
import { GIFT_POOL, SCHEMA_VERSION, seedRewards, seedRoutines } from '../data/seed'
import { addDays, localDate } from '../utils/date'
import { hash, uid } from '../utils/id'
import { awardOnce, totals, xpForTask } from '../engine/rewards'
import { applyRescuePlan, undoRescue } from '../engine/scheduling/rescue'
import { blocksForDate, findConflicts } from '../engine/scheduling/day'
import { elapsedSeconds, pauseSession, resumeSession } from '../engine/focus'
import { detectComeback, comebackEventId } from '../engine/comeback'
import { initialDomain, pickDomain, type DomainState } from './state'
import { migrate, validateData } from './backup'

export const STORAGE_KEY = 'becoming-data'

export type TaskDraft = Partial<Task> & Pick<Task, 'title' | 'missionId' | 'estimatedMinutes'>

export interface Actions {
  // clock (overridable for tests)
  now: () => Date
  today: () => string

  completeOnboarding: (p: { name: string; prefs: Partial<UserPreferences>; skipped?: boolean }) => void
  updateProfile: (p: Partial<UserProfile>) => void
  updatePreferences: (p: Partial<UserPreferences>) => void
  updateSettings: (p: Partial<AppSettings>) => void

  touchActive: () => void
  resolveComeback: (action: 'review' | 'mission' | 'reset') => void

  saveCheckIn: (p: Partial<DailyCheckIn>, date?: string) => DailyCheckIn
  setOneThing: (taskId: string | null, date?: string) => void

  addTask: (d: TaskDraft) => Task
  updateTask: (id: string, p: Partial<Task>) => void
  deleteTask: (id: string) => void
  completeTask: (id: string) => { xp: number; giftUnlocked: boolean }
  reopenTask: (id: string) => void
  postponeTask: (id: string, to: string | null) => void
  reduceScope: (id: string) => void

  addProject: (p: Partial<Project> & Pick<Project, 'title' | 'missionId'>) => Project
  updateProject: (id: string, p: Partial<Project>) => void
  deleteProject: (id: string) => void
  setPrimaryProject: (id: string) => void
  toggleMilestone: (projectId: string, msId: string) => void
  addMilestone: (projectId: string, title: string) => void

  addRoutine: (b: Partial<RoutineBlock> & Pick<RoutineBlock, 'title' | 'category' | 'duration'>) => { ok: boolean; conflicts: string[] }
  updateRoutine: (id: string, p: Partial<RoutineBlock>, force?: boolean) => { ok: boolean; conflicts: string[] }
  deleteRoutine: (id: string) => void
  setRoutineStatus: (id: string, status: RoutineDayEntry['status'], date?: string) => void
  rescheduleRoutineToday: (id: string, start: string | null) => { ok: boolean; conflicts: string[] }
  moveRoutine: (id: string, dir: -1 | 1) => void

  startFocus: (taskId: string | null, title: string, minutes: number) => void
  pauseFocus: () => void
  resumeFocus: () => void
  acknowledgeOvertime: () => void
  completeFocus: () => { xp: number; giftUnlocked: boolean }
  exitFocus: () => void
  stopAndReschedule: () => void

  confirmRescue: (s: Omit<RescueSession, 'id' | 'confirmedAt' | 'undoStatus'>) => RescueSession
  undoLastRescue: () => boolean

  addJournal: (e: Pick<JournalEntry, 'content' | 'type'> & Partial<JournalEntry>) => void
  updateJournal: (id: string, p: Partial<JournalEntry>) => void
  deleteJournal: (id: string) => void

  revealGift: (date?: string) => (typeof GIFT_POOL)[number] | null
  redeemReward: (id: string) => boolean
  addReward: (title: string, cost: number) => void
  deleteReward: (id: string) => void
  awardEvent: (sourceEventId: string, amount: number, reason: string) => boolean

  saveDebrief: (r: Omit<DailyReview, 'id' | 'localDate'>) => void
  saveWeekly: (r: Omit<WeeklyReviewRecord, 'createdAt'>) => void

  addIdea: (text: string) => void
  updateIdea: (id: string, p: Partial<Idea>) => void
  ideaToTask: (id: string) => void
  upsertPartner: (p: Partial<Partner> & Pick<Partner, 'name'>) => void
  deletePartner: (id: string) => void
  addRevenue: (r: Omit<RevenueEntry, 'id'>) => void
  deleteRevenue: (id: string) => void
  upsertContent: (c: Partial<ContentItem> & Pick<ContentItem, 'title'>) => void
  deleteContent: (id: string) => void
  updateAgent: (id: string, p: Partial<AgentRole>) => void
  createAgentTask: (id: string, title: string) => void

  updateMission: (id: AnnualMission['id'], p: Partial<AnnualMission>) => void
  updateTarget: (missionId: AnnualMission['id'], targetId: string, p: Partial<MissionTarget>) => void
  addTarget: (missionId: AnnualMission['id'], label: string, unit: string, target: number) => void

  dismissFollowUp: (key: string) => void
  snoozeFollowUp: (key: string, minutes: number) => void
  markNotified: (key: string) => void

  startExperiment: () => void
  toggleExperimentDay: (d: number) => void
  setExperimentFeedback: (k: string, v: number | string) => void

  importData: (d: DomainState) => void
  resetAll: () => void
}

export type Store = DomainState & Actions & { hydrated: boolean; storageError: string | null }

// The store may not exist yet while it hydrates during creation, so defer.
let pendingError: string | null = null
function flagError(msg: string) {
  pendingError = msg
  setTimeout(() => {
    if (pendingError) useStore.setState({ storageError: pendingError })
    pendingError = null
  }, 0)
}

/** localStorage wrapper that never throws and keeps a copy of corrupted data. */
export const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      const v = localStorage.getItem(name)
      if (v !== null) JSON.parse(v)
      return v
    } catch {
      try {
        const v = localStorage.getItem(name)
        if (v) localStorage.setItem(`${name}-corrupt-${Date.now()}`, v)
        localStorage.removeItem(name)
      } catch {
        /* ignore */
      }
      flagError('ข้อมูลเดิมเสียหาย แอปสำรองไว้และเริ่มต้นใหม่ให้')
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch {
      flagError('บันทึกข้อมูลไม่สำเร็จ (พื้นที่เบราว์เซอร์อาจเต็ม)')
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      /* ignore */
    }
  },
}

const iso = (get: () => Actions) => get().now().toISOString()

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const today = () => localDate(get().now(), get().settings.timezone)

      const award = (sourceEventId: string, amount: number, reason: string): boolean => {
        const r = awardOnce(get().transactions, sourceEventId, amount, reason, iso(get))
        if (r.awarded) set({ transactions: r.txs })
        return r.awarded
      }

      const finishTask = (id: string): { xp: number; giftUnlocked: boolean } => {
        const s = get()
        const t = s.tasks.find((x) => x.id === id)
        if (!t) return { xp: 0, giftUnlocked: false }
        const d = today()
        const nowIso = iso(get)
        set({ tasks: s.tasks.map((x) => (x.id === id ? { ...x, status: 'done', completedAt: x.completedAt ?? nowIso, updatedAt: nowIso } : x)) })
        const isOneThing = Object.values(s.checkIns).some((c) => c.oneThingId === id)
        let xp = 0
        let giftUnlocked = false
        if (isOneThing) {
          if (award(`onething:${id}`, s.settings.rewardRules.oneThing, `One Thing: ${t.title}`)) xp += s.settings.rewardRules.oneThing
          const date = Object.values(s.checkIns).find((c) => c.oneThingId === id)?.localDate ?? d
          if (!get().gifts[date]?.unlocked) {
            set({ gifts: { ...get().gifts, [date]: { unlocked: true, revealedRewardId: null, revealedAt: null } } })
            giftUnlocked = true
          }
        } else {
          const amt = xpForTask(t, s.settings.rewardRules)
          if (award(`task:${id}`, amt, t.title)) xp += amt
        }
        // bonus for completing a revised Rescue mission
        const rescue = s.rescues.find((r) => r.confirmedAt && r.undoStatus === 'available' && r.proposedPlan.oneThingId === id)
        if (rescue && award(`rescue:${rescue.id}`, s.settings.rewardRules.rescueBonus, 'Rescue mission')) xp += s.settings.rewardRules.rescueBonus
        return { xp, giftUnlocked }
      }

      const checkRoutineConflicts = (block: RoutineBlock, ignoreId?: string): string[] => {
        if (!block.startTime) return []
        const s = get()
        const date = block.recurrence === 'none' && block.date ? block.date : today()
        const items = blocksForDate(s.routines.filter((r) => r.id !== ignoreId), date, s.dayLogs[date])
        const [h, m] = block.startTime.split(':').map(Number)
        return findConflicts(items, h * 60 + m, block.duration).map((c) => c.block.title)
      }

      return {
        ...initialDomain(),
        hydrated: false,
        storageError: null,
        now: () => new Date(),
        today,

        completeOnboarding: ({ name, prefs, skipped }) => {
          const s = get()
          const preferences = { ...s.profile.preferences, ...prefs }
          const routines = s.routines.some((r) => r.id === 'rb_wake')
            ? seedRoutines(preferences.wakeTime, preferences.sleepTime).map((b) => s.routines.find((r) => r.id === b.id && r.title !== b.title) ?? b)
            : s.routines
          const projects = preferences.primaryBusiness
            ? s.projects.map((p) => (p.isPrimaryBusiness && p.id === 'proj_ai_company' && preferences.primaryBusiness && !p.title.includes(preferences.primaryBusiness) ? { ...p, description: `${p.description} · ธุรกิจหลัก: ${preferences.primaryBusiness}` } : p))
            : s.projects
          set({
            profile: { ...s.profile, name: name.trim() || s.profile.name, preferences, onboardingStatus: skipped ? 'skipped' : 'done', startedAt: s.profile.startedAt || today() },
            routines,
            projects,
            rewards: [...s.rewards.filter((r) => !r.id.startsWith('rw_custom')), ...seedRewards(preferences.rewardPreferences).filter((r) => !s.rewards.some((x) => x.id === r.id))],
            lastActiveDate: today(),
          })
        },
        updateProfile: (p) => set({ profile: { ...get().profile, ...p } }),
        updatePreferences: (p) => set({ profile: { ...get().profile, preferences: { ...get().profile.preferences, ...p } } }),
        updateSettings: (p) => set({ settings: { ...get().settings, ...p } }),

        touchActive: () => {
          const s = get()
          const d = today()
          if (s.lastActiveDate === d) return
          const cb = detectComeback(s.lastActiveDate, d, s.settings.comebackAfterDays)
          set({ lastActiveDate: d, comeback: cb ?? s.comeback })
        },
        resolveComeback: (action) => {
          const s = get()
          if (!s.comeback) return
          award(comebackEventId(s.comeback.returnDate), s.settings.rewardRules.comeback, 'Comeback Bonus')
          if (action === 'reset') {
            // clear today's plan without deleting anything: unfinished scheduled tasks return to the pool
            const d = today()
            set({ tasks: s.tasks.map((t) => (t.status !== 'done' && t.scheduledDate && t.scheduledDate < d ? { ...t, scheduledDate: null } : t)) })
          }
          set({ comeback: null })
        },

        saveCheckIn: (p, date) => {
          const d = date ?? today()
          const prev = get().checkIns[d]
          const base: DailyCheckIn = prev ?? {
            id: uid('ci'),
            localDate: d,
            energy: 60,
            mood: 'okay',
            sleepDuration: 7,
            availableMinutes: 30,
            circumstances: 'normal',
            oneThingId: get().plannedOneThing[d] ?? null,
            completedAt: null,
          }
          const c: DailyCheckIn = { ...base, ...p, localDate: d }
          set({ checkIns: { ...get().checkIns, [d]: c } })
          return c
        },
        setOneThing: (taskId, date) => {
          const d = date ?? today()
          get().saveCheckIn({ oneThingId: taskId }, d)
          if (taskId) get().updateTask(taskId, { scheduledDate: d })
        },

        addTask: (draft) => {
          const nowIso = iso(get)
          const t: Task = {
            id: uid('task'),
            projectId: null,
            description: '',
            actualMinutes: 0,
            priority: 'medium',
            energyRequirement: 'medium',
            kind: 'general',
            status: 'todo',
            scheduledDate: null,
            dependencies: [],
            postponementCount: 0,
            completedAt: null,
            createdAt: nowIso,
            updatedAt: nowIso,
            ...draft,
          }
          set({ tasks: [...get().tasks, t] })
          return t
        },
        updateTask: (id, p) => set({ tasks: get().tasks.map((t) => (t.id === id ? { ...t, ...p, updatedAt: iso(get) } : t)) }),
        deleteTask: (id) =>
          set({
            tasks: get().tasks.filter((t) => t.id !== id).map((t) => (t.dependencies.includes(id) ? { ...t, dependencies: t.dependencies.filter((x) => x !== id) } : t)),
          }),
        completeTask: (id) => finishTask(id),
        reopenTask: (id) => get().updateTask(id, { status: 'todo', completedAt: null }), // XP stays; re-completing won't award twice
        postponeTask: (id, to) => {
          const t = get().tasks.find((x) => x.id === id)
          if (!t) return
          get().updateTask(id, { scheduledDate: to, postponementCount: t.postponementCount + 1, status: to ? (t.status === 'in_progress' ? 'in_progress' : 'todo') : 'deferred' })
        },
        reduceScope: (id) => {
          const t = get().tasks.find((x) => x.id === id)
          if (!t) return
          const est = Math.max(5, Math.round(t.estimatedMinutes / 2 / 5) * 5)
          get().updateTask(id, { estimatedMinutes: est, description: `${t.description}${t.description ? '\n' : ''}[ลดขอบเขตเหลือ ${est} นาที]` })
        },

        addProject: (p) => {
          const nowIso = iso(get)
          const pr: Project = { id: uid('proj'), description: '', status: 'active', isPrimaryBusiness: false, priority: 'medium', milestones: [], createdAt: nowIso, updatedAt: nowIso, ...p }
          set({ projects: [...get().projects, pr] })
          return pr
        },
        updateProject: (id, p) => set({ projects: get().projects.map((x) => (x.id === id ? { ...x, ...p, updatedAt: iso(get) } : x)) }),
        deleteProject: (id) =>
          set({ projects: get().projects.filter((p) => p.id !== id), tasks: get().tasks.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)) }),
        setPrimaryProject: (id) => set({ projects: get().projects.map((p) => ({ ...p, isPrimaryBusiness: p.id === id })) }),
        toggleMilestone: (pid, mid) =>
          set({
            projects: get().projects.map((p) =>
              p.id === pid ? { ...p, milestones: p.milestones.map((m) => (m.id === mid ? { ...m, done: !m.done, doneAt: !m.done ? iso(get) : null } : m)) } : p,
            ),
          }),
        addMilestone: (pid, title) =>
          set({ projects: get().projects.map((p) => (p.id === pid ? { ...p, milestones: [...p.milestones, { id: uid('ms'), title, done: false }] } : p)) }),

        addRoutine: (b) => {
          const s = get()
          const block: RoutineBlock = {
            id: uid('rb'),
            startTime: null,
            anchor: null,
            recurrence: 'daily',
            weekday: null,
            date: null,
            flexibility: 'flexible',
            priority: 'medium',
            essential: false,
            notes: '',
            order: s.routines.length,
            status: 'active',
            ...b,
          }
          const conflicts = checkRoutineConflicts(block)
          if (conflicts.length) return { ok: false, conflicts }
          set({ routines: [...s.routines, block] })
          return { ok: true, conflicts: [] }
        },
        updateRoutine: (id, p, force) => {
          const cur = get().routines.find((r) => r.id === id)
          if (!cur) return { ok: false, conflicts: [] }
          const next = { ...cur, ...p }
          const conflicts = force ? [] : checkRoutineConflicts(next, id)
          if (conflicts.length) return { ok: false, conflicts }
          set({ routines: get().routines.map((r) => (r.id === id ? next : r)) })
          return { ok: true, conflicts: [] }
        },
        deleteRoutine: (id) => set({ routines: get().routines.filter((r) => r.id !== id) }),
        setRoutineStatus: (id, status, date) => {
          const d = date ?? today()
          const s = get()
          const log = s.dayLogs[d] ?? {}
          set({ dayLogs: { ...s.dayLogs, [d]: { ...log, [id]: { ...(log[id] ?? {}), status } } } })
          if (status === 'done') {
            const b = s.routines.find((r) => r.id === id)
            if (!b) return
            const r = s.settings.rewardRules
            if (b.category === 'exercise' || b.category === 'recovery' || b.category === 'sleep') award(`routine:${id}:${d}`, r.health, b.title)
            else if (b.category === 'family') award(`routine:${id}:${d}`, r.family, b.title)
          }
        },
        rescheduleRoutineToday: (id, start) => {
          const d = today()
          const s = get()
          const b = s.routines.find((r) => r.id === id)
          if (!b) return { ok: false, conflicts: [] }
          if (start) {
            const items = blocksForDate(s.routines, d, s.dayLogs[d])
            const [h, m] = start.split(':').map(Number)
            const c = findConflicts(items, h * 60 + m, b.duration, id).map((x) => x.block.title)
            if (c.length) return { ok: false, conflicts: c }
          }
          const log = s.dayLogs[d] ?? {}
          set({ dayLogs: { ...s.dayLogs, [d]: { ...log, [id]: { ...(log[id] ?? { status: 'pending' as const }), startTime: start } } } })
          return { ok: true, conflicts: [] }
        },
        moveRoutine: (id, dir) => {
          const list = [...get().routines].sort((a, b) => a.order - b.order)
          const i = list.findIndex((r) => r.id === id)
          const j = i + dir
          if (i < 0 || j < 0 || j >= list.length) return
          ;[list[i], list[j]] = [list[j], list[i]]
          set({ routines: list.map((r, k) => ({ ...r, order: k })) })
        },

        startFocus: (taskId, title, minutes) => {
          const s = get()
          if (s.focus && (s.focus.status === 'running' || s.focus.status === 'paused')) get().exitFocus()
          const nowIso = iso(get)
          set({
            focus: { id: uid('fs'), taskId, title, plannedMinutes: minutes, createdAt: nowIso, startedAt: nowIso, pausedAt: null, elapsedSeconds: 0, status: 'running', overtimeAcknowledgedAt: 0 },
          })
          if (taskId) {
            const t = get().tasks.find((x) => x.id === taskId)
            if (t && t.status === 'todo') get().updateTask(taskId, { status: 'in_progress' })
          }
        },
        pauseFocus: () => {
          const f = get().focus
          if (f) set({ focus: pauseSession(f, get().now().getTime()) })
        },
        resumeFocus: () => {
          const f = get().focus
          if (f) set({ focus: resumeSession(f, get().now().getTime()) })
        },
        acknowledgeOvertime: () => {
          const f = get().focus
          if (f) set({ focus: { ...f, overtimeAcknowledgedAt: elapsedSeconds(f, get().now().getTime()) } })
        },
        completeFocus: () => {
          const f = get().focus
          if (!f) return { xp: 0, giftUnlocked: false }
          const sec = elapsedSeconds(f, get().now().getTime())
          const done = { ...f, status: 'completed' as const, elapsedSeconds: sec }
          set({ focus: null, focusLog: [...get().focusLog, done] })
          if (f.taskId) {
            const t = get().tasks.find((x) => x.id === f.taskId)
            if (t) get().updateTask(t.id, { actualMinutes: t.actualMinutes + Math.round(sec / 60) })
            return finishTask(f.taskId)
          }
          return { xp: 0, giftUnlocked: false }
        },
        exitFocus: () => {
          const f = get().focus
          if (!f) return
          const sec = elapsedSeconds(f, get().now().getTime())
          set({ focus: null, focusLog: [...get().focusLog, { ...f, status: 'stopped', elapsedSeconds: sec }] })
          if (f.taskId) {
            const t = get().tasks.find((x) => x.id === f.taskId)
            if (t) get().updateTask(t.id, { actualMinutes: t.actualMinutes + Math.round(sec / 60) })
          }
        },
        stopAndReschedule: () => {
          const f = get().focus
          get().exitFocus()
          if (f?.taskId) get().postponeTask(f.taskId, addDays(today(), 1))
        },

        confirmRescue: (draft) => {
          const s = get()
          const d = draft.localDate
          const applied = applyRescuePlan(draft.proposedPlan, d, s.routines, s.dayLogs[d] ?? {}, s.tasks, iso(get))
          const session: RescueSession = { ...draft, id: uid('rescue'), confirmedAt: iso(get), undoStatus: 'available' }
          const prevCheck = s.checkIns[d]
          set({
            routines: applied.routines,
            dayLogs: { ...s.dayLogs, [d]: applied.dayLog },
            tasks: applied.tasks,
            rescues: [...s.rescues.map((r) => (r.undoStatus === 'available' ? { ...r, undoStatus: 'none' as const } : r)), session],
          })
          get().saveCheckIn({ oneThingId: applied.oneThingId, availableMinutes: draft.remainingMinutes, energy: draft.remainingEnergy ?? prevCheck?.energy }, d)
          return session
        },
        undoLastRescue: () => {
          const s = get()
          const r = [...s.rescues].reverse().find((x) => x.undoStatus === 'available')
          if (!r) return false
          const d = r.localDate
          const restored = undoRescue(r.previousPlan, s.routines, s.dayLogs[d] ?? {}, s.tasks)
          set({
            routines: restored.routines,
            dayLogs: { ...s.dayLogs, [d]: restored.dayLog },
            tasks: restored.tasks,
            rescues: s.rescues.map((x) => (x.id === r.id ? { ...x, undoStatus: 'undone' } : x)),
          })
          get().saveCheckIn({ oneThingId: restored.oneThingId }, d)
          return true
        },

        addJournal: (e) => {
          const nowIso = iso(get)
          set({ journal: [{ id: uid('j'), localDate: today(), mood: null, tags: [], createdAt: nowIso, updatedAt: nowIso, ...e }, ...get().journal] })
        },
        updateJournal: (id, p) => set({ journal: get().journal.map((j) => (j.id === id ? { ...j, ...p, updatedAt: iso(get) } : j)) }),
        deleteJournal: (id) => set({ journal: get().journal.filter((j) => j.id !== id) }),

        revealGift: (date) => {
          const d = date ?? today()
          const g = get().gifts[d]
          if (!g?.unlocked) return null
          if (g.revealedRewardId) return GIFT_POOL.find((x) => x.id === g.revealedRewardId) ?? null
          const gift = GIFT_POOL[hash(d + get().profile.id) % GIFT_POOL.length]
          set({ gifts: { ...get().gifts, [d]: { ...g, revealedRewardId: gift.id, revealedAt: iso(get) } } })
          return gift
        },
        redeemReward: (id) => {
          const s = get()
          const r = s.rewards.find((x) => x.id === id)
          const { coins } = totals(s.transactions)
          if (!r || r.cost > coins) return false
          const nowIso = iso(get)
          set({
            transactions: [...s.transactions, { id: uid('tx'), sourceEventId: `redeem:${id}:${nowIso}`, amount: -r.cost, rewardType: 'coins', reason: r.title, createdAt: nowIso }],
          })
          return true
        },
        addReward: (title, cost) => set({ rewards: [...get().rewards, { id: uid('rw_custom'), title, cost, type: 'personal', unlockCondition: 'ใช้เหรียญ', status: 'available' } satisfies Reward] }),
        deleteReward: (id) => set({ rewards: get().rewards.filter((r) => r.id !== id) }),
        awardEvent: (sid, amount, reason) => award(sid, amount, reason),

        saveDebrief: (r) => {
          const d = today()
          const s = get()
          const review: DailyReview = { id: s.reviews[d]?.id ?? uid('rv'), localDate: d, ...r }
          const planned = { ...s.plannedOneThing }
          if (r.tomorrowOneThingId) planned[addDays(d, 1)] = r.tomorrowOneThingId
          set({ reviews: { ...s.reviews, [d]: review }, plannedOneThing: planned })
          award(`debrief:${d}`, s.settings.rewardRules.debrief, 'Evening Debrief')
        },
        saveWeekly: (r) => set({ weekly: [...get().weekly.filter((w) => w.weekStart !== r.weekStart), { ...r, createdAt: iso(get) }] }),

        addIdea: (text) => set({ ideas: [{ id: uid('idea'), text, missionId: null, createdAt: iso(get), status: 'inbox' }, ...get().ideas] }),
        updateIdea: (id, p) => set({ ideas: get().ideas.map((i) => (i.id === id ? { ...i, ...p } : i)) }),
        ideaToTask: (id) => {
          const idea = get().ideas.find((i) => i.id === id)
          if (!idea || idea.status === 'converted') return
          get().addTask({ title: idea.text.slice(0, 80), missionId: idea.missionId ?? 'empire', estimatedMinutes: 15, kind: 'business' })
          get().updateIdea(id, { status: 'converted' })
        },
        upsertPartner: (p) => {
          const nowIso = iso(get)
          const list = get().partners
          if (p.id && list.some((x) => x.id === p.id)) set({ partners: list.map((x) => (x.id === p.id ? { ...x, ...p, updatedAt: nowIso } : x)) })
          else set({ partners: [...list, { id: uid('pt'), skills: '', stage: 'candidate', valuesFit: 3, notes: '', updatedAt: nowIso, ...p }] })
        },
        deletePartner: (id) => set({ partners: get().partners.filter((x) => x.id !== id) }),
        addRevenue: (r) => set({ revenue: [...get().revenue, { id: uid('rev'), ...r }] }),
        deleteRevenue: (id) => set({ revenue: get().revenue.filter((x) => x.id !== id) }),
        upsertContent: (c) => {
          const nowIso = iso(get)
          const list = get().content
          if (c.id && list.some((x) => x.id === c.id)) {
            set({ content: list.map((x) => (x.id === c.id ? { ...x, ...c, publishedAt: c.status === 'published' && !x.publishedAt ? nowIso : x.publishedAt } : x)) })
            if (c.status === 'published') award(`content:${c.id}`, get().settings.rewardRules.brand, 'เผยแพร่คอนเทนต์')
          } else set({ content: [{ id: uid('ct'), status: 'idea', channel: '', createdAt: nowIso, publishedAt: null, ...c }, ...list] })
        },
        deleteContent: (id) => set({ content: get().content.filter((x) => x.id !== id) }),
        updateAgent: (id, p) => set({ agents: get().agents.map((a) => (a.id === id ? { ...a, ...p } : a)) }),
        createAgentTask: (id, title) => {
          const a = get().agents.find((x) => x.id === id)
          if (!a) return
          const primary = get().projects.find((p) => p.isPrimaryBusiness)
          const t = get().addTask({ title, missionId: 'empire', estimatedMinutes: 15, projectId: primary?.id ?? null, kind: 'business', priority: 'high' })
          get().updateAgent(id, { taskId: t.id })
        },

        updateMission: (id, p) => set({ missions: get().missions.map((m) => (m.id === id ? { ...m, ...p } : m)) }),
        updateTarget: (mid, tid, p) =>
          set({ missions: get().missions.map((m) => (m.id === mid ? { ...m, targets: m.targets.map((t) => (t.id === tid ? { ...t, ...p } : t)) } : m)) }),
        addTarget: (mid, label, unit, target) =>
          set({ missions: get().missions.map((m) => (m.id === mid ? { ...m, targets: [...m.targets, { id: uid('tg'), label, unit, target, current: 0 }] } : m)) }),

        dismissFollowUp: (key) => set({ followUp: { ...get().followUp, dismissed: { ...get().followUp.dismissed, [key]: iso(get) } } }),
        snoozeFollowUp: (key, minutes) =>
          set({ followUp: { ...get().followUp, snoozedUntil: { ...get().followUp.snoozedUntil, [key]: new Date(get().now().getTime() + minutes * 60000).toISOString() } } }),
        markNotified: (key) => set({ followUp: { ...get().followUp, notified: { ...get().followUp.notified, [key]: today() } } }),

        startExperiment: () => set({ experiment: { ...get().experiment, startedAt: today() } }),
        toggleExperimentDay: (d) => {
          const e = get().experiment
          set({ experiment: { ...e, doneDays: e.doneDays.includes(d) ? e.doneDays.filter((x) => x !== d) : [...e.doneDays, d] } })
        },
        setExperimentFeedback: (k, v) => set({ experiment: { ...get().experiment, feedback: { ...get().experiment.feedback, [k]: v } } }),

        importData: (d) => set({ ...d, comeback: null, lastActiveDate: today() }),
        resetAll: () => set({ ...initialDomain(get().now()), lastActiveDate: null }),
      }
    },
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => pickDomain(s),
      migrate: (persisted, version) => migrate((persisted ?? {}) as Record<string, unknown>, version) as unknown as Store,
      merge: (persisted, current) => {
        if (!persisted) return current
        const v = validateData({ app: 'becoming', schemaVersion: SCHEMA_VERSION, data: persisted })
        if (!v.ok || !v.data) return { ...current, storageError: 'อ่านข้อมูลเดิมไม่ได้ เริ่มต้นใหม่ให้แล้ว' }
        // keep runtime-only fields not covered by validation
        const p = persisted as Partial<DomainState>
        return { ...current, ...v.data, comeback: p.comeback ?? null, focus: p.focus ?? null }
      },
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true
        setTimeout(() => useStore.setState({ hydrated: true, ...(pendingError ? { storageError: pendingError } : {}) }), 0)
      },
    },
  ),
)
