import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { uid } from '../utils/id'
import { safeStorage } from '../store/useStore'
import type { BehaviorEvent, BehaviorEventType, CoreAgentId, CoreRecommendation, Memory, MemoryKind, MemorySource, RecommendationDraft } from './types'
import { computeWeights, selectRecommendations } from './learning'
import type { AnalyzerContext } from './analyzers'
import { activeAnalyzers } from './agents'

export const CORE_STORAGE_KEY = 'becoming-core'
const MAX_LOCAL_EVENTS = 1500

export interface CoreSyncMeta {
  /** ids changed locally and not yet pushed */
  dirtyMemories: string[]
  dirtyRecs: string[]
  /** events not yet pushed */
  outbox: string[]
  lastPulledAt: string | null
}

export interface CoreData {
  memories: Memory[]
  events: BehaviorEvent[]
  recommendations: CoreRecommendation[]
  /** draft memory text attached to a recommendation, proposed when it helps */
  learnedMemoryFor: Record<string, string>
  sync: CoreSyncMeta
}

interface CoreActions {
  now: () => Date
  logEvent: (type: BehaviorEventType, payload?: BehaviorEvent['payload'], agentId?: CoreAgentId | null) => void
  addMemory: (m: { content: string; kind?: MemoryKind; source?: MemorySource; agentId?: CoreAgentId | null; status?: Memory['status']; tags?: string[] }) => Memory
  updateMemory: (id: string, p: Partial<Pick<Memory, 'content' | 'kind' | 'tags' | 'status'>>) => void
  deleteMemory: (id: string) => void
  /** Analyze + Recommend: run active analyzers and add new recommendations. Returns how many were added. */
  runAnalysis: (ctx: Omit<AnalyzerContext, 'events' | 'now'>) => number
  addRecommendation: (d: RecommendationDraft) => CoreRecommendation
  decide: (id: string, approve: boolean) => void
  evaluate: (id: string, helpful: boolean) => void
  /** Used by sync: merge rows from the cloud (last-write-wins by updatedAt). */
  mergeRemote: (p: { memories?: Memory[]; recommendations?: CoreRecommendation[]; events?: BehaviorEvent[]; pulledAt?: string }) => void
  markPushed: (p: { memories?: string[]; recs?: string[]; events?: string[] }) => void
  markAllDirty: () => void
  resetCore: () => void
}

export type CoreStore = CoreData & CoreActions

export const initialCore = (): CoreData => ({
  memories: [],
  events: [],
  recommendations: [],
  learnedMemoryFor: {},
  sync: { dirtyMemories: [], dirtyRecs: [], outbox: [], lastPulledAt: null },
})

const addUnique = (arr: string[], id: string) => (arr.includes(id) ? arr : [...arr, id])

function mergeRows<T extends { id: string; updatedAt: string }>(local: T[], remote: T[], dirty: string[]): T[] {
  const map = new Map(local.map((r) => [r.id, r]))
  for (const r of remote) {
    const l = map.get(r.id)
    // local unsynced edits win; otherwise the newer copy wins
    if (!l || (!dirty.includes(r.id) && Date.parse(r.updatedAt) >= Date.parse(l.updatedAt))) map.set(r.id, r)
  }
  return [...map.values()]
}

export const useCore = create<CoreStore>()(
  persist(
    (set, get) => {
      const nowIso = () => get().now().toISOString()
      const touchMemory = (id: string, p: Partial<Memory>) =>
        set((s) => ({
          memories: s.memories.map((m) => (m.id === id ? { ...m, ...p, updatedAt: nowIso() } : m)),
          sync: { ...s.sync, dirtyMemories: addUnique(s.sync.dirtyMemories, id) },
        }))
      const touchRec = (id: string, p: Partial<CoreRecommendation>) =>
        set((s) => ({
          recommendations: s.recommendations.map((r) => (r.id === id ? { ...r, ...p, updatedAt: nowIso() } : r)),
          sync: { ...s.sync, dirtyRecs: addUnique(s.sync.dirtyRecs, id) },
        }))

      return {
        ...initialCore(),
        now: () => new Date(),

        logEvent: (type, payload = {}, agentId = null) => {
          const e: BehaviorEvent = { id: uid('ev'), type, agentId, payload, occurredAt: nowIso() }
          set((s) => ({ events: [...s.events, e].slice(-MAX_LOCAL_EVENTS), sync: { ...s.sync, outbox: [...s.sync.outbox, e.id] } }))
        },

        addMemory: ({ content, kind = 'fact', source = 'user', agentId = null, status = 'active', tags = [] }) => {
          const at = nowIso()
          const m: Memory = { id: uid('mem'), kind, content: content.trim(), source, agentId, status, confidence: source === 'user' ? 1 : 0.6, tags, createdAt: at, updatedAt: at, deletedAt: null }
          set((s) => ({ memories: [...s.memories, m], sync: { ...s.sync, dirtyMemories: addUnique(s.sync.dirtyMemories, m.id) } }))
          return m
        },
        updateMemory: (id, p) => touchMemory(id, { ...p, ...(p.status === 'active' ? { confidence: 1 } : {}) }),
        // soft delete so the deletion also reaches other devices
        deleteMemory: (id) => touchMemory(id, { deletedAt: nowIso(), content: '' }),

        runAnalysis: (ctx) => {
          const s = get()
          const now = s.now()
          const full: AnalyzerContext = { ...ctx, events: s.events, now }
          const drafts = activeAnalyzers().flatMap((a) => {
            try {
              return a(full)
            } catch {
              return []
            }
          })
          const chosen = selectRecommendations(drafts, s.recommendations, computeWeights(s.recommendations), now)
          chosen.forEach((d) => get().addRecommendation(d))
          return chosen.length
        },
        addRecommendation: (d) => {
          const at = nowIso()
          const r: CoreRecommendation = { id: uid('rec'), agentId: d.agentId, signalKey: d.signalKey, title: d.title, body: d.body, rationale: d.rationale, status: 'proposed', outcome: null, createdAt: at, decidedAt: null, evaluatedAt: null, updatedAt: at, deletedAt: null }
          set((s) => ({
            recommendations: [...s.recommendations, r],
            learnedMemoryFor: d.learnedMemory ? { ...s.learnedMemoryFor, [r.id]: d.learnedMemory } : s.learnedMemoryFor,
            sync: { ...s.sync, dirtyRecs: addUnique(s.sync.dirtyRecs, r.id) },
          }))
          return r
        },
        decide: (id, approve) => {
          touchRec(id, { status: approve ? 'approved' : 'dismissed', decidedAt: nowIso() })
          const r = get().recommendations.find((x) => x.id === id)
          get().logEvent(approve ? 'recommendation.approved' : 'recommendation.dismissed', { signalKey: r?.signalKey ?? null }, r?.agentId ?? null)
        },
        evaluate: (id, helpful) => {
          touchRec(id, { status: 'evaluated', outcome: helpful ? 'helpful' : 'not_helpful', evaluatedAt: nowIso() })
          const r = get().recommendations.find((x) => x.id === id)
          get().logEvent('recommendation.evaluated', { signalKey: r?.signalKey ?? null, helpful }, r?.agentId ?? null)
          // Learn: a helpful pattern becomes a *proposed* memory — the user approves it before agents use it.
          const text = get().learnedMemoryFor[id]
          if (helpful && text && !get().memories.some((m) => !m.deletedAt && m.content === text)) {
            get().addMemory({ content: text, kind: 'pattern', source: 'learned', agentId: r?.agentId ?? 'core', status: 'proposed' })
          }
        },

        mergeRemote: ({ memories, recommendations, events, pulledAt }) =>
          set((s) => {
            const known = new Set(s.events.map((e) => e.id))
            const newEvents = (events ?? []).filter((e) => !known.has(e.id))
            return {
              memories: memories ? mergeRows(s.memories, memories, s.sync.dirtyMemories) : s.memories,
              recommendations: recommendations ? mergeRows(s.recommendations, recommendations, s.sync.dirtyRecs) : s.recommendations,
              events: newEvents.length ? [...s.events, ...newEvents].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).slice(-MAX_LOCAL_EVENTS) : s.events,
              sync: { ...s.sync, lastPulledAt: pulledAt ?? s.sync.lastPulledAt },
            }
          }),
        markPushed: ({ memories = [], recs = [], events = [] }) =>
          set((s) => ({
            sync: {
              ...s.sync,
              dirtyMemories: s.sync.dirtyMemories.filter((id) => !memories.includes(id)),
              dirtyRecs: s.sync.dirtyRecs.filter((id) => !recs.includes(id)),
              outbox: s.sync.outbox.filter((id) => !events.includes(id)),
            },
          })),
        markAllDirty: () =>
          set((s) => ({
            sync: { dirtyMemories: s.memories.map((m) => m.id), dirtyRecs: s.recommendations.map((r) => r.id), outbox: s.events.map((e) => e.id), lastPulledAt: null },
          })),
        resetCore: () => set({ ...initialCore() }),
      }
    },
    {
      name: CORE_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ memories: s.memories, events: s.events, recommendations: s.recommendations, learnedMemoryFor: s.learnedMemoryFor, sync: s.sync }),
    },
  ),
)

/** Memories visible to the user (not deleted). */
export const visibleMemories = (m: Memory[]) => m.filter((x) => !x.deletedAt)
