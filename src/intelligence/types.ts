/**
 * BECOMING Intelligence Core — shared data model.
 * Every agent (J, Atlas, Spark, Bloom, Muse) reads and writes through these
 * shapes, so new agents can plug in without restructuring the data.
 */

export type CoreAgentId = 'core' | 'j' | 'atlas' | 'spark' | 'bloom' | 'muse'

export type MemoryKind = 'fact' | 'preference' | 'pattern' | 'goal' | 'context'
export type MemorySource = 'user' | 'learned' | 'capture' | `agent:${string}`

/** Long-term Memory. The user can always see, edit and delete every item. */
export interface Memory {
  id: string
  kind: MemoryKind
  content: string
  source: MemorySource
  agentId: CoreAgentId | null
  /** proposed = waiting for the user's approval (Human Approval). Only active memories are used by agents. */
  status: 'proposed' | 'active'
  confidence: number
  tags: string[]
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/** Observe: one thing that happened. Append-only. */
export interface BehaviorEvent {
  id: string
  type: BehaviorEventType
  agentId: CoreAgentId | null
  payload: Record<string, string | number | boolean | null>
  occurredAt: string
}

export type BehaviorEventType =
  | 'task.completed'
  | 'task.postponed'
  | 'focus.completed'
  | 'focus.stopped'
  | 'checkin.saved'
  | 'journal.added'
  | 'rescue.confirmed'
  | 'recommendation.approved'
  | 'recommendation.dismissed'
  | 'recommendation.evaluated'
  | 'capture.imported'

export type RecommendationStatus = 'proposed' | 'approved' | 'dismissed' | 'evaluated'

/** Recommend → Human approval → Evaluate → Learn */
export interface CoreRecommendation {
  id: string
  agentId: CoreAgentId
  /** Groups recommendations of the same kind so the core can learn which ones work. */
  signalKey: string
  title: string
  body: string
  rationale: string
  status: RecommendationStatus
  outcome: 'helpful' | 'not_helpful' | null
  createdAt: string
  decidedAt: string | null
  evaluatedAt: string | null
  updatedAt: string
  deletedAt: string | null
}

/** What an analyzer produces before the core decides whether to show it. */
export interface RecommendationDraft {
  agentId: CoreAgentId
  signalKey: string
  title: string
  body: string
  rationale: string
  /** Optional memory to propose if the user later says it helped. */
  learnedMemory?: string
}

/** Learn: per-signal statistics derived from the user's own feedback. */
export interface SignalWeight {
  signalKey: string
  shown: number
  approved: number
  dismissed: number
  helpful: number
  notHelpful: number
  /** 0..1 — how much the core should trust this kind of advice for this person. */
  weight: number
}
