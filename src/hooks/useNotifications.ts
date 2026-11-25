import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { useFollowUps } from './useToday'

/**
 * Optional browser notifications for the most important follow-up.
 * Only fires while the app is open, with explicit permission, outside quiet hours
 * (useFollowUps already returns nothing in quiet hours), and at most once per item per day.
 */
export function useNotifications() {
  const follow = useFollowUps()
  const enabled = useStore((s) => s.settings.notificationPreferences.browser)
  const freq = useStore((s) => s.profile.preferences.reminderFrequency)
  const notified = useStore((s) => s.followUp.notified)
  const mark = useStore((s) => s.markNotified)
  const today = useStore((s) => s.today)
  useEffect(() => {
    if (!enabled || freq === 'off' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (document.visibilityState === 'visible') return // in-app UI already shows it
    const top = follow[0]
    if (!top || notified[top.key] === today()) return
    try {
      new Notification('BECOMING', { body: top.message, icon: './icon-192.png', tag: top.key })
      mark(top.key)
    } catch {
      /* some mobile browsers only allow notifications from a service worker */
    }
  }, [follow, enabled, freq, notified, mark, today])
}
