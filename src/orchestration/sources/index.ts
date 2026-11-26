import type { BusinessSourceAdapter, WriteBackSink } from './adapter'
import { mockAdapter, mockSink } from './mock'

/**
 * Which adapter BECOMING uses. v0.1 = mock JSON for all four sources.
 * To connect a real AI Company workspace later, implement BusinessSourceAdapter +
 * WriteBackSink (e.g. ./notion.ts calling a server function that holds the token)
 * and return it here.
 */
export function activeAdapter(): BusinessSourceAdapter {
  return mockAdapter
}
export function activeSink(): WriteBackSink {
  return mockSink
}
export type { BusinessSourceAdapter, WriteBackSink, WriteBackResult } from './adapter'
