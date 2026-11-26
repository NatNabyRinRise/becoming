import { getSupabase } from '../../sync/supabase'
import type { BusinessContext, WriteBackEvent } from '../types'
import type { BusinessSourceAdapter, WriteBackResult, WriteBackSink } from './adapter'

/**
 * Real AI Company workspace in Notion, reached through the `notion-bridge`
 * Supabase Edge Function. The Notion token lives only on the server.
 */
export type UnavailableReason = 'not_signed_in' | 'not_deployed' | 'not_configured' | 'forbidden' | 'rate_limited' | 'error'
export class SourceUnavailable extends Error {
  reason: UnavailableReason
  constructor(reason: UnavailableReason, message: string) {
    super(message)
    this.reason = reason
  }
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase()
  if (!sb) throw new SourceUnavailable('not_signed_in', 'ยังไม่ได้ตั้งค่าการเข้าสู่ระบบ')
  const { data: s } = await sb.auth.getSession()
  if (!s.session) throw new SourceUnavailable('not_signed_in', 'เข้าสู่ระบบก่อนเพื่ออ่านข้อมูลจาก Notion')
  const { data, error } = await sb.functions.invoke<T & { error?: string }>('notion-bridge', { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const status = ctx?.status
    let detail = ''
    try {
      detail = (await ctx?.json())?.error ?? ''
    } catch {
      /* ignore */
    }
    if (status === 429 || detail === 'rate_limited') throw new SourceUnavailable('rate_limited', 'Notion ขอให้พักสักครู่ (อ่านข้อมูลถี่เกินลิมิต) จะลองใหม่เองในอีก 1 นาที')
    if (status === 404) throw new SourceUnavailable('not_deployed', 'ยังไม่ได้ deploy ตัวเชื่อม Notion (notion-bridge)')
    if (status === 503 || detail === 'not_configured') throw new SourceUnavailable('not_configured', 'ยังไม่ได้ใส่ NOTION_TOKEN บน Supabase')
    if (status === 401 || status === 403) throw new SourceUnavailable('forbidden', detail || 'บัญชีนี้ไม่ได้รับสิทธิ์')
    throw new SourceUnavailable('error', detail || 'เชื่อม Notion ไม่สำเร็จ')
  }
  if (!data || (data as { error?: string }).error) throw new SourceUnavailable('error', (data as { error?: string })?.error ?? 'เชื่อม Notion ไม่สำเร็จ')
  return data as T
}

export const notionAdapter: BusinessSourceAdapter = {
  id: 'notion',
  label: 'Notion — AI Company Operating HQ',
  sources: ['company_tasks', 'idea_lab', 'life_os', 'ceo_review'],
  load: async ({ today }) => {
    const d = await invoke<BusinessContext>({ action: 'load', today })
    return {
      companyTasks: d.companyTasks ?? [],
      ideas: d.ideas ?? [],
      life: d.life ?? { items: [], constraints: [], defaultFocusMinutes: 60 },
      ceoReview: d.ceoReview ?? null,
      loadedAt: d.loadedAt ?? new Date().toISOString(),
      adapter: 'notion',
    }
  },
}

/** Only the fields Notion needs; never the whole local state. */
const slim = (e: WriteBackEvent) => ({ id: e.id, target: e.target, payload: e.payload, localDate: e.localDate })

export const notionSink: WriteBackSink = {
  id: 'notion',
  deliver: async (events): Promise<WriteBackResult> => {
    try {
      return await invoke<WriteBackResult>({ action: 'writeback', events: events.map(slim) })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { sent: [], failed: events.map((x) => ({ id: x.id, error: msg })) }
    }
  },
}

/**
 * One-way send from Eve's sandbox (Founder Mode) into Idea Inbox & Lab.
 * Creates a new page and returns its link. Nothing is read back.
 */
export async function pushToNotion(item: { kind: 'project' | 'idea'; title: string; description: string; milestones: { title: string; done: boolean }[]; microTasks: string[] }): Promise<{ url: string | null }> {
  const r = await invoke<{ url?: string | null }>({ action: 'push', item })
  return { url: r.url ?? null }
}
