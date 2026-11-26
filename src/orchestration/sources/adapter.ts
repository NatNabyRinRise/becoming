import type { BusinessContext, SourceId, WriteBackEvent } from '../types'

/**
 * Source adapters are the ONLY place that knows how the AI Company stores data.
 * Swap the mock for a real implementation (Notion, Supabase, REST…) by writing
 * another adapter that returns the same BusinessContext shape — nothing else
 * in BECOMING needs to change.
 */
export interface BusinessSourceAdapter {
  /** e.g. 'mock', 'notion' */
  id: string
  label: string
  /** Sources this adapter can read. */
  sources: SourceId[]
  load(opts: { today: string; now: Date }): Promise<BusinessContext>
}

export interface WriteBackResult {
  sent: string[]
  failed: { id: string; error: string }[]
}

/** Receives Eve's answers (status / feedback / decisions / suggestions) and delivers them to the original source. */
export interface WriteBackSink {
  id: string
  deliver(events: WriteBackEvent[]): Promise<WriteBackResult>
}
