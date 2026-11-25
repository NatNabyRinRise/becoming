import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'

/** Re-renders on an interval and returns the store clock's current time. */
export function useNow(intervalMs = 30000): Date {
  const nowFn = useStore((s) => s.now)
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return nowFn()
}
