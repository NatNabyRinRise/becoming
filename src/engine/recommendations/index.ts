import type { Circumstance, CompanionId, EnergyThresholds, MissionId, Task } from '../../types'
import { MISSION_META, MISSION_ORDER } from '../../data/seed'

export interface RecommendationInput {
  tasks: Task[]
  availableMinutes: number
  energy: number
  nowMin?: number
  circumstances?: Circumstance
  thresholds: EnergyThresholds
  missionPriorities?: MissionId[]
  primaryProjectId?: string | null
  excludeIds?: string[]
  /** prefer tasks from this mission (e.g. Rescue keeps the business thread) */
  preferMission?: MissionId | null
  /** restrict to these kinds (e.g. opportunity window "work" vs everything) */
  allowKinds?: Task['kind'][]
}

export type Recommendation =
  | {
      kind: 'task'
      task: Task
      minutes: number
      companionId: CompanionId
      reason: string
      score: number
      alternatives: Task[]
    }
  | {
      kind: 'recovery'
      minutes: number
      title: string
      companionId: CompanionId
      reason: string
      light: Task | null // optional light activity
    }
  | {
      kind: 'smaller'
      minutes: number
      title: string // clearly-identified suggestion
      basedOn: Task
      companionId: CompanionId
      reason: string
    }

/** Interface so a future AI provider can replace the local engine. */
export interface RecommendationProvider {
  recommend(input: RecommendationInput): Recommendation
}

const PRIORITY_SCORE = { high: 30, medium: 18, low: 8 } as const
const ENERGY_RANK = { low: 0, medium: 1, high: 2 } as const

export function remainingMinutes(t: Task): number {
  return Math.max(5, t.estimatedMinutes - (t.status === 'in_progress' ? t.actualMinutes : 0))
}

export function companionFor(t: Task): CompanionId {
  if (t.kind === 'brand') return 'muse'
  if (t.kind === 'health' || t.kind === 'recovery' || t.kind === 'family') return 'bloom'
  return MISSION_META[t.missionId]?.companion ?? 'j'
}

export function isActionable(t: Task, all: Task[]): boolean {
  if (t.status !== 'todo' && t.status !== 'in_progress') return false
  return t.dependencies.every((d) => {
    const dep = all.find((x) => x.id === d)
    return !dep || dep.status === 'done'
  })
}

export function energyBand(energy: number, th: EnergyThresholds): 'recovery' | 'low' | 'normal' {
  if (energy < th.recovery) return 'recovery'
  if (energy < th.lowEffort) return 'low'
  return 'normal'
}

export function scoreTask(t: Task, input: RecommendationInput): number {
  const order = input.missionPriorities?.length ? input.missionPriorities : MISSION_ORDER
  const idx = order.indexOf(t.missionId)
  const missionScore = idx < 0 ? 0 : (order.length - idx) * 4
  let s = PRIORITY_SCORE[t.priority] + missionScore
  if (input.primaryProjectId && t.projectId === input.primaryProjectId) s += 10
  if (input.preferMission && t.missionId === input.preferMission) s += 8
  if (t.status === 'in_progress') s += 6
  s += Math.min(t.postponementCount, 4) * 2
  // use the window well: larger meaningful deliverable when there is more time
  const fit = remainingMinutes(t) / Math.max(1, input.availableMinutes)
  s += fit * 14
  // energy fit
  const band = energyBand(input.energy, input.thresholds)
  const need = ENERGY_RANK[t.energyRequirement]
  if (band === 'low') s -= need * 14
  if (band === 'normal' && input.energy >= 75 && need === 2) s += 4
  // circumstances
  if (input.circumstances === 'baby' || input.circumstances === 'unexpected') s -= remainingMinutes(t) > 20 ? 6 : 0
  if (input.circumstances === 'high_focus') s += need * 3
  if (input.circumstances === 'low_energy') s -= need * 8
  return Math.round(s * 10) / 10
}

/**
 * Deterministic local recommender (spec §23).
 * 1 protected commitments are handled by the caller via availableMinutes.
 */
export function recommend(input: RecommendationInput): Recommendation {
  const { tasks, availableMinutes, energy, thresholds } = input
  const band = energyBand(energy, thresholds)
  const exclude = new Set(input.excludeIds ?? [])

  const lightTask = (max: number) =>
    tasks
      .filter((t) => isActionable(t, tasks) && !exclude.has(t.id) && t.energyRequirement === 'low' && remainingMinutes(t) <= max)
      .sort((a, b) => scoreTask(b, input) - scoreTask(a, input))[0] ?? null

  if (availableMinutes <= 0) {
    return {
      kind: 'recovery',
      minutes: 0,
      title: 'วันนี้ไม่ต้องทำงานเพิ่ม',
      companionId: 'bloom',
      reason: 'ไม่มีเวลาว่างก็ไม่เป็นไร งานที่ไม่ด่วนจะรอเธอในคิวทบทวน',
      light: null,
    }
  }

  if (band === 'recovery' || input.circumstances === 'low_energy' && energy < thresholds.recovery) {
    return {
      kind: 'recovery',
      minutes: Math.min(availableMinutes, 20),
      title: 'พักฟื้นพลัง',
      companionId: 'bloom',
      reason: 'พลังงานเหลือน้อย พักก่อนดีกว่า ถ้าอยากขยับนิดหน่อยมีงานเบา ๆ ให้เลือก',
      light: lightTask(Math.min(availableMinutes, 10)),
    }
  }

  // 3. filter completed / blocked, 4. fit to window
  let pool = tasks.filter((t) => isActionable(t, tasks) && !exclude.has(t.id))
  if (input.allowKinds) pool = pool.filter((t) => input.allowKinds!.includes(t.kind))
  if (band === 'low') pool = pool.filter((t) => t.energyRequirement !== 'high')
  const fitting = pool.filter((t) => remainingMinutes(t) <= availableMinutes)

  if (fitting.length === 0) {
    const big = pool.sort((a, b) => scoreTask(b, input) - scoreTask(a, input))[0]
    if (big) {
      const mins = Math.max(5, Math.min(availableMinutes, 15))
      return {
        kind: 'smaller',
        minutes: mins,
        title: `ขั้นแรก ${mins} นาทีของ: ${big.title}`,
        basedOn: big,
        companionId: 'atlas',
        reason: 'งานเต็มใหญ่เกินเวลาที่มี ลองทำขั้นเล็กที่สุดที่ยังมีความหมาย',
      }
    }
    return {
      kind: 'recovery',
      minutes: Math.min(availableMinutes, 15),
      title: 'พักหายใจ หรือเก็บไอเดียสั้น ๆ',
      companionId: 'bloom',
      reason: 'ตอนนี้ไม่มีงานที่พอดีกับเวลา ใช้ช่วงนี้พักได้เต็มที่',
      light: null,
    }
  }

  // 5-7 score and select
  const ranked = [...fitting].sort((a, b) => scoreTask(b, input) - scoreTask(a, input) || a.id.localeCompare(b.id))
  const best = ranked[0]
  const companionId = companionFor(best)
  return {
    kind: 'task',
    task: best,
    minutes: remainingMinutes(best),
    companionId,
    reason: explain(best, input, band),
    score: scoreTask(best, input),
    alternatives: ranked.slice(1, 4),
  }
}

function explain(t: Task, input: RecommendationInput, band: 'low' | 'normal' | 'recovery'): string {
  const m = MISSION_META[t.missionId]
  const mins = remainingMinutes(t)
  if (band === 'low') return `พลังงานยังไม่เต็ม งานนี้ใช้แรงน้อยและพอดีกับ ${input.availableMinutes} นาที`
  if (t.status === 'in_progress') return `ต่อจากที่ทำค้างไว้ อีกประมาณ ${mins} นาที`
  if (t.postponementCount >= 2) return `งานนี้ถูกเลื่อนมา ${t.postponementCount} ครั้ง ลองปิดให้ได้วันนี้`
  return `ช่วยภารกิจ ${m.title} และพอดีกับเวลา ${input.availableMinutes} นาที`
}

export const localRecommendationProvider: RecommendationProvider = { recommend }
