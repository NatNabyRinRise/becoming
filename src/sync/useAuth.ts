import { create } from 'zustand'

export type AuthStatus = 'unconfigured' | 'loading' | 'signedOut' | 'signedIn'
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

export interface SyncConflict {
  remoteUpdatedAt: string
  remoteDevice: string | null
  /** first time this account is used on this device, and this device already has its own data */
  firstLogin: boolean
}

interface AuthState {
  status: AuthStatus
  user: { id: string; email: string | null } | null
  sync: SyncStatus
  lastSyncedAt: string | null
  error: string | null
  conflict: SyncConflict | null
  set: (p: Partial<Omit<AuthState, 'set'>>) => void
}

/** Session + sync status (not persisted; Supabase keeps the session itself). */
export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  sync: 'idle',
  lastSyncedAt: null,
  error: null,
  conflict: null,
  set: (p) => set(p),
}))
