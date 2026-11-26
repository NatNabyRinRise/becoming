import type { BehaviorEvent, RecommendationDraft } from './types'
import type { Task } from '../types'

/**
 * Analyze: rule-based baseline analyzers (Level 2 starting point).
 * Each analyzer is pure: (context) → drafts. An AI-backed agent can later
 * replace or add to these by implementing the same Analyzer signature.
 */
export interface AnalyzerContext {
  events: BehaviorEvent[]
  tasks: Task[]
  timezone: string
  now: Date
}
export type Analyzer = (ctx: AnalyzerContext) => RecommendationDraft[]

const DAY = 86_400_000
const recent = (ctx: AnalyzerContext, days: number) => ctx.events.filter((e) => ctx.now.getTime() - Date.parse(e.occurredAt) <= days * DAY)

type Part = 'morning' | 'afternoon' | 'evening' | 'night'
const PART_TH: Record<Part, string> = { morning: 'ช่วงเช้า', afternoon: 'ช่วงบ่าย', evening: 'ช่วงเย็น', night: 'ช่วงกลางคืน' }

export function dayPart(iso: string, timezone: string): Part {
  let h = new Date(iso).getHours()
  try {
    h = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: timezone }).format(new Date(iso)))
  } catch {
    /* fall back to device time */
  }
  if (h >= 5 && h < 11) return 'morning'
  if (h >= 11 && h < 17) return 'afternoon'
  if (h >= 17 && h < 22) return 'evening'
  return 'night'
}

/** When do tasks actually get finished? */
export const productiveTime: Analyzer = (ctx) => {
  const done = recent(ctx, 30).filter((e) => e.type === 'task.completed')
  if (done.length < 8) return []
  const counts: Record<Part, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 }
  for (const e of done) counts[dayPart(e.occurredAt, ctx.timezone)]++
  const [best, n] = (Object.entries(counts) as [Part, number][]).sort((a, b) => b[1] - a[1])[0]
  const share = n / done.length
  if (share < 0.4) return []
  return [
    {
      agentId: 'core',
      signalKey: `timing.${best}`,
      title: `งานสำคัญลองวางไว้${PART_TH[best]}`,
      body: `เธอทำงานเสร็จ${PART_TH[best]}บ่อยที่สุด ลองย้าย One Thing ของพรุ่งนี้มาไว้${PART_TH[best]}ดูไหม`,
      rationale: `${n} จาก ${done.length} งานที่เสร็จใน 30 วันล่าสุด (${Math.round(share * 100)}%) เสร็จ${PART_TH[best]}`,
      learnedMemory: `มักทำงานสำเร็จ${PART_TH[best]}`,
    },
  ]
}

type Len = 'short' | 'medium' | 'long'
const lenOf = (m: number): Len => (m <= 20 ? 'short' : m <= 45 ? 'medium' : 'long')
const LEN_TH: Record<Len, string> = { short: 'สั้น ๆ (≤20 นาที)', medium: 'กลาง ๆ (21–45 นาที)', long: 'ยาว (เกิน 45 นาที)' }

/** Which focus lengths actually get finished? */
export const focusLength: Analyzer = (ctx) => {
  const ev = recent(ctx, 30).filter((e) => e.type === 'focus.completed' || e.type === 'focus.stopped')
  if (ev.length < 6) return []
  const stat: Record<Len, { ok: number; n: number }> = { short: { ok: 0, n: 0 }, medium: { ok: 0, n: 0 }, long: { ok: 0, n: 0 } }
  for (const e of ev) {
    const s = stat[lenOf(Number(e.payload.plannedMinutes ?? 0))]
    s.n++
    if (e.type === 'focus.completed') s.ok++
  }
  const rated = (Object.entries(stat) as [Len, { ok: number; n: number }][]).filter(([, s]) => s.n >= 2).map(([k, s]) => [k, s.ok / s.n, s] as const)
  if (rated.length < 2) return []
  rated.sort((a, b) => b[1] - a[1])
  const [best, rate, s] = rated[0]
  const worst = rated[rated.length - 1]
  if (rate - worst[1] < 0.25) return []
  return [
    {
      agentId: 'core',
      signalKey: `focus.len.${best}`,
      title: `โฟกัสแบบ${LEN_TH[best]}เหมาะกับเธอ`,
      body: `รอบโฟกัสแบบ${LEN_TH[best]}จบได้บ่อยกว่า ลองตั้งเวลาแบบนี้เป็นค่าเริ่มต้น`,
      rationale: `แบบ${LEN_TH[best]}จบ ${s.ok}/${s.n} ครั้ง ส่วนแบบ${LEN_TH[worst[0]]}จบ ${Math.round(worst[1] * 100)}%`,
      learnedMemory: `โฟกัสได้ดีกับรอบ${LEN_TH[best]}`,
    },
  ]
}

/** Tasks that keep being pushed to later. */
export const stuckTasks: Analyzer = (ctx) => {
  const stuck = ctx.tasks.filter((t) => t.status !== 'done' && t.status !== 'archived' && t.postponementCount >= 3).sort((a, b) => b.postponementCount - a.postponementCount)
  return stuck.slice(0, 1).map((t) => ({
    agentId: 'core' as const,
    signalKey: `task.stuck.${t.id}`,
    title: `"${t.title}" ถูกเลื่อนมา ${t.postponementCount} ครั้ง`,
    body: 'ลองย่อให้เหลือก้าวแรก 15 นาที หรือถามตัวเองว่ายังสำคัญอยู่ไหม ถ้าไม่ก็พักไว้ได้',
    rationale: `เลื่อน ${t.postponementCount} ครั้ง`,
  }))
}

/** Low energy check-ins that still end in completed work → recovery-first days work. */
export const energyPattern: Analyzer = (ctx) => {
  const checkins = recent(ctx, 21).filter((e) => e.type === 'checkin.saved')
  const low = checkins.filter((e) => Number(e.payload.energy ?? 100) < 40)
  if (low.length < 3) return []
  return [
    {
      agentId: 'core',
      signalKey: 'energy.low.frequent',
      title: 'ช่วงนี้พลังงานต่ำบ่อย',
      body: `${low.length} วันจาก ${checkins.length} วันที่เช็กอิน พลังงานต่ำกว่า 40% ลองตั้ง One Thing ให้เล็กลง และกันเวลาพักไว้ในวันแบบนี้`,
      rationale: `เช็กอินพลังงานต่ำ ${low.length} ครั้งใน 21 วัน`,
      learnedMemory: 'ช่วงที่พลังงานต่ำ ทำงานเล็ก ๆ ได้ดีกว่าแผนใหญ่',
    },
  ]
}

export const BASELINE_ANALYZERS: Analyzer[] = [productiveTime, focusLength, stuckTasks, energyPattern]
