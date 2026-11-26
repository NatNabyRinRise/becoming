import { beforeEach, describe, expect, it } from 'vitest'
import { resetStore, S } from './helpers'
import { useStore } from '../store/useStore'
import { useCore, initialCore } from '../intelligence/useCore'
import { startObserver, buildAgentContext } from '../intelligence/observer'
import { computeWeights, selectRecommendations, dueForEvaluation } from '../intelligence/learning'
import { productiveTime, focusLength, stuckTasks } from '../intelligence/analyzers'
import type { BehaviorEvent, CoreRecommendation, RecommendationDraft } from '../intelligence/types'

const C = () => useCore.getState()
let now = new Date('2026-11-25T02:00:00.000Z')
beforeEach(() => {
  resetStore()
  now = new Date('2026-11-25T02:00:00.000Z')
  useCore.setState({ ...initialCore(), now: () => now })
  useStore.setState({ hydrated: true })
})

const ev = (type: BehaviorEvent['type'], at: string, payload: BehaviorEvent['payload'] = {}): BehaviorEvent => ({ id: Math.random().toString(36), type, agentId: null, payload, occurredAt: at })

describe('Observe', () => {
  it('logs task, focus, check-in and journal events from normal app use', () => {
    const stop = startObserver()
    S().completeTask('task_assign_agent')
    S().saveCheckIn({ energy: 35 })
    S().startFocus(null, 'deep work', 15)
    S().completeFocus()
    S().addJournal({ content: 'วันนี้ดี', type: 'reflection' })
    S().postponeTask('task_prompt_agent', '2026-11-26')
    stop()
    const types = C().events.map((e) => e.type)
    expect(types).toEqual(expect.arrayContaining(['task.completed', 'checkin.saved', 'focus.completed', 'journal.added', 'task.postponed']))
    expect(C().events.find((e) => e.type === 'focus.completed')?.payload.plannedMinutes).toBe(15)
    expect(C().sync.outbox.length).toBe(C().events.length)
  })
})

describe('Analyze', () => {
  it('finds the time of day when tasks get done', () => {
    // 10 completions, 7 of them at 23:00 Bangkok (16:00 UTC)
    const events = [
      ...Array.from({ length: 7 }, (_, i) => ev('task.completed', `2026-11-${10 + i}T16:00:00Z`)),
      ...Array.from({ length: 3 }, (_, i) => ev('task.completed', `2026-11-${10 + i}T02:00:00Z`)),
    ]
    const d = productiveTime({ events, tasks: [], timezone: 'Asia/Bangkok', now })
    expect(d[0].signalKey).toBe('timing.night')
  })
  it('needs enough data before saying anything', () => {
    expect(productiveTime({ events: [ev('task.completed', '2026-11-20T16:00:00Z')], tasks: [], timezone: 'Asia/Bangkok', now })).toEqual([])
  })
  it('prefers the focus length that actually gets finished', () => {
    const events = [
      ...Array.from({ length: 4 }, (_, i) => ev('focus.completed', `2026-11-${10 + i}T02:00:00Z`, { plannedMinutes: 15 })),
      ...Array.from({ length: 4 }, (_, i) => ev('focus.stopped', `2026-11-${10 + i}T03:00:00Z`, { plannedMinutes: 60 })),
    ]
    expect(focusLength({ events, tasks: [], timezone: 'Asia/Bangkok', now })[0].signalKey).toBe('focus.len.short')
  })
  it('flags tasks postponed 3+ times', () => {
    const t = { ...S().tasks[0], postponementCount: 4, status: 'todo' as const }
    expect(stuckTasks({ events: [], tasks: [t], timezone: 'Asia/Bangkok', now })[0].signalKey).toBe(`task.stuck.${t.id}`)
  })
})

describe('Recommend → Human approval → Evaluate → Learn', () => {
  const draft: RecommendationDraft = { agentId: 'core', signalKey: 'focus.len.short', title: 't', body: 'b', rationale: 'r', learnedMemory: 'โฟกัสได้ดีกับรอบสั้น' }

  it('does not repeat an open recommendation, and respects cooldown', () => {
    const r = C().addRecommendation(draft)
    expect(selectRecommendations([draft], C().recommendations, {}, now)).toHaveLength(0)
    C().decide(r.id, false)
    expect(selectRecommendations([draft], C().recommendations, {}, now)).toHaveLength(0)
    expect(selectRecommendations([draft], C().recommendations, {}, new Date(now.getTime() + 8 * 86_400_000))).toHaveLength(1)
  })

  it('a helpful outcome proposes a memory that only becomes active after approval', () => {
    const r = C().addRecommendation(draft)
    C().decide(r.id, true)
    expect(dueForEvaluation(C().recommendations, now)).toHaveLength(0)
    now = new Date(now.getTime() + 4 * 86_400_000)
    expect(dueForEvaluation(C().recommendations, now)).toHaveLength(1)
    C().evaluate(r.id, true)
    const m = C().memories.find((x) => x.content === 'โฟกัสได้ดีกับรอบสั้น')!
    expect(m.status).toBe('proposed')
    expect(buildAgentContext().memories).toHaveLength(0) // not used until approved
    C().updateMemory(m.id, { status: 'active' })
    expect(buildAgentContext().memories).toEqual([{ kind: 'pattern', content: 'โฟกัสได้ดีกับรอบสั้น' }])
  })

  it('learns to stop suggesting what does not work for this person', () => {
    const mk = (status: CoreRecommendation['status'], outcome: CoreRecommendation['outcome']): CoreRecommendation => ({
      id: Math.random().toString(36), agentId: 'core', signalKey: 'timing.morning', title: '', body: '', rationale: '', status, outcome,
      createdAt: '2026-10-01T00:00:00Z', decidedAt: '2026-10-01T00:00:00Z', evaluatedAt: null, updatedAt: '2026-10-01T00:00:00Z', deletedAt: null,
    })
    const recs = [mk('dismissed', null), mk('dismissed', null), mk('evaluated', 'not_helpful'), mk('evaluated', 'not_helpful')]
    const w = computeWeights(recs)
    expect(w['timing.morning'].weight).toBeLessThan(0.3)
    expect(selectRecommendations([{ ...draft, signalKey: 'timing.morning' }], recs, w, now)).toHaveLength(0)
    const good = computeWeights([mk('evaluated', 'helpful'), mk('evaluated', 'helpful')])
    expect(good['timing.morning'].weight).toBeGreaterThan(0.75)
  })
})

describe('Memory is editable and deletable by the user', () => {
  it('edits and soft-deletes (so deletion syncs to other devices)', () => {
    const m = C().addMemory({ content: 'ลูกตื่น 6 โมง' })
    C().updateMemory(m.id, { content: 'ลูกตื่น 6 โมงครึ่ง' })
    expect(C().memories[0].content).toBe('ลูกตื่น 6 โมงครึ่ง')
    C().deleteMemory(m.id)
    expect(C().memories[0].deletedAt).not.toBeNull()
    expect(C().memories[0].content).toBe('')
    expect(C().sync.dirtyMemories).toContain(m.id)
  })
  it('merges cloud rows without overwriting unsynced local edits', () => {
    const m = C().addMemory({ content: 'local' })
    C().mergeRemote({ memories: [{ ...m, content: 'remote', updatedAt: '2030-01-01T00:00:00Z' }] })
    expect(C().memories[0].content).toBe('local')
    C().markPushed({ memories: [m.id] })
    C().mergeRemote({ memories: [{ ...m, content: 'remote', updatedAt: '2030-01-01T00:00:00Z' }] })
    expect(C().memories[0].content).toBe('remote')
  })
})
