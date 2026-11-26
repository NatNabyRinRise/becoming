import type { CeoReview, CompanyTask, ContextPack, DecisionFrame, IdeaFrame, IdeaStage, LabIdea, ReviewFrame } from '../types'

/**
 * Atlas — Business Partner. Strategy, judgment, decision framing.
 * Atlas never commits work. New business suggestions go back through J to the AI Company.
 */

const PRIORITY_TH = { p1: 'ความสำคัญสูงสุด (P1)', p2: 'สำคัญ (P2)', p3: 'รองลงมา (P3)' } as const

function inCeoPriorities(text: string, ceo: CeoReview | null): boolean {
  if (!ceo) return false
  const words = text.split(/\s+/).filter((w) => w.length >= 4)
  return ceo.priorities.some((p) => words.some((w) => p.includes(w)) || text.includes(p))
}

export function frameReview(task: CompanyTask, ceo: CeoReview | null, ctx: ContextPack | null): ReviewFrame {
  const out = task.output ?? { agent: task.requestedBy, title: task.title, summary: task.summary, original: task.summary, highlights: [], createdAt: null }
  const keyPoints = [...out.highlights, out.summary].filter(Boolean).slice(0, 3)
  const mismatch: string[] = []
  if (/ประมาณการ|estimate|สมมติ/.test(out.original + out.highlights.join(' '))) mismatch.push('มีตัวเลขที่ยังเป็นประมาณการ ควรเช็กแหล่งที่มา')
  if (task.tags.includes('brand') || task.tags.includes('creative')) mismatch.push('ดูว่า tone และภาพตรงกับตัวตนของเธอจริงไหม')
  if (ctx?.preferences.length) mismatch.push(`เทียบกับสิ่งที่เธอเคยบอกไว้: ${ctx.preferences[0]}`)
  if (mismatch.length === 0) mismatch.push('ดูว่าตรงกับกลุ่มลูกค้าและทิศทางที่เธอตั้งใจไหม')
  return {
    whatAiCreated: `${out.agent} ทำ "${out.title}" มาแล้ว: ${out.summary}`,
    whyItMatters: `${PRIORITY_TH[task.priority]} ของ ${task.project}${inCeoPriorities(task.title, ceo) ? ' และอยู่ในเป้าหมายสัปดาห์นี้' : ''} — ทีมเดินต่อได้เมื่อเธอให้ Feedback`,
    keyPoints,
    possibleMismatch: mismatch.slice(0, 3),
    questions: ['สิ่งนี้ตรงกับสิ่งที่เธอคิดไว้ไหม?', 'มีอะไรที่ขาดหรือเกินไป?', 'ถ้าแก้ได้เรื่องเดียว จะแก้อะไร?'],
    originalUrl: task.ref.url,
    original: out.original,
  }
}

export function frameDecision(task: CompanyTask, capacityImpact: string | null): DecisionFrame {
  const d = task.decision!
  const scored = d.options.map((o) => ({ o, s: o.pros.length - o.cons.length - (o.weeklyMinutes ?? 0) / 240 }))
  const pickId = d.agentRecommendation ?? scored.sort((a, b) => b.s - a.s)[0]?.o.id ?? null
  const pick = d.options.find((o) => o.id === pickId) ?? null
  const risks = [
    ...(pick ? pick.cons.map((c) => `${pick.label}: ${c}`) : []),
    `ถ้ายังไม่ตัดสินใจ ${task.requestedBy} จะหยุดรอ`,
  ]
  const impact = [
    `ปลดล็อกงานของ ${task.requestedBy} ใน ${task.project}`,
    ...(d.affectsCapacity ? ['กระทบเวลาและภาระงานของเธอ'] : []),
  ]
  return {
    question: d.question,
    options: d.options,
    recommendation: {
      optionId: pick?.id ?? null,
      text: pick
        ? `Atlas แนะนำ "${pick.label}" — ${pick.pros.join(', ') || pick.summary}${d.agentRecommendation ? ' (ตรงกับที่ทีม AI Company เสนอ)' : ''}`
        : 'Atlas ยังไม่มีคำแนะนำที่ชัดพอ ลองดูข้อดีข้อเสียแต่ละทาง',
    },
    risks,
    impact,
    deadline: task.dueDate,
    next: d.next,
    capacityImpact,
  }
}

const NEXT_STAGE: Partial<Record<IdeaStage, IdeaStage>> = { capture: 'expand', expand: 'validate', validate: 'commit_requested' }

export function challengeIdea(idea: LabIdea, ceo: CeoReview | null, muse: { expansion: string[]; angle: string; experiment: string; alternative: string }): IdeaFrame {
  const fits = inCeoPriorities(idea.title + ' ' + idea.note, ceo)
  return {
    ...muse,
    challenge: [
      fits ? 'สอดคล้องกับเป้าหมายสัปดาห์นี้' : 'ยังไม่อยู่ในเป้าหมายสัปดาห์นี้ — ถ้าทำตอนนี้จะแย่งเวลาจากงานหลักไหม?',
      'ต้องใช้เวลาเธอเท่าไหร่ต่อสัปดาห์?',
      'จะรู้ได้อย่างไรว่าไอเดียนี้ได้ผล (ตัวชี้วัด 1 ตัว)?',
    ],
    whatNotToDo: 'อย่าเพิ่งสร้างของจริงหรือเปิดโปรเจกต์ใหม่ จนกว่าจะผ่าน Validate และ AI Company Commit',
    nextStage: NEXT_STAGE[idea.stage] ?? null,
  }
}
