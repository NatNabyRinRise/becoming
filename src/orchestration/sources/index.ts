import type { BusinessContext } from '../types'
import type { WriteBackSink } from './adapter'
import { mockAdapter, mockSink } from './mock'
import { notionAdapter, notionSink, SourceUnavailable, type UnavailableReason } from './notion'

/**
 * Which adapter BECOMING reads from.
 *  - 'auto' (default): Notion through the notion-bridge function. If Notion can't be reached,
 *    BECOMING shows NO business items (and says why) rather than silently showing demo data,
 *    so every device shows the same truth.
 *  - 'mock': the local demo data, only when Eve picks it.
 */
export type SourcePreference = 'auto' | 'mock'
const PREF_KEY = 'becoming-source'

export function sourcePreference(): SourcePreference {
  try {
    return localStorage.getItem(PREF_KEY) === 'mock' ? 'mock' : 'auto'
  } catch {
    return 'auto'
  }
}
export function setSourcePreference(p: SourcePreference) {
  try {
    localStorage.setItem(PREF_KEY, p)
  } catch {
    /* ignore */
  }
}

export interface SourceStatus {
  /** 'none' = Notion unreachable: business context is empty. */
  adapter: 'notion' | 'mock' | 'none'
  /** Why Notion could not be read (null when on Notion or demo data was chosen). */
  fallback: { reason: UnavailableReason; message: string } | null
}

export async function loadContext(today: string, now: Date): Promise<{ ctx: BusinessContext; status: SourceStatus }> {
  if (sourcePreference() === 'auto') {
    try {
      const ctx = await notionAdapter.load({ today, now })
      return { ctx, status: { adapter: 'notion', fallback: null } }
    } catch (e) {
      const fallback = e instanceof SourceUnavailable ? { reason: e.reason, message: e.message } : { reason: 'error' as const, message: e instanceof Error ? e.message : String(e) }
      return { ctx: emptyContext(now), status: { adapter: 'none', fallback } }
    }
  }
  return { ctx: await mockAdapter.load({ today, now }), status: { adapter: 'mock', fallback: null } }
}

/** No business items: what BECOMING shows when Notion can't be read. */
export function emptyContext(now: Date): BusinessContext {
  return { companyTasks: [], ideas: [], life: { items: [], constraints: [], defaultFocusMinutes: 60 }, ceoReview: null, loadedAt: now.toISOString(), adapter: 'none' }
}

export function adapterLabel(id: string): string {
  if (id === 'none') return 'ยังไม่ได้เชื่อม Notion'
  return id === 'notion' ? notionAdapter.label : mockAdapter.label
}

/** Each answer goes back to the adapter its record came from. */
export function sinkFor(via: string | undefined): WriteBackSink {
  return via === 'notion' ? notionSink : mockSink
}

export type { BusinessSourceAdapter, WriteBackSink, WriteBackResult } from './adapter'
