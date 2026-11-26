import type { ContextPack, SourceRef, WriteBackEvent } from '../types'

/**
 * Nexus — Intelligence & Memory. Pulls context, past decisions, preferences and patterns.
 * Nexus never decides priority; it only adds evidence.
 */
export interface NexusMemory {
  kind: string
  content: string
}

const keyOf = (r: SourceRef | null) => (r ? `${r.source}:${r.externalId}` : '')

export function contextPack(args: { ref: SourceRef | null; project?: string; events: WriteBackEvent[]; memories: NexusMemory[] }): ContextPack {
  const k = keyOf(args.ref)
  const mine = args.events.filter((e) => keyOf(e.target) === k)
  const similarPast = args.events
    .filter((e) => e.payload.kind === 'decision' && keyOf(e.target) !== k)
    .slice(-3)
    .reverse()
    .map((e) => (e.payload.kind === 'decision' ? `${e.payload.decidedOn}: "${e.payload.question}" → ${e.payload.optionLabel}` : ''))
  const reviewFeedback = args.events
    .filter((e) => e.payload.kind === 'review' && e.payload.feedback.trim())
    .slice(-2)
    .map((e) => (e.payload.kind === 'review' ? e.payload.feedback.trim() : ''))
  const preferences = [
    ...args.memories.filter((m) => m.kind === 'preference' || m.kind === 'goal').map((m) => m.content),
    ...reviewFeedback.map((f) => `Feedback ล่าสุด: ${f}`),
  ].slice(0, 3)
  const deferred = mine.filter((e) => e.payload.kind === 'action' && e.payload.outcome === 'deferred').length
  const patterns: string[] = []
  if (deferred >= 2) patterns.push(`งานนี้ถูกเลื่อนมาแล้ว ${deferred} ครั้ง ลองแตกให้เล็กลงหรือบอกทีมว่าติดอะไร`)
  const revise = args.events.filter((e) => e.payload.kind === 'review' && e.payload.outcome === 'revise').length
  if (revise >= 2) patterns.push(`เธอขอแก้งาน AI ไปแล้ว ${revise} ครั้ง — อาจต้องบอกทีมให้ชัดขึ้นตั้งแต่ต้น`)
  return { similarPast, preferences, patterns }
}

/** Learning signals from Eve's feedback, for the AI Company and future agents. */
export function learningSignals(events: WriteBackEvent[]): string[] {
  const count = (pred: (e: WriteBackEvent) => boolean) => events.filter(pred).length
  const out: string[] = []
  const done = count((e) => e.payload.kind === 'action' && e.payload.outcome === 'done')
  const deferred = count((e) => e.payload.kind === 'action' && e.payload.outcome === 'deferred')
  if (done + deferred > 0) out.push(`ทำงาน Action สำเร็จ ${done} / เลื่อน ${deferred}`)
  const approved = count((e) => e.payload.kind === 'review' && e.payload.outcome === 'approved')
  const revise = count((e) => e.payload.kind === 'review' && e.payload.outcome !== 'approved')
  if (approved + revise > 0) out.push(`Review: อนุมัติ ${approved} / ขอแก้หรือปฏิเสธ ${revise}`)
  const decisions = count((e) => e.payload.kind === 'decision')
  if (decisions > 0) out.push(`ตัดสินใจไปแล้ว ${decisions} เรื่อง`)
  const life = count((e) => e.payload.kind === 'life' && e.payload.outcome === 'done')
  if (life > 0) out.push(`ดูแลชีวิตสำเร็จ ${life} ครั้ง`)
  return out
}
