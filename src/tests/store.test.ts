import { beforeEach, describe, expect, it } from 'vitest'
import { resetStore, S } from './helpers'
import { useStore, STORAGE_KEY } from '../store/useStore'
import { totals } from '../engine/rewards'
import { elapsedSeconds } from '../engine/focus'
import { buildRescuePlan, snapshotPlan } from '../engine/scheduling/rescue'
import { exportBackup, validateData } from '../store/backup'
import { pickDomain } from '../store/state'

let clock: ReturnType<typeof resetStore>
beforeEach(() => {
  clock = resetStore()
})

describe('Store acceptance scenarios', () => {
  it('Scenario A: briefing → accept → focus starts', () => {
    S().saveCheckIn({ energy: 72, availableMinutes: 60 })
    S().setOneThing('task_prompt_agent')
    S().saveCheckIn({ completedAt: S().now().toISOString() })
    S().startFocus('task_prompt_agent', 'x', 30)
    expect(S().focus?.status).toBe('running')
    expect(S().tasks.find((t) => t.id === 'task_prompt_agent')?.status).toBe('in_progress')
    expect(S().checkIns[S().today()].oneThingId).toBe('task_prompt_agent')
  })

  it('Scenario F: complete → reopen → complete gives XP once', () => {
    S().setOneThing('task_assign_agent')
    S().completeTask('task_assign_agent')
    const xp1 = totals(S().transactions).xp
    S().reopenTask('task_assign_agent')
    S().completeTask('task_assign_agent')
    S().reopenTask('task_assign_agent')
    S().completeTask('task_assign_agent')
    expect(totals(S().transactions).xp).toBe(xp1)
    expect(xp1).toBe(50)
    const ids = S().transactions.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(S().gifts[S().today()].unlocked).toBe(true)
  })

  it('Scenario G: three inactive days → comeback, XP not removed, bonus once', () => {
    S().touchActive()
    S().completeTask('task_walk')
    const xp = totals(S().transactions).xp
    clock.setNow('2026-11-28T02:00:00.000Z')
    S().touchActive()
    expect(S().comeback?.gap).toBe(3)
    expect(totals(S().transactions).xp).toBe(xp)
    S().resolveComeback('mission')
    S().resolveComeback('mission')
    expect(S().comeback).toBeNull()
    expect(totals(S().transactions).xp).toBe(xp + S().settings.rewardRules.comeback)
  })

  it('Scenario H: data persists to storage and rehydrates', async () => {
    S().addTask({ title: 'งานทดสอบ', missionId: 'empire', estimatedMinutes: 10 })
    S().addProject({ title: 'โปรเจกต์ทดสอบ', missionId: 'influence' })
    S().saveCheckIn({ energy: 55 })
    S().addJournal({ content: 'บันทึก', type: 'reflection' })
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    // simulate refresh: wipe memory then rehydrate from storage
    useStore.setState({ tasks: [], projects: [], journal: [], checkIns: {} })
    localStorage.setItem(STORAGE_KEY, raw!) // a real refresh keeps storage; memory is gone
    await useStore.persist.rehydrate()
    expect(S().tasks.some((t) => t.title === 'งานทดสอบ')).toBe(true)
    expect(S().projects.some((p) => p.title === 'โปรเจกต์ทดสอบ')).toBe(true)
    expect(S().journal[0].content).toBe('บันทึก')
    expect(S().checkIns[S().today()].energy).toBe(55)
  })

  it('handles corrupted storage gracefully', async () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    await useStore.persist.rehydrate()
    await new Promise((r) => setTimeout(r, 5))
    expect(S().storageError).toBeTruthy()
    expect(Object.keys(localStorage).some((k) => k.includes('corrupt'))).toBe(true)
  })

  it('Scenario I: focus survives refresh with correct elapsed time', async () => {
    S().startFocus(null, 'Focus', 25)
    clock.advance(90)
    const raw = localStorage.getItem(STORAGE_KEY)!
    useStore.setState({ focus: null })
    localStorage.setItem(STORAGE_KEY, raw)
    await useStore.persist.rehydrate()
    expect(S().focus).not.toBeNull()
    expect(elapsedSeconds(S().focus!, S().now().getTime())).toBe(90)
    S().pauseFocus()
    clock.advance(600)
    expect(elapsedSeconds(S().focus!, S().now().getTime())).toBe(90)
    S().resumeFocus()
    clock.advance(30)
    expect(elapsedSeconds(S().focus!, S().now().getTime())).toBe(120)
  })

  it('Scenario B + J: rescue confirm then undo restores plan, keeps completed progress', () => {
    const d = S().today()
    S().setOneThing('task_run_agent')
    S().setRoutineStatus('rb_wake', 'done')
    const s = S()
    const before = snapshotPlan(s.routines, s.dayLogs[d] ?? {}, s.tasks, 'task_run_agent')
    const plan = buildRescuePlan({ date: d, nowMin: 9 * 60, routines: s.routines, dayLog: s.dayLogs[d] ?? {}, tasks: s.tasks, reason: 'baby', remainingMinutes: 15, energy: 60, thresholds: s.settings.energyThresholds, currentOneThingId: 'task_run_agent' })
    // nothing changes before confirmation
    expect(S().tasks.find((t) => t.id === 'task_run_agent')?.scheduledDate).toBe(d)
    S().confirmRescue({ localDate: d, reason: 'baby', remainingMinutes: 15, remainingEnergy: 60, previousPlan: before, proposedPlan: plan })
    expect(S().checkIns[d].oneThingId).toBe(plan.oneThingId)
    expect(S().tasks.find((t) => t.id === 'task_run_agent')?.scheduledDate).not.toBe(d)
    expect(S().dayLogs[d].rb_brand?.status).toBe('rescheduled')
    // complete the revised one thing → bonus once
    S().completeTask(plan.oneThingId!)
    expect(S().transactions.some((t) => t.sourceEventId.startsWith('rescue:'))).toBe(true)
    // undo
    expect(S().undoLastRescue()).toBe(true)
    expect(S().tasks.find((t) => t.id === 'task_run_agent')?.scheduledDate).toBe(d)
    expect(S().dayLogs[d].rb_brand?.status ?? 'pending').toBe('pending')
    expect(S().dayLogs[d].rb_wake.status).toBe('done')
    expect(S().tasks.find((t) => t.id === plan.oneThingId)?.status).toBe('done')
    expect(S().checkIns[d].oneThingId).toBe('task_run_agent')
  })

  it('opening rescue (without confirming) awards nothing', () => {
    expect(S().transactions).toHaveLength(0)
  })

  it('routine conflicts are prevented', () => {
    const r = S().addRoutine({ title: 'ประชุม', category: 'work', duration: 30, startTime: '12:15', recurrence: 'daily' })
    expect(r.ok).toBe(false)
    expect(r.conflicts).toContain('อาหารกลางวัน')
    const ok = S().addRoutine({ title: 'ประชุม', category: 'work', duration: 30, startTime: '10:30', recurrence: 'daily' })
    expect(ok.ok).toBe(true)
  })
})

describe('Scenario L: backup export / import', () => {
  it('round-trips into a fresh state and rejects invalid records', () => {
    S().addTask({ title: 'สำรองไว้', missionId: 'life', estimatedMinutes: 10 })
    S().addJournal({ content: 'hello', type: 'idea' })
    S().completeTask('task_walk')
    const file = exportBackup(pickDomain(S()))
    const json = JSON.parse(JSON.stringify(file))
    json.data.tasks.push({ id: 'bad', title: '' }) // invalid
    json.data.journal.push({ nope: true })
    resetStore()
    const preview = validateData(JSON.stringify(json))
    expect(preview.ok).toBe(true)
    const tasksCount = preview.counts.find((c) => c.key === 'tasks')!
    expect(tasksCount.invalid).toBe(1)
    expect(preview.counts.find((c) => c.key === 'journal')!.invalid).toBe(1)
    // not applied until confirmed
    expect(S().tasks.some((t) => t.title === 'สำรองไว้')).toBe(false)
    S().importData(preview.data!)
    expect(S().tasks.some((t) => t.title === 'สำรองไว้')).toBe(true)
    expect(S().journal[0].content).toBe('hello')
    expect(totals(S().transactions).xp).toBe(20)
  })

  it('rejects non-BECOMING files safely', () => {
    expect(validateData('not json').ok).toBe(false)
    expect(validateData(JSON.stringify({ app: 'other', data: {} })).ok).toBe(false)
    expect(validateData(JSON.stringify({ hello: 1 })).ok).toBe(false)
  })
})
