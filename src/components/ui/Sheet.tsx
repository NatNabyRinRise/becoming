import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  wide?: boolean
}

/** Bottom sheet on mobile, centered panel on larger screens. */
export function Sheet({ open, onClose, title, children, wide }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  // Parents pass inline onClose callbacks, so it changes on every parent render
  // (store sync, timers). Keep it in a ref so focus moves to the sheet only when it
  // opens, and never steals focus from a field the user is typing in.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#302b3d]/25 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
          <motion.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`glass-strong relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] outline-none sm:rounded-[2rem] ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
            style={{ background: 'rgba(247,243,237,0.92)' }}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[#302b3d]/15 sm:hidden" aria-hidden />
            <div className="mb-3 flex items-start justify-between gap-3">
              {title ? <h2 className="text-lg">{title}</h2> : <span />}
              <button className="btn-ghost -mr-2 -mt-1 rounded-full p-2" onClick={onClose} aria-label="ปิด">
                <X size={20} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
