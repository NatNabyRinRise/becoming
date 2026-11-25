/**
 * Adapter interfaces for future integrations (spec §37).
 * None of these are connected in v0.3 — the UI marks them "not connected".
 * Secrets must live on a server/edge function, never in this frontend bundle.
 */
import type { RecommendationInput, Recommendation } from '../engine/recommendations'
import type { Task, RoutineBlock, JournalEntry } from '../types'

export interface NotionAdapter {
  importProjects(): Promise<{ title: string; tasks: Pick<Task, 'title' | 'estimatedMinutes'>[] }[]>
}
export interface CalendarAdapter {
  listFixedCommitments(date: string): Promise<Pick<RoutineBlock, 'title' | 'startTime' | 'duration'>[]>
}
export interface AIRecommendationAdapter {
  recommend(input: RecommendationInput): Promise<Recommendation>
}
export interface SyncAdapter {
  push(snapshot: unknown): Promise<void>
  pull(): Promise<unknown>
}
export interface VoiceAdapter {
  transcribe(audio: Blob): Promise<string>
}
export interface PushAdapter {
  schedule(at: Date, title: string, body: string): Promise<void>
}
export interface HealthAdapter {
  sleepHours(date: string): Promise<number | null>
}
export interface JournalExportAdapter {
  export(entries: JournalEntry[]): Promise<void>
}

export const INTEGRATIONS = [
  { id: 'notion', name: 'Notion' },
  { id: 'gcal', name: 'Google Calendar' },
  { id: 'ai', name: 'AI language model' },
  { id: 'supabase', name: 'Supabase (ซิงก์ข้ามอุปกรณ์)' },
  { id: 'voice', name: 'Voice interaction' },
  { id: 'push', name: 'Push notifications' },
  { id: 'health', name: 'Health data' },
] as const
