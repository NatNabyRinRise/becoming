import type {
  AgentRole,
  AnnualMission,
  AppSettings,
  ContentItem,
  DailyCheckIn,
  DailyReview,
  ExperimentState,
  FocusSession,
  FollowUpState,
  GiftState,
  Idea,
  JournalEntry,
  Partner,
  Project,
  RescueSession,
  RevenueEntry,
  Reward,
  RewardTransaction,
  RoutineBlock,
  RoutineDayEntry,
  Task,
  UserProfile,
  WeeklyReviewRecord,
} from '../types'
import {
  defaultSettings,
  MISSION_ORDER,
  seedAgents,
  seedMissions,
  seedProjects,
  seedRewards,
  seedRoutines,
  seedTasks,
} from '../data/seed'
import { localDate } from '../utils/date'

/** Everything that is persisted. */
export interface DomainState {
  profile: UserProfile
  settings: AppSettings
  missions: AnnualMission[]
  projects: Project[]
  tasks: Task[]
  routines: RoutineBlock[]
  dayLogs: Record<string, Record<string, RoutineDayEntry>>
  checkIns: Record<string, DailyCheckIn>
  focus: FocusSession | null
  focusLog: FocusSession[]
  rescues: RescueSession[]
  journal: JournalEntry[]
  rewards: Reward[]
  transactions: RewardTransaction[]
  reviews: Record<string, DailyReview>
  ideas: Idea[]
  partners: Partner[]
  revenue: RevenueEntry[]
  content: ContentItem[]
  agents: AgentRole[]
  gifts: Record<string, GiftState>
  followUp: FollowUpState
  weekly: WeeklyReviewRecord[]
  experiment: ExperimentState
  lastActiveDate: string | null
  comeback: { since: string; returnDate: string; gap: number } | null
  plannedOneThing: Record<string, string>
}

export const DOMAIN_KEYS: (keyof DomainState)[] = [
  'profile', 'settings', 'missions', 'projects', 'tasks', 'routines', 'dayLogs', 'checkIns', 'focus', 'focusLog',
  'rescues', 'journal', 'rewards', 'transactions', 'reviews', 'ideas', 'partners', 'revenue', 'content', 'agents',
  'gifts', 'followUp', 'weekly', 'experiment', 'lastActiveDate', 'comeback', 'plannedOneThing',
]

export function initialDomain(now: Date = new Date()): DomainState {
  const iso = now.toISOString()
  return {
    profile: {
      id: 'me',
      name: '',
      timezone: 'Asia/Bangkok',
      onboardingStatus: 'pending',
      startedAt: localDate(now),
      preferences: {
        wakeTime: '06:30',
        sleepTime: '22:30',
        typicalWorkMinutes: 60,
        familyCommitments: [],
        primaryBusiness: null,
        missionPriorities: [...MISSION_ORDER],
        reminderFrequency: 'gentle',
        rewardPreferences: [],
      },
    },
    settings: defaultSettings(),
    missions: seedMissions(),
    projects: seedProjects(iso),
    tasks: seedTasks(iso),
    routines: seedRoutines(),
    dayLogs: {},
    checkIns: {},
    focus: null,
    focusLog: [],
    rescues: [],
    journal: [],
    rewards: seedRewards(),
    transactions: [],
    reviews: {},
    ideas: [],
    partners: [],
    revenue: [],
    content: [],
    agents: seedAgents(),
    gifts: {},
    followUp: { dismissed: {}, snoozedUntil: {}, notified: {} },
    weekly: [],
    experiment: { startedAt: null, feedback: {}, doneDays: [] },
    lastActiveDate: null,
    comeback: null,
    plannedOneThing: {},
  }
}

export function pickDomain<T extends DomainState>(s: T): DomainState {
  const out = {} as Record<string, unknown>
  for (const k of DOMAIN_KEYS) out[k] = s[k]
  return out as unknown as DomainState
}
