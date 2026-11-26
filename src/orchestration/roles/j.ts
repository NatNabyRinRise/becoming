import type {
  AttentionItem,
  AttentionType,
  BusinessContext,
  Capacity,
  CompanyTask,
  DispatchPlan,
  LabIdea,
  LifeItem,
  LocalDate,
  OrchestrationState,
  PersonalContext,
  SourceId,
  SourceRef,
  WorkMode,
  WriteBackEvent,
} from '../types'
import { assessCapacity, decisionCapacityImpact } from './bloom'
import { activate, microStepFor } from './spark'
import { challengeIdea, frameDecision, frameReview } from './atlas'
import { expandIdea } from './muse'
import { contextPack, type NexusMemory } from './nexus'

/**
 * J — Chief of Staff. Orchestrator / Dispatcher / Synthesizer.
 * J reads business + personal context, dispatches each item to the right
 * specialists, merges what they return and orders Eve's attention.
 * J never creates business priority, never changes scope, never commits business tasks.
 */

export const refKey = (r: SourceRef) => `${r.source}:${r.externalId}`

// ── Dispatch rules (spec §5) ────────────────────────────────────────────────

export function dispatchFor(source: SourceId, mode?: WorkMode, opts: { affectsCapacity?: boolean; creative?: boolean } = {}): DispatchPlan {
  if (source === 'company_tasks' && mode === 'action')
    return { primary: ['spark'], support: ['bloom'], flow: ['J', 'Bloom ตรวจ Capacity', 'Spark แตกเป็น Action', 'J นำเสนอ Eve'] }
  if (source === 'company_tasks' && mode === 'review')
    return {
      primary: ['atlas'],
      support: opts.creative ? ['nexus', 'muse'] : ['nexus'],
      flow: ['J', 'Atlas ตรวจ Strategic Fit', 'Nexus ดึง Context / Preference / Decision เก่า', 'J สรุปสิ่งที่ Eve ต้องอ่าน', 'Eve ให้ Feedback', 'Feedback ส่งกลับ AI Company'],
    }
  if (source === 'company_tasks' && mode === 'decision')
    return {
      primary: ['atlas'],
      support: opts.affectsCapacity ? ['nexus', 'bloom'] : ['nexus'],
      flow: ['J', 'Atlas สร้าง Decision Frame', 'Nexus ดึง Context', ...(opts.affectsCapacity ? ['Bloom ตรวจ Impact'] : []), 'J นำเสนอ Eve'],
    }
  if (source === 'idea_lab')
    return { primary: ['muse', 'atlas'], support: ['nexus'], flow: ['Idea', 'Muse Expand', 'Atlas Challenge', 'Nexus เติม Context', 'J สรุป'] }
  if (source === 'life_os') return { primary: ['bloom', 'spark'], support: ['nexus'], flow: ['J', 'Bloom ดู Capacity / Routine', 'Spark ชวนลงมือ', 'J นำเสนอ Eve'] }
  // ceo_review
  return { primary: ['j', 'atlas', 'bloom'], support: ['nexus'], flow: ['J', 'Atlas อ่านสิ่งที่ขยับ/ค้าง', 'Bloom เทียบกับ Capacity จริง', 'Nexus เติม Context', 'J สรุป Weekly Focus'] }
}

// ── Local outcomes: Eve's answers already given in BECOMING ────────────────

export interface ResolvedState {
  /** Business item closed from BECOMING's side (done, blocked, reviewed, decided, idea parked…). */
  closed: Set<string>
  /** Idea key → stage after Eve's answer. */
  ideaStage: Map<string, LabIdea['stage']>
  /** Life items answered today. */
  lifeToday: Set<string>
}

export function resolveOutcomes(events: WriteBackEvent[], today: LocalDate): ResolvedState {
  const closed = new Set<string>()
  const ideaStage = new Map<string, LabIdea['stage']>()
  const lifeToday = new Set<string>()
  for (const e of events) {
    if (!e.target) continue
    const k = refKey(e.target)
    const p = e.payload
    if (p.kind === 'action') {
      if (p.outcome === 'deferred') continue // handled by snooze
      closed.add(k)
    } else if (p.kind === 'review' || p.kind === 'decision') closed.add(k)
    else if (p.kind === 'idea') {
      const stage = { explore: 'expand', validate: 'validate', park: 'parked', kill: 'killed', commit: 'commit_requested' }[p.outcome] as LabIdea['stage']
      ideaStage.set(k, stage)
    } else if (p.kind === 'life' && e.localDate === today) lifeToday.add(k)
  }
  return { closed, ideaStage, lifeToday }
}

// ── Building the attention queue ────────────────────────────────────────────

const PRIORITY_SCORE = { p1: 40, p2: 25, p3: 10 } as const

function urgency(due: LocalDate | null, today: LocalDate): number {
  if (!due) return 0
  const days = Math.round((Date.parse(due) - Date.parse(today)) / 86_400_000)
  if (days <= 0) return 30
  if (days <= 1) return 22
  if (days <= 3) return 12
  if (days <= 7) return 4
  return 0
}

export function isReady(t: CompanyTask): boolean {
  return t.readyForBecoming && t.status !== 'done' && t.status !== 'cancelled'
}

export interface QueueInput {
  ctx: BusinessContext
  personal: PersonalContext
  state: OrchestrationState
  memories?: NexusMemory[]
  /** Override Bloom's capacity (Rescue recalculates it). */
  capacity?: Capacity
}

export interface Queue {
  capacity: Capacity
  items: AttentionItem[]
  byType: Record<AttentionType, AttentionItem[]>
  /** Items held back today (snoozed / Rescue-delayed). */
  held: number
}

export function buildQueue(input: QueueInput): Queue {
  const { ctx, personal: p, state } = input
  const memories = input.memories ?? []
  const capacity = input.capacity ?? assessCapacity(ctx, p)
  const outcomes = resolveOutcomes(state.events, p.date)
  const snoozed = (k: string) => (state.snoozed[k] ?? '') > p.date
  const lowEnergy = capacity.level === 'recovery' || capacity.level === 'light'
  const items: AttentionItem[] = []
  let held = 0

  for (const t of ctx.companyTasks) {
    const key = refKey(t.ref)
    if (!isReady(t) || outcomes.closed.has(key)) continue
    if (snoozed(key)) {
      held++
      continue
    }
    const nexus = contextPack({ ref: t.ref, project: t.project, events: state.events, memories })
    let score = PRIORITY_SCORE[t.priority] + urgency(t.dueDate, p.date)
    if (lowEnergy && t.effort === 'high') score -= 15
    if (t.estimatedMinutes <= capacity.focusMinutes) score += 5
    const base = { key, title: t.title, minutes: t.estimatedMinutes, ref: t.ref, origin: 'ai_company' as const, dueDate: t.dueDate, context: nexus }
    if (t.mode === 'action') {
      items.push({
        ...base,
        type: 'do',
        task: t,
        subtitle: `${t.project} · ${t.requestedBy}`,
        score,
        why: t.priority === 'p1' ? 'งานสำคัญสุดที่ต้องใช้มือเธอเอง' : 'งานที่ทีมรอให้เธอลงมือ',
        dispatch: dispatchFor('company_tasks', 'action'),
        spark: activate(t, capacity.focusMinutes, capacity),
      })
    } else if (t.mode === 'review') {
      items.push({
        ...base,
        type: 'review',
        task: t,
        subtitle: `${t.output?.agent ?? t.requestedBy} ทำมาแล้ว · รอเธออ่าน`,
        score: score + 3,
        why: 'AI ทำงานมาแล้ว รอเธอตรวจว่าตรงกับแนวคิดไหม',
        dispatch: dispatchFor('company_tasks', 'review', { creative: t.tags.includes('creative') }),
        frame: frameReview(t, ctx.ceoReview, nexus),
      })
    } else {
      const impact = t.decision?.affectsCapacity ? decisionCapacityImpact(t.decision.options, capacity.focusMinutes * 5) : null
      items.push({
        ...base,
        type: 'decide',
        task: t,
        subtitle: `${t.requestedBy} หยุดรอคำตัดสินของเธอ`,
        // decisions unblock the whole team
        score: score + 8,
        why: 'ทีมเดินต่อไม่ได้จนกว่าเธอจะตัดสินใจ',
        dispatch: dispatchFor('company_tasks', 'decision', { affectsCapacity: t.decision?.affectsCapacity }),
        frame: frameDecision(t, impact),
      })
    }
  }

  // THINK — ideas still in the lab (never sent to Spark)
  for (const idea0 of ctx.ideas) {
    const key = refKey(idea0.ref)
    const stage = outcomes.ideaStage.get(key) ?? idea0.stage
    if (!['capture', 'expand', 'validate'].includes(stage) || snoozed(key)) continue
    const idea = { ...idea0, stage }
    const muse = expandIdea(idea)
    items.push({
      key,
      type: 'think',
      title: idea.title,
      subtitle: `Idea Lab · ${STAGE_TH[stage]}`,
      minutes: 10,
      score: 8 + (stage === 'validate' ? 4 : 0),
      why: 'ไอเดียที่น่ากลับมาคิดต่อ (ยังเป็นแค่ Suggestion)',
      dispatch: dispatchFor('idea_lab'),
      ref: idea.ref,
      origin: 'ai_company',
      dueDate: null,
      context: contextPack({ ref: idea.ref, events: state.events, memories }),
      idea,
      frame: challengeIdea(idea, ctx.ceoReview, muse),
    })
  }
  if (ctx.ceoReview?.strategicQuestion) {
    items.push({
      key: `${refKey(ctx.ceoReview.ref)}:question`,
      type: 'think',
      title: ctx.ceoReview.strategicQuestion,
      subtitle: 'คำถามเชิงกลยุทธ์จาก Weekly CEO Review',
      minutes: 5,
      score: 6,
      why: 'คิดสั้น ๆ แล้วจดลง Journal',
      dispatch: dispatchFor('ceo_review'),
      ref: ctx.ceoReview.ref,
      origin: 'becoming',
      outputKind: 'reflection',
      dueDate: null,
      context: null,
      prompt: ctx.ceoReview.strategicQuestion,
    })
  }

  // LIFE — Discipline & Life OS + Bloom
  for (const l of ctx.life.items) {
    const key = refKey(l.ref)
    if (outcomes.lifeToday.has(key)) continue
    items.push(lifeItem(l, capacity))
  }
  if (capacity.level === 'recovery' || capacity.overload) {
    items.push({
      key: 'becoming:bloom-recovery',
      type: 'life',
      title: capacity.level === 'recovery' ? 'พักฟื้นพลัง 15 นาที' : 'พัก 5 นาทีก่อนเริ่มงานถัดไป',
      subtitle: 'Bloom แนะนำ',
      minutes: capacity.level === 'recovery' ? 15 : 5,
      score: 60,
      why: capacity.recovery,
      dispatch: dispatchFor('life_os'),
      ref: null,
      origin: 'becoming',
      outputKind: 'life_action',
      dueDate: null,
      context: null,
    })
  }

  items.sort((a, b) => b.score - a.score)
  const byType: Queue['byType'] = { do: [], review: [], decide: [], think: [], life: [] }
  for (const it of items) byType[it.type].push(it)
  return { capacity, items, byType, held }
}

const STAGE_TH: Record<LabIdea['stage'], string> = {
  capture: 'Capture',
  expand: 'Expand',
  validate: 'Validate',
  commit_requested: 'ขอ Commit แล้ว',
  committed: 'Committed',
  parked: 'พักไว้',
  killed: 'ปิดแล้ว',
}

function lifeItem(l: LifeItem, c: Capacity): AttentionItem {
  const lifeBoost = c.level === 'recovery' ? 30 : c.level === 'light' ? 12 : 0
  return {
    key: refKey(l.ref),
    type: 'life',
    title: l.title,
    subtitle: `${l.time ? `${l.time} · ` : ''}${l.essential ? 'ปกป้องไว้' : 'Discipline & Life OS'}${l.streak > 1 ? ` · ต่อเนื่อง ${l.streak} วัน` : ''}`,
    minutes: l.minutes,
    score: (l.essential ? 20 : 5) + lifeBoost + (l.kind === 'recovery' ? 3 : 0),
    why: l.note || (l.essential ? 'สิ่งที่ไม่ต่อรอง' : 'ดูแลตัวเองเพื่อไปได้ไกล'),
    dispatch: dispatchFor('life_os'),
    ref: l.ref,
    origin: 'ai_company',
    dueDate: null,
    context: null,
    life: l,
  }
}

// ── Free-time logic (spec §7) ───────────────────────────────────────────────

export interface WindowPick {
  item: AttentionItem | null
  /** Set when Spark sliced a larger Action into a micro step (BECOMING output, not a new task). */
  microStep: { title: string; minutes: number; basedOn: AttentionItem } | null
  reason: string
  /** Trace of the checks J made, in order. */
  trace: string[]
}

export function pickForWindow(q: Queue, minutes: number, exclude: string[] = []): WindowPick {
  const trace: string[] = []
  const pool = q.items.filter((i) => !exclude.includes(i.key))
  if (q.capacity.level === 'recovery' || minutes <= 0) {
    const life = pool.find((i) => i.type === 'life' && i.minutes <= Math.max(5, minutes))
    trace.push('Bloom: พลังงานต่ำ/ไม่มีเวลา → เลือกเรื่องชีวิตก่อน')
    return { item: life ?? null, microStep: null, reason: q.capacity.recovery, trace }
  }
  const fit = (t: AttentionType) => pool.filter((i) => i.type === t && i.minutes <= minutes)
  for (const [t, label] of [['decide', 'Decision'], ['review', 'Review'], ['do', 'Action']] as const) {
    const hit = fit(t)[0]
    trace.push(`มี ${label} ที่ใช้ ≤ ${minutes} นาที? ${hit ? `ใช่ — "${hit.title}"` : 'ไม่มี'}`)
    if (hit) return { item: hit, microStep: null, reason: `${hit.why} และใช้เวลา ${hit.minutes} นาที พอดีกับเวลาที่มี`, trace }
  }
  const big = pool.find((i) => i.type === 'do')
  if (big && big.type === 'do') {
    const m = microStepFor(big.task, minutes)
    trace.push(`Spark แตก "${big.title}" เป็น Micro Step ${m.minutes} นาที`)
    return { item: null, microStep: { ...m, basedOn: big }, reason: 'งานใหญ่เกินเวลา Spark แตกขั้นแรกให้ทำได้ทันที (ไม่ใช่งานใหม่)', trace }
  }
  const soft = pool.find((i) => (i.type === 'life' || i.type === 'think') && i.minutes <= minutes) ?? null
  trace.push(soft ? `ไม่มีงานธุรกิจที่พร้อม → เสนอ ${soft.type === 'life' ? 'Life' : 'Reflection / Idea'}` : 'ไม่มีอะไรต้องทำ ใช้เวลานี้พักได้เลย')
  return { item: soft, microStep: null, reason: soft ? soft.why : 'ไม่ต้องเปลี่ยนทุกช่วงว่างให้เป็นงาน', trace }
}

// ── Morning Briefing (spec §8) ──────────────────────────────────────────────

export interface MorningBriefing {
  capacity: Capacity
  business: { do: AttentionItem[]; review: AttentionItem[]; decide: AttentionItem[] }
  thinking: { idea: AttentionItem | null; question: string | null }
  life: AttentionItem[]
  picks: AttentionItem[]
  recommendation: string
}

export function morningBriefing(q: Queue): MorningBriefing {
  const c = q.capacity
  const lim = Math.max(1, c.workloadLimit)
  const business = { do: q.byType.do.slice(0, lim), review: q.byType.review.slice(0, lim), decide: q.byType.decide.slice(0, lim) }
  const idea = q.byType.think.find((i) => i.type === 'think' && !!i.idea) ?? null
  const question = q.byType.think.map((i) => (i.type === 'think' ? i.prompt : undefined)).find(Boolean) ?? null
  const life = q.byType.life.slice(0, 3)

  const picks: AttentionItem[] = []
  if (c.level === 'recovery') {
    const rest = q.byType.life[0]
    if (rest) picks.push(rest)
    const tiny = [...q.byType.decide, ...q.byType.review, ...q.byType.do].filter((i) => i.minutes <= 15).sort((a, b) => b.score - a.score)[0]
    if (tiny) picks.push(tiny)
  } else {
    let left = Math.max(c.focusMinutes, 10)
    for (const it of [...q.byType.decide, ...q.byType.review, ...q.byType.do].sort((a, b) => b.score - a.score)) {
      if (picks.length >= 2) break
      if (it.minutes <= left || picks.length === 0) {
        picks.push(it)
        left -= it.minutes
      }
    }
    if (picks.length < 2 && q.byType.life[0]) picks.push(q.byType.life[0])
  }
  const names = picks.map((p) => `"${p.title}"`)
  const recommendation =
    picks.length === 0
      ? 'วันนี้ไม่มีอะไรรอเธอเลย ใช้เวลากับตัวเองและครอบครัวได้เต็มที่'
      : `วันนี้ถ้าทำได้เพียง ${picks.length === 1 ? '1 เรื่อง' : '2 เรื่อง'} ฉันเลือก ${names.join(' และ ')}${c.level === 'recovery' ? ' เพราะพลังงานวันนี้ต่ำ Bloom ขอให้เบาไว้ก่อน' : ''}`
  return { capacity: c, business, thinking: { idea, question }, life, picks, recommendation }
}

// ── Rescue Mode (spec §9) ───────────────────────────────────────────────────

export interface RescueOutput {
  capacity: Capacity
  must: AttentionItem | null
  mustMicro: { title: string; minutes: number; basedOn: AttentionItem } | null
  should: AttentionItem | null
  could: AttentionItem | null
  delay: AttentionItem[]
  recovery: { text: string; protect: AttentionItem[] }
  split: { action: number; review: number; decision: number }
}

/** Critical = overdue/due today, or P1 due tomorrow. Everything else can move. */
export function isCritical(i: AttentionItem, today: LocalDate): boolean {
  if (i.type !== 'do' && i.type !== 'review' && i.type !== 'decide') return false
  const due = i.dueDate
  if (!due) return false
  const days = Math.round((Date.parse(due) - Date.parse(today)) / 86_400_000)
  return days <= 0 || (days <= 1 && i.task.priority === 'p1')
}

export function rescuePlan(input: QueueInput & { minutes: number; energy: number }): RescueOutput {
  // 1. Recalculate capacity with what Eve has left
  const personal = { ...input.personal, energy: input.energy, availableMinutes: input.minutes }
  const capacity = assessCapacity(input.ctx, personal)
  // 2. Only work that is Ready for BECOMING (buildQueue filters it)
  const q = buildQueue({ ...input, personal, capacity })
  const business = q.items.filter((i) => i.type === 'do' || i.type === 'review' || i.type === 'decide')
  // 3. Split by work mode
  const split = { action: q.byType.do.length, review: q.byType.review.length, decision: q.byType.decide.length }

  let left = input.minutes
  const take = (pred: (i: AttentionItem) => boolean): AttentionItem | null => {
    const hit = business.find((i) => pred(i) && i.minutes <= left && !chosen.includes(i))
    if (hit) {
      chosen.push(hit)
      left -= hit.minutes
    }
    return hit ?? null
  }
  const chosen: AttentionItem[] = []
  let must: AttentionItem | null = null
  let mustMicro: RescueOutput['mustMicro'] = null
  if (capacity.level !== 'recovery' && input.minutes > 0) {
    must = take((i) => isCritical(i, input.personal.date)) ?? take(() => true)
    if (!must) {
      const big = q.byType.do[0]
      if (big && big.type === 'do') {
        mustMicro = { ...microStepFor(big.task, input.minutes), basedOn: big }
        chosen.push(big)
        left -= mustMicro.minutes
      }
    }
  }
  const should = capacity.level === 'recovery' ? null : take(() => true)
  const could = capacity.workloadLimit >= 3 ? take(() => true) : null
  // 4. Push back everything not chosen and not critical
  const delay = business.filter((i) => !chosen.includes(i))
  // 5. Minimum viable day + Bloom's recovery
  const protect = q.byType.life.filter((i) => i.type === 'life' && (i.life?.essential || i.origin === 'becoming')).slice(0, 3)
  if (capacity.level === 'recovery' && !must && !mustMicro) must = q.byType.life[0] ?? null
  return { capacity, must, mustMicro, should, could, delay, recovery: { text: capacity.recovery, protect }, split }
}

// ── Weekly CEO Review synthesis (spec §5, J + Atlas + Bloom) ────────────────

export interface WeeklySynthesis {
  moved: string[]
  stalled: string[]
  needsDecision: string[]
  stop: string[]
  continue: string[]
  capacityReality: string
  priorities: string[]
  dispatch: DispatchPlan
}

export function weeklySynthesis(ctx: BusinessContext, q: Queue, events: WriteBackEvent[]): WeeklySynthesis | null {
  const r = ctx.ceoReview
  if (!r) return null
  const doneTitles = events.filter((e) => (e.payload.kind === 'action' && e.payload.outcome === 'done') || e.payload.kind === 'decision' || (e.payload.kind === 'review' && e.payload.outcome === 'approved')).map((e) => e.title)
  const openDecisions = q.byType.decide.map((d) => d.title)
  const decisions = [...new Set([...r.needsDecision.filter((d) => openDecisions.some((o) => o.includes(d) || d.includes(o)) || !doneTitles.some((t) => t.includes(d))), ...openDecisions])]
  // Bloom: a hard week → keep it to 2 priorities
  const hardWeek = /ป่วย|ไม่ค่อยได้|น้อย|เหนื่อย/.test(r.capacityNote) || q.capacity.level === 'recovery' || q.capacity.level === 'light'
  const maxP = hardWeek ? 2 : 3
  return {
    moved: [...r.moved, ...doneTitles.map((t) => `${t} (จาก BECOMING)`)],
    stalled: r.stalled,
    needsDecision: decisions,
    stop: r.stop,
    continue: r.continue,
    capacityReality: `${r.capacityNote}${hardWeek ? ' — Bloom แนะนำให้ตั้งเป้าแค่ 2 เรื่อง' : ''}`,
    priorities: r.priorities.slice(0, maxP),
    dispatch: dispatchFor('ceo_review'),
  }
}
