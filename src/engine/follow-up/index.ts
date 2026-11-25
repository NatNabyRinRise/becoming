import type { CompanionId, ContentItem, FollowUpState, Project, RoutineBlock, RoutineDayEntry, Task } from '../../types'
import { addDays } from '../../utils/date'

export interface FollowUp {
  key: string
  type: 'unfinished' | 'postponed' | 'stalled' | 'missed_routine' | 'overtime' | 'content' | 'recovery'
  companionId: CompanionId
  title: string
  message: string
  taskId: string | null
  weight: number
}

export interface FollowUpInput {
  today: string
  nowIso: string
  tasks: Task[]
  projects: Project[]
  routines: RoutineBlock[]
  dayLogs: Record<string, Record<string, RoutineDayEntry>>
  content: ContentItem[]
  energy: number | null
  recoveryThreshold: number
  state: FollowUpState
  quiet: boolean
}

/** Rule-based smart follow-up. Returns items ranked most-important first. */
export function computeFollowUps(i: FollowUpInput): FollowUp[] {
  if (i.quiet) return []
  const out: FollowUp[] = []
  const active = (t: Task) => t.status === 'todo' || t.status === 'in_progress'

  // Bloom: recovery first when energy is low
  if (i.energy !== null && i.energy < i.recoveryThreshold) {
    out.push({ key: `recovery:${i.today}`, type: 'recovery', companionId: 'bloom', title: 'พักฟื้นพลังก่อน', message: 'พลังงานวันนี้ต่ำ พัก 15 นาทีก่อนตัดสินใจอะไรต่อดีไหม', taskId: null, weight: 100 })
  }

  for (const t of i.tasks) {
    if (!active(t)) continue
    // J: unfinished high-priority overdue
    if (t.priority === 'high' && t.scheduledDate && t.scheduledDate < i.today) {
      out.push({ key: `unfinished:${t.id}`, type: 'unfinished', companionId: 'j', title: t.title, message: 'งานสำคัญนี้ยังค้างอยู่ เริ่มขั้นเล็ก ๆ วันนี้ไหม', taskId: t.id, weight: 80 })
    }
    // Spark: repeatedly postponed → restart challenge
    if (t.postponementCount >= 2) {
      out.push({ key: `postponed:${t.id}:${t.postponementCount}`, type: 'postponed', companionId: 'spark', title: t.title, message: `เลื่อนมา ${t.postponementCount} ครั้งแล้ว ลองท้าทาย 5 นาทีแรกกันไหม`, taskId: t.id, weight: 60 + t.postponementCount })
    }
    // Atlas: exceeded estimate → possible low-value work
    if (t.actualMinutes > t.estimatedMinutes * 1.25 && t.estimatedMinutes > 0) {
      out.push({ key: `overtime:${t.id}`, type: 'overtime', companionId: 'atlas', title: t.title, message: 'งานนี้ใช้เวลาเกินที่วางไว้แล้ว ลองหยุดและทดสอบสิ่งที่มีอยู่ก่อนดีไหม', taskId: t.id, weight: 70 })
    }
  }

  // Atlas: stalled projects (no completed task in 7 days)
  const weekAgo = addDays(i.today, -7)
  for (const p of i.projects) {
    if (p.status !== 'active') continue
    const pts = i.tasks.filter((t) => t.projectId === p.id)
    if (pts.length === 0) continue
    const recent = pts.some((t) => t.completedAt && t.completedAt.slice(0, 10) >= weekAgo)
    const created = p.createdAt.slice(0, 10)
    if (!recent && created <= weekAgo) {
      out.push({ key: `stalled:${p.id}:${i.today.slice(0, 8)}`, type: 'stalled', companionId: 'atlas', title: p.title, message: 'โปรเจกต์นี้นิ่งมา 7 วัน ยังสำคัญอยู่ไหม หรือควรลดขอบเขต', taskId: null, weight: 50 })
    }
  }

  // J: self-selected routine missed 3 of last 5 days
  for (const b of i.routines) {
    if (b.status !== 'active' || b.recurrence !== 'daily' || b.essential) continue
    let missed = 0
    for (let d = 1; d <= 5; d++) {
      const e = i.dayLogs[addDays(i.today, -d)]?.[b.id]
      if (e && (e.status === 'skipped' || e.status === 'rescheduled')) missed++
    }
    if (missed >= 3) {
      out.push({ key: `routine:${b.id}:${i.today}`, type: 'missed_routine', companionId: 'j', title: b.title, message: 'กิจวัตรนี้หลุดบ่อย ลองย่อให้สั้นลงหรือย้ายเวลาดีไหม', taskId: null, weight: 40 })
    }
  }

  // Muse: saved content ideas
  const ideas = i.content.filter((c) => c.status === 'idea')
  if (ideas.length) {
    out.push({ key: `content:${ideas[0].id}`, type: 'content', companionId: 'muse', title: ideas[0].title, message: 'ไอเดียที่เธอเก็บไว้อาจกลายเป็นคอนเทนต์ที่ดีได้ ลองใช้ 5 นาทีเก็บประเด็นไหม', taskId: null, weight: 30 })
  }

  const now = Date.parse(i.nowIso)
  return out
    .filter((f) => !i.state.dismissed[f.key])
    .filter((f) => !i.state.snoozedUntil[f.key] || Date.parse(i.state.snoozedUntil[f.key]) <= now)
    .sort((a, b) => b.weight - a.weight)
}
