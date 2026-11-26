import { beforeEach, describe, expect, it } from 'vitest'
import { resetStore, S } from './helpers'
import { mockContext } from '../orchestration/sources/mock'
import { buildQueue, dispatchFor, morningBriefing, pickForWindow, rescuePlan, weeklySynthesis, type Queue } from '../orchestration/roles/j'
import { assessCapacity } from '../orchestration/roles/bloom'
import { assertBecomingOutput, makeEvent, markDelivered, pendingEvents } from '../orchestration/writeback'
import { answer, delayItems, sendOutbox, suggestToCompany } from '../orchestration/useOrchestration'
import { emptyOrchestration, type AttentionItem, type OrchestrationState, type PersonalContext } from '../orchestration/types'
import { exportBackup, validateData } from '../store/backup'
import { pickDomain } from '../store/state'

const TODAY = '2026-11-25'
const NOW = new Date('2026-11-25T02:00:00.000Z')

function personal(p: Partial<PersonalContext> = {}): PersonalContext {
  return {
    date: TODAY,
    nowMin: 9 * 60,
    energy: 70,
    availableMinutes: 60,
    circumstance: 'normal',
    familyCommitments: [],
    essentialMinutesLeft: 0,
    recoveryThreshold: 30,
    lowEffortThreshold: 50,
    ...p,
  }
}

const ctx = () => mockContext(TODAY, NOW)
const queue = (p: Partial<PersonalContext> = {}, state: OrchestrationState = emptyOrchestration()): Queue => buildQueue({ ctx: ctx(), personal: personal(p), state })
const keys = (items: AttentionItem[]) => items.map((i) => i.key)

describe('Business sources (mock adapter)', () => {
  it('loads all four sources and keeps a SourceRef on every record', () => {
    const c = ctx()
    expect(c.adapter).toBe('mock')
    expect(c.companyTasks.length).toBeGreaterThan(5)
    expect(c.ideas.length).toBeGreaterThan(0)
    expect(c.life.items.length).toBeGreaterThan(0)
    expect(c.ceoReview).not.toBeNull()
    for (const t of c.companyTasks) {
      expect(t.ref.source).toBe('company_tasks')
      expect(t.ref.externalId).toBeTruthy()
    }
    // relative due dates resolve against today
    expect(c.companyTasks.find((t) => t.ref.externalId === 'ct-201')?.dueDate).toBe('2026-11-26')
  })

  it('every company task has one of the three work modes', () => {
    for (const t of ctx().companyTasks) expect(['action', 'review', 'decision']).toContain(t.mode)
  })
})

describe('J dispatch rules', () => {
  it('routes each source / work mode to the specified roles', () => {
    expect(dispatchFor('company_tasks', 'action')).toMatchObject({ primary: ['spark'], support: ['bloom'] })
    expect(dispatchFor('company_tasks', 'review')).toMatchObject({ primary: ['atlas'], support: ['nexus'] })
    expect(dispatchFor('company_tasks', 'decision')).toMatchObject({ primary: ['atlas'], support: ['nexus'] })
    expect(dispatchFor('company_tasks', 'decision', { affectsCapacity: true }).support).toEqual(['nexus', 'bloom'])
    expect(dispatchFor('idea_lab')).toMatchObject({ primary: ['muse', 'atlas'], support: ['nexus'] })
    expect(dispatchFor('life_os')).toMatchObject({ primary: ['bloom', 'spark'], support: ['nexus'] })
    expect(dispatchFor('ceo_review')).toMatchObject({ primary: ['j', 'atlas', 'bloom'], support: ['nexus'] })
  })

  it('ideas are never dispatched to Spark', () => {
    const q = queue()
    for (const i of q.byType.think) expect(i.dispatch.primary).not.toContain('spark')
  })
})

describe('Attention queue', () => {
  it('only surfaces items that are Ready for BECOMING', () => {
    const q = queue()
    expect(keys(q.items)).not.toContain('company_tasks:ct-104')
  })

  it('maps work modes to DO / REVIEW / DECIDE and the rest to THINK / LIFE', () => {
    const q = queue()
    expect(q.byType.do.every((i) => i.type === 'do' && i.task.mode === 'action')).toBe(true)
    expect(q.byType.review.every((i) => i.type === 'review' && i.task.mode === 'review')).toBe(true)
    expect(q.byType.decide.every((i) => i.type === 'decide' && i.task.mode === 'decision')).toBe(true)
    expect(q.byType.think.length).toBeGreaterThan(0)
    expect(q.byType.life.length).toBeGreaterThan(0)
    // parked ideas stay out
    expect(keys(q.byType.think)).not.toContain('idea_lab:idea-4')
  })

  it('a Review keeps the original output and its link, and asks structured questions', () => {
    const r = queue().byType.review.find((i) => i.key === 'company_tasks:ct-201')!
    expect(r.type).toBe('review')
    if (r.type !== 'review') return
    expect(r.frame.original).toContain('แม่ที่ขายของออนไลน์')
    expect(r.frame.originalUrl).toContain('market-research')
    expect(r.frame.keyPoints).toHaveLength(3)
    expect(r.frame.possibleMismatch.length).toBeGreaterThan(0)
    expect(r.frame.questions.length).toBeGreaterThan(0)
  })

  it('a Decision shows question, options, recommendation, risks, impact, deadline and what happens next', () => {
    const d = queue().byType.decide.find((i) => i.key === 'company_tasks:ct-301')!
    if (d.type !== 'decide') throw new Error('not a decision')
    expect(d.frame.question).toBeTruthy()
    expect(d.frame.options.length).toBe(3)
    expect(d.frame.recommendation.optionId).toBe('a')
    expect(d.frame.risks.length).toBeGreaterThan(0)
    expect(d.frame.impact.length).toBeGreaterThan(0)
    expect(d.frame.deadline).toBe('2026-11-27')
    expect(d.frame.next).toBeTruthy()
    // affects capacity → Bloom adds the impact
    expect(d.frame.capacityImpact).toContain('Bloom')
    expect(d.dispatch.support).toContain('bloom')
  })

  it('Bloom lowers the workload limit when energy is low but does not reorder business priority', () => {
    const strong = queue({ energy: 90, availableMinutes: 120 })
    const tired = queue({ energy: 20, availableMinutes: 30 })
    expect(strong.capacity.workloadLimit).toBeGreaterThan(tired.capacity.workloadLimit)
    expect(tired.capacity.level).toBe('recovery')
    // same business items are present either way
    const biz = (q: Queue) => keys([...q.byType.do, ...q.byType.review, ...q.byType.decide]).sort()
    expect(biz(tired)).toEqual(biz(strong))
  })

  it('Bloom flags overload when waiting work far exceeds today’s focus time', () => {
    const c = assessCapacity(ctx(), personal({ availableMinutes: 15 }))
    expect(c.overload).toBe(true)
    expect(c.warning).toBeTruthy()
  })
})

describe('Free time (I Have a Moment) — never invents business work', () => {
  it('30 minutes → checks Decision, then Review, then Action', () => {
    const q = queue({ availableMinutes: 30 })
    const p1 = pickForWindow(q, 30)
    expect(p1.item?.type).toBe('decide')
    const p2 = pickForWindow(q, 30, keys(q.byType.decide))
    expect(p2.item?.type).toBe('review')
    const p3 = pickForWindow(q, 30, [...keys(q.byType.decide), ...keys(q.byType.review)])
    expect(p3.item?.type).toBe('do')
    expect(p3.item!.minutes).toBeLessThanOrEqual(30)
  })

  it('when nothing fits, Spark slices an existing Action into a micro step (not a new task)', () => {
    const q = queue()
    const notDo = q.items.filter((i) => i.type !== 'do').map((i) => i.key)
    const smallDo = q.byType.do.filter((i) => i.minutes <= 5).map((i) => i.key)
    const p = pickForWindow(q, 5, [...notDo, ...smallDo])
    expect(p.item).toBeNull()
    expect(p.microStep).not.toBeNull()
    expect(p.microStep!.basedOn.type).toBe('do')
    expect(p.microStep!.minutes).toBeLessThanOrEqual(15)
  })

  it('with no business work left it offers Life / Reflection instead', () => {
    const q = queue()
    const biz = q.items.filter((i) => i.type === 'do' || i.type === 'review' || i.type === 'decide').map((i) => i.key)
    const p = pickForWindow(q, 30, biz)
    expect(['life', 'think']).toContain(p.item?.type)
  })
})

describe('Morning Briefing', () => {
  it('has capacity, business attention, thinking, life and J’s two picks', () => {
    const b = morningBriefing(queue())
    expect(b.capacity.focusMinutes).toBe(60)
    expect(b.business.decide.length).toBeGreaterThan(0)
    expect(b.business.review.length).toBeGreaterThan(0)
    expect(b.business.do.length).toBeGreaterThan(0)
    expect(b.thinking.idea).not.toBeNull()
    expect(b.thinking.question).toBeTruthy()
    expect(b.life.length).toBeGreaterThan(0)
    expect(b.picks.length).toBe(2)
    expect(b.recommendation).toContain('วันนี้ถ้าทำได้เพียง 2 เรื่อง ฉันเลือก')
  })

  it('on a recovery day J picks rest first', () => {
    const b = morningBriefing(queue({ energy: 15 }))
    expect(b.picks[0].type).toBe('life')
  })
})

describe('Rescue Mode', () => {
  it('builds a minimum viable day: Must / Should / Could / Delay / Recovery', () => {
    const r = rescuePlan({ ctx: ctx(), personal: personal(), state: emptyOrchestration(), minutes: 30, energy: 55 })
    expect(r.must).not.toBeNull()
    expect(r.must!.minutes).toBeLessThanOrEqual(30)
    const used = [r.must, r.should, r.could].filter(Boolean).reduce((a, i) => a + i!.minutes, 0)
    expect(used).toBeLessThanOrEqual(30)
    expect(r.delay.length).toBeGreaterThan(0)
    expect(r.recovery.text).toBeTruthy()
    expect(r.split.action + r.split.review + r.split.decision).toBeGreaterThan(0)
  })

  it('with 0 minutes everything business is delayed and Must is a life item', () => {
    const r = rescuePlan({ ctx: ctx(), personal: personal(), state: emptyOrchestration(), minutes: 0, energy: 20 })
    expect(r.should).toBeNull()
    expect(r.must?.type).toBe('life')
    const biz = queue().items.filter((i) => i.type === 'do' || i.type === 'review' || i.type === 'decide')
    expect(r.delay.length).toBe(biz.length)
  })

  it('a critical item due today becomes Must', () => {
    const c = ctx()
    c.companyTasks.find((t) => t.ref.externalId === 'ct-102')!.dueDate = TODAY
    c.companyTasks.find((t) => t.ref.externalId === 'ct-201')!.dueDate = '2026-12-20'
    const r = rescuePlan({ ctx: c, personal: personal(), state: emptyOrchestration(), minutes: 30, energy: 60 })
    expect(r.must?.key).toBe('company_tasks:ct-102')
  })
})

describe('Weekly CEO Review synthesis', () => {
  it('returns moved / stalled / decisions / stop / continue / capacity / 1–3 priorities', () => {
    const w = weeklySynthesis(ctx(), queue(), [])!
    expect(w.moved.length).toBeGreaterThan(0)
    expect(w.stalled.length).toBeGreaterThan(0)
    expect(w.needsDecision.length).toBeGreaterThan(0)
    expect(w.stop.length).toBeGreaterThan(0)
    expect(w.continue.length).toBeGreaterThan(0)
    expect(w.capacityReality).toBeTruthy()
    expect(w.priorities.length).toBeGreaterThanOrEqual(1)
    expect(w.priorities.length).toBeLessThanOrEqual(3)
    // the mock week had a sick child → Bloom trims to 2
    expect(w.priorities.length).toBe(2)
  })
})

describe('Guardrails', () => {
  it('BECOMING cannot create a committed business task', () => {
    expect(() => assertBecomingOutput('task')).toThrow()
    expect(() => assertBecomingOutput('committed_task')).toThrow()
    for (const k of ['life_action', 'reflection', 'suggestion', 'micro_step', 'execution_step', 'recommendation']) expect(() => assertBecomingOutput(k)).not.toThrow()
  })

  it('every BECOMING-generated attention item uses an allowed output kind', () => {
    for (const i of queue({ energy: 20 }).items.filter((x) => x.origin === 'becoming')) expect(() => assertBecomingOutput(i.outputKind ?? '')).not.toThrow()
  })

  it('a decision event must carry the chosen option', () => {
    expect(() => makeEvent({ target: null, title: 'x', payload: { kind: 'decision', optionId: '', optionLabel: '', note: '', decidedOn: TODAY, question: '', context: '' }, now: NOW, localDate: TODAY })).toThrow()
  })
})

describe('Write-back (store)', () => {
  beforeEach(() => {
    resetStore()
  })
  const item = (key: string, p: Partial<PersonalContext> = {}) => queue(p, S().orchestration).items.find((i) => i.key === key)!

  it('Action done → event for the original record, item leaves the queue, no local task created', async () => {
    const tasksBefore = S().tasks.length
    const it = item('company_tasks:ct-103')
    answer(it, { kind: 'action', outcome: 'done', note: '' })
    const e = S().orchestration.events.at(-1)!
    expect(e.target?.externalId).toBe('ct-103')
    expect(e.payload).toMatchObject({ kind: 'action', outcome: 'done' })
    expect(keys(queue({}, S().orchestration).items)).not.toContain('company_tasks:ct-103')
    expect(S().tasks.length).toBe(tasksBefore)
    await sendOutbox()
    expect(S().orchestration.events.at(-1)!.delivery).toBe('sent')
  })

  it('Action deferred hides it today and brings it back tomorrow', () => {
    answer(item('company_tasks:ct-102'), { kind: 'action', outcome: 'deferred', note: '' })
    expect(keys(queue({}, S().orchestration).items)).not.toContain('company_tasks:ct-102')
    expect(keys(queue({ date: '2026-11-26' }, S().orchestration).items)).toContain('company_tasks:ct-102')
  })

  it('Review feedback and Decision context are stored for the source', () => {
    answer(item('company_tasks:ct-201'), { kind: 'review', outcome: 'revise', feedback: 'อยากเห็นตัวเลขจริง' })
    const d = item('company_tasks:ct-302')
    if (d.type !== 'decide') throw new Error('not a decision')
    answer(d, { kind: 'decision', optionId: 'a', optionLabel: 'Calm Power', note: 'ตรงกับตัวเรา', decidedOn: TODAY, question: d.frame.question, context: d.task.decision!.context })
    const [rev, dec] = S().orchestration.events.slice(-2)
    expect(rev.payload).toMatchObject({ kind: 'review', outcome: 'revise', feedback: 'อยากเห็นตัวเลขจริง' })
    expect(dec.payload).toMatchObject({ kind: 'decision', optionId: 'a', decidedOn: TODAY })
    expect(dec.target?.url).toContain('brand-direction')
    // Nexus learns: next review shows Eve's past feedback as a preference
    const next = item('company_tasks:ct-202')
    expect(next.context?.preferences.join(' ')).toContain('อยากเห็นตัวเลขจริง')
  })

  it('Idea commit only requests a commit from the AI Company', () => {
    const tasksBefore = S().tasks.length
    answer(item('idea_lab:idea-3'), { kind: 'idea', outcome: 'commit' })
    expect(keys(queue({}, S().orchestration).items)).not.toContain('idea_lab:idea-3')
    expect(S().tasks.length).toBe(tasksBefore)
    expect(S().orchestration.events.at(-1)!.payload).toMatchObject({ kind: 'idea', outcome: 'commit' })
  })

  it('Life done counts for today only', () => {
    answer(item('life_os:life-2'), { kind: 'life', outcome: 'done', note: '' })
    expect(keys(queue({}, S().orchestration).items)).not.toContain('life_os:life-2')
    expect(keys(queue({ date: '2026-11-26' }, S().orchestration).items)).toContain('life_os:life-2')
  })

  it('business suggestions are stored with Suggestion status and sent back', async () => {
    suggestToCompany({ title: 'ทำ mini-course ฟรี', rationale: 'Muse เสนอ', proposedBy: 'muse' })
    expect(S().orchestration.suggestions[0].status).toBe('suggestion')
    await sendOutbox()
    expect(S().orchestration.suggestions[0].status).toBe('sent')
    expect(pendingEvents(S().orchestration)).toHaveLength(0)
  })

  it('Rescue delay snoozes items and reports deferred Actions', () => {
    const q = queue({}, S().orchestration)
    delayItems([q.byType.do[0], q.byType.review[0]])
    const evs = S().orchestration.events
    expect(evs.filter((e) => e.payload.kind === 'action' && e.payload.outcome === 'deferred')).toHaveLength(1)
    expect(Object.keys(S().orchestration.snoozed)).toHaveLength(2)
  })

  it('orchestration state survives backup export / import', () => {
    answer(item('company_tasks:ct-103'), { kind: 'action', outcome: 'done', note: '' })
    const file = exportBackup(pickDomain(S()))
    const back = validateData(JSON.stringify(file))
    expect(back.ok).toBe(true)
    expect(back.data!.orchestration.events).toHaveLength(1)
  })

  it('markDelivered leaves failed events in the outbox', () => {
    const e = makeEvent({ target: null, title: 'x', payload: { kind: 'life', outcome: 'done', note: '' }, now: NOW, localDate: TODAY })
    const s = markDelivered({ ...emptyOrchestration(), events: [e] }, [], [e.id], NOW)
    expect(pendingEvents(s)).toHaveLength(1)
    expect(s.events[0].delivery).toBe('failed')
  })
})

describe('Notion source (client side)', () => {
  beforeEach(() => {
    resetStore()
  })

  it('shows no business items (never demo data) with a reason when Notion is not reachable', async () => {
    const { loadContext } = await import('../orchestration/sources')
    const r = await loadContext(TODAY, NOW)
    expect(r.ctx.adapter).toBe('none')
    expect(r.ctx.companyTasks).toEqual([])
    expect(r.ctx.ideas).toEqual([])
    expect(r.status.adapter).toBe('none')
    expect(r.status.fallback?.reason).toBeTruthy()
  })

  it('uses demo data only when Eve chooses it', async () => {
    const { loadContext, setSourcePreference } = await import('../orchestration/sources')
    setSourcePreference('mock')
    try {
      const r = await loadContext(TODAY, NOW)
      expect(r.status).toEqual({ adapter: 'mock', fallback: null })
      expect(r.ctx.companyTasks.length).toBeGreaterThan(0)
    } finally {
      setSourcePreference('auto')
    }
  })

  it('answers about Notion records wait in the outbox until Notion is reachable', async () => {
    const { useSources } = await import('../orchestration/useOrchestration')
    useSources.setState({ ctx: { ...ctx(), adapter: 'notion' }, status: { adapter: 'mock', fallback: null } })
    answer(queue({}, S().orchestration).byType.do[0], { kind: 'action', outcome: 'done', note: '' })
    const e = S().orchestration.events.at(-1)!
    expect(e.via).toBe('notion')
    await sendOutbox()
    expect(S().orchestration.events.at(-1)!.delivery).toBe('pending')
    useSources.setState({ ctx: null, status: null })
  })
})
