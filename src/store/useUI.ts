import { create } from 'zustand'

/** Temporary interface state (not persisted). */
interface UIState {
  toast: { id: number; text: string; tone?: 'xp' | 'info' | 'warn' } | null
  rescueOpen: boolean
  opportunityOpen: boolean
  showToast: (text: string, tone?: 'xp' | 'info' | 'warn') => void
  clearToast: () => void
  setRescue: (v: boolean) => void
  setOpportunity: (v: boolean) => void
}

export const useUI = create<UIState>((set) => ({
  toast: null,
  rescueOpen: false,
  opportunityOpen: false,
  showToast: (text, tone = 'info') => set({ toast: { id: Date.now(), text, tone } }),
  clearToast: () => set({ toast: null }),
  setRescue: (v) => set({ rescueOpen: v }),
  setOpportunity: (v) => set({ opportunityOpen: v }),
}))
