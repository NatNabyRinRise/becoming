import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetStore, S } from './helpers'
import { useStore } from '../store/useStore'
import { pickDomain } from '../store/state'
import { useCore, initialCore } from '../intelligence/useCore'
import { useAuth } from '../sync/useAuth'

/** Tiny in-memory stand-in for the Supabase client (only what the sync engine uses). */
type Row = Record<string, unknown>
const db: Record<string, Row[]> = {}
function table(name: string) {
  db[name] ??= []
  const rows = db[name]
  let filters: ((r: Row) => boolean)[] = []
  let result: () => { data: unknown; error: null } = () => ({ data: rows.filter((r) => filters.every((f) => f(r))), error: null })
  const b: Record<string, unknown> = {
    select: () => b,
    eq: (k: string, v: unknown) => ((filters = [...filters, (r) => r[k] === v]), b),
    gte: (k: string, v: string) => ((filters = [...filters, (r) => String(r[k] ?? '') >= v]), b),
    order: () => b,
    limit: () => b,
    maybeSingle: () => Promise.resolve({ data: rows.filter((r) => filters.every((f) => f(r)))[0] ?? null, error: null }),
    single: () => Promise.resolve({ data: result().data instanceof Array ? (result().data as Row[])[0] : result().data, error: null }),
    upsert: (input: Row | Row[]) => {
      const list = Array.isArray(input) ? input : [input]
      const key = name === 'user_state' ? 'user_id' : 'id'
      const now = new Date().toISOString()
      const written: Row[] = []
      for (const r of list) {
        const row: Row = { user_id: 'u1', created_at: now, ...r }
        const i = rows.findIndex((x) => x[key] === row[key])
        if (i >= 0) rows[i] = row
        else rows.push(row)
        written.push(row)
      }
      result = () => ({ data: written, error: null })
      return b
    },
    then: (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res),
  }
  return b
}
const fake = {
  from: (n: string) => table(n),
  auth: {
    getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1', email: 'a@b.c' } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: () => Promise.resolve({}),
  },
}
vi.mock('../sync/supabase', () => ({ getSupabase: () => fake, deviceId: () => 'dev_test', buildConfig: () => null, getConfig: () => null }))

const { syncNow, resolveConflict, localIsFresh, startSync } = await import('../sync/engine')

beforeEach(() => {
  resetStore()
  for (const k of Object.keys(db)) delete db[k]
  useCore.setState({ ...initialCore() })
  useStore.setState({ hydrated: true })
  useAuth.setState({ status: 'signedIn', user: { id: 'u1', email: 'a@b.c' }, conflict: null, sync: 'idle', error: null })
})

describe('Cloud sync', () => {
  it('first login with no cloud data moves this device’s data up (migration from v0.3)', async () => {
    S().completeOnboarding({ name: 'Nat', prefs: {} })
    useCore.getState().addMemory({ content: 'ลูกตื่น 6 โมง' })
    await syncNow()
    expect(useAuth.getState().error).toBeNull()
    expect((db.user_state[0].data as { profile: { name: string } }).profile.name).toBe('Nat')
    expect(db.memories).toHaveLength(1)
    expect(useCore.getState().sync.dirtyMemories).toEqual([])
  })

  it('a fresh device signing in takes the cloud data without asking', async () => {
    const other = pickDomain(S())
    other.profile = { ...other.profile, name: 'จากเครื่องอื่น', onboardingStatus: 'done' }
    db.user_state = [{ user_id: 'u1', data: other, updated_at: '2026-11-25T01:00:00.000Z', device_id: 'dev_phone' }]
    expect(localIsFresh()).toBe(true)
    await syncNow()
    expect(useAuth.getState().conflict).toBeNull()
    expect(S().profile.name).toBe('จากเครื่องอื่น')
  })

  it('a device with its own data asks which copy to keep, and either choice works', async () => {
    S().completeOnboarding({ name: 'เครื่องนี้', prefs: {} })
    const other = pickDomain(S())
    other.profile = { ...other.profile, name: 'คลาวด์' }
    db.user_state = [{ user_id: 'u1', data: other, updated_at: '2026-11-25T01:00:00.000Z', device_id: 'dev_phone' }]
    await syncNow()
    expect(useAuth.getState().conflict?.firstLogin).toBe(true)
    expect(S().profile.name).toBe('เครื่องนี้')
    await resolveConflict('cloud')
    expect(S().profile.name).toBe('คลาวด์')
    const stop = startSync() // watches local edits and marks them for upload
    S().updateProfile({ name: 'แก้ใหม่' })
    await syncNow()
    stop()
    expect((db.user_state[0].data as { profile: { name: string } }).profile.name).toBe('แก้ใหม่')
  })
})
