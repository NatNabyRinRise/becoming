import type { Analyzer } from './analyzers'
import { BASELINE_ANALYZERS } from './analyzers'
import type { CoreAgentId } from './types'

/**
 * Agent registry — the plug-in point for the AI team.
 * Each agent is turned on one at a time. An agent contributes analyzers
 * (local, rule-based) and later can call a server-side AI function with the
 * context from `buildAgentContext()`. Everything it proposes goes through
 * Human Approval in the Intelligence Core before it takes effect.
 */
export interface IntelligenceAgent {
  id: CoreAgentId
  name: string
  role: string
  roleTh: string
  status: 'active' | 'planned'
  analyzers: Analyzer[]
}

export const AGENTS: IntelligenceAgent[] = [
  { id: 'core', name: 'Intelligence Core', role: 'Shared brain', roleTh: 'สมองกลางของทีม (ทำงานตามกฎ + เรียนรู้จากผลตอบรับ)', status: 'active', analyzers: BASELINE_ANALYZERS },
  { id: 'j', name: 'J', role: 'Chief of Staff', roleTh: 'ประสานงานและจัดลำดับความสำคัญ', status: 'planned', analyzers: [] },
  { id: 'atlas', name: 'Atlas', role: 'Business', roleTh: 'ธุรกิจ เป้าหมาย และการลงทุนเวลา', status: 'planned', analyzers: [] },
  { id: 'spark', name: 'Spark', role: 'Action', roleTh: 'ลงมือทำและโฟกัส', status: 'planned', analyzers: [] },
  { id: 'bloom', name: 'Bloom', role: 'Life', roleTh: 'สุขภาพ ครอบครัว และพลังงาน', status: 'planned', analyzers: [] },
  { id: 'muse', name: 'Muse', role: 'Creative', roleTh: 'ความคิดสร้างสรรค์และแบรนด์', status: 'planned', analyzers: [] },
]

export const agentName = (id: CoreAgentId | null) => AGENTS.find((a) => a.id === id)?.name ?? 'คุณ'
export const activeAnalyzers = (): Analyzer[] => AGENTS.filter((a) => a.status === 'active').flatMap((a) => a.analyzers)
