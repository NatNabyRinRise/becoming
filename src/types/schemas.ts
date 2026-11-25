import { z } from 'zod'

// Runtime validation for persisted / imported data.
// Objects are "loose" so newer optional fields survive round-trips.

const id = z.string().min(1)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const iso = z.string().min(10)
const missionId = z.enum(['influence', 'people', 'empire', 'freedom', 'life'])
const priority = z.enum(['low', 'medium', 'high'])
const mood = z.enum(['great', 'good', 'okay', 'tired', 'low'])

export const TaskSchema = z.looseObject({
  id,
  projectId: z.string().nullable(),
  missionId,
  title: z.string().min(1),
  description: z.string().default(''),
  estimatedMinutes: z.number().min(0),
  actualMinutes: z.number().min(0),
  priority,
  energyRequirement: z.enum(['low', 'medium', 'high']),
  kind: z.enum(['business', 'brand', 'partnership', 'health', 'family', 'recovery', 'general']),
  status: z.enum(['todo', 'in_progress', 'done', 'deferred', 'blocked', 'archived']),
  scheduledDate: date.nullable(),
  dependencies: z.array(z.string()),
  postponementCount: z.number().int().min(0),
  completedAt: iso.nullable(),
  createdAt: iso,
  updatedAt: iso,
})

const MilestoneSchema = z.looseObject({ id, title: z.string(), done: z.boolean() })

export const ProjectSchema = z.looseObject({
  id,
  missionId,
  title: z.string().min(1),
  description: z.string(),
  status: z.enum(['active', 'paused', 'done']),
  isPrimaryBusiness: z.boolean(),
  priority,
  milestones: z.array(MilestoneSchema),
  createdAt: iso,
  updatedAt: iso,
})

export const RoutineSchema = z.looseObject({
  id,
  category: z.enum(['morning', 'sleep', 'work', 'business', 'childcare', 'family', 'exercise', 'meals', 'personal', 'recovery']),
  title: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  duration: z.number().min(1),
  anchor: z.enum(['after_wake', 'baby_sleeps', 'childcare_support', 'after_lunch', 'before_bed']).nullable(),
  recurrence: z.enum(['none', 'daily', 'weekly']),
  weekday: z.number().int().min(0).max(6).nullable(),
  date: date.nullable(),
  flexibility: z.enum(['fixed', 'flexible']),
  priority,
  essential: z.boolean(),
  notes: z.string(),
  order: z.number(),
  status: z.enum(['active', 'paused']),
})

export const CheckInSchema = z.looseObject({
  id,
  localDate: date,
  energy: z.number().min(0).max(100),
  mood,
  sleepDuration: z.number().min(0).max(24),
  availableMinutes: z.number().min(0),
  circumstances: z.enum(['normal', 'baby', 'low_energy', 'unexpected', 'high_focus']),
  oneThingId: z.string().nullable(),
})

export const JournalSchema = z.looseObject({
  id,
  localDate: date,
  content: z.string(),
  mood: mood.nullable(),
  tags: z.array(z.string()),
  type: z.enum(['reflection', 'insight', 'idea', 'gratitude', 'checkin', 'lesson']),
  createdAt: iso,
  updatedAt: iso,
})

export const TransactionSchema = z.looseObject({
  id,
  sourceEventId: z.string().min(1),
  amount: z.number(),
  rewardType: z.enum(['xp', 'coins']),
  createdAt: iso,
})

export const RewardSchema = z.looseObject({
  id,
  title: z.string().min(1),
  cost: z.number().min(0),
  type: z.enum(['personal', 'virtual', 'message']),
  status: z.enum(['available', 'redeemed', 'locked']),
})

export const ReviewSchema = z.looseObject({ id, localDate: date, mood, reflection: z.string(), achievements: z.array(z.string()) })
export const IdeaSchema = z.looseObject({ id, text: z.string().min(1), createdAt: iso, status: z.enum(['inbox', 'converted', 'archived']) })
export const PartnerSchema = z.looseObject({ id, name: z.string().min(1), stage: z.string(), valuesFit: z.number() })
export const RevenueSchema = z.looseObject({ id, localDate: date, amount: z.number(), source: z.string(), recurring: z.boolean() })
export const ContentSchema = z.looseObject({ id, title: z.string().min(1), status: z.enum(['idea', 'draft', 'published']) })
export const AgentSchema = z.looseObject({ id, name: z.string(), status: z.enum(['planned', 'prompt_created', 'tested', 'operational']) })
export const MissionSchema = z.looseObject({ id: missionId, title: z.string(), targets: z.array(z.looseObject({ id, label: z.string(), target: z.number(), current: z.number() })) })
export const RescueSchema = z.looseObject({ id, localDate: date, reason: z.string(), remainingMinutes: z.number(), remainingEnergy: z.number() })
export const FocusLogSchema = z.looseObject({ id, title: z.string(), elapsedSeconds: z.number().min(0), startedAt: iso, status: z.string() })

export const ProfileSchema = z.looseObject({
  id,
  name: z.string(),
  timezone: z.string(),
  onboardingStatus: z.enum(['pending', 'done', 'skipped']),
  startedAt: date,
  preferences: z.looseObject({ wakeTime: z.string(), sleepTime: z.string(), missionPriorities: z.array(missionId) }),
})

export const SettingsSchema = z.looseObject({
  timezone: z.string(),
  quietHours: z.object({ start: z.string(), end: z.string() }),
  energyThresholds: z.object({ recovery: z.number(), lowEffort: z.number() }),
  rewardRules: z.looseObject({ oneThing: z.number() }),
  schemaVersion: z.number(),
})

/** Array collections in the backup, with the schema for each item. */
export const COLLECTION_SCHEMAS = {
  tasks: TaskSchema,
  projects: ProjectSchema,
  routines: RoutineSchema,
  journal: JournalSchema,
  transactions: TransactionSchema,
  rewards: RewardSchema,
  ideas: IdeaSchema,
  partners: PartnerSchema,
  revenue: RevenueSchema,
  content: ContentSchema,
  agents: AgentSchema,
  missions: MissionSchema,
  rescues: RescueSchema,
  focusLog: FocusLogSchema,
} as const

/** Record collections keyed by date. */
export const RECORD_SCHEMAS = {
  checkIns: CheckInSchema,
  reviews: ReviewSchema,
} as const
