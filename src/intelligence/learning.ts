import type { BehaviorEvent, CoreRecommendation, RecommendationDraft, SignalWeight } from './types'

/**
 * Learn: turn the user's feedback into a weight per signal.
 * weight = geometric mean of acceptance and usefulness, smoothed (starts at 0.5, moves with evidence) so one answer
 * doesn't swing behavior too far. No model training needed — just statistics.
 */
export function computeWeights(recs: CoreRecommendation[]): Record<string, SignalWeight> {
  const out: Record<string, SignalWeight> = {}
  for (const r of recs) {
    if (r.deletedAt) continue
    const w = (out[r.signalKey] ??= { signalKey: r.signalKey, shown: 0, approved: 0, dismissed: 0, helpful: 0, notHelpful: 0, weight: 0.5 })
    w.shown++
    if (r.status === 'approved' || r.status === 'evaluated') w.approved++
    if (r.status === 'dismissed') w.dismissed++
    if (r.outcome === 'helpful') w.helpful++
    if (r.outcome === 'not_helpful') w.notHelpful++
  }
  for (const w of Object.values(out)) {
    // light prior (0.5 with the weight of one answer) so the user's own answers dominate quickly
    const acceptance = (w.approved + 0.5) / (w.approved + w.dismissed + 1)
    const usefulness = (w.helpful + 0.5) / (w.helpful + w.notHelpful + 1)
    w.weight = Math.min(1, Math.max(0, Math.round(Math.sqrt(acceptance * usefulness) * 100) / 100))
  }
  return out
}

export const WEIGHT_FLOOR = 0.3
export const COOLDOWN_DAYS = 7
export const EVALUATE_AFTER_DAYS = 3

const DAY = 86_400_000

/**
 * Decide which drafts become visible recommendations.
 * - skip a signal that already has an open recommendation
 * - respect a cooldown after the user answered the same signal
 * - skip signals the user has taught us don't work for them
 * - highest weight first, at most `limit`
 */
export function selectRecommendations(
  drafts: RecommendationDraft[],
  existing: CoreRecommendation[],
  weights: Record<string, SignalWeight>,
  now: Date,
  limit = 3,
): RecommendationDraft[] {
  const live = existing.filter((r) => !r.deletedAt)
  const openCount = live.filter((r) => r.status === 'proposed').length
  const room = Math.max(0, limit - openCount)
  return drafts
    .filter((d) => {
      const same = live.filter((r) => r.signalKey === d.signalKey)
      if (same.some((r) => r.status === 'proposed' || (r.status === 'approved' && !r.outcome))) return false
      const last = same.map((r) => Date.parse(r.decidedAt ?? r.createdAt)).sort((a, b) => b - a)[0]
      if (last && now.getTime() - last < COOLDOWN_DAYS * DAY) return false
      return (weights[d.signalKey]?.weight ?? 0.5) >= WEIGHT_FLOOR
    })
    .sort((a, b) => (weights[b.signalKey]?.weight ?? 0.5) - (weights[a.signalKey]?.weight ?? 0.5))
    .slice(0, room)
}

/** Approved recommendations old enough to ask "did it help?" */
export function dueForEvaluation(recs: CoreRecommendation[], now: Date): CoreRecommendation[] {
  return recs.filter((r) => !r.deletedAt && r.status === 'approved' && r.decidedAt && now.getTime() - Date.parse(r.decidedAt) >= EVALUATE_AFTER_DAYS * DAY)
}

export function eventCounts(events: BehaviorEvent[], sinceMs: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of events) if (Date.parse(e.occurredAt) >= sinceMs) out[e.type] = (out[e.type] ?? 0) + 1
  return out
}
