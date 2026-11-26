import type {
  BusinessContext,
  CeoReview,
  CompanyTask,
  LabIdea,
  LifeOsSnapshot,
  SourceId,
  SourceRef,
} from '../types'
import type { BusinessSourceAdapter, WriteBackSink } from './adapter'
import companyRaw from './mock/company-tasks.json'
import ideaRaw from './mock/idea-lab.json'
import lifeRaw from './mock/life-os.json'
import ceoRaw from './mock/ceo-review.json'
import { addDays } from '../../utils/date'

/** Raw mock rows look like what an API would return; dates are relative so the demo never goes stale. */
type Raw = Record<string, unknown> & { id: string; url?: string; updatedAt?: string }

const ref = (source: SourceId, r: Raw): SourceRef => ({ source, externalId: r.id, url: r.url ?? null, updatedAt: r.updatedAt ?? null })

export function normalizeCompanyTasks(rows: Raw[], today: string): CompanyTask[] {
  return rows.map((r) => {
    const { id: _id, url: _url, dueInDays, ...rest } = r as Raw & { dueInDays?: number }
    const base = rest as unknown as Omit<CompanyTask, 'ref' | 'dueDate'>
    return {
      ...base,
      tags: base.tags ?? [],
      ref: ref('company_tasks', r),
      dueDate: typeof dueInDays === 'number' ? addDays(today, dueInDays) : ((r.dueDate as string) ?? null),
    }
  })
}

export function normalizeIdeas(rows: Raw[]): LabIdea[] {
  return rows.map((r) => ({
    ref: ref('idea_lab', r),
    title: String(r.title),
    note: String(r.note ?? ''),
    stage: r.stage as LabIdea['stage'],
    tags: (r.tags as string[]) ?? [],
    capturedAt: (r.capturedAt as string) ?? null,
  }))
}

export function normalizeLife(raw: { defaultFocusMinutes: number; items: Raw[]; constraints: Raw[] }): LifeOsSnapshot {
  return {
    defaultFocusMinutes: raw.defaultFocusMinutes,
    items: raw.items.map((r) => ({
      ref: ref('life_os', r),
      kind: r.kind as LifeOsSnapshot['items'][number]['kind'],
      title: String(r.title),
      minutes: Number(r.minutes),
      time: (r.time as string) ?? null,
      essential: !!r.essential,
      streak: Number(r.streak ?? 0),
      note: String(r.note ?? ''),
    })),
    constraints: raw.constraints.map((r) => ({
      ref: ref('life_os', r),
      title: String(r.title),
      from: (r.from as string) ?? null,
      to: (r.to as string) ?? null,
      minutes: Number(r.minutes ?? 0),
    })),
  }
}

export function normalizeCeoReview(rows: Raw[], today: string): CeoReview | null {
  const r = rows[0] as (Raw & { weekStartOffsetDays?: number }) | undefined
  if (!r) return null
  const { id: _id, url: _url, weekStartOffsetDays, ...rest } = r
  return {
    ...(rest as unknown as Omit<CeoReview, 'ref' | 'weekStart'>),
    ref: ref('ceo_review', r),
    weekStart: addDays(today, weekStartOffsetDays ?? -7),
  }
}

/** Build the mock context synchronously (handy for tests). */
export function mockContext(today: string, now: Date = new Date()): BusinessContext {
  return {
    companyTasks: normalizeCompanyTasks(companyRaw.records as Raw[], today),
    ideas: normalizeIdeas(ideaRaw.records as Raw[]),
    life: normalizeLife(lifeRaw as unknown as { defaultFocusMinutes: number; items: Raw[]; constraints: Raw[] }),
    ceoReview: normalizeCeoReview(ceoRaw.records as Raw[], today),
    loadedAt: now.toISOString(),
    adapter: 'mock',
  }
}

export const mockAdapter: BusinessSourceAdapter = {
  id: 'mock',
  label: 'ข้อมูลจำลอง (Local JSON)',
  sources: ['company_tasks', 'idea_lab', 'life_os', 'ceo_review'],
  load: async ({ today, now }) => mockContext(today, now),
}

/** Mock delivery: acknowledges every event. A real sink would PATCH the original record. */
export const mockSink: WriteBackSink = {
  id: 'mock',
  deliver: async (events) => ({ sent: events.map((e) => e.id), failed: [] }),
}
