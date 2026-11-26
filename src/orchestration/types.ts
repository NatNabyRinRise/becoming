// ─── BECOMING Orchestration Layer — data model ─────────────────────────────
//
// "AI Company decides what work exists.
//  BECOMING decides what deserves Eve's attention now."
//
// Business truth lives in the AI Company. BECOMING only READS business context
// through source adapters, and WRITES BACK status / feedback / decisions as
// events. Every record that came from a source carries a SourceRef so the
// same shapes work with mock JSON today and a real API (e.g. Notion) later.

export type ISOTime = string
export type LocalDate = string

/** v0.1 business sources. Future: calendar, decision_log, agent_memory, personal_memory, project_health, notifications. */
export type SourceId = 'company_tasks' | 'idea_lab' | 'life_os' | 'ceo_review'

/** Pointer back to the original record in the AI Company. Never dropped. */
export interface SourceRef {
  source: SourceId
  /** Id in the source system (Notion page id, row id…). */
  externalId: string
  /** Link to the original record / original agent output. */
  url: string | null
  /** Source-side last-edited time, used to detect changes. */
  updatedAt: ISOTime | null
}

export type RoleId = 'j' | 'atlas' | 'bloom' | 'muse' | 'spark' | 'nexus'

// ── Company Tasks (source of truth) ──────────────────────────────────────────

export type WorkMode = 'action' | 'review' | 'decision'
export type CompanyPriority = 'p1' | 'p2' | 'p3'
export type CompanyTaskStatus = 'ready' | 'in_progress' | 'waiting' | 'done' | 'cancelled'
export type Effort = 'low' | 'medium' | 'high'

export interface AgentOutput {
  /** Which AI Company agent produced it, e.g. "Research Agent". */
  agent: string
  title: string
  summary: string
  /** The original output, kept verbatim (guardrail 5). */
  original: string
  highlights: string[]
  createdAt: ISOTime | null
}

export interface DecisionOption {
  id: string
  label: string
  summary: string
  pros: string[]
  cons: string[]
  /** Rough cost in Eve's time per week, if the source knows it (lets Bloom check impact). */
  weeklyMinutes?: number | null
}

export interface DecisionSpec {
  question: string
  context: string
  options: DecisionOption[]
  /** The AI Company agent's own recommendation, if any. */
  agentRecommendation: string | null
  /** Whether the decision changes Eve's workload / family time. */
  affectsCapacity: boolean
  /** What the AI Company will do once Eve decides. */
  next: string
}

export interface CompanyTask {
  ref: SourceRef
  mode: WorkMode
  title: string
  project: string
  summary: string
  priority: CompanyPriority
  status: CompanyTaskStatus
  /** Only items flagged ready by the AI Company are surfaced to Eve. */
  readyForBecoming: boolean
  estimatedMinutes: number
  effort: Effort
  dueDate: LocalDate | null
  /** creative, brand, partner… (lets J pull in Muse). */
  tags: string[]
  /** Who in the AI Company owns / waits on this. */
  requestedBy: string
  /** Action only: suggested first steps from the company (Spark can refine). */
  steps?: string[]
  /** Review only. */
  output?: AgentOutput
  /** Decision only. */
  decision?: DecisionSpec
}

// ── Idea Inbox & Lab ─────────────────────────────────────────────────────────

/** Capture → Expand → Validate → Commit. Commit happens in the AI Company, never here. */
export type IdeaStage = 'capture' | 'expand' | 'validate' | 'commit_requested' | 'committed' | 'parked' | 'killed'

export interface LabIdea {
  ref: SourceRef
  title: string
  note: string
  stage: IdeaStage
  tags: string[]
  capturedAt: ISOTime | null
}

// ── Discipline & Life OS ─────────────────────────────────────────────────────

export type LifeKind = 'routine' | 'habit' | 'recovery' | 'family' | 'commitment'

export interface LifeItem {
  ref: SourceRef
  kind: LifeKind
  title: string
  minutes: number
  /** HH:MM if time-bound. */
  time: string | null
  /** Protected: never dropped by Rescue. */
  essential: boolean
  streak: number
  note: string
}

export interface LifeConstraint {
  ref: SourceRef
  title: string
  /** HH:MM–HH:MM blocked window (family, pickup…). */
  from: string | null
  to: string | null
  /** Minutes this constraint removes from today's focus time. */
  minutes: number
}

export interface LifeOsSnapshot {
  items: LifeItem[]
  constraints: LifeConstraint[]
  /** Source's own defaults when Eve hasn't checked in. */
  defaultFocusMinutes: number
}

// ── Weekly CEO Review ────────────────────────────────────────────────────────

export interface CeoReview {
  ref: SourceRef
  weekStart: LocalDate
  moved: string[]
  stalled: string[]
  needsDecision: string[]
  stop: string[]
  continue: string[]
  /** Company's proposed priorities for next week. */
  priorities: string[]
  strategicQuestion: string | null
  capacityNote: string
}

/** Everything BECOMING read from the AI Company. */
export interface BusinessContext {
  companyTasks: CompanyTask[]
  ideas: LabIdea[]
  life: LifeOsSnapshot
  ceoReview: CeoReview | null
  loadedAt: ISOTime
  /** 'mock' until a real adapter is plugged in. */
  adapter: string
}

/** Eve's side: comes from BECOMING itself (check-in, routines, family commitments). */
export interface PersonalContext {
  date: LocalDate
  nowMin: number
  energy: number | null
  availableMinutes: number | null
  circumstance: 'normal' | 'baby' | 'low_energy' | 'unexpected' | 'high_focus'
  familyCommitments: string[]
  /** Minutes of essential routine still ahead today (childcare, meals…). */
  essentialMinutesLeft: number
  recoveryThreshold: number
  lowEffortThreshold: number
}

// ── What BECOMING itself may create (guardrail 2 & 3) ───────────────────────

export type BecomingOutputKind = 'life_action' | 'reflection' | 'suggestion' | 'micro_step' | 'execution_step' | 'recommendation'
export const ALLOWED_OUTPUT_KINDS: readonly BecomingOutputKind[] = ['life_action', 'reflection', 'suggestion', 'micro_step', 'execution_step', 'recommendation']

/** A business idea/suggestion created inside BECOMING. It stays a Suggestion until the AI Company commits it. */
export interface BusinessSuggestion {
  id: string
  kind: 'suggestion'
  status: 'suggestion' | 'sent' | 'accepted' | 'declined'
  title: string
  rationale: string
  /** Which BECOMING role proposed it. */
  proposedBy: RoleId
  /** The record it relates to, if any. */
  relatedTo: SourceRef | null
  createdAt: ISOTime
}

// ── Attention ────────────────────────────────────────────────────────────────

export type AttentionType = 'do' | 'review' | 'decide' | 'think' | 'life'

export interface DispatchPlan {
  primary: RoleId[]
  support: RoleId[]
  /** Human-readable flow, e.g. ["J", "Bloom ตรวจ Capacity", "Spark แตกเป็น Action", "J นำเสนอ Eve"]. */
  flow: string[]
}

export interface Capacity {
  /** 0–100 */
  score: number
  energy: number
  focusMinutes: number
  level: 'recovery' | 'light' | 'steady' | 'strong'
  /** Max business attention items Bloom thinks are sustainable today. */
  workloadLimit: number
  overload: boolean
  warning: string | null
  recovery: string
  constraints: string[]
}

export interface SparkPlan {
  startNow: string
  steps: { title: string; minutes: number; kind: 'micro_step' | 'execution_step' }[]
  sprintMinutes: number
  challenge: string
  reward: string
}

export interface ReviewFrame {
  whatAiCreated: string
  whyItMatters: string
  keyPoints: string[]
  possibleMismatch: string[]
  questions: string[]
  originalUrl: string | null
  original: string
}

export interface DecisionFrame {
  question: string
  options: DecisionOption[]
  recommendation: { optionId: string | null; text: string }
  risks: string[]
  impact: string[]
  deadline: LocalDate | null
  next: string
  capacityImpact: string | null
}

export interface IdeaFrame {
  expansion: string[]
  angle: string
  experiment: string
  alternative: string
  challenge: string[]
  whatNotToDo: string
  nextStage: IdeaStage | null
}

export interface ContextPack {
  similarPast: string[]
  preferences: string[]
  patterns: string[]
}

interface AttentionBase {
  /** Stable key: `${source}:${externalId}` or `becoming:<id>`. */
  key: string
  type: AttentionType
  title: string
  subtitle: string
  minutes: number
  /** Higher = more deserving of attention now. */
  score: number
  why: string
  dispatch: DispatchPlan
  /** Where the item came from. BECOMING-created items have ref = null. */
  ref: SourceRef | null
  origin: 'ai_company' | 'becoming'
  /** Set when BECOMING generated it. */
  outputKind?: BecomingOutputKind
  dueDate: LocalDate | null
  context: ContextPack | null
}

export type AttentionItem =
  | (AttentionBase & { type: 'do'; task: CompanyTask; spark: SparkPlan })
  | (AttentionBase & { type: 'review'; task: CompanyTask; frame: ReviewFrame })
  | (AttentionBase & { type: 'decide'; task: CompanyTask; frame: DecisionFrame })
  | (AttentionBase & { type: 'think'; idea?: LabIdea; frame?: IdeaFrame; prompt?: string })
  | (AttentionBase & { type: 'life'; life?: LifeItem })

// ── Write-back (BECOMING → AI Company) ───────────────────────────────────────

export type WriteBackPayload =
  | { kind: 'action'; outcome: 'done' | 'deferred' | 'blocked'; note: string }
  | { kind: 'review'; outcome: 'approved' | 'revise' | 'rejected'; feedback: string }
  | { kind: 'decision'; optionId: string; optionLabel: string; note: string; decidedOn: LocalDate; question: string; context: string }
  | { kind: 'idea'; outcome: 'explore' | 'validate' | 'park' | 'kill' | 'commit' }
  | { kind: 'life'; outcome: 'done' | 'skipped' | 'adjusted'; note: string }
  | { kind: 'suggestion'; suggestion: BusinessSuggestion }

export interface WriteBackEvent {
  id: string
  /** Original record (null for a new suggestion that has no record yet). */
  target: SourceRef | null
  title: string
  payload: WriteBackPayload
  createdAt: ISOTime
  /** Eve's local day the answer was given (life items reset daily). */
  localDate: LocalDate
  /** pending = waiting in the outbox, sent = acknowledged by the source adapter. */
  delivery: 'pending' | 'sent' | 'failed'
  sentAt: ISOTime | null
}

/** Persisted orchestration state (lives inside DomainState.orchestration). */
export interface OrchestrationState {
  /** Outbox + history. Nexus learns from this (guardrail 10). */
  events: WriteBackEvent[]
  suggestions: BusinessSuggestion[]
  /** Items Eve pushed out of today (key → LocalDate until which it is hidden). */
  snoozed: Record<string, LocalDate>
  lastSentAt: ISOTime | null
}

export function emptyOrchestration(): OrchestrationState {
  return { events: [], suggestions: [], snoozed: {}, lastSentAt: null }
}
