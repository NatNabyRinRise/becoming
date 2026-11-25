import type {
  AgentRole,
  AnnualMission,
  AppSettings,
  Companion,
  CompanionId,
  MissionId,
  Project,
  Reward,
  RoutineBlock,
  Task,
} from '../types'

export const SCHEMA_VERSION = 1

export const COMPANIONS: Record<CompanionId, Companion> = {
  j: {
    id: 'j',
    name: 'J',
    role: 'Chief of Staff',
    roleTh: 'เลขาและผู้ประสานงาน',
    personality: 'อบอุ่น เป็นระบบ คิดล่วงหน้า',
    avatar: 'j',
    color: '#A99ACB',
  },
  atlas: {
    id: 'atlas',
    name: 'Atlas',
    role: 'Business Partner',
    roleTh: 'หุ้นส่วนธุรกิจ',
    personality: 'มีกลยุทธ์ วิเคราะห์ ตรงไปตรงมา',
    avatar: 'atlas',
    color: '#645B7C',
  },
  muse: {
    id: 'muse',
    name: 'Muse',
    role: 'Creative Partner',
    roleTh: 'คู่คิดสร้างสรรค์',
    personality: 'สร้างสรรค์ ช่างสื่อสาร ให้กำลังใจ',
    avatar: 'muse',
    color: '#D9A6C4',
  },
  bloom: {
    id: 'bloom',
    name: 'Bloom',
    role: 'Life Guardian',
    roleTh: 'ผู้ดูแลชีวิต',
    personality: 'อ่อนโยน ใส่ใจ ช่างสังเกต',
    avatar: 'bloom',
    color: '#9CC5B0',
  },
  spark: {
    id: 'spark',
    name: 'Spark',
    role: 'Accountability Partner',
    roleTh: 'เพื่อนคู่ท้าทาย',
    personality: 'ขี้เล่น มีพลัง ชวนลงมือ',
    avatar: 'spark',
    color: '#E9C27A',
  },
}

export const COMPANION_ORDER: CompanionId[] = ['j', 'atlas', 'muse', 'bloom', 'spark']

export const MISSION_META: Record<MissionId, { title: string; titleTh: string; color: string; companion: CompanionId }> = {
  influence: { title: 'Build My Influence', titleTh: 'สร้างตัวตนและอิทธิพล', color: '#D9A6C4', companion: 'muse' },
  people: { title: 'Find My People', titleTh: 'หาคนที่ใช่', color: '#9DB4E0', companion: 'atlas' },
  empire: { title: 'Build My Empire', titleTh: 'สร้างธุรกิจหลัก', color: '#A99ACB', companion: 'atlas' },
  freedom: { title: 'Build My Freedom', titleTh: 'สร้างอิสรภาพทางรายได้', color: '#E9C27A', companion: 'atlas' },
  life: { title: 'Build My Life', titleTh: 'ดูแลชีวิตและครอบครัว', color: '#9CC5B0', companion: 'bloom' },
}

export const MISSION_ORDER: MissionId[] = ['empire', 'influence', 'people', 'freedom', 'life']

const t = (id: string, label: string, unit: string, target: number) => ({ id, label, unit, target, current: 0 })

export function seedMissions(): AnnualMission[] {
  return [
    {
      id: 'influence',
      ...pick('influence'),
      description: 'พัฒนาตัวตนที่คนจำได้ สื่อสารไอเดียที่มีความหมาย และสร้างความไว้วางใจ',
      targets: [
        t('inf-content', 'คอนเทนต์ที่เผยแพร่', 'ชิ้น', 48),
        t('inf-interact', 'การสนทนาที่มีความหมายกับผู้ติดตาม', 'ครั้ง', 100),
        t('inf-audience', 'ผู้ติดตามใหม่', 'คน', 500),
        t('inf-exp', 'การทดลองคอนเทนต์', 'ครั้ง', 12),
      ],
      milestones: [],
      status: 'active',
    },
    {
      id: 'people',
      ...pick('people'),
      description: 'หาพาร์ทเนอร์เชิงกลยุทธ์ที่มีทักษะเสริมกันและคุณค่าตรงกัน',
      targets: [
        t('ppl-conn', 'คอนเนกชันใหม่', 'คน', 30),
        t('ppl-talk', 'บทสนทนาที่มีความหมาย', 'ครั้ง', 20),
        t('ppl-cand', 'ผู้สมัครพาร์ทเนอร์', 'คน', 5),
        t('ppl-exp', 'การทดลองทำงานร่วมกัน', 'ครั้ง', 3),
      ],
      milestones: [],
      status: 'active',
    },
    {
      id: 'empire',
      ...pick('empire'),
      description: 'เลือกธุรกิจหลักหนึ่งเดียว ตรวจสอบปัญหา สร้างต้นแบบ และสร้างรายได้แรก',
      targets: [
        t('emp-int', 'สัมภาษณ์ลูกค้า', 'ครั้ง', 20),
        t('emp-proto', 'ไมล์สโตนต้นแบบ', 'ขั้น', 5),
        t('emp-val', 'การทดลองตรวจสอบตลาด', 'ครั้ง', 6),
        t('emp-cust', 'ลูกค้าที่จ่ายเงิน', 'ราย', 10),
      ],
      milestones: [],
      status: 'active',
    },
    {
      id: 'freedom',
      ...pick('freedom'),
      description: 'พัฒนารายได้หลายทาง และรายได้ที่ไม่ผูกกับชั่วโมงทำงาน',
      targets: [
        t('fre-streams', 'ช่องทางรายได้', 'ช่องทาง', 3),
        t('fre-exp', 'การทดลองรายได้', 'ครั้ง', 4),
      ],
      milestones: [],
      status: 'active',
    },
    {
      id: 'life',
      ...pick('life'),
      description: 'นอนดีขึ้น สุขภาพดี กิจวัตรครอบครัวมั่นคง และมีความสุขในบ้านใหม่',
      targets: [
        t('life-ex', 'วันที่ได้ออกกำลังกาย', 'วัน', 150),
        t('life-family', 'กิจกรรมครอบครัว', 'ครั้ง', 100),
        t('life-me', 'เวลาส่วนตัว', 'ชั่วโมง', 100),
      ],
      milestones: [],
      status: 'active',
    },
  ]
}

function pick(id: MissionId) {
  return { title: MISSION_META[id].title, titleTh: MISSION_META[id].titleTh }
}

export const STARTER_PROJECT_ID = 'proj_ai_company'

export function seedProjects(now: string): Project[] {
  return [
    {
      id: STARTER_PROJECT_ID,
      missionId: 'empire',
      title: 'AI Company — Activate My AI Team',
      description: 'ตั้งทีม AI Agent ให้ทำงานจริงทีละตำแหน่ง (โปรเจกต์ตัวอย่าง แก้ไขได้)',
      status: 'active',
      isPrimaryBusiness: true,
      priority: 'high',
      milestones: [
        { id: 'ms1', title: 'เลือก Agent ตัวแรก', done: false },
        { id: 'ms2', title: 'มี Agent ที่ทดสอบแล้ว 1 ตัว', done: false },
        { id: 'ms3', title: 'Agent ทำงานจริงได้ 3 ตำแหน่ง', done: false },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ]
}

function task(now: string, p: Partial<Task> & Pick<Task, 'id' | 'title' | 'missionId' | 'estimatedMinutes'>): Task {
  return {
    projectId: null,
    description: '',
    actualMinutes: 0,
    priority: 'medium',
    energyRequirement: 'medium',
    kind: 'general',
    status: 'todo',
    scheduledDate: null,
    dependencies: [],
    postponementCount: 0,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...p,
  }
}

/** Editable starter tasks. They are suggestions, not completed work. */
export function seedTasks(now: string): Task[] {
  const P = STARTER_PROJECT_ID
  return [
    task(now, { id: 'task_pick_agent', title: 'เลือก AI Agent 1 ตัวที่จะเปิดใช้งาน', missionId: 'empire', projectId: P, estimatedMinutes: 5, priority: 'high', energyRequirement: 'low', kind: 'business' }),
    task(now, { id: 'task_assign_agent', title: 'กำหนดภารกิจจริงให้ AI Agent 1 คน', missionId: 'empire', projectId: P, estimatedMinutes: 15, priority: 'high', energyRequirement: 'medium', kind: 'business' }),
    task(now, { id: 'task_prompt_agent', title: 'เขียน Prompt ของ Agent และกำหนดวิธีทดสอบ', missionId: 'empire', projectId: P, estimatedMinutes: 30, priority: 'high', energyRequirement: 'medium', kind: 'business' }),
    task(now, { id: 'task_run_agent', title: 'ทดลองใช้ Agent จริง 1 ครั้ง และบันทึกผล', missionId: 'empire', projectId: P, estimatedMinutes: 60, priority: 'high', energyRequirement: 'high', kind: 'business' }),
    task(now, { id: 'task_milestone', title: 'ทำให้ Agent ตัวแรกพร้อมใช้งานจริง (Founder milestone)', missionId: 'empire', projectId: P, estimatedMinutes: 120, priority: 'high', energyRequirement: 'high', kind: 'business', dependencies: [] }),
    task(now, { id: 'task_insight', title: 'บันทึก Business Insight 1 ข้อ', missionId: 'empire', estimatedMinutes: 5, priority: 'medium', energyRequirement: 'low', kind: 'business' }),
    task(now, { id: 'task_post', title: 'ร่างโพสต์ Personal Brand 1 ชิ้น', missionId: 'influence', estimatedMinutes: 15, priority: 'medium', energyRequirement: 'medium', kind: 'brand' }),
    task(now, { id: 'task_partner', title: 'ประเมินผู้สมัครพาร์ทเนอร์ 1 คน', missionId: 'people', estimatedMinutes: 30, priority: 'medium', energyRequirement: 'medium', kind: 'partnership' }),
    task(now, { id: 'task_stream', title: 'ลิสต์ไอเดียรายได้ประจำ (recurring) 3 ข้อ', missionId: 'freedom', estimatedMinutes: 15, priority: 'low', energyRequirement: 'low', kind: 'business' }),
    task(now, { id: 'task_walk', title: 'เดินเล่นยืดเส้น 10 นาที', missionId: 'life', estimatedMinutes: 10, priority: 'medium', energyRequirement: 'low', kind: 'health' }),
  ]
}

function block(p: Partial<RoutineBlock> & Pick<RoutineBlock, 'id' | 'title' | 'category' | 'duration'>): RoutineBlock {
  return {
    startTime: null,
    anchor: null,
    recurrence: 'daily',
    weekday: null,
    date: null,
    flexibility: 'flexible',
    priority: 'medium',
    essential: false,
    notes: '',
    order: 0,
    status: 'active',
    ...p,
  }
}

export function seedRoutines(wake = '06:30', sleep = '22:30'): RoutineBlock[] {
  return [
    block({ id: 'rb_wake', title: 'ดื่มน้ำ ยืดตัว ตั้งหลัก', category: 'morning', duration: 15, anchor: 'after_wake', order: 0 }),
    block({ id: 'rb_breakfast', title: 'อาหารเช้า', category: 'meals', duration: 30, startTime: addMin(wake, 30), flexibility: 'fixed', essential: true, order: 1 }),
    block({ id: 'rb_baby_morning', title: 'ดูแลลูกช่วงเช้า', category: 'childcare', duration: 120, startTime: addMin(wake, 60), flexibility: 'fixed', essential: true, priority: 'high', order: 2 }),
    block({ id: 'rb_onething', title: 'เวลาของ One Thing', category: 'business', duration: 45, anchor: 'baby_sleeps', order: 3 }),
    block({ id: 'rb_lunch', title: 'อาหารกลางวัน', category: 'meals', duration: 45, startTime: '12:00', flexibility: 'fixed', essential: true, order: 4 }),
    block({ id: 'rb_rest', title: 'พักฟื้นพลัง 20 นาที', category: 'recovery', duration: 20, anchor: 'after_lunch', essential: true, order: 5 }),
    block({ id: 'rb_brand', title: 'งาน Personal Brand', category: 'work', duration: 30, startTime: '14:00', order: 6 }),
    block({ id: 'rb_exercise', title: 'ออกกำลังกายเบา ๆ', category: 'exercise', duration: 20, startTime: '16:30', order: 7 }),
    block({ id: 'rb_family', title: 'เวลาครอบครัว', category: 'family', duration: 90, startTime: '17:30', flexibility: 'fixed', essential: true, priority: 'high', order: 8 }),
    block({ id: 'rb_dinner', title: 'อาหารเย็น', category: 'meals', duration: 45, startTime: '19:00', flexibility: 'fixed', essential: true, order: 9 }),
    block({ id: 'rb_me', title: 'เวลาส่วนตัว', category: 'personal', duration: 30, anchor: 'before_bed', order: 10 }),
    block({ id: 'rb_sleep', title: 'นอน', category: 'sleep', duration: 480, startTime: sleep, flexibility: 'fixed', essential: true, priority: 'high', order: 11 }),
  ]
}

function addMin(hhmm: string, add: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const tot = (h * 60 + m + add) % 1440
  return `${String(Math.floor(tot / 60)).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`
}

export function seedRewards(prefs: string[] = []): Reward[] {
  const base: Reward[] = [
    { id: 'rw_coffee', title: 'กาแฟแก้วโปรดแบบไม่รีบ', cost: 30, type: 'personal', unlockCondition: 'ใช้เหรียญ', status: 'available' },
    { id: 'rw_read', title: 'อ่านหนังสือ 30 นาที', cost: 40, type: 'personal', unlockCondition: 'ใช้เหรียญ', status: 'available' },
    { id: 'rw_fav', title: 'ทำกิจกรรมโปรด 1 อย่าง', cost: 60, type: 'personal', unlockCondition: 'ใช้เหรียญ', status: 'available' },
  ]
  for (const p of prefs) base.push({ id: `rw_${p}`, title: p, cost: 50, type: 'personal', unlockCondition: 'ใช้เหรียญ', status: 'available' })
  return base
}

/** Mystery-gift pool. No randomness tied to money; one gift per One Thing. */
export const GIFT_POOL = [
  { id: 'g_coffee', title: 'Coffee moment ☕', text: 'ให้ตัวเองดื่มกาแฟแบบช้า ๆ 10 นาที' },
  { id: 'g_read', title: 'Reading time 📖', text: 'อ่านอะไรก็ได้ที่ชอบ 15 นาที' },
  { id: 'g_fav', title: 'Favorite thing ✨', text: 'ทำสิ่งเล็ก ๆ ที่ชอบ โดยไม่ต้องรู้สึกผิด' },
  { id: 'g_star', title: 'Star decoration 🌟', text: 'ดาวดวงใหม่ถูกเพิ่มลงในจักรวาลของเธอ' },
  { id: 'g_msg', title: 'A note from J 💌', text: 'ก้าวเล็ก ๆ วันนี้ คือหลักฐานว่าเธอกำลังกลายเป็นคนที่อยากเป็น' },
  { id: 'g_custom', title: 'รางวัลของเธอเอง 🎁', text: 'เลือกรางวัลจากรายการที่เธอตั้งไว้ 1 อย่าง' },
]

export const AGENT_ROLES: [string, string][] = [
  ['Business Development', 'พัฒนาธุรกิจ'],
  ['Researcher', 'นักวิจัย'],
  ['Marketing', 'การตลาด'],
  ['Product Team', 'ทีมผลิตภัณฑ์'],
  ['Developer', 'นักพัฒนา'],
  ['HR and Performance', 'HR และผลงาน'],
  ['AI Chief of Staff and Operations', 'Chief of Staff และปฏิบัติการ'],
  ['Finance and BI', 'การเงินและ BI'],
  ['QA, Legal and Security', 'QA กฎหมาย และความปลอดภัย'],
  ['Healer and Advisor', 'ผู้เยียวยาและที่ปรึกษา'],
]

export function seedAgents(): AgentRole[] {
  return AGENT_ROLES.map(([name, nameTh], i) => ({ id: `agent_${i + 1}`, name, nameTh, status: 'planned', taskId: null }))
}

export function defaultSettings(): AppSettings {
  return {
    timezone: 'Asia/Bangkok',
    quietHours: { start: '21:30', end: '07:00' },
    notificationPreferences: { browser: false, inApp: true },
    rewardRules: { oneThing: 50, health: 20, family: 20, brand: 15, debrief: 15, rescueBonus: 30, comeback: 25, taskDefault: 10 },
    energyThresholds: { recovery: 30, lowEffort: 50 },
    reducedMotion: 'system',
    comebackAfterDays: 3,
    voiceInput: false,
    schemaVersion: SCHEMA_VERSION,
  }
}

/** Sanctuary objects unlocked by total XP (meaningful progress). */
export const SANCTUARY_ITEMS = [
  { id: 'home', title: 'บ้านเล็ก ๆ', xp: 0 },
  { id: 'office', title: 'Home office', xp: 100 },
  { id: 'books', title: 'ชั้นหนังสือ', xp: 250 },
  { id: 'garden', title: 'สวน', xp: 450 },
  { id: 'family', title: 'มุมครอบครัว', xp: 700 },
  { id: 'studio', title: 'Creative studio', xp: 1000 },
  { id: 'business', title: 'Business workspace', xp: 1400 },
]
