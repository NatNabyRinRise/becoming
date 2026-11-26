// ─── BECOMING domain models ────────────────────────────────────────────────
// Pure types. Runtime validation lives in ./schemas.ts.

export type ID = string
export type LocalDate = string // YYYY-MM-DD in the user's timezone
export type ISOTime = string // full ISO timestamp

export type MissionId = 'influence' | 'people' | 'empire' | 'freedom' | 'life'
export type CompanionId = 'j' | 'atlas' | 'muse' | 'bloom' | 'spark' | 'nexus'
export type Priority = 'low' | 'medium' | 'high'
export type EnergyLevel = 'low' | 'medium' | 'high'
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'deferred' | 'blocked' | 'archived'
export type TaskKind = 'business' | 'brand' | 'partnership' | 'health' | 'family' | 'recovery' | 'general'

export type Circumstance = 'normal' | 'baby' | 'low_energy' | 'unexpected' | 'high_focus'
export type RescueReason = 'baby' | 'urgent_work' | 'fatigue' | 'lost_focus' | 'no_time' | 'other'
export type Mood = 'great' | 'good' | 'okay' | 'tired' | 'low'

export interface UserPreferences {
  wakeTime: string // HH:MM
  sleepTime: string
  typicalWorkMinutes: number
  familyCommitments: string[]
  primaryBusiness: string | null // null = undecided
  missionPriorities: MissionId[] // ordered, most important first
  reminderFrequency: 'gentle' | 'normal' | 'off'
  rewardPreferences: string[]
}

export interface UserProfile {
  id: ID
  name: string
  timezone: string
  preferences: UserPreferences
  onboardingStatus: 'pending' | 'done' | 'skipped'
  startedAt: LocalDate
}

export interface Companion {
  id: CompanionId
  name: string
  role: string
  roleTh: string
  personality: string
  avatar: string // key into avatar renderer
  color: string
}

export interface MissionTarget {
  id: ID
  label: string
  unit: string
  target: number
  current: number
}

export interface Milestone {
  id: ID
  title: string
  done: boolean
  doneAt?: ISOTime | null
}

export interface AnnualMission {
  id: MissionId
  title: string
  titleTh: string
  description: string
  targets: MissionTarget[]
  milestones: Milestone[]
  status: 'active' | 'paused'
}

export interface Project {
  id: ID
  missionId: MissionId
  title: string
  description: string
  status: 'active' | 'paused' | 'done'
  isPrimaryBusiness: boolean
  priority: Priority
  milestones: Milestone[]
  createdAt: ISOTime
  updatedAt: ISOTime
  /** Plain-text micro tasks (sandbox). Missing = not edited yet; falls back to linked task titles. */
  microTasks?: MicroTaskText[]
  /** Set when pinned to the top of Founder Mode (max 5). */
  pinnedAt?: ISOTime | null
  /** Last one-way send to Notion (Idea Inbox & Lab). Nothing syncs back. */
  notion?: NotionSent | null
}

export interface MicroTaskText {
  id: ID
  title: string
}

export interface NotionSent {
  sentAt: ISOTime
  url: string | null
}

export interface Task {
  id: ID
  projectId: ID | null
  missionId: MissionId
  title: string
  description: string
  estimatedMinutes: number
  actualMinutes: number
  priority: Priority
  energyRequirement: EnergyLevel
  kind: TaskKind
  status: TaskStatus
  scheduledDate: LocalDate | null
  dependencies: ID[]
  postponementCount: number
  completedAt: ISOTime | null
  createdAt: ISOTime
  updatedAt: ISOTime
}

export type RoutineCategory =
  | 'morning'
  | 'sleep'
  | 'work'
  | 'business'
  | 'childcare'
  | 'family'
  | 'exercise'
  | 'meals'
  | 'personal'
  | 'recovery'

export type Anchor = 'after_wake' | 'baby_sleeps' | 'childcare_support' | 'after_lunch' | 'before_bed'
export type Recurrence = 'none' | 'daily' | 'weekly'

export interface RoutineBlock {
  id: ID
  category: RoutineCategory
  title: string
  startTime: string | null // HH:MM, null when anchor-based
  duration: number // minutes
  anchor: Anchor | null
  recurrence: Recurrence
  weekday: number | null // 0-6 for weekly
  date: LocalDate | null // for one-off ("none") blocks
  flexibility: 'fixed' | 'flexible'
  priority: Priority
  essential: boolean // protected (sleep, childcare, meals, recovery)
  notes: string
  order: number
  status: 'active' | 'paused'
}

/** Per-day state of a routine block. */
export interface RoutineDayEntry {
  status: 'pending' | 'done' | 'skipped' | 'rescheduled'
  startTime?: string | null // override for this day
  movedTo?: LocalDate | null
}

export interface DailyCheckIn {
  id: ID
  localDate: LocalDate
  energy: number
  mood: Mood
  sleepDuration: number // hours
  availableMinutes: number
  circumstances: Circumstance
  oneThingId: ID | null
  completedAt: ISOTime | null // briefing completion
}

export interface FocusSession {
  id: ID
  taskId: ID | null
  title: string
  plannedMinutes: number
  createdAt: ISOTime
  startedAt: ISOTime // start of current running segment
  pausedAt: ISOTime | null
  elapsedSeconds: number // accumulated before current segment
  status: 'running' | 'paused' | 'completed' | 'stopped'
  overtimeAcknowledgedAt: number // elapsed seconds when user last chose "continue"
}

export interface PlanChange {
  type: 'routine' | 'task'
  id: ID
  title: string
  from: string
  to: string
}

export interface RescuePlan {
  oneThingId: ID | null
  oneThingTitle: string
  oneThingMinutes: number
  suggestion: boolean // true when it's a suggested (not existing) task
  protected: { id: ID; title: string; reason: string }[]
  rescheduled: PlanChange[]
  note: string
}

export interface PlanSnapshot {
  dayLog: Record<ID, RoutineDayEntry>
  routines: RoutineBlock[]
  tasks: Pick<Task, 'id' | 'status' | 'scheduledDate' | 'postponementCount'>[]
  oneThingId: ID | null
}

export interface RescueSession {
  id: ID
  localDate: LocalDate
  reason: RescueReason
  remainingMinutes: number
  remainingEnergy: number
  previousPlan: PlanSnapshot
  proposedPlan: RescuePlan
  confirmedAt: ISOTime | null
  undoStatus: 'available' | 'undone' | 'none'
}

export interface JournalEntry {
  id: ID
  localDate: LocalDate
  content: string
  mood: Mood | null
  tags: string[]
  type: 'reflection' | 'insight' | 'idea' | 'gratitude' | 'checkin' | 'lesson'
  createdAt: ISOTime
  updatedAt: ISOTime
}

export interface Reward {
  id: ID
  title: string
  cost: number // coins; 0 = gift-only
  type: 'personal' | 'virtual' | 'message'
  unlockCondition: string
  status: 'available' | 'redeemed' | 'locked'
}

export interface RewardTransaction {
  id: ID
  sourceEventId: string // unique per qualifying event
  amount: number
  rewardType: 'xp' | 'coins'
  reason: string
  createdAt: ISOTime
}

export interface DailyReview {
  id: ID
  localDate: LocalDate
  achievements: string[]
  mood: Mood
  reflection: string
  tomorrowOneThingId: ID | null
  /** สิ่งที่อยากให้เกิดพรุ่งนี้ (typed in Evening Debrief step 3). */
  tomorrowIntention?: string
  /** ภารกิจสำคัญของวันพรุ่งนี้ (typed in Evening Debrief step 3). */
  tomorrowMission?: string
  summary: string
}

export interface RewardRules {
  oneThing: number
  health: number
  family: number
  brand: number
  debrief: number
  rescueBonus: number
  comeback: number
  taskDefault: number
}

export interface EnergyThresholds {
  recovery: number // below → recovery
  lowEffort: number // below → low-effort tasks
}

export interface AppSettings {
  timezone: string
  quietHours: { start: string; end: string }
  notificationPreferences: { browser: boolean; inApp: boolean }
  rewardRules: RewardRules
  energyThresholds: EnergyThresholds
  reducedMotion: 'system' | 'on' | 'off'
  comebackAfterDays: number
  voiceInput: boolean
  schemaVersion: number
}

export interface Idea {
  id: ID
  text: string
  missionId: MissionId | null
  createdAt: ISOTime
  status: 'inbox' | 'converted' | 'archived'
  /** Last one-way send to Notion (Idea Inbox & Lab). */
  notion?: NotionSent | null
}

export interface Partner {
  id: ID
  name: string
  skills: string
  stage: 'candidate' | 'talking' | 'evaluating' | 'experimenting' | 'partner' | 'not_fit'
  valuesFit: number // 1-5
  notes: string
  updatedAt: ISOTime
}

export interface RevenueEntry {
  id: ID
  localDate: LocalDate
  amount: number
  source: string
  recurring: boolean
}

export interface ContentItem {
  id: ID
  title: string
  status: 'idea' | 'draft' | 'published'
  channel: string
  createdAt: ISOTime
  publishedAt: ISOTime | null
}

export type AgentStatus = 'planned' | 'prompt_created' | 'tested' | 'operational'
export interface AgentRole {
  id: ID
  name: string
  nameTh: string
  status: AgentStatus
  taskId: ID | null
}

export interface GiftState {
  unlocked: boolean
  revealedRewardId: ID | null
  revealedAt: ISOTime | null
}

export interface FollowUpState {
  dismissed: Record<string, ISOTime>
  snoozedUntil: Record<string, ISOTime>
  notified: Record<string, LocalDate>
}

export interface WeeklyReviewRecord {
  weekStart: LocalDate
  priority: string
  status: 'accepted' | 'rejected' | 'edited'
  createdAt: ISOTime
}

export interface ExperimentState {
  startedAt: LocalDate | null
  feedback: Record<string, number | string>
  doneDays: number[]
}
