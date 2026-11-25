import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { useUI } from '../../store/useUI'

export function Toast() {
  const toast = useUI((s) => s.toast)
  const clear = useUI((s) => s.clearToast)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(clear, 3200)
    return () => clearTimeout(t)
  }, [toast, clear])
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="glass-strong pointer-events-auto rounded-full px-5 py-3 text-sm"
            style={{ background: toast.tone === 'xp' ? 'rgba(233,216,180,0.92)' : 'rgba(247,243,237,0.92)' }}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
