import { COLLECTION_SCHEMAS, ProfileSchema, RECORD_SCHEMAS, SettingsSchema } from '../types/schemas'
import { SCHEMA_VERSION } from '../data/seed'
import { DOMAIN_KEYS, initialDomain, type DomainState } from './state'

export interface BackupFile {
  app: 'becoming'
  schemaVersion: number
  exportedAt: string
  data: DomainState
}

export interface ImportPreview {
  ok: boolean
  error?: string
  counts: { key: string; valid: number; invalid: number }[]
  data: DomainState | null
  exportedAt?: string
}

export function exportBackup(d: DomainState, now = new Date()): BackupFile {
  return { app: 'becoming', schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), data: structuredClone(d) }
}

/** Upgrade older persisted shapes. Add a case per schema bump. */
export function migrate(raw: Record<string, unknown>, fromVersion: number): Record<string, unknown> {
  const out = { ...raw }
  if (fromVersion < 1) {
    // v0 → v1: nothing persisted before v1; fill missing collections from defaults.
  }
  const base = initialDomain() as unknown as Record<string, unknown>
  for (const k of DOMAIN_KEYS) if (out[k] === undefined) out[k] = base[k]
  return out
}

/**
 * Validates a backup (or persisted blob) collection by collection.
 * Invalid records are dropped and counted, never silently merged.
 */
export function validateData(input: unknown): ImportPreview {
  let parsed: unknown = input
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input)
    } catch {
      return { ok: false, error: 'ไฟล์ไม่ใช่ JSON ที่ถูกต้อง', counts: [], data: null }
    }
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'ไม่พบข้อมูล', counts: [], data: null }
  const file = parsed as Partial<BackupFile>
  const raw = (file.app === 'becoming' && file.data ? file.data : parsed) as Record<string, unknown>
  if (file.app !== undefined && file.app !== 'becoming') return { ok: false, error: 'ไฟล์นี้ไม่ใช่ข้อมูลของ BECOMING', counts: [], data: null }
  if (!('tasks' in raw) && !('profile' in raw)) return { ok: false, error: 'ไม่พบข้อมูล BECOMING ในไฟล์', counts: [], data: null }

  const version = typeof file.schemaVersion === 'number' ? file.schemaVersion : SCHEMA_VERSION
  if (version > SCHEMA_VERSION) return { ok: false, error: 'ไฟล์มาจากเวอร์ชันที่ใหม่กว่าแอปนี้', counts: [], data: null }
  const migrated = migrate(raw, version)
  const base = initialDomain()
  const result = { ...base } as unknown as Record<string, unknown>
  const counts: ImportPreview['counts'] = []

  for (const [key, schema] of Object.entries(COLLECTION_SCHEMAS)) {
    const arr = Array.isArray(migrated[key]) ? (migrated[key] as unknown[]) : []
    const valid: unknown[] = []
    let invalid = 0
    const seen = new Set<string>()
    for (const item of arr) {
      const r = schema.safeParse(item)
      const idv = r.success ? String((r.data as { id: string }).id) : ''
      if (r.success && !seen.has(idv)) {
        seen.add(idv)
        valid.push(r.data)
      } else invalid++
    }
    result[key] = valid
    counts.push({ key, valid: valid.length, invalid })
  }
  // transactions must be unique per source/type
  const txSeen = new Set<string>()
  result.transactions = (result.transactions as { sourceEventId: string; rewardType: string }[]).filter((t) => {
    const k = t.sourceEventId + t.rewardType
    if (txSeen.has(k)) return false
    txSeen.add(k)
    return true
  })

  for (const [key, schema] of Object.entries(RECORD_SCHEMAS)) {
    const rec = migrated[key] && typeof migrated[key] === 'object' ? (migrated[key] as Record<string, unknown>) : {}
    const out: Record<string, unknown> = {}
    let invalid = 0
    for (const [k, v] of Object.entries(rec)) {
      const r = schema.safeParse(v)
      if (r.success) out[k] = r.data
      else invalid++
    }
    result[key] = out
    counts.push({ key, valid: Object.keys(out).length, invalid })
  }

  const prof = ProfileSchema.safeParse(migrated.profile)
  result.profile = prof.success ? { ...base.profile, ...prof.data, preferences: { ...base.profile.preferences, ...prof.data.preferences } } : base.profile
  const set = SettingsSchema.safeParse(migrated.settings)
  result.settings = set.success ? { ...base.settings, ...set.data, rewardRules: { ...base.settings.rewardRules, ...set.data.rewardRules }, schemaVersion: SCHEMA_VERSION } : base.settings
  counts.push({ key: 'profile', valid: prof.success ? 1 : 0, invalid: prof.success ? 0 : 1 })

  // simple passthrough objects (validated loosely by type)
  for (const k of ['dayLogs', 'gifts', 'plannedOneThing'] as const) {
    if (migrated[k] && typeof migrated[k] === 'object' && !Array.isArray(migrated[k])) result[k] = migrated[k]
  }
  for (const k of ['followUp', 'experiment'] as const) {
    if (migrated[k] && typeof migrated[k] === 'object') result[k] = { ...(base[k] as object), ...(migrated[k] as object) }
  }
  if (Array.isArray(migrated.weekly)) result.weekly = migrated.weekly
  const orch = migrated.orchestration as Record<string, unknown> | undefined
  if (orch && typeof orch === 'object') {
    result.orchestration = {
      ...base.orchestration,
      events: Array.isArray(orch.events) ? orch.events.filter((e) => e && typeof e === 'object' && 'payload' in e && 'id' in e) : [],
      suggestions: Array.isArray(orch.suggestions) ? orch.suggestions : [],
      snoozed: orch.snoozed && typeof orch.snoozed === 'object' ? orch.snoozed : {},
      lastSentAt: typeof orch.lastSentAt === 'string' ? orch.lastSentAt : null,
    }
  }
  result.lastActiveDate = typeof migrated.lastActiveDate === 'string' ? migrated.lastActiveDate : null
  result.focus = migrated.focus && typeof migrated.focus === 'object' && 'startedAt' in (migrated.focus as object) ? migrated.focus : null
  result.comeback = null

  return { ok: true, counts, data: result as unknown as DomainState, exportedAt: file.exportedAt }
}
