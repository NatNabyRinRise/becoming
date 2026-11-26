import { useStore } from '../store/useStore'
import type { DomainState } from '../store/state'
import { useCore } from './useCore'

/**
 * Observe: watches the Life OS store and writes behavior events into the
 * Intelligence Core. It only diffs state, so v0.3 features don't need to know
 * the core exists.
 */
export function diffEvents(prev: DomainState, next: DomainState, log: ReturnType<typeof useCore.getState>['logEvent']) {
  if (prev.tasks !== next.tasks) {
    const before = new Map(prev.tasks.map((t) => [t.id, t]))
    for (const t of next.tasks) {
      const p = before.get(t.id)
      if (!p) continue
      if (t.status === 'done' && p.status !== 'done') log('task.completed', { taskId: t.id, kind: t.kind, missionId: t.missionId, estimatedMinutes: t.estimatedMinutes, postponed: t.postponementCount })
      if (t.postponementCount > p.postponementCount) log('task.postponed', { taskId: t.id, kind: t.kind, count: t.postponementCount })
    }
  }
  if (next.focusLog.length > prev.focusLog.length) {
    for (const f of next.focusLog.slice(prev.focusLog.length)) {
      log(f.status === 'completed' ? 'focus.completed' : 'focus.stopped', { plannedMinutes: f.plannedMinutes, actualMinutes: Math.round(f.elapsedSeconds / 60), taskId: f.taskId })
    }
  }
  if (prev.checkIns !== next.checkIns) {
    for (const [d, c] of Object.entries(next.checkIns)) {
      const p = prev.checkIns[d]
      if (!p || p.energy !== c.energy || p.mood !== c.mood) log('checkin.saved', { date: d, energy: c.energy, mood: c.mood, sleep: c.sleepDuration, minutes: c.availableMinutes })
    }
  }
  if (next.journal.length > prev.journal.length) {
    const known = new Set(prev.journal.map((j) => j.id))
    for (const j of next.journal) if (!known.has(j.id)) log('journal.added', { type: j.type, length: j.content.length })
  }
  if (next.rescues.length > prev.rescues.length) {
    for (const r of next.rescues.slice(prev.rescues.length)) log('rescue.confirmed', { reason: r.reason, minutes: r.remainingMinutes, energy: r.remainingEnergy })
  }
}

let paused = false
/** Remote snapshots applied by sync are not new behavior — don't log them. */
export function withoutObserving(fn: () => void) {
  paused = true
  try {
    fn()
  } finally {
    paused = false
  }
}

export function startObserver(): () => void {
  return useStore.subscribe((next, prev) => {
    if (paused || !next.hydrated || !prev.hydrated) return
    diffEvents(prev, next, useCore.getState().logEvent)
  })
}

/** Context package a future AI agent receives (only active memories; nothing the user hasn't approved). */
export function buildAgentContext() {
  const s = useStore.getState()
  const c = useCore.getState()
  const since = Date.now() - 14 * 86_400_000
  return {
    profile: { name: s.profile.name, timezone: s.settings.timezone, preferences: s.profile.preferences },
    memories: c.memories.filter((m) => !m.deletedAt && m.status === 'active').map((m) => ({ kind: m.kind, content: m.content })),
    recentEvents: c.events.filter((e) => Date.parse(e.occurredAt) >= since),
    openTasks: s.tasks.filter((t) => t.status !== 'done' && t.status !== 'archived').map((t) => ({ title: t.title, missionId: t.missionId, scheduledDate: t.scheduledDate, postponed: t.postponementCount })),
    feedback: c.recommendations.filter((r) => !r.deletedAt && r.status !== 'proposed').map((r) => ({ signalKey: r.signalKey, status: r.status, outcome: r.outcome })),
  }
}
