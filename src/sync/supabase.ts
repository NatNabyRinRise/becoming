import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase connection.
 * The URL and anon (publishable) key are safe to ship in the web bundle:
 * every table is protected by Row Level Security (see supabase/schema.sql).
 * NEVER put a service_role / secret key here.
 *
 * Order of precedence: build-time env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
 * → the project config below → values saved on this device (Account page).
 */
const RUNTIME_KEY = 'becoming-supabase-config'

export interface SupabaseConfig {
  url: string
  anonKey: string
}

/** Nat's BECOMING project. Public values: publishable key + RLS. */
const PROJECT_CONFIG: SupabaseConfig = {
  url: 'https://ddczmwjjecqobxnbcjqf.supabase.co',
  anonKey: 'sb_publishable_JvkqmgbJTc_rIWha859u_g_VFbkXIcx',
}

export function buildConfig(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (url?.trim() && anonKey?.trim()) return { url: url.trim(), anonKey: anonKey.trim() }
  // tests run without a project so they never touch the real database
  return import.meta.env.MODE === 'test' ? null : PROJECT_CONFIG
}

export function runtimeConfig(): SupabaseConfig | null {
  try {
    const raw = localStorage.getItem(RUNTIME_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as SupabaseConfig
    return c.url && c.anonKey ? c : null
  } catch {
    return null
  }
}

export function getConfig(): SupabaseConfig | null {
  return buildConfig() ?? runtimeConfig()
}

/** Rejects obviously wrong values, including a service_role key pasted by mistake. */
export function checkConfig(c: SupabaseConfig): string | null {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(c.url.trim()) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(c.url.trim()))
    return 'URL ควรมีหน้าตาแบบ https://xxxx.supabase.co'
  const key = c.anonKey.trim()
  if (key.startsWith('sb_secret_')) return 'นี่คือ secret key ห้ามใส่ในแอป ใช้ anon / publishable key แทน'
  if (key.split('.').length === 3) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (payload.role === 'service_role') return 'นี่คือ service_role key ห้ามใส่ในแอป ใช้ anon key แทน'
    } catch {
      return 'อ่าน key ไม่ได้'
    }
  } else if (!key.startsWith('sb_publishable_')) return 'key ควรขึ้นต้นด้วย eyJ... (anon) หรือ sb_publishable_...'
  return null
}

export function saveRuntimeConfig(c: SupabaseConfig | null) {
  try {
    if (c) localStorage.setItem(RUNTIME_KEY, JSON.stringify({ url: c.url.trim().replace(/\/$/, ''), anonKey: c.anonKey.trim() }))
    else localStorage.removeItem(RUNTIME_KEY)
  } catch {
    /* ignore */
  }
  client = null
}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (client) return client
  const c = getConfig()
  if (!c) return null
  client = createClient(c.url, c.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'becoming-auth' },
  })
  return client
}

/** A stable id for this browser, so we can tell which device wrote the cloud copy. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem('becoming-device-id')
    if (!id) {
      id = `dev_${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem('becoming-device-id', id)
    }
    return id
  } catch {
    return 'dev_unknown'
  }
}
