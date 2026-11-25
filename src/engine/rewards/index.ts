import type { RewardTransaction, Task, RewardRules } from '../../types'
import { SANCTUARY_ITEMS } from '../../data/seed'

/**
 * Idempotent award: each sourceEventId can only ever produce one XP transaction.
 * Returns the new list (unchanged if the event was already rewarded).
 */
export function awardOnce(
  txs: RewardTransaction[],
  sourceEventId: string,
  amount: number,
  reason: string,
  nowIso: string,
): { txs: RewardTransaction[]; awarded: boolean } {
  if (amount <= 0 || txs.some((t) => t.sourceEventId === sourceEventId && t.rewardType === 'xp')) {
    return { txs, awarded: false }
  }
  const coins = Math.max(1, Math.round(amount / 5))
  return {
    awarded: true,
    txs: [
      ...txs,
      { id: `tx_${sourceEventId}_xp`, sourceEventId, amount, rewardType: 'xp', reason, createdAt: nowIso },
      { id: `tx_${sourceEventId}_coins`, sourceEventId, amount: coins, rewardType: 'coins', reason, createdAt: nowIso },
    ],
  }
}

export function totals(txs: RewardTransaction[]): { xp: number; coins: number } {
  let xp = 0
  let coins = 0
  for (const t of txs) {
    if (t.rewardType === 'xp') xp += t.amount
    else coins += t.amount
  }
  return { xp, coins }
}

/** XP for completing a task (non One Thing). */
export function xpForTask(t: Task, rules: RewardRules): number {
  if (t.kind === 'health' || t.kind === 'recovery') return rules.health
  if (t.kind === 'family') return rules.family
  if (t.kind === 'brand') return rules.brand
  return rules.taskDefault
}

export function level(xp: number): { level: number; into: number; span: number } {
  // gentle curve: 100, 150, 200, ...
  let lvl = 1
  let need = 100
  let rest = xp
  while (rest >= need) {
    rest -= need
    lvl++
    need += 50
  }
  return { level: lvl, into: rest, span: need }
}

export function unlockedSanctuary(xp: number) {
  return SANCTUARY_ITEMS.map((i) => ({ ...i, unlocked: xp >= i.xp }))
}

/** Orb evolution stage 0-4 based on recorded progress. */
export function orbStage(xp: number): number {
  if (xp >= 1400) return 4
  if (xp >= 700) return 3
  if (xp >= 250) return 2
  if (xp >= 50) return 1
  return 0
}
