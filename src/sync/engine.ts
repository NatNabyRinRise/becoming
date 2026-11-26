import type { SupabaseClient } from '@supabase/supabase-js'
import { useStore } from '../store/useStore'
import { DOMAIN_KEYS, pickDomain, type DomainState } from '../store/state'
import { validateData } from '../store/backup'
import { SCHEMA_VERSION } from '../data/seed'
import { useCore } from '../intelligence/useCore'
import { withoutObserving } from '../intelligence/observer'
import type { BehaviorEvent, CoreRecommendation, Memory } from '../intelligence/types'
import { deviceId, getSupabase } from './supabase'
import { useAuth } from './useAuth'

/**
 * Cloud sync.
 * - Life OS data (everything from v0.3) syncs as one snapshot per user (table user_state).
 *   LocalStorage stays the working copy, so the app works offline; changes are pushed when online.
 * - Intelligence Core syncs row by row (memories, recommendations, behavior_events) so future
 *   server-side agents can query them directly.
 */

const META_KEY = 'becoming-sync-meta'
interface SyncMeta {
  userId: string | null
  remoteUpdatedAt: string | null
  dirty: boolean
}

function readMeta(): SyncMeta {
  try {
    return { userId: null, remoteUpdatedAt: null, dirty: false, ...JSON.parse(localStorage.getItem(META_KEY) ?? '{}') }
  } catch {
    return { userId: null, remoteUpdatedAt: null, dirty: false }
  }
}
function writeMeta(p: Partial<SyncMeta>) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify({ ...readMeta(), ...p }))
  } catch {
    /* ignore */
  }
}

let applying = false
let running: Promise<void> | null = null
let pending = false

const msg = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e))

/** A device that has never been set up has nothing worth keeping. */
export function localIsFresh(s: DomainState = useStore.getState()): boolean {
  return s.profile.onboardingStatus === 'pending' && s.journal.length === 0 && s.transactions.length === 0 && Object.keys(s.checkIns).length === 0
}

function backupLocal() {
  try {
    localStorage.setItem(`becoming-data-before-sync-${Date.now()}`, JSON.stringify(pickDomain(useStore.getState())))
  } catch {
    /* storage full — nothing else we can do */
  }
}

function applyRemote(data: unknown, updatedAt: string, userId: string) {
  const v = validateData({ app: 'becoming', schemaVersion: SCHEMA_VERSION, data })
  if (!v.ok || !v.data) throw new Error(v.error ?? 'ข้อมูลบนคลาวด์อ่านไม่ได้')
  const cur = useStore.getState()
  const remote = v.data
  applying = true
  try {
    withoutObserving(() =>
      useStore.setState({
        ...remote,
        // a focus session running on this device stays here
        focus: cur.focus ?? remote.focus,
        comeback: cur.comeback,
        lastActiveDate: [cur.lastActiveDate, remote.lastActiveDate].filter(Boolean).sort().pop() ?? null,
      }),
    )
  } finally {
    applying = false
  }
  writeMeta({ userId, remoteUpdatedAt: updatedAt, dirty: false })
}

async function pushSnapshot(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb
    .from('user_state')
    .upsert({ user_id: userId, data: pickDomain(useStore.getState()), schema_version: SCHEMA_VERSION, device_id: deviceId(), updated_at: new Date().toISOString() })
    .select('updated_at')
    .single()
  if (error) throw error
  writeMeta({ userId, remoteUpdatedAt: data.updated_at as string, dirty: false })
}

// ---- Intelligence Core rows -------------------------------------------------
const memToRow = (m: Memory) => ({ id: m.id, kind: m.kind, content: m.content, source: m.source, agent_id: m.agentId, status: m.status, confidence: m.confidence, tags: m.tags, created_at: m.createdAt, updated_at: m.updatedAt, deleted_at: m.deletedAt })
const rowToMem = (r: Record<string, unknown>): Memory => ({ id: r.id as string, kind: r.kind as Memory['kind'], content: r.content as string, source: r.source as Memory['source'], agentId: (r.agent_id as Memory['agentId']) ?? null, status: r.status as Memory['status'], confidence: Number(r.confidence), tags: (r.tags as string[]) ?? [], createdAt: r.created_at as string, updatedAt: r.updated_at as string, deletedAt: (r.deleted_at as string) ?? null })
const recToRow = (r: CoreRecommendation) => ({ id: r.id, agent_id: r.agentId, signal_key: r.signalKey, title: r.title, body: r.body, rationale: r.rationale, status: r.status, outcome: r.outcome, created_at: r.createdAt, decided_at: r.decidedAt, evaluated_at: r.evaluatedAt, updated_at: r.updatedAt, deleted_at: r.deletedAt })
const rowToRec = (r: Record<string, unknown>): CoreRecommendation => ({ id: r.id as string, agentId: r.agent_id as CoreRecommendation['agentId'], signalKey: r.signal_key as string, title: r.title as string, body: r.body as string, rationale: (r.rationale as string) ?? '', status: r.status as CoreRecommendation['status'], outcome: (r.outcome as CoreRecommendation['outcome']) ?? null, createdAt: r.created_at as string, decidedAt: (r.decided_at as string) ?? null, evaluatedAt: (r.evaluated_at as string) ?? null, updatedAt: r.updated_at as string, deletedAt: (r.deleted_at as string) ?? null })
const evToRow = (e: BehaviorEvent) => ({ id: e.id, type: e.type, agent_id: e.agentId, payload: e.payload, occurred_at: e.occurredAt })
const rowToEv = (r: Record<string, unknown>): BehaviorEvent => ({ id: r.id as string, type: r.type as BehaviorEvent['type'], agentId: (r.agent_id as BehaviorEvent['agentId']) ?? null, payload: (r.payload as BehaviorEvent['payload']) ?? {}, occurredAt: r.occurred_at as string })

async function syncCore(sb: SupabaseClient) {
  const c = useCore.getState()
  const mems = c.memories.filter((m) => c.sync.dirtyMemories.includes(m.id))
  const recs = c.recommendations.filter((r) => c.sync.dirtyRecs.includes(r.id))
  const evs = c.events.filter((e) => c.sync.outbox.includes(e.id))
  if (mems.length) {
    const { error } = await sb.from('memories').upsert(mems.map(memToRow))
    if (error) throw error
  }
  if (recs.length) {
    const { error } = await sb.from('recommendations').upsert(recs.map(recToRow))
    if (error) throw error
  }
  for (let i = 0; i < evs.length; i += 500) {
    const { error } = await sb.from('behavior_events').upsert(evs.slice(i, i + 500).map(evToRow), { ignoreDuplicates: true })
    if (error) throw error
  }
  useCore.getState().markPushed({ memories: mems.map((m) => m.id), recs: recs.map((r) => r.id), events: evs.map((e) => e.id) })

  // pull, with 5 minutes of overlap to tolerate device clock differences (merge is idempotent)
  const since = c.sync.lastPulledAt ?? '1970-01-01T00:00:00Z'
  const startedAt = new Date(Date.now() - 5 * 60_000).toISOString()
  const [m, r, e] = await Promise.all([
    sb.from('memories').select('*').gte('updated_at', since).limit(2000),
    sb.from('recommendations').select('*').gte('updated_at', since).limit(2000),
    sb.from('behavior_events').select('*').gte('created_at', since).order('occurred_at', { ascending: false }).limit(1500),
  ])
  if (m.error) throw m.error
  if (r.error) throw r.error
  if (e.error) throw e.error
  useCore.getState().mergeRemote({ memories: (m.data ?? []).map(rowToMem), recommendations: (r.data ?? []).map(rowToRec), events: (e.data ?? []).map(rowToEv), pulledAt: startedAt })
}

// ---- main sync ----------------------------------------------------------------
async function doSync() {
  const sb = getSupabase()
  const { user, status } = useAuth.getState()
  if (!sb || status !== 'signedIn' || !user) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    useAuth.getState().set({ sync: 'offline' })
    return
  }
  useAuth.getState().set({ sync: 'syncing', error: null })
  try {
    const meta = readMeta()
    const firstLogin = meta.userId !== user.id
    if (firstLogin) useCore.getState().markAllDirty() // carry this device's memories/events into the account

    const { data: row, error } = await sb.from('user_state').select('updated_at, device_id, data').eq('user_id', user.id).maybeSingle()
    if (error) throw error

    if (!row) {
      // first device for this account → move existing local data to the cloud
      await pushSnapshot(sb, user.id)
    } else if (firstLogin) {
      if (localIsFresh()) applyRemote(row.data, row.updated_at, user.id)
      else {
        useAuth.getState().set({ conflict: { remoteUpdatedAt: row.updated_at, remoteDevice: row.device_id, firstLogin: true }, sync: 'idle' })
        return
      }
    } else {
      const remoteNewer = Date.parse(row.updated_at) > Date.parse(meta.remoteUpdatedAt ?? '1970-01-01')
      if (remoteNewer && meta.dirty && row.device_id !== deviceId()) {
        useAuth.getState().set({ conflict: { remoteUpdatedAt: row.updated_at, remoteDevice: row.device_id, firstLogin: false }, sync: 'idle' })
        return
      }
      if (remoteNewer && !meta.dirty) applyRemote(row.data, row.updated_at, user.id)
      else if (meta.dirty) await pushSnapshot(sb, user.id)
    }
    await syncCore(sb)
    useAuth.getState().set({ sync: 'synced', lastSyncedAt: new Date().toISOString() })
  } catch (e) {
    useAuth.getState().set({ sync: 'error', error: msg(e) })
  }
}

/** Runs one sync at a time; a request made while syncing runs once more afterwards. */
export function syncNow(): Promise<void> {
  if (running) {
    pending = true
    return running
  }
  running = doSync().finally(() => {
    running = null
    if (pending) {
      pending = false
      void syncNow()
    }
  })
  return running
}

/** Resolve a conflict. The side not chosen is kept as a local backup copy. */
export async function resolveConflict(choice: 'cloud' | 'device') {
  const sb = getSupabase()
  const { user } = useAuth.getState()
  if (!sb || !user) return
  useAuth.getState().set({ conflict: null, sync: 'syncing' })
  try {
    backupLocal()
    if (choice === 'cloud') {
      const { data, error } = await sb.from('user_state').select('updated_at, data').eq('user_id', user.id).single()
      if (error) throw error
      applyRemote(data.data, data.updated_at, user.id)
    } else {
      await pushSnapshot(sb, user.id)
    }
    await syncCore(sb)
    useAuth.getState().set({ sync: 'synced', lastSyncedAt: new Date().toISOString() })
  } catch (e) {
    useAuth.getState().set({ sync: 'error', error: msg(e) })
  }
}

let timer: ReturnType<typeof setTimeout> | null = null
const schedule = (ms = 2500) => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), ms)
}

/** Wire up auth + automatic sync. Call once at startup. Returns a cleanup function. */
export function startSync(): () => void {
  const sb = getSupabase()
  const auth = useAuth.getState()
  if (!sb) {
    auth.set({ status: 'unconfigured', user: null })
    return () => {}
  }
  const onSession = (u: { id: string; email?: string | null } | null | undefined) => {
    const was = useAuth.getState().user?.id
    if (u) {
      useAuth.getState().set({ status: 'signedIn', user: { id: u.id, email: u.email ?? null } })
      if (was !== u.id) void syncNow()
    } else useAuth.getState().set({ status: 'signedOut', user: null, sync: 'idle' })
  }
  void sb.auth.getSession().then(({ data }) => onSession(data.session?.user))
  const { data: sub } = sb.auth.onAuthStateChange((_e, session) => onSession(session?.user))

  const unStore = useStore.subscribe((next, prev) => {
    if (applying || !next.hydrated) return
    if (prev.hydrated && next !== prev && changedDomain(prev, next)) {
      writeMeta({ dirty: true })
      if (useAuth.getState().status === 'signedIn') schedule()
    }
  })
  const unCore = useCore.subscribe((next, prev) => {
    if (next.sync !== prev.sync && (next.sync.outbox.length || next.sync.dirtyMemories.length || next.sync.dirtyRecs.length) && useAuth.getState().status === 'signedIn') schedule(4000)
  })
  const onVisible = () => document.visibilityState === 'visible' && void syncNow()
  const onOnline = () => void syncNow()
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onOnline)
  const iv = setInterval(() => document.visibilityState === 'visible' && void syncNow(), 90_000)
  return () => {
    sub.subscription.unsubscribe()
    unStore()
    unCore()
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onOnline)
    clearInterval(iv)
  }
}

function changedDomain(a: DomainState, b: DomainState) {
  return DOMAIN_KEYS.some((k) => a[k] !== b[k])
}

// ---- auth actions ------------------------------------------------------------
const redirectTo = () => `${location.origin}${location.pathname}`

export async function signIn(email: string, password: string) {
  const sb = getSupabase()
  if (!sb) return 'ยังไม่ได้ตั้งค่า Supabase'
  const { error } = await sb.auth.signInWithPassword({ email, password })
  return error ? thaiAuthError(error.message) : null
}
export async function signUp(email: string, password: string) {
  const sb = getSupabase()
  if (!sb) return { error: 'ยังไม่ได้ตั้งค่า Supabase', needsConfirm: false }
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } })
  return { error: error ? thaiAuthError(error.message) : null, needsConfirm: !error && !data.session }
}
export async function sendMagicLink(email: string) {
  const sb = getSupabase()
  if (!sb) return 'ยังไม่ได้ตั้งค่า Supabase'
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } })
  return error ? thaiAuthError(error.message) : null
}
export async function signOut(clearDevice: boolean) {
  const sb = getSupabase()
  await syncNow().catch(() => {})
  await sb?.auth.signOut()
  if (clearDevice) {
    writeMeta({ userId: null, remoteUpdatedAt: null, dirty: false })
    applying = true
    try {
      withoutObserving(() => useStore.getState().resetAll())
      useCore.getState().resetCore()
    } finally {
      applying = false
    }
  }
}

function thaiAuthError(m: string): string {
  if (/invalid login credentials/i.test(m)) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
  if (/email not confirmed/i.test(m)) return 'ยังไม่ได้ยืนยันอีเมล ลองเปิดลิงก์ในอีเมลก่อน'
  if (/already registered|already exists/i.test(m)) return 'อีเมลนี้สมัครแล้ว ลองเข้าสู่ระบบแทน'
  if (/password/i.test(m) && /least|short|weak/i.test(m)) return 'รหัสผ่านสั้นหรือง่ายเกินไป (อย่างน้อย 6 ตัวอักษร)'
  if (/rate limit|too many/i.test(m)) return 'ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่'
  return m
}
