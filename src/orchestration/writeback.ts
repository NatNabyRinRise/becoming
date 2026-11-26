import type {
  AttentionItem,
  BecomingOutputKind,
  BusinessSuggestion,
  LocalDate,
  OrchestrationState,
  RoleId,
  SourceRef,
  WriteBackEvent,
  WriteBackPayload,
} from './types'
import { ALLOWED_OUTPUT_KINDS } from './types'

/** Guardrail 2: BECOMING may only create these kinds of things. */
export function assertBecomingOutput(kind: string): asserts kind is BecomingOutputKind {
  if (!(ALLOWED_OUTPUT_KINDS as readonly string[]).includes(kind)) {
    throw new Error(`BECOMING ห้ามสร้าง "${kind}" — Business Task ต้อง Commit ใน AI Company เท่านั้น`)
  }
}

let seq = 0
const eid = () => `wb_${Date.now().toString(36)}_${(seq++).toString(36)}`

/** Which payload kinds are valid for an attention item (keeps answers matched to the source record). */
export function payloadKindFor(item: AttentionItem): WriteBackPayload['kind'] | null {
  if (item.type === 'do') return 'action'
  if (item.type === 'review') return 'review'
  if (item.type === 'decide') return 'decision'
  if (item.type === 'think') return item.idea ? 'idea' : null
  if (item.type === 'life') return item.ref ? 'life' : null
  return null
}

export function makeEvent(args: { target: SourceRef | null; title: string; payload: WriteBackPayload; now: Date; localDate: LocalDate }): WriteBackEvent {
  if (args.payload.kind === 'decision' && !args.payload.optionId) throw new Error('Decision ต้องมีตัวเลือกที่เลือก')
  if (args.payload.kind === 'suggestion' && args.payload.suggestion.status !== 'suggestion') throw new Error('Suggestion ต้องมีสถานะ Suggestion')
  return {
    id: eid(),
    target: args.target,
    title: args.title,
    payload: args.payload,
    createdAt: args.now.toISOString(),
    localDate: args.localDate,
    delivery: 'pending',
    sentAt: null,
  }
}

/** Guardrail 3 & 4: a business suggestion is created as status "suggestion" and travels back to the AI Company. */
export function makeSuggestion(args: { title: string; rationale: string; proposedBy: RoleId; relatedTo: SourceRef | null; now: Date }): BusinessSuggestion {
  return {
    id: `sg_${Date.now().toString(36)}_${(seq++).toString(36)}`,
    kind: 'suggestion',
    status: 'suggestion',
    title: args.title,
    rationale: args.rationale,
    proposedBy: args.proposedBy,
    relatedTo: args.relatedTo,
    createdAt: args.now.toISOString(),
  }
}

export function recordEvent(s: OrchestrationState, e: WriteBackEvent): OrchestrationState {
  return { ...s, events: [...s.events, e] }
}

export function pendingEvents(s: OrchestrationState): WriteBackEvent[] {
  return s.events.filter((e) => e.delivery !== 'sent')
}

export function markDelivered(s: OrchestrationState, sent: string[], failed: (string | { id: string; error: string })[], now: Date): OrchestrationState {
  const sentSet = new Set(sent)
  const failMap = new Map(failed.map((f) => (typeof f === 'string' ? [f, null] : [f.id, f.error])))
  const at = now.toISOString()
  const events = s.events.map((e) =>
    sentSet.has(e.id) ? { ...e, delivery: 'sent' as const, sentAt: at, error: null } : failMap.has(e.id) ? { ...e, delivery: 'failed' as const, error: failMap.get(e.id) ?? null } : e,
  )
  const sentSuggestionIds = new Set(events.filter((e) => sentSet.has(e.id) && e.payload.kind === 'suggestion').map((e) => (e.payload.kind === 'suggestion' ? e.payload.suggestion.id : '')))
  return {
    ...s,
    events,
    suggestions: s.suggestions.map((x) => (sentSuggestionIds.has(x.id) && x.status === 'suggestion' ? { ...x, status: 'sent' as const } : x)),
    lastSentAt: sent.length ? at : s.lastSentAt,
  }
}

/** Short Thai label for an outcome (UI + outbox). */
export function outcomeLabel(p: WriteBackPayload): string {
  switch (p.kind) {
    case 'action':
      return { done: 'ทำเสร็จ', deferred: 'เลื่อน', blocked: 'ติดปัญหา' }[p.outcome]
    case 'review':
      return { approved: 'อนุมัติ', revise: 'ขอแก้', rejected: 'ไม่ผ่าน' }[p.outcome]
    case 'decision':
      return `เลือก: ${p.optionLabel}`
    case 'idea':
      return { explore: 'สำรวจต่อ', validate: 'ทดสอบ', park: 'พักไว้', kill: 'ปิดไอเดีย', commit: 'ขอ Commit' }[p.outcome]
    case 'life':
      return { done: 'ทำแล้ว', skipped: 'ข้าม', adjusted: 'ปรับ' }[p.outcome]
    case 'suggestion':
      return 'ข้อเสนอ (Suggestion)'
  }
}
