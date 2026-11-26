import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { useStore } from '../store/useStore'
import { useToday } from '../hooks/useToday'
import { useCore } from '../intelligence/useCore'
import { addDays } from '../utils/date'
import type { DayItem } from '../engine/scheduling/day'
import type { AttentionItem, BusinessContext, PersonalContext, RoleId, SourceRef, WriteBackPayload } from './types'
import { loadContext, sinkFor, type SourceStatus } from './sources'
import { buildQueue, type Queue } from './roles/j'
import { makeEvent, makeSuggestion, markDelivered, pendingEvents, recordEvent } from './writeback'

// ── Business context (read from the AI Company; not persisted — the source is the truth) ──

interface SourcesState {
  ctx: BusinessContext | null
  status: SourceStatus | null
  loading: boolean
  error: string | null
  load: (today: string) => Promise<void>
}

export const useSources = create<SourcesState>((set, get) => ({
  ctx: null,
  status: null,
  loading: false,
  error: null,
  load: async (today) => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const { ctx, status } = await loadContext(today, new Date())
      set({ ctx, status, loading: false })
      // answers waiting for this source can go now
      void sendOutbox()
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) })
    }
  },
}))

/** Personal context from BECOMING's own data (check-in, routines, family). */
export function personalContext(args: {
  date: string
  nowMin: number
  checkIn: { energy: number; availableMinutes: number; circumstances: PersonalContext['circumstance'] } | undefined
  items: DayItem[]
  familyCommitments: string[]
  thresholds: { recovery: number; lowEffort: number }
}): PersonalContext {
  const essentialMinutesLeft = args.items
    .filter((i) => i.block.essential && i.entry.status === 'pending' && (i.start === null || i.start >= args.nowMin) && i.block.category !== 'sleep')
    .reduce((a, i) => a + i.block.duration, 0)
  return {
    date: args.date,
    nowMin: args.nowMin,
    energy: args.checkIn?.energy ?? null,
    availableMinutes: args.checkIn?.availableMinutes ?? null,
    circumstance: args.checkIn?.circumstances ?? 'normal',
    familyCommitments: args.familyCommitments,
    essentialMinutesLeft,
    recoveryThreshold: args.thresholds.recovery,
    lowEffortThreshold: args.thresholds.lowEffort,
  }
}

/** Everything a screen needs: business context + personal context + J's queue. */
export function useAttention(): { ctx: BusinessContext | null; personal: PersonalContext; queue: Queue | null; loading: boolean; error: string | null } {
  const { date, nowMin, checkIn, items } = useToday()
  const { ctx, loading, error, load } = useSources()
  const orchestration = useStore((s) => s.orchestration)
  const family = useStore((s) => s.profile.preferences.familyCommitments)
  const thresholds = useStore((s) => s.settings.energyThresholds)
  const memories = useCore((c) => c.memories)
  useEffect(() => {
    if (!ctx && !loading && !error) void load(date)
  }, [ctx, loading, error, load, date])
  const personal = useMemo(
    () => personalContext({ date, nowMin: Math.floor(nowMin / 15) * 15, checkIn, items, familyCommitments: family, thresholds }),
    [date, nowMin, checkIn, items, family, thresholds],
  )
  const queue = useMemo(() => {
    if (!ctx) return null
    const mem = memories.filter((m) => !m.deletedAt && m.status === 'active').map((m) => ({ kind: m.kind, content: m.content }))
    return buildQueue({ ctx, personal, state: orchestration, memories: mem })
  }, [ctx, personal, orchestration, memories])
  return { ctx, personal, queue, loading, error }
}

// ── Actions (write-back) ─────────────────────────────────────────────────────

const st = () => useStore.getState()
const currentVia = () => useSources.getState().ctx?.adapter ?? 'mock'
const setOrch = (fn: (o: ReturnType<typeof st>['orchestration']) => ReturnType<typeof st>['orchestration']) =>
  useStore.setState((s) => ({ orchestration: fn(s.orchestration) }))

let sending: Promise<void> | null = null
/** Deliver pending events to the source adapter (mock acknowledges immediately). */
export function sendOutbox(): Promise<void> {
  if (sending) return sending
  sending = (async () => {
    try {
      const pending = pendingEvents(st().orchestration)
      if (pending.length === 0) return
      const live = useSources.getState().status?.adapter ?? null
      const groups = new Map<string, typeof pending>()
      for (const e of pending) {
        const via = e.via ?? 'mock'
        // Notion answers wait in the outbox until Notion is reachable again
        if (via === 'notion' && live !== 'notion') continue
        groups.set(via, [...(groups.get(via) ?? []), e])
      }
      for (const [via, evs] of groups) {
        const r = await sinkFor(via).deliver(evs)
        setOrch((o) => markDelivered(o, r.sent, r.failed, st().now()))
      }
    } finally {
      sending = null
    }
  })()
  return sending
}

const XP_FOR: Partial<Record<WriteBackPayload['kind'], number>> = { action: 10, review: 10, decision: 15, life: 10, idea: 5 }

/** Eve answers an attention item. Stored as an event for the original source (spec §10). */
export function answer(item: AttentionItem, payload: WriteBackPayload): void {
  const s = st()
  const now = s.now()
  const today = s.today()
  const e = { ...makeEvent({ target: item.ref, title: item.title, payload, now, localDate: today }), via: currentVia() }
  setOrch((o) => {
    let next = recordEvent(o, e)
    if (payload.kind === 'action' && payload.outcome === 'deferred') next = { ...next, snoozed: { ...next.snoozed, [item.key]: addDays(today, 1) } }
    return next
  })
  const positive =
    (payload.kind === 'action' && payload.outcome === 'done') ||
    payload.kind === 'review' ||
    payload.kind === 'decision' ||
    (payload.kind === 'life' && payload.outcome === 'done') ||
    payload.kind === 'idea'
  const xp = XP_FOR[payload.kind]
  if (positive && xp) s.awardEvent(`attn:${item.key}:${payload.kind}:${today}`, xp, item.title)
  void sendOutbox()
}

/** Hide items from today (Rescue "Drop / Delay"). Action items also tell the AI Company they were deferred. */
export function delayItems(items: AttentionItem[], note = 'Rescue Mode: เลื่อนเพราะเวลาไม่พอ'): void {
  const s = st()
  const now = s.now()
  const today = s.today()
  const until = addDays(today, 1)
  setOrch((o) => {
    let next = { ...o, snoozed: { ...o.snoozed } }
    for (const it of items) {
      next.snoozed[it.key] = until
      if (it.type === 'do') next = recordEvent(next, { ...makeEvent({ target: it.ref, title: it.title, payload: { kind: 'action', outcome: 'deferred', note }, now, localDate: today }), via: currentVia() })
    }
    return next
  })
  void sendOutbox()
}

/** A new business idea from BECOMING. Never a task: it is a Suggestion sent back to the AI Company. */
export function suggestToCompany(args: { title: string; rationale: string; proposedBy: RoleId; relatedTo?: SourceRef | null }): void {
  const s = st()
  const now = s.now()
  const sg = makeSuggestion({ ...args, relatedTo: args.relatedTo ?? null, now })
  const e = { ...makeEvent({ target: args.relatedTo ?? null, title: sg.title, payload: { kind: 'suggestion', suggestion: sg }, now, localDate: s.today() }), via: currentVia() }
  setOrch((o) => ({ ...recordEvent(o, e), suggestions: [...o.suggestions, sg] }))
  void sendOutbox()
}

export function reloadSources(): Promise<void> {
  useSources.setState({ ctx: null, status: null, error: null })
  return useSources.getState().load(st().today())
}
