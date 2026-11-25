import { useStore } from '../store/useStore'
import { initialDomain } from '../store/state'

/** Reset the store to fresh seed data with a fixed clock. */
export function resetStore(nowIso = '2026-11-25T02:00:00.000Z') {
  let now = new Date(nowIso)
  localStorage.clear()
  useStore.setState({ ...initialDomain(now), now: () => now, storageError: null })
  return {
    setNow: (iso: string) => {
      now = new Date(iso)
      useStore.setState({ now: () => now })
    },
    advance: (sec: number) => {
      now = new Date(now.getTime() + sec * 1000)
      useStore.setState({ now: () => now })
    },
  }
}

export const S = () => useStore.getState()
