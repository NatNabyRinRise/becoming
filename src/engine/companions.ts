import type { CompanionId, DailyCheckIn, Task } from '../types'
import type { DayItem } from './scheduling/day'
import type { FollowUp } from './follow-up'

export interface CompanionMessage {
  companionId: CompanionId
  text: string
  action?: { label: string; to: string }
}

/**
 * Picks ONE message for the home screen, following the team priority order:
 * 1 health/rest/caregiving → 2 fixed commitments → 3 mission → 4 business → 5 rewards.
 */
export function homeMessage(args: {
  nowMin: number
  checkIn: DailyCheckIn | undefined
  oneThing: Task | null
  upcoming: DayItem | null
  followUp: FollowUp | null
  recoveryThreshold: number
  sleepMin: number | null
  giftReady: boolean
}): CompanionMessage {
  const { checkIn, oneThing, upcoming, nowMin } = args
  if (args.sleepMin !== null && nowMin >= args.sleepMin - 30 && nowMin < args.sleepMin + 240) {
    return { companionId: 'bloom', text: 'ใกล้เวลานอนแล้ว วันนี้พอแค่นี้ก็ดีมากแล้วนะ', action: { label: 'Evening Debrief', to: '/evening' } }
  }
  if (checkIn && checkIn.energy < args.recoveryThreshold) {
    return { companionId: 'bloom', text: 'วันนี้พลังงานเหลือน้อย เราเลื่อนงานที่ไม่ด่วนแล้วเก็บเวลาไว้พักกันดีกว่า', action: { label: 'ปรับแผน', to: '#rescue' } }
  }
  if (upcoming && upcoming.start !== null && upcoming.start - nowMin <= 30 && upcoming.start >= nowMin) {
    return { companionId: 'j', text: `อีก ${upcoming.start - nowMin} นาทีมี "${upcoming.block.title}" เตรียมตัวสบาย ๆ ได้เลย` }
  }
  if (!checkIn?.completedAt) {
    return { companionId: 'j', text: 'เริ่มวันด้วย Morning Briefing 2 นาที ฉันจะช่วยเลือกงานที่สำคัญที่สุดให้', action: { label: 'เริ่มเลย', to: '/briefing' } }
  }
  if (args.giftReady) {
    return { companionId: 'spark', text: 'เธอทำ One Thing สำเร็จแล้ว! มีของขวัญรออยู่ 🎁', action: { label: 'เปิดของขวัญ', to: '/rewards' } }
  }
  if (oneThing && oneThing.status !== 'done') {
    const mins = Math.max(5, oneThing.estimatedMinutes - oneThing.actualMinutes)
    if (oneThing.status === 'in_progress') return { companionId: 'spark', text: `อีกแค่ ${mins} นาที เรามาทำภารกิจนี้ให้ขยับไปอีกขั้นกันไหม?` }
    return { companionId: 'j', text: `วันนี้เรามีเวลา ${checkIn?.availableMinutes ?? 0} นาที ฉันเลือกงานที่สำคัญที่สุดไว้ให้แล้ว` }
  }
  if (args.followUp) return { companionId: args.followUp.companionId, text: args.followUp.message }
  return { companionId: 'spark', text: 'One Thing วันนี้เสร็จแล้ว ที่เหลือคือเวลาของเธอ ✨' }
}

export const COMPANION_TIPS: Record<CompanionId, string[]> = {
  j: ['ฉันดูแลภาพรวมของวัน และเลือกสิ่งเดียวที่สำคัญที่สุดให้', 'ถ้าแผนเปลี่ยน กด Rescue ได้ทุกเมื่อ'],
  atlas: ['โฟกัสธุรกิจหลักหนึ่งเดียว ไอเดียอื่นเก็บไว้ใน Idea Inbox ก่อน', 'ทดสอบกับลูกค้าจริงเร็วที่สุด ดีกว่าขัดเกลานาน ๆ'],
  muse: ['เรื่องเล่าจริงของเธอคือคอนเทนต์ที่ดีที่สุด', 'เก็บไอเดียสั้น ๆ ไว้ก่อน ค่อยเกลาทีหลัง'],
  bloom: ['การนอน การกิน และเวลากับลูก ไม่ต้อง "หามา" ด้วยแต้ม', 'พักก็คือส่วนหนึ่งของความก้าวหน้า'],
  spark: ['5 นาทีก็นับว่าเริ่มแล้ว', 'กลับมาเมื่อไหร่ก็เริ่มใหม่ได้เสมอ'],
  nexus: ['ฉันจำสิ่งที่เธอตัดสินใจและ Feedback ที่ให้ไว้ เพื่อเตือนเมื่อเรื่องคล้ายกันกลับมา', 'ฉันไม่ตัดสินลำดับความสำคัญ ฉันแค่เติมบริบทให้ทีม'],
}
