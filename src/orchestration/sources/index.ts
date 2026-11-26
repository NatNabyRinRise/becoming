import type { BusinessContext } from '../types'
import type { WriteBackSink } from './adapter'
import { mockAdapter, mockSink } from './mock'
import { notionAdapter, notionSink, SourceUnavailable, type UnavailableReason } from './notion'

/**
 * Which adapter BECOMING reads from.
 *  - 'auto' (default): Notion through the notion-bridge function when it is set up, otherwise mock JSON.
 *  - 'mock': always the local demo data.
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
  adapter: 'notion' | 'mock'
  /** Why BECOMING fell back to mock data (null when on Notion or mock was chosen). */
  fallback: { reason: UnavailableReason; message: string } | null
}

export async function loadContext(today: string, now: Date): Promise<{ ctx: BusinessContext; status: SourceStatus }> {
  if (sourcePreference() === 'auto') {
    try {
      const ctx = await notionAdapter.load({ today, now })
      return { ctx, status: { adapter: 'notion', fallback: null } }
    } catch (e) {
      const fallback = e instanceof SourceUnavailable ? { reason: e.reason, message: e.message } : { reason: 'error' as const, message: e instanceof Error ? e.message : String(e) }
      return { ctx: await mockAdapter.load({ today, now }), status: { adapter: 'mock', fallback } }
    }
  }
  return { ctx: await mockAdapter.load({ today, now }), status: { adapter: 'mock', fallback: null } }
}

export function adapterLabel(id: string): string {
  return id === 'notion' ? notionAdapter.label : mockAdapter.label
}

/** Each answer goes back to the adapter its record came from. */
export function sinkFor(via: string | undefined): WriteBackSink {
  return via === 'notion' ? notionSink : mockSink
}

export type { BusinessSourceAdapter, WriteBackSink, WriteBackResult } from './adapter'
