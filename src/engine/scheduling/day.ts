import type { Anchor, RoutineBlock, RoutineCategory, RoutineDayEntry } from '../../types'
import { hhmmToMin, weekday } from '../../utils/date'

export interface DayItem {
  block: RoutineBlock
  entry: RoutineDayEntry
  start: number | null // minutes of day (null = anchor/unscheduled)
  end: number | null
}

export const ANCHOR_LABEL: Record<Anchor, string> = {
  after_wake: 'หลังตื่นนอน',
  baby_sleeps: 'ตอนลูกหลับ',
  childcare_support: 'ตอนมีคนช่วยดูลูก',
  after_lunch: 'หลังมื้อกลางวัน',
  before_bed: 'ก่อนนอน',
}

export const CATEGORY_META: Record<RoutineCategory, { label: string; color: string; emoji: string }> = {
  morning: { label: 'กิจวัตรเช้า', color: '#E9D8B4', emoji: '🌅' },
  sleep: { label: 'การนอน', color: '#8E85B0', emoji: '🌙' },
  work: { label: 'งาน', color: '#A99ACB', emoji: '💼' },
  business: { label: 'พัฒนาธุรกิจ', color: '#7E6FA8', emoji: '🚀' },
  childcare: { label: 'ดูแลลูก', color: '#F0B8C8', emoji: '👶' },
  family: { label: 'ครอบครัว', color: '#F2C9A0', emoji: '🏡' },
  exercise: { label: 'ออกกำลังกาย', color: '#9CC5B0', emoji: '🌿' },
  meals: { label: 'มื้ออาหาร', color: '#EBCB8B', emoji: '🍵' },
  personal: { label: 'เวลาส่วนตัว', color: '#D9A6C4', emoji: '✨' },
  recovery: { label: 'พักฟื้น', color: '#B5D3E7', emoji: '🫧' },
}

/** Categories that are always protected by Rescue Mode and the recommender. */
export const ESSENTIAL_CATEGORIES: RoutineCategory[] = ['sleep', 'childcare', 'meals', 'recovery']

export function isProtected(b: RoutineBlock): boolean {
  return b.essential || b.flexibility === 'fixed' || ESSENTIAL_CATEGORIES.includes(b.category)
}

export function occursOn(b: RoutineBlock, date: string): boolean {
  if (b.status !== 'active') return false
  if (b.recurrence === 'daily') return true
  if (b.recurrence === 'weekly') return b.weekday === weekday(date)
  return b.date === date
}

/** Resolve the routine for a date, applying per-day overrides. */
export function blocksForDate(blocks: RoutineBlock[], date: string, dayLog: Record<string, RoutineDayEntry> = {}): DayItem[] {
  return blocks
    .filter((b) => occursOn(b, date))
    .map((b) => {
      const entry = dayLog[b.id] ?? { status: 'pending' as const }
      const st = hhmmToMin(entry.startTime ?? b.startTime)
      return { block: b, entry, start: st, end: st === null ? null : st + b.duration }
    })
    .sort((a, b) => {
      if (a.start !== null && b.start !== null) return a.start - b.start || a.block.order - b.block.order
      if (a.start !== null) return -1
      if (b.start !== null) return 1
      return a.block.order - b.block.order
    })
}

/** Returns blocks that would overlap [start, start+duration). Sleep that wraps midnight is handled. */
export function findConflicts(items: DayItem[], start: number, duration: number, ignoreId?: string): DayItem[] {
  const s = start
  const e = start + duration
  return items.filter((it) => {
    if (it.block.id === ignoreId || it.start === null || it.end === null) return false
    if (it.entry.status === 'rescheduled' || it.entry.status === 'skipped') return false
    return overlaps(s, e, it.start, it.end)
  })
}

function overlaps(s1: number, e1: number, s2: number, e2: number): boolean {
  // normalise ranges that wrap past midnight into two segments
  const seg = (s: number, e: number): [number, number][] => (e <= 1440 ? [[s, e]] : [[s, 1440], [0, e - 1440]])
  for (const [a, b] of seg(s1, e1)) for (const [c, d] of seg(s2, e2)) if (a < d && c < b) return true
  return false
}

/** Next free slot of `duration` minutes at or after `from` that avoids timed blocks. */
export function nextFreeSlot(items: DayItem[], from: number, duration: number, until = 22 * 60): number | null {
  let t = from
  while (t + duration <= until) {
    const c = findConflicts(items, t, duration)
    if (c.length === 0) return t
    t = Math.max(...c.map((x) => x.end ?? t + 15))
  }
  return null
}
