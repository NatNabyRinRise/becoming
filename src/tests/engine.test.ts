import { describe, expect, it } from 'vitest'
import { recommend } from '../engine/recommendations'
import { buildRescuePlan } from '../engine/scheduling/rescue'
import { seedRoutines, seedTasks, defaultSettings } from '../data/seed'
import { blocksForDate, findConflicts } from '../engine/scheduling/day'
import { awardOnce, totals } from '../engine/rewards'
import { elapsedSeconds, pauseSession, resumeSession, isOvertime } from '../engine/focus'
import { detectComeback } from '../engine/comeback'
import { computeFollowUps } from '../engine/follow-up'
import type { FocusSession } from '../types'

const NOW = '2026-11-25T02:00:00.000Z'
const th = defaultSettings().energyThresholds

describe('Recommendation engine', () => {
  it('Scenario A: energy 72, 60 min → one meaningful task that fits', () => {
    const r = recommend({ tasks: seedTasks(NOW), availableMinutes: 60, energy: 72, thresholds: th })
    expect(r.kind).toBe('task')
    if (r.kind !== 'task') return
    expect(r.minutes).toBeLessThanOrEqual(60)
    // uses the larger window well (prefers 30-60 min business deliverable)
    expect(r.minutes).toBeGreaterThanOrEqual(30)
    expect(r.alternatives.length).toBeGreaterThan(0)
  })

  it('Scenario D: energy 20 → recovery, no high-intensity work', () => {
    const r = recommend({ tasks: seedTasks(NOW), availableMinutes: 60, energy: 20, thresholds: th })
    expect(r.kind).toBe('recovery')
    if (r.kind === 'recovery' && r.light) expect(r.light.energyRequirement).toBe('low')
  })

  it('energy 30-49 prefers low-effort and never high', () => {
    const r = recommend({ tasks: seedTasks(NOW), availableMinutes: 60, energy: 40, thresholds: th })
    expect(r.kind).toBe('task')
    if (r.kind === 'task') expect(r.task.energyRequirement).not.toBe('high')
  })

  it('Scenario E: 5 minute window → only a task that fits 5 minutes', () => {
    const r = recommend({ tasks: seedTasks(NOW), availableMinutes: 5, energy: 60, thresholds: th })
    expect(r.kind).toBe('task')
    if (r.kind === 'task') expect(r.minutes).toBeLessThanOrEqual(5)
  })

  it('0 minutes → no work is forced', () => {
    const r = recommend({ tasks: seedTasks(NOW), availableMinutes: 0, energy: 80, thresholds: th })
    expect(r.kind).toBe('recovery')
  })

  it('skips done and dependency-blocked tasks; suggests smaller step when nothing fits', () => {
    const tasks = seedTasks(NOW).map((t) => ({ ...t, estimatedMinutes: 90 }))
    tasks[0].dependencies = ['missing-is-ok']
    const r = recommend({ tasks, availableMinutes: 15, energy: 70, thresholds: th })
    expect(r.kind).toBe('smaller')
  })

  it('is deterministic', () => {
    const a = recommend({ tasks: seedTasks(NOW), availableMinutes: 30, energy: 65, thresholds: th })
    const b = recommend({ tasks: seedTasks(NOW), availableMinutes: 30, energy: 65, thresholds: th })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('Rescue engine', () => {
  const routines = seedRoutines()
  const tasks = seedTasks(NOW).map((t) => (t.id === 'task_run_agent' ? { ...t, scheduledDate: '2026-11-25' } : t))

  it('Scenario B: 60-min task, 15 min left, childcare → smaller meaningful task; childcare protected', () => {
    const plan = buildRescuePlan({
      date: '2026-11-25', nowMin: 9 * 60, routines, dayLog: { rb_wake: { status: 'done' } }, tasks, reason: 'baby',
      remainingMinutes: 15, energy: 60, thresholds: th, currentOneThingId: 'task_run_agent',
    })
    expect(plan.oneThingMinutes).toBeLessThanOrEqual(15)
    expect(plan.oneThingId).not.toBe('task_run_agent')
    expect(plan.protected.some((p) => p.id === 'rb_family')).toBe(true)
    expect(plan.protected.some((p) => p.id === 'rb_wake')).toBe(true) // completed preserved
    expect(plan.rescheduled.some((c) => c.id === 'task_run_agent')).toBe(true)
    expect(plan.rescheduled.every((c) => c.id !== 'rb_family' && c.id !== 'rb_sleep')).toBe(true)
  })

  it('Scenario C: 0 minutes → optional business deferred to review queue, no work', () => {
    const plan = buildRescuePlan({
      date: '2026-11-25', nowMin: 9 * 60, routines, dayLog: {}, tasks, reason: 'no_time',
      remainingMinutes: 0, energy: 60, thresholds: th, currentOneThingId: 'task_run_agent',
    })
    expect(plan.oneThingId).toBeNull()
    const moved = plan.rescheduled.find((c) => c.id === 'task_run_agent')
    expect(moved?.to).toBe('คิวทบทวน')
    expect(plan.rescheduled.some((c) => c.id === 'rb_brand')).toBe(true)
  })
})

describe('Scheduling', () => {
  it('detects overlaps and ignores anchor blocks', () => {
    const items = blocksForDate(seedRoutines(), '2026-11-25')
    expect(findConflicts(items, 12 * 60 + 10, 20).map((c) => c.block.id)).toContain('rb_lunch')
    expect(findConflicts(items, 10 * 60 + 30, 10)).toHaveLength(0)
  })
})

describe('Rewards', () => {
  it('Scenario F (engine): same source event never awards twice', () => {
    let txs = awardOnce([], 'onething:t1', 50, 'x', NOW).txs
    const again = awardOnce(txs, 'onething:t1', 50, 'x', NOW)
    expect(again.awarded).toBe(false)
    txs = again.txs
    expect(totals(txs).xp).toBe(50)
  })
})

describe('Focus timer math', () => {
  const base: FocusSession = { id: 'f', taskId: null, title: 't', plannedMinutes: 1, createdAt: NOW, startedAt: NOW, pausedAt: null, elapsedSeconds: 0, status: 'running', overtimeAcknowledgedAt: 0 }
  it('uses timestamps; pause/resume keeps accumulated time', () => {
    const t0 = Date.parse(NOW)
    expect(elapsedSeconds(base, t0 + 30000)).toBe(30)
    const p = pauseSession(base, t0 + 30000)
    expect(elapsedSeconds(p, t0 + 999999)).toBe(30)
    const r = resumeSession(p, t0 + 100000)
    expect(elapsedSeconds(r, t0 + 110000)).toBe(40)
  })
  it('flags overtime at planned end, not before', () => {
    const t0 = Date.parse(NOW)
    expect(isOvertime(base, t0 + 59000)).toBe(false)
    expect(isOvertime(base, t0 + 61000)).toBe(true)
  })
})

describe('Comeback', () => {
  it('Scenario G (engine): 3 inactive days triggers welcome back', () => {
    expect(detectComeback('2026-11-22', '2026-11-25', 3)?.gap).toBe(3)
    expect(detectComeback('2026-11-24', '2026-11-25', 3)).toBeNull()
  })
})

describe('Follow-up', () => {
  it('respects quiet hours and dismissals', () => {
    const tasks = seedTasks(NOW).map((t) => (t.id === 'task_post' ? { ...t, postponementCount: 3 } : t))
    const base = { today: '2026-11-25', nowIso: NOW, tasks, projects: [], routines: [], dayLogs: {}, content: [], energy: 70, recoveryThreshold: 30, state: { dismissed: {}, snoozedUntil: {}, notified: {} } }
    expect(computeFollowUps({ ...base, quiet: true })).toHaveLength(0)
    const items = computeFollowUps({ ...base, quiet: false })
    expect(items[0].companionId).toBe('spark')
    const after = computeFollowUps({ ...base, quiet: false, state: { ...base.state, dismissed: { [items[0].key]: NOW } } })
    expect(after.find((f) => f.key === items[0].key)).toBeUndefined()
  })
})
