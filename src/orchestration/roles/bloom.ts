import type { BusinessContext, Capacity, DecisionOption, PersonalContext } from '../types'

/**
 * Bloom — Life Guardian. Answers only "how much can Eve sustainably do right now?"
 * Bloom never changes business priority; it can only lower the workload recommendation.
 */
export function assessCapacity(ctx: BusinessContext, p: PersonalContext): Capacity {
  const energy = p.energy ?? 60
  const constraintMin = ctx.life.constraints.reduce((a, c) => a + c.minutes, 0)
  let focus = p.availableMinutes ?? Math.max(0, ctx.life.defaultFocusMinutes - constraintMin)
  if (p.circumstance === 'baby' || p.circumstance === 'unexpected') focus = Math.round(focus * 0.6)
  focus = Math.max(0, focus)

  const score = Math.round(energy * 0.6 + (Math.min(focus, 120) / 120) * 40)
  const level: Capacity['level'] =
    energy < p.recoveryThreshold ? 'recovery' : energy < p.lowEffortThreshold || focus < 20 ? 'light' : score >= 70 ? 'strong' : 'steady'
  const workloadLimit = { recovery: 1, light: 2, steady: 3, strong: 4 }[level]

  const ready = ctx.companyTasks.filter((t) => t.readyForBecoming && t.status !== 'done' && t.status !== 'cancelled')
  const demand = ready.reduce((a, t) => a + t.estimatedMinutes, 0)
  const overload = ready.length > 0 && (demand > Math.max(focus, 15) * 2 || ready.length > workloadLimit * 3)
  const warning = overload
    ? `งานที่รอเธอรวม ${demand} นาที แต่วันนี้มีเวลาโฟกัสราว ${focus} นาที เลือกทำแค่ ${workloadLimit} เรื่องก็พอ`
    : null

  const recovery =
    level === 'recovery'
      ? 'วันนี้พักให้เต็มที่ก่อน งานธุรกิจรอได้ ทำแค่เรื่องเล็กที่สุดถ้าอยากทำ'
      : level === 'light'
        ? 'แบ่งพัก 5 นาทีทุก 25 นาที ดื่มน้ำ และหยุดก่อนเหนื่อย'
        : 'อย่าลืมพักสายตาระหว่างช่วงโฟกัส และเก็บเวลาครอบครัวไว้ตามเดิม'

  const constraints = [
    ...ctx.life.constraints.map((c) => (c.from && c.to ? `${c.title} ${c.from}–${c.to}` : c.title)),
    ...p.familyCommitments,
    ...(p.essentialMinutesLeft > 0 ? [`กิจวัตรสำคัญที่เหลือวันนี้ ${p.essentialMinutesLeft} นาที`] : []),
  ]

  return { score, energy, focusMinutes: focus, level, workloadLimit, overload, warning, recovery, constraints }
}

/** For decisions that touch Eve's time: what each option costs her week. */
export function decisionCapacityImpact(options: DecisionOption[], weeklyFocusMinutes: number): string | null {
  const heavy = options.filter((o) => (o.weeklyMinutes ?? 0) > 0)
  if (heavy.length === 0) return null
  const parts = heavy.map((o) => {
    const share = weeklyFocusMinutes > 0 ? Math.round(((o.weeklyMinutes ?? 0) / weeklyFocusMinutes) * 100) : 100
    return `"${o.label}" ใช้เวลาเธอราว ${Math.round((o.weeklyMinutes ?? 0) / 60 * 10) / 10} ชม./สัปดาห์ (${share}% ของเวลาโฟกัส)`
  })
  return `Bloom: ${parts.join(' · ')}`
}
